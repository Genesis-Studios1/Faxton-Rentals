// "Download my data": gathers the signed-in person's OWN data from Firestore and packs it into one ZIP in the browser.
// Nothing is sent anywhere: the queries below are the ones firestore.rules already lets the person run for themselves, the ZIP is built here,
// and the only thing written back is a small record in `dataRequests` (who and when, never the data) so staff can see the request was served.
//
// The export is behind a "Confirm it's you" check (re-authentication). This file holds the rules of that check, so they cannot be skipped by the UI:
//   - a verification is granted only after a Firebase re-authentication promise resolved (grantNow), is valid for 10 minutes and for one export;
//   - 5 failed attempts lock the check for 15 minutes; at most 3 exports per hour (counted in this browser).
// The dialog that drives all this is in mydata-ui.js.
import { auth, db, sendSignInLinkToEmail, isSignInWithEmailLink, EmailAuthProvider, reauthenticateWithCredential } from "./firebase.js";
import { collection, doc, getDoc, getDocs, addDoc, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { BUILD } from "./ui.js";
import { getListings } from "./store.js";

// ------------------------------------------------------------------ limits + storage helpers
export const LIMITS = { grantMs: 10 * 60 * 1000, maxFails: 5, lockMs: 15 * 60 * 1000, exportsPerHour: 3, resendMs: 60 * 1000 };
const lsGet = (k) => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } };
const lsSet = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const K = { lock: (u) => "fx_dm_lock_" + u, exp: (u) => "fx_dm_exp_" + u, last: (u) => "fx_dm_last_" + u, pending: "fx_dm_pending", grant: "fx_dm_grant" };
const err = (code, message) => Object.assign(new Error(message || code), { code });

// A sentence the dialog can show for the codes this file throws. Raw Firebase errors never reach the person.
export const MESSAGES = {
  "dm/locked": "Too many wrong attempts. For your safety this is paused for a while.",
  "dm/rate-limit": "You have downloaded your data 3 times in the last hour. Please try again later.",
  "dm/not-verified": "Please confirm it's you first.",
  "dm/expired": "Your confirmation has run out (it lasts 10 minutes). Please confirm again.",
  "dm/other-device": "That link was not requested from this device. Ask for a new one here and open it on this device.",
  "dm/no-email": "This account has no email address, so we can't email a link. Use the other option.",
  "auth/wrong-password": "That password isn't right.", "auth/invalid-credential": "That password isn't right.",
  "auth/invalid-action-code": "That link has already been used or isn't valid. Ask for a new one.", "auth/expired-action-code": "That link has expired. Ask for a new one.",
  "auth/too-many-requests": "Too many tries. Wait a few minutes and try again.", "auth/network-request-failed": "Can't reach the server. Check your connection and try again.",
  "auth/popup-closed-by-user": "The Google window was closed before it finished.", "auth/cancelled-popup-request": "The Google window was closed before it finished.",
  "auth/popup-blocked": "Your browser blocked the Google window. Allow pop-ups for this site and try again.", "auth/user-mismatch": "That is a different account from the one you are signed in with.",
  "auth/requires-recent-login": "Please try again.", "auth/operation-not-allowed": "That way of confirming isn't available right now.",
};
export const friendly = (e) => MESSAGES[e?.code] || (/^google\//.test(e?.code || "") ? "Google did not confirm it. Try again, or use another option." : "That didn't work. Please try again.");

// ------------------------------------------------------------------ failed attempts, lockout, hourly cap
export function lockState(uid) {
  const s = lsGet(K.lock(uid)) || {}, now = Date.now();
  if (s.until && s.until > now) return { locked: true, until: s.until, fails: s.fails || 0, left: 0 };
  if (s.until && s.until <= now) { lsSet(K.lock(uid), null); return { locked: false, fails: 0, left: LIMITS.maxFails }; }
  return { locked: false, fails: s.fails || 0, left: LIMITS.maxFails - (s.fails || 0) };
}
export function noteFail(uid) {
  const s = lockState(uid); if (s.locked) return s;
  const fails = s.fails + 1;
  if (fails >= LIMITS.maxFails) { lsSet(K.lock(uid), { fails, until: Date.now() + LIMITS.lockMs }); return lockState(uid); }
  lsSet(K.lock(uid), { fails }); return lockState(uid);
}
const clearFails = (uid) => lsSet(K.lock(uid), null);
const recentExports = (uid) => (lsGet(K.exp(uid)) || []).filter((t) => Date.now() - t < 3600000);
export const exportsLeft = (uid) => Math.max(0, LIMITS.exportsPerHour - recentExports(uid).length);
export const lastDownload = (uid) => lsGet(K.last(uid));
const noteExport = (uid) => { lsSet(K.exp(uid), [...recentExports(uid), Date.now()]); lsSet(K.last(uid), Date.now()); };

// ------------------------------------------------------------------ the verification grant
let grant = null; // { uid, at, authTime }  kept in memory; mirrored to sessionStorage so a page reload inside the 10 minutes keeps it
const readGrant = () => { if (grant) return grant; try { const g = JSON.parse(sessionStorage.getItem(K.grant) || "null"); if (g && typeof g.at === "number") grant = g; } catch {} return grant; };
const dropGrant = () => { grant = null; try { sessionStorage.removeItem(K.grant); } catch {} };
// Only called from the three re-authentication helpers below, right after Firebase accepted the proof.
async function grantNow(user, via = 0) {
  let authTime = 0;
  try { if (user.getIdTokenResult) authTime = Date.parse((await user.getIdTokenResult(true)).authTime) || 0; } catch {}
  // Firebase signs the moment of the last real sign-in into the token. If it is older than the window, the re-authentication did not really happen.
  if (authTime && Date.now() - authTime > LIMITS.grantMs) throw err("dm/not-verified");
  grant = { uid: user.uid, at: Date.now(), authTime, via };
  try { sessionStorage.setItem(K.grant, JSON.stringify(grant)); } catch {}
  clearFails(user.uid);
}
// True while this person's verification is fresh (and has not been used yet).
export async function isVerified(user) {
  const g = readGrant();
  if (!g || !user || g.uid !== user.uid) return false;
  if (Date.now() - g.at > LIMITS.grantMs || g.at > Date.now() + 5000) { dropGrant(); return false; }
  try { if (user.getIdTokenResult && g.authTime) { const t = Date.parse((await user.getIdTokenResult()).authTime) || 0; if (t < g.authTime) { dropGrant(); return false; } } } catch {}
  return true;
}
export const verifiedUntil = () => { const g = readGrant(); return g ? g.at + LIMITS.grantMs : 0; };

// ------------------------------------------------------------------ the ways of confirming
export const maskEmail = (e) => { const [a = "", d = ""] = String(e || "").split("@"); return d ? a.slice(0, 1) + "***@" + d : "your email"; };
export const providers = (user) => ({ password: !!user?.providerData?.some((p) => p.providerId === "password"), google: !!user?.providerData?.some((p) => p.providerId === "google.com") });
const guardAttempt = (user) => { if (lockState(user.uid).locked) throw err("dm/locked"); };
const credentialFail = (user, e) => { if (["auth/wrong-password", "auth/invalid-credential", "auth/invalid-action-code", "auth/expired-action-code", "auth/user-mismatch"].includes(e?.code)) noteFail(user.uid); throw e; };

export async function verifyWithPassword(user, password) {
  guardAttempt(user);
  if (!user.email) throw err("dm/no-email");
  try { await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, String(password || ""))); } catch (e) { credentialFail(user, e); }
  await grantNow(user);
}
// `reauthGoogle(user)` is supplied by the app (main.js): the native Google plugin inside the Android / iPhone app, a pop-up on the web.
export async function verifyWithGoogle(user, reauthGoogle) {
  guardAttempt(user);
  try { await reauthGoogle(user); } catch (e) { credentialFail(user, e); }
  await grantNow(user);
}
export const pending = () => lsGet(K.pending);
export const clearPending = () => lsSet(K.pending, null);
export const resendWaitMs = () => { const p = pending(); return p?.sentAt ? Math.max(0, p.sentAt + LIMITS.resendMs - Date.now()) : 0; };
export async function sendLink(user) {
  guardAttempt(user);
  if (!user.email) throw err("dm/no-email");
  if (resendWaitMs() > 0) throw err("dm/wait");
  // The link brings the person back to the Account settings page, which finishes the check (resumeFromLink below).
  await sendSignInLinkToEmail(auth, user.email, { url: location.origin + "/#/settings/account?confirm=data", handleCodeInApp: true });
  lsSet(K.pending, { uid: user.uid, email: user.email, sentAt: Date.now(), done: false });
}
export const hasLink = (href = location.href) => { try { return !!isSignInWithEmailLink(auth, href); } catch { return false; } };
// Finishes the email-link check when the person lands back here through the link.
export async function resumeFromLink(user, href = location.href) {
  guardAttempt(user);
  const p = pending();
  if (!p || p.uid !== user.uid || String(p.email).toLowerCase() !== String(user.email || "").toLowerCase()) throw err("dm/other-device");
  try { await reauthenticateWithCredential(user, EmailAuthProvider.credentialWithLink(p.email, href)); } catch (e) { credentialFail(user, e); }
  const doneAt = Date.now();
  await grantNow(user, doneAt);
  lsSet(K.pending, { ...p, done: true, doneAt });
}
// Tab B opened the link and finished the check. Tab A (where the dialog is open) calls this to pick that up; it only counts if Firebase's own
// token shows a sign-in in the last 10 minutes, so a copied localStorage entry is not enough.
export async function adoptOtherTab(user) {
  const p = pending(); if (!p?.done || p.consumed || p.uid !== user.uid || Date.now() - (p.doneAt || 0) > LIMITS.grantMs) return false;
  try { await user.reload?.(); } catch {}
  let authTime = 0; try { if (user.getIdTokenResult) authTime = Date.parse((await user.getIdTokenResult(true)).authTime) || 0; else return false; } catch { return false; }
  if (!authTime || Date.now() - authTime > LIMITS.grantMs) return false;
  grant = { uid: user.uid, at: Date.now(), authTime, via: p.doneAt }; try { sessionStorage.setItem(K.grant, JSON.stringify(grant)); } catch {}
  return true;
}

// ------------------------------------------------------------------ gathering
const toIso = (v) => { const ms = v?.seconds != null ? v.seconds * 1000 : v?.toMillis ? v.toMillis() : typeof v?.toDate === "function" ? +v.toDate() : null; return ms == null || !isFinite(ms) ? null : new Date(ms).toISOString(); };
const isStamp = (v) => v && typeof v === "object" && (v.seconds != null || typeof v.toMillis === "function" || typeof v.toDate === "function") && Object.keys(v).length <= 3;
// Fields that only staff, or other people, should see: dropped wherever they appear.
const DENY = /^(ownerUid|agentUid|byStaff|staffUnread|assignee|banned|bannedAt|reviewedBy|decidedBy|repliedBy|updatedBy|typing|internal\w*|admin\w*|staff\w*|flag\w*)$/i;
const DATA_URL = /^data:([^;,]*)[^,]*,/i;
const EXT = { "image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "application/pdf": "pdf", "audio/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "m4a", "audio/mpeg": "mp3", "audio/wav": "wav", "text/plain": "txt" };
function dataUrlBytes(s) {
  const i = s.indexOf(","), meta = s.slice(5, i), body = s.slice(i + 1), mime = (meta.split(";")[0] || "application/octet-stream").toLowerCase();
  if (/;base64/i.test(meta)) { const b = atob(body.replace(/\s/g, "")), u = new Uint8Array(b.length); for (let k = 0; k < b.length; k++) u[k] = b.charCodeAt(k); return { mime, bytes: u }; }
  return { mime, bytes: new TextEncoder().encode(decodeURIComponent(body)) };
}
const safeName = (s) => String(s).replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "file";

class Packer {
  constructor(uid) { this.uid = uid; this.files = []; this.omitted = 0; }
  // One value, cleaned: timestamps become ISO text, staff-only fields go, large images/audio are either kept as files or replaced by a note.
  clean(v, o, depth = 0) {
    if (v == null) return v;
    if (typeof v === "string") {
      const m = DATA_URL.exec(v);
      if (m && v.length > 1500) {
        const { mime, bytes } = dataUrlBytes(v);
        if (o.keep) { const name = `files/${safeName(o.tag)}.${EXT[mime] || "bin"}`; this.files.push({ name, data: bytes }); return { file: name, type: mime, bytes: bytes.length }; }
        this.omitted++; return { omitted: o.why || "image kept out of this file", type: mime, bytes: bytes.length };
      }
      return v;
    }
    if (typeof v !== "object") return v;
    if (isStamp(v)) return toIso(v);
    if (depth > 6) return null;
    if (Array.isArray(v)) return v.map((x, i) => this.clean(x, { ...o, keep: false, tag: o.tag + "-" + i }, depth + 1));
    const out = {};
    for (const [k, x] of Object.entries(v)) {
      if (DENY.test(k) || (o.drop && o.drop.includes(k))) continue;
      if (depth > 0 && k === "uid" && x !== this.uid) continue; // another person's id inside a history list
      out[k] = this.clean(x, { ...o, keep: !!(depth === 0 && o.keepKeys?.includes(k)), tag: o.tag + "-" + k }, depth + 1);
    }
    return out;
  }
}
const byDate = (a, b) => String(b.createdAt || b.at || "").localeCompare(String(a.createdAt || a.at || ""));
const rowsOf = (s) => s.docs.map((d) => ({ ...d.data(), id: d.id }));

// Collections read with `where(field, op, uid)`: exactly the questions the rules answer "yes" to for the person themself.
const OWN = [
  ["viewings", "uid", "==", "viewings", {}],
  ["applications", "uid", "==", "applications", {}],
  ["offers", "uid", "==", "offers", {}],
  ["tenancies", "uid", "==", "tenancies", {}],
  ["records", "uid", "==", "rentRecords", {}],
  ["maintenance", "uid", "==", "maintenanceRequests", { keepKeys: ["photo"] }],
  ["notices", "tenants", "array-contains", "propertyNotices", {}],
  ["paymentProofs", "uid", "==", "paymentProofs", { receipt: true }],
  ["serviceRequests", "uid", "==", "serviceRequests", {}],
  ["tickets", "uid", "==", "supportTickets", { drop: ["priority"], tickets: true }],
  ["feedback", "uid", "==", "feedback", {}],
  ["notifications", "uid", "==", "notifications", { drop: ["ref"] }],
  ["documents", "uid", "==", "documents", { keepKeys: ["data"] }],
];

export async function gather(user, profile, onStep = () => {}) {
  const uid = user.uid, P = new Packer(uid), skipped = [], out = {}, counts = {};
  const step = (t) => { try { onStep(t); } catch {} };
  const mine = (v, tag, extra = {}) => P.clean(v, { tag, why: "picture from the home listing, not something you uploaded", ...extra });

  // 1. the profile (a failed read here means we cannot reach the server at all)
  step("your profile");
  const me = await getDoc(doc(db, "users", uid));
  if (!me.exists()) throw err("dm/no-profile", "profile missing");
  const u = me.data();
  out.profile = mine({ ...u, signInEmail: user.email || null, signInMethods: (user.providerData || []).map((p) => (p.providerId === "google.com" ? "Google" : "Email and password")) }, "profile", { keepKeys: ["photo"], drop: ["saved"] });
  try { const pp = await getDoc(doc(db, "profiles", uid)); out.publicProfile = pp.exists() ? mine(pp.data(), "public-profile", { keepKeys: ["photo"] }) : null; } catch { skipped.push("public profile"); }

  // 2. saved homes: the ids from the profile, with a title when the home is still listed
  step("saved homes");
  const ids = Array.isArray(u.saved) ? u.saved : [];
  let listed = []; try { listed = await getListings(); } catch {}
  out.savedHomes = ids.map((id) => { const l = listed.find((x) => x.id === id); return l ? { id, title: l.title, area: l.area, city: l.city || null } : { id }; });

  // 3. everything the person created or that is addressed to them
  const jobs = OWN.map(async ([col, field, op, key, o]) => {
    try {
      const rows = rowsOf(await getDocs(query(collection(db, col), where(field, op, uid))));
      out[key] = rows.map((r) => {
        let x = r;
        if (o.tickets) x = { ...r, replies: (r.replies || []).filter((q) => !q.internal).map((q) => ({ from: "Faxton support", text: q.text, at: q.at })) };
        if (o.receipt) { const p = r.proof; x = { ...r, proof: undefined, receiptPicture: p ? { omitted: "receipt picture is not part of this file; ask us if you need it", fileName: r.proofName || null, bytes: typeof p === "string" ? p.length : null } : null }; }
        return mine(x, `${key}-${r.id}`, o);
      }).sort(byDate);
    } catch { out[key] = []; skipped.push(key); }
  });
  step("your activity"); await Promise.all(jobs);

  // 4. calls the person took part in
  step("calls");
  try {
    out.calls = rowsOf(await getDocs(query(collection(db, "calls"), where("members", "array-contains", uid)))).map((c) => {
      const out1 = c.callerUid === uid;
      return mine({ id: c.id, kind: c.kind, title: c.title, status: c.status, direction: out1 ? "you called" : "called you", otherPerson: out1 ? c.calleeName : c.callerName, createdAt: c.createdAt, answeredAt: c.answeredAt, endedAt: c.endedAt, durationSeconds: c.duration, recorded: !!c.recorded }, "call-" + c.id);
    }).sort(byDate);
  } catch { out.calls = []; skipped.push("calls"); }

  // 5. chats: only conversations that are the person's own, their messages and the other side's text, with just the other side's display name
  step("messages");
  out.conversations = [];
  try {
    const convs = rowsOf(await getDocs(query(collection(db, "conversations"), where("uid", "==", uid))));
    for (const c of convs) {
      const other = c.agent?.name || c.listingTitle || "Faxton team";
      let msgs = []; try { msgs = rowsOf(await getDocs(collection(db, "conversations", c.id, "messages"))); } catch { skipped.push("messages in " + c.id); }
      msgs.sort((a, b) => (toIso(a.at) || "").localeCompare(toIso(b.at) || ""));
      out.conversations.push({
        id: c.id, with: other, about: c.listingId === "direct" ? null : c.listingTitle || null, area: c.area || null, startedAt: toIso(c.createdAt), lastMessageAt: toIso(c.lastAt),
        messages: msgs.map((m) => {
          const mine1 = m.from === uid, tag = `chat-${c.id}-${m.id}`;
          const media = (key) => (m[key] ? P.clean(m[key], { tag: tag + "-" + key, keep: mine1, why: "sent to you by someone else, kept out of this file" }) : undefined);
          return { at: toIso(m.at), from: mine1 ? "you" : other, text: m.text || "", image: media("image"), audio: media("audio"), file: media("file"), fileName: m.fname || undefined, replyTo: m.reply?.text || undefined, yourReaction: m.reactions?.[uid] || undefined };
        }),
      });
    }
    out.conversations.sort((a, b) => String(b.lastMessageAt).localeCompare(String(a.lastMessageAt)));
  } catch { skipped.push("conversations"); }

  for (const [k, v] of Object.entries(out)) counts[k] = Array.isArray(v) ? v.length : v ? 1 : 0;
  return { data: out, files: P.files, counts, omitted: P.omitted, skipped };
}

// ------------------------------------------------------------------ the files inside the ZIP
const README = (name, when, counts, skipped) => `FAXTON RENTALS: A COPY OF YOUR DATA
==================================
Prepared for: ${name}
Prepared on:  ${when}   (app version ${BUILD})

This is the personal data Faxton Rentals holds about you, gathered on your own device after you confirmed it was you. Nothing in this
file was sent to anyone. Only a note that you downloaded it (your name, role and the time, with none of the contents) was saved so our
team can see the request was served.

WHAT IS INSIDE
  README.txt     this page
  summary.html   a readable version: open it in any web browser
  my-data.json   the same information in a machine-readable form (you can give it to another service)
  files/         pictures, documents and voice notes that you uploaded or sent

WHAT IS COVERED
  Your profile and the public profile others see; the homes you saved; your viewing requests, applications and offers; your tenancy and
  My Home records (rent records, maintenance requests, notices to you); the details of payment confirmations you submitted (amount,
  reference, date and status; receipt pictures are not copied here); home service requests; support tickets and feedback you sent
  (with our replies); notifications sent to you; calls you took part in; and your chat messages, with only the other person's display name.

WHAT IS LEFT OUT ON PURPOSE
  Anything that belongs to someone else: other people's phone numbers, emails, pictures or messages in conversations you were part of
  (only their display name appears). Internal notes and flags kept by our team, and security and audit records. Listings you publish
  as an owner or agent, and records that other people created about their own homes, are not part of a personal copy.
  Pictures that came from home listings are shown as a note with a size rather than copied.
${skipped.length ? `\nNOT READ THIS TIME (could not be loaded; try again later): ${skipped.join(", ")}\n` : ""}
COUNTS
${Object.entries(counts).map(([k, v]) => `  ${k.padEnd(20)} ${v}`).join("\n")}

Dates are in UTC (ISO 8601). To ask us to correct or delete anything, use Settings > Account and security in the app, or contact us.
`;

const hesc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const nice = (k) => String(k).replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").replace(/^./, (c) => c.toUpperCase());
function val(v) {
  if (v == null || v === "") return "<span class=n>none</span>";
  if (typeof v === "object" && !Array.isArray(v)) {
    if (v.file) return `<a href="${hesc(v.file)}">${hesc(v.file.split("/").pop())}</a> <span class=n>(${Math.round(v.bytes / 1024)} KB)</span>`;
    if (v.omitted) return `<span class=n>${hesc(v.omitted)} (${Math.round((v.bytes || 0) / 1024)} KB)</span>`;
    return `<dl>${Object.entries(v).map(([k, x]) => `<dt>${hesc(nice(k))}</dt><dd>${val(x)}</dd>`).join("")}</dl>`;
  }
  if (Array.isArray(v)) return v.length ? `<ol>${v.map((x) => `<li>${val(x)}</li>`).join("")}</ol>` : "<span class=n>none</span>";
  if (typeof v === "string" && /^\d{4}-\d\d-\d\dT[\d:.]+Z$/.test(v)) return hesc(new Date(v).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }));
  return hesc(v);
}
const TITLES = { profile: "Your profile", publicProfile: "Your public profile", savedHomes: "Saved homes", viewings: "Viewing requests", applications: "Applications", offers: "Offers you made", tenancies: "Tenancy", rentRecords: "Rent and charges", maintenanceRequests: "Maintenance requests", propertyNotices: "Notices to you", paymentProofs: "Payment confirmations", serviceRequests: "Home service requests", supportTickets: "Support tickets", feedback: "Feedback you sent", notifications: "Notifications", documents: "Your documents", calls: "Calls", conversations: "Chats" };
function summaryHtml(name, when, data) {
  const sec = Object.entries(TITLES).map(([k, t]) => {
    const v = data[k], n = Array.isArray(v) ? v.length : v ? 1 : 0;
    const body = Array.isArray(v) ? v.map((x) => `<article>${val(x)}</article>`).join("") : v ? `<article>${val(v)}</article>` : "";
    return `<section><h2>${hesc(t)} <small>${n}</small></h2>${n ? body : "<p class=n>Nothing here.</p>"}</section>`;
  }).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>My Faxton data</title><style>
:root{color-scheme:light dark;--bg:#fff;--fg:#14211b;--mut:#5c6b63;--card:#f4f7f5;--line:#dbe4df}@media(prefers-color-scheme:dark){:root{--bg:#0f1713;--fg:#e8efeb;--mut:#9aaba2;--card:#17211c;--line:#2a3a32}}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,sans-serif}main{max-width:820px;margin:0 auto;padding:24px 16px 60px}h1{font-size:24px;margin:0 0 4px}h2{font-size:18px;margin:28px 0 10px}h2 small{color:var(--mut);font-weight:400;margin-left:6px}
article{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin:0 0 10px;overflow-wrap:anywhere}dl{margin:0;display:grid;grid-template-columns:minmax(110px,30%) 1fr;gap:4px 12px}dt{color:var(--mut)}dd{margin:0}ol{margin:0;padding-left:20px}.n{color:var(--mut)}a{color:inherit}
@media(max-width:520px){dl{grid-template-columns:1fr}}</style></head><body><main><h1>Your Faxton Rentals data</h1><p class=n>${hesc(name)} · prepared ${hesc(when)}. This page is made on your device and sent nowhere.</p>${sec}</main></body></html>`;
}

// ------------------------------------------------------------------ a small ZIP writer (store only, no compression, no library)
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
export const crc32 = (u8) => { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
export function makeZip(files, when = new Date()) {
  const enc = new TextEncoder(), parts = [], central = [];
  const dt = (when.getHours() << 11) | (when.getMinutes() << 5) | (when.getSeconds() >> 1), dd = ((when.getFullYear() - 1980) << 9) | ((when.getMonth() + 1) << 5) | when.getDate();
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name), data = f.data instanceof Uint8Array ? f.data : enc.encode(String(f.data)), crc = crc32(data);
    const l = new DataView(new ArrayBuffer(30));
    l.setUint32(0, 0x04034b50, true); l.setUint16(4, 20, true); l.setUint16(6, 0x0800, true); l.setUint16(8, 0, true); l.setUint16(10, dt, true); l.setUint16(12, dd, true);
    l.setUint32(14, crc, true); l.setUint32(18, data.length, true); l.setUint32(22, data.length, true); l.setUint16(26, name.length, true); l.setUint16(28, 0, true);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true); c.setUint16(12, dt, true); c.setUint16(14, dd, true);
    c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true); c.setUint32(42, offset, true);
    parts.push(new Uint8Array(l.buffer), name, data); central.push(new Uint8Array(c.buffer), name);
    offset += 30 + name.length + data.length;
  }
  const size = central.reduce((n, p) => n + p.length, 0), e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, size, true); e.setUint32(16, offset, true);
  return new Blob([...parts, ...central, new Uint8Array(e.buffer)], { type: "application/zip" });
}

const day = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const fileNameFor = (d = new Date()) => `faxton-my-data-${day(d)}.zip`;

// ------------------------------------------------------------------ the export itself
// Refuses unless the person has just confirmed it is them. The verification is spent when the file is built (one export per confirmation).
export async function buildExport(user, profile, onStep) {
  if (!user) throw err("dm/not-verified");
  if (lockState(user.uid).locked) throw err("dm/locked");
  if (!(await isVerified(user))) throw err(readGrant() ? "dm/expired" : "dm/not-verified");
  if (exportsLeft(user.uid) <= 0) throw err("dm/rate-limit");
  // One email-link confirmation allows one export, even if the link was opened in a second tab.
  const g = readGrant(), pl = pending();
  if (g?.via) { if (pl?.consumed === g.via) { dropGrant(); throw err("dm/expired"); } lsSet(K.pending, { ...pl, consumed: g.via }); }
  const now = new Date(), name = profile?.name || user.displayName || user.email || "you";
  const when = now.toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short" });
  const { data, files, counts, omitted, skipped } = await gather(user, profile, onStep);
  onStep?.("your file");
  const json = JSON.stringify({ about: { app: "Faxton Rentals", preparedAt: now.toISOString(), build: BUILD, account: { uid: user.uid, email: user.email || null }, omittedPictures: omitted, notRead: skipped }, ...data }, null, 2);
  const zip = makeZip([
    { name: "README.txt", data: README(name, when, counts, skipped) }, { name: "summary.html", data: summaryHtml(name, when, data) }, { name: "my-data.json", data: json }, ...files,
  ], now);
  dropGrant(); // single use
  const filename = fileNameFor(now);
  return { blob: zip, filename, file: typeof File === "function" ? new File([zip], filename, { type: "application/zip" }) : null, counts, skipped, size: zip.size };
}

// Saves the file. A normal browser downloads it through an anchor. Inside the Android / iPhone app the WebView often ignores that,
// so the share sheet comes first there (and is the fallback anywhere the download is blocked).
const inApp = () => { const ua = navigator.userAgent; return /FaxtonApp\/mobile/.test(ua) || window.Capacitor?.isNativePlatform?.() === true || /; wv\)/.test(ua); };
export const canShareFile = (file) => { try { return !!(file && navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share); } catch { return false; } };
export async function deliver(res, { preferShare = false } = {}) {
  const share = async () => { await navigator.share({ files: [res.file], title: "My Faxton Rentals data" }); return "shared"; };
  if ((preferShare || inApp()) && canShareFile(res.file)) { try { return await share(); } catch (e) { if (e?.name === "AbortError") return "cancelled"; } }
  try {
    const url = URL.createObjectURL(res.blob), a = document.createElement("a");
    a.href = url; a.download = res.filename; a.rel = "noopener"; a.style.display = "none"; document.body.append(a); a.click();
    setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 60000);
    return "downloaded";
  } catch {
    if (canShareFile(res.file)) { try { return await share(); } catch (e) { if (e?.name === "AbortError") return "cancelled"; } }
    return "failed";
  }
}

// After a file was handed over: remember it on this device and leave a small note for staff (no data in it).
export async function recordExport(user, profile) {
  noteExport(user.uid);
  try {
    await addDoc(collection(db, "dataRequests"), { uid: user.uid, name: String(profile?.name || user.displayName || user.email || "").slice(0, 120), role: String(profile?.role || "renter").slice(0, 20), status: "verified-downloaded", at: serverTimestamp() });
    return true;
  } catch { return false; }
}
