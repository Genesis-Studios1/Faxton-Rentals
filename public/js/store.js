import { db } from "./firebase.js";
import { moveIn as costOf } from "./area.js";
import { collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, query, where, orderBy, limit, onSnapshot, serverTimestamp, arrayUnion, arrayRemove, writeBatch, deleteDoc, deleteField }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

let cache = null;
// Fill any missing fields so a partial or older Firestore listing can never break a page.
const norm = (l) => { const o = { ...l }; o.agent = { ...(l.agent || {}) }; if (!o.agent.name) o.agent.name = "Faxton agent"; if (!o.agent.avatar) o.agent.avatar = "img/av-daniel.webp"; if (!o.agent.photo) o.agent.photo = o.agent.avatar; o.images = o.images?.length ? o.images : [o.thumb || "img/palm-court.webp"]; o.thumb = o.thumb || o.images[0]; o.amenities = o.amenities || []; o.desc = o.desc || ""; o.area = o.area || ""; o.city = o.city || ""; o.beds = o.beds ?? 1; o.baths = o.baths ?? 1; o.price = o.price || 0; o.videos = (Array.isArray(o.videos) ? o.videos : []).filter((u) => typeof u === "string" && /^https:\/\//.test(u)).slice(0, 6); return o; };

// ---- demo mode ----
// Real visitors must never see made-up homes. Sample data exists only for the owner, who switches demo mode on from
// the address bar (#/admin?demo=on, and #/admin?demo=off to turn it off). It is remembered in this browser only.
const DEMO_KEY = "faxton_demo";
export const demoMode = () => { try { return localStorage.getItem(DEMO_KEY) === "1"; } catch { return false; } };
export const setDemoMode = (on) => { try { on ? localStorage.setItem(DEMO_KEY, "1") : localStorage.removeItem(DEMO_KEY); } catch {} };
const readDemoFlag = () => { const m = /[?&]demo=(on|off)\b/.exec(location.hash); if (m) setDemoMode(m[1] === "on"); };
readDemoFlag(); addEventListener("hashchange", readDemoFlag);
// The sample homes live in data.js and are loaded on demand (tests and demo mode only), never on the normal path.
export const loadDemoSeed = async () => (await import("./data.js")).SEED;

// Returns the live, active listings. When there are none (or Firestore cannot be reached) the answer is an empty list,
// never sample homes. A failed load is flagged with `.failed` so a screen can offer a "Try again" button.
export async function getListings(force = false) {
  if (cache && !force) return cache;
  // Stale-while-revalidate: show the last known listings instantly, then refresh them in the background.
  let stored = null; try { localStorage.removeItem("lst"); stored = JSON.parse(localStorage.getItem("lst2") || "null"); } catch {}
  const fetchFresh = async () => {
    let list;
    try {
      const snap = await getDocs(query(collection(db, "listings"), where("status", "==", "active")));
      list = snap.docs.map((d) => norm({ ...d.data(), id: d.id }));
    } catch {
      list = Array.isArray(stored) ? stored.filter(Boolean).map(norm) : []; list.failed = true; // do not cache a failure: the next call retries
      return list;
    }
    cache = list;
    try { localStorage.setItem("lst2", JSON.stringify(cache.slice(0, 60))); } catch {}
    return cache;
  };
  if (stored?.length && !force) { cache = stored.filter(Boolean).map(norm); fetchFresh(); return cache; }
  return fetchFresh();
}
export const getListing = async (id) => (await getListings()).find((l) => l.id === id) || null;

// ---- profile + saved homes ----
export async function getProfile(uid) { try { const s = await getDoc(doc(db, "users", uid)); return s.exists() ? s.data() : null; } catch { return null; } }
export const saveProfile = (uid, data) => setDoc(doc(db, "users", uid), data, { merge: true });
const localSaved = () => { try { return JSON.parse(localStorage.getItem("saved") || "[]"); } catch { return []; } };
export async function getSaved(user) { return user ? ((await getProfile(user.uid))?.saved || []) : localSaved(); }
export async function toggleSaved(user, id, on) {
  if (!user) { const s = new Set(localSaved()); on ? s.add(id) : s.delete(id); try { localStorage.setItem("saved", JSON.stringify([...s])); } catch {} return; }
  await setDoc(doc(db, "users", user.uid), { saved: on ? arrayUnion(id) : arrayRemove(id) }, { merge: true });
}

// ---- viewings, applications ----
export const addViewing = (user, l, when, slot, extra = {}) => addDoc(collection(db, "viewings"), { ...extra, ownerUid: l.ownerUid || null, uid: user.uid, name: user.displayName || user.email, listingId: l.id, title: l.title, area: l.area, image: l.thumb || l.images[0], when, slot, status: "Requested", createdAt: serverTimestamp() });
export const addApplication = (user, l, moveIn, details = {}, extra = {}) => addDoc(collection(db, "applications"), { ...extra, details, rent: extra.rent || l.price, ownerUid: l.ownerUid || null, uid: user.uid, name: user.displayName || user.email, email: user.email, listingId: l.id, title: l.title, area: l.area, image: l.thumb || l.images[0], amount: costOf(l, extra.rent || l.price).total, moveIn, status: "Under review", createdAt: serverTimestamp() });
const mine = async (col, user) => { try { return (await getDocs(query(collection(db, col), where("uid", "==", user.uid)))).docs.map((d) => ({ ...d.data(), id: d.id })).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)); } catch { return []; } };
export const myViewings = (u) => mine("viewings", u);
export const myApplications = (u) => mine("applications", u);

// ---- documents (stored per user; files up to ~700 KB are kept in the document itself) ----
export const myDocs = (u) => mine("documents", u);
export const addDocument = (u, d) => addDoc(collection(db, "documents"), { ...d, uid: u.uid, status: "Uploaded", createdAt: serverTimestamp() });
export const removeDocument = (id) => deleteDoc(doc(db, "documents", id));

// ---- support tickets ----
export const myTickets = (u) => mine("tickets", u);
export const addTicket = (u, t) => addDoc(collection(db, "tickets"), { ...t, uid: u.uid, name: u.displayName || u.email, status: "Open", ref: "FR-" + (1000 + Math.floor(Math.random() * 9000)), createdAt: serverTimestamp() });

// ---- messaging ----
export const convId = (user, l) => `${user.uid}__${l.id}`;
export async function ensureConversation(user, l) {
  const ref = doc(db, "conversations", convId(user, l));
  if (!(await getDoc(ref)).exists()) await setDoc(ref, { uid: user.uid, userName: user.displayName || user.email, userPhoto: user.photoURL || "", listingId: l.id, listingTitle: l.title, area: l.area, price: l.price, beds: l.beds, baths: l.baths, image: l.thumb || l.images[0], agent: l.agent, last: "", lastAt: serverTimestamp(), createdAt: serverTimestamp() });
  return ref.id;
}
export const watchConversations = (user, cb) => onSnapshot(query(collection(db, "conversations"), where("uid", "==", user.uid)),
  (s) => cb(s.docs.map((d) => ({ ...d.data(), id: d.id })).sort((a, b) => (b.lastAt?.seconds || 0) - (a.lastAt?.seconds || 0))), () => cb([]));
export const watchMessages = (cid, cb, onErr) => onSnapshot(query(collection(db, "conversations", cid, "messages"), orderBy("at")), (s) => cb(s.docs.map((d) => ({ ...d.data(), id: d.id }))), (e) => { if (onErr) onErr(e); else cb([]); });
// Every conversation the Faxton team has with users (admins, the owner and support see all of them).
export const watchStaffConversations = (cb, onErr) => onSnapshot(query(collection(db, "conversations"), where("listingId", "==", "direct")),
  (s) => cb(s.docs.map((d) => ({ ...d.data(), id: d.id })).filter((c) => !c.byStaff).sort((a, b) => (b.lastAt?.seconds || 0) - (a.lastAt?.seconds || 0))), (e) => { cb([]); onErr?.(e); });
// An admin chatting as themselves (not as Faxton support): the conversation sits in the person's own inbox with the admin as the agent.
export async function ensureStaffPersonalConversation(staff, me, u) {
  const id = `${u.id}__dm_${staff.uid}`, ref = doc(db, "conversations", id), name = me.name || staff.displayName || staff.email, photo = me.photo || staff.photoURL || "assets/mark.svg";
  if (!(await getDoc(ref)).exists()) await setDoc(ref, { uid: u.id, userName: u.name || u.email, listingId: "direct", listingTitle: name, area: "", price: 0, beds: 0, baths: 0, image: photo, userPhoto: u.photo || "", byStaff: staff.uid, agent: { id: staff.uid, name, avatar: photo, photo }, last: "", lastAt: serverTimestamp(), createdAt: serverTimestamp() });
  return id;
}
export const watchStaffDMs = (uid, cb) => onSnapshot(query(collection(db, "conversations"), where("byStaff", "==", uid)),
  (s) => cb(s.docs.map((d) => ({ ...d.data(), id: d.id })).sort((a, b) => (b.lastAt?.seconds || 0) - (a.lastAt?.seconds || 0))), () => cb([]));
export const getConversation = async (cid) => { try { const s = await getDoc(doc(db, "conversations", cid)); return s.exists() ? { ...s.data(), id: s.id } : null; } catch { return null; } };
// A small "typing" marker for the other side (the screen shows it for 5 seconds; it is written at most every 4 seconds).
export const setTyping = (cid, uid) => updateDoc(doc(db, "conversations", cid), { typing: { uid, at: Date.now() } }).catch(() => {});
export const setStaffUnread = (cid, v) => updateDoc(doc(db, "conversations", cid), { staffUnread: !!v });
// side: "u" when the person whose inbox it is writes, "s" when the Faxton team side writes (stored as lastBy for the ticks).
export async function sendMessage(user, cid, text, extra = {}, unread = false, convExtra = {}, side = "u") {
  const b = writeBatch(db);
  b.set(doc(collection(db, "conversations", cid, "messages")), { from: user.uid, text, at: serverTimestamp(), ...extra });
  b.update(doc(db, "conversations", cid), { last: text || (extra.image ? "📷 Photo" : extra.audio ? "🎤 Voice message" : extra.file ? "📎 " + (extra.fname || "File") : ""), lastAt: serverTimestamp(), lastBy: side, unread, ...convExtra });
  await b.commit();
}
export const markRead = (cid) => updateDoc(doc(db, "conversations", cid), { unread: false });
// "I have the thread open": clears my unread flag and stamps rd.<side> (the blue ticks on the other side).
export const ackRead = (cid, side) => updateDoc(doc(db, "conversations", cid), side === "s" ? { staffUnread: false, "rd.s": serverTimestamp() } : { unread: false, "rd.u": serverTimestamp() });
// "My app received it": one batched write for every conversation that has news from the other side (dv.<side>).
export async function ackDelivered(ids, side) {
  if (!ids.length) return;
  const b = writeBatch(db);
  ids.slice(0, 400).forEach((id) => b.update(doc(db, "conversations", id), { ["dv." + side]: serverTimestamp() }));
  await b.commit();
}
// Presence: presence/<uid> = { online, lastSeen (server time), show }. Only the person writes their own.
export const setPresence = (uid, online, show = true) => setDoc(doc(db, "presence", uid), { online: !!online && show, show: !!show, lastSeen: serverTimestamp() });
export const watchPresence = (uid, cb, onErr) => onSnapshot(doc(db, "presence", uid), (s) => cb(s.exists() ? s.data() : null), (e) => { cb(null); onErr?.(e); });

// ---- ownership & roles ----
export async function getOwnerUid() { try { const s = await getDoc(doc(db, "config", "owner")); return s.exists() ? s.data().uid : null; } catch { return null; } }
// While no owner exists, a verified sign-in may try to claim ownership. Firestore rules decide who is allowed.
export async function claimOwnership(user) {
  await setDoc(doc(db, "config", "owner"), { uid: user.uid, since: serverTimestamp() });
  await setDoc(doc(db, "users", user.uid), { role: "owner" }, { merge: true });
}
export const setRole = (uid, role) => updateDoc(doc(db, "users", uid), { role });
export const setBanned = (uid, on) => updateDoc(doc(db, "users", uid), on ? { banned: true, bannedAt: serverTimestamp() } : { banned: false });
export const watchProfile = (uid, cb) => onSnapshot(doc(db, "users", uid), (s) => cb(s.exists() ? s.data() : null), () => {});
export async function transferOwnership(fromUid, toUid) {
  const b = writeBatch(db);
  b.update(doc(db, "config", "owner"), { uid: toUid });
  b.update(doc(db, "users", fromUid), { role: "admin" });
  b.update(doc(db, "users", toUid), { role: "owner" });
  await b.commit();
}

// ---- admin ----
export async function adminAll(col) { try { return (await getDocs(collection(db, col))).docs.map((d) => ({ ...d.data(), id: d.id })); } catch { return []; } }
export const patch = (col, id, data) => { cache = null; return updateDoc(doc(db, col, id), data); };
export const createListing = (l) => { cache = null; return setDoc(doc(db, "listings", l.id), { ...l, createdAt: serverTimestamp() }); };
export const watchReleases = (cb) => onSnapshot(query(collection(db, "appReleases"), where("published", "==", true)), (s) => cb(s.docs.map((d) => ({ ...d.data(), id: d.id }))), () => cb([]));
export const saveRelease = (id, data) => (id ? updateDoc(doc(db, "appReleases", id), { ...data, updatedAt: serverTimestamp() }) : addDoc(collection(db, "appReleases"), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
export const removeRelease = (id) => deleteDoc(doc(db, "appReleases", id));
export const setStatus = (col, id, status) => updateDoc(doc(db, col, id), { status });
export async function seedListings() {
  if (!demoMode()) throw new Error("Demo mode is off.");
  const SEED = await loadDemoSeed(), b = writeBatch(db);
  SEED.forEach((l) => b.set(doc(db, "listings", l.id), { ...l, demo: true }));
  b.set(doc(db, "listings", "cedar-house"), { ...SEED[1], id: "cedar-house", title: "Cedar House", area: "Wuse 2", city: "Abuja", status: "pending", price: 2800000, lat: 9.0765, lng: 7.4719, demo: true });
  await b.commit(); cache = null;
}

// Documents (listings, viewings, applications) that belong to a landlord or agency account.
export async function ownedDocs(col, uid) { try { return (await getDocs(query(collection(db, col), where("ownerUid", "==", uid)))).docs.map((d) => ({ ...d.data(), id: d.id })); } catch { return []; } }

// ---- verification of agencies and agents, notifications, suggestions ----
export const verifyUser = async (uid, verification) => {
  await updateDoc(doc(db, "users", uid), { verified: verification.status === "verified", verification });
  try { const u = (await getDoc(doc(db, "users", uid))).data() || {}; await setDoc(doc(db, "profiles", uid), { name: u.agency?.business || u.name || "User", role: u.role || "", photo: u.photo || "", verified: verification.status === "verified", updatedAt: serverTimestamp() }, { merge: true }); pubCache.delete(uid); } catch {}
};
export const notify = (uid, n) => addDoc(collection(db, "notifications"), { uid, read: false, createdAt: serverTimestamp(), ...n });
export const watchNotifications = (uid, cb) => onSnapshot(query(collection(db, "notifications"), where("uid", "==", uid), where("read", "==", false)), (s) => cb(s.docs.map((d) => ({ ...d.data(), id: d.id }))), () => {});
export const watchAllNotifications = (uid, cb) => onSnapshot(query(collection(db, "notifications"), where("uid", "==", uid)),
  (s) => cb(s.docs.map((d) => ({ ...d.data(), id: d.id })).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).slice(0, 40)), () => {});
export const markNotificationRead = (id) => updateDoc(doc(db, "notifications", id), { read: true }).catch(() => {});
export const watchPendingVerifications = (cb) => onSnapshot(query(collection(db, "users"), where("verification.status", "==", "pending")), (s) => cb(s.docs.map((d) => ({ ...d.data(), id: d.id }))), () => {});
export const addSuggestion = (u, s) => addDoc(collection(db, "suggestions"), { ...s, uid: u.uid, name: u.displayName || u.email, email: u.email, status: "New", createdAt: serverTimestamp() });
export const setDeletion = (uid, d) => updateDoc(doc(db, "users", uid), { deletion: d ? d : deleteField() });
export const decideDeletion = (uid, d) => updateDoc(doc(db, "users", uid), { deletion: d });
export async function deleteProfile(uid) { await deleteDoc(doc(db, "users", uid)); }

// A direct conversation started by the Faxton team (admin or support) with any user.
export async function ensureDirectConversation(staff, u) {
  const id = `${u.id}__direct`, ref = doc(db, "conversations", id);
  if (!(await getDoc(ref)).exists()) await setDoc(ref, { uid: u.id, userName: u.name || u.email, listingId: "direct", listingTitle: "Faxton team", area: "", price: 0, beds: 0, baths: 0, image: "assets/mark.svg", userPhoto: u.photo || "", agent: { id: "faxton", name: "Faxton team", avatar: "assets/mark.svg", photo: "assets/mark.svg" }, last: "", lastAt: serverTimestamp(), createdAt: serverTimestamp() });
  return id;
}

// ---- blocking and reporting other users ----
export const blockUser = (me, uid, name = "") => setDoc(doc(db, "blocks", `${me.uid}_${uid}`), { blocker: me.uid, blocked: uid, name, at: serverTimestamp() });
export const unblockUser = (me, uid) => deleteDoc(doc(db, "blocks", `${me.uid}_${uid}`));
export const isBlocked = async (blocker, blocked) => { try { return (await getDoc(doc(db, "blocks", `${blocker}_${blocked}`))).exists(); } catch { return false; } };
export const reportUser = (me, r) => addDoc(collection(db, "reports"), { ...r, reporterUid: me.uid, reporterName: me.displayName || me.email || "", status: "New", createdAt: serverTimestamp() });

// ---- call relay (TURN) servers, set by an admin ----
export const getIce = async () => { try { const s = await getDoc(doc(db, "config", "ice")); const d = s.exists() ? s.data() : {}; return { servers: d.servers || [], credsUrl: d.credsUrl || "" }; } catch { return { servers: [], credsUrl: "" }; } };
export const saveIce = (servers, credsUrl = "") => setDoc(doc(db, "config", "ice"), { servers, credsUrl, updatedAt: serverTimestamp() });

// Pin one message to the top of a conversation (null removes the pin).
export const pinMessage = (cid, pin) => updateDoc(doc(db, "conversations", cid), { pinned: pin || deleteField() });

// ---- public profile cards (what people see when they tap a picture) ----
const pubCache = new Map();
export const getPublic = async (uid) => { if (!uid) return null; if (pubCache.has(uid)) return pubCache.get(uid); let v = null; try { const s = await getDoc(doc(db, "profiles", uid)); v = s.exists() ? s.data() : null; } catch {} pubCache.set(uid, v); return v; };
export const syncPublic = (uid, d) => { pubCache.delete(uid); return setDoc(doc(db, "profiles", uid), { ...d, updatedAt: serverTimestamp() }, { merge: true }).catch(() => {}); };
// An admin opening the Users page marks everyone already verified on their public card too.
export const syncVerified = (users) => Promise.all(users.filter((u) => u.verified === true && u.id).map((u) => setDoc(doc(db, "profiles", u.id), { name: u.agency?.business || u.name || "User", role: u.role || "", photo: u.photo || "", verified: true, updatedAt: serverTimestamp() }, { merge: true }).catch(() => {})));

// React to a message with an emoji (null removes my reaction).
export const reactToMessage = (cid, mid, uid, emoji) => updateDoc(doc(db, "conversations", cid, "messages", mid), { ["reactions." + uid]: emoji || deleteField() });

// ---- first-time signup events: admins and support receive these live; routine logins are intentionally not recorded ----
export const logStaffEvent = (user, p) => {
  const d = { type: "signup", uid: user.uid, name: String((p?.role === "agency" && p?.agency?.business) || p?.name || user.displayName || "Someone").slice(0, 120), role: String(p?.role || "renter").slice(0, 20), at: serverTimestamp() };
  return setDoc(doc(db, "staffEvents", "signup_" + user.uid), d).catch(() => {});
};
export const watchStaffEvents = (cb) => onSnapshot(query(collection(db, "staffEvents"), orderBy("at", "desc"), limit(30)), (s) => cb(s.docs.map((d) => ({ ...d.data(), id: d.id })), s.docChanges().filter((c) => c.type === "added").map((c) => c.doc.id)), () => {});
