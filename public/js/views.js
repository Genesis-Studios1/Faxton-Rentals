import { auth } from "./firebase.js";
import { updateProfile } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { $, $$, esc, naira, short, icon, logo, logoMark, initials, toast, modal, friendlyErr, BUILD, verifiedBadge } from "./ui.js";
import * as st from "./store.js";
import * as PG from "./pages.js";
import * as LEGAL from "./legal.js";
import * as CALLS2 from "./calls.js";
import { loadLeaflet, ctrlZoom, tiles } from "./maps.js";
import * as CALLS from "./calls.js";
import * as AV from "./authviews.js";
import { locFields, mountLoc, legacyLoc, resFields } from "./loc.js";
import * as APPS from "./apps.js";
import * as SAFE from "./safety.js";
import { openProfile } from "./profile.js";
import * as AREA from "./area.js";
import * as OFFERS from "./offers.js";
import * as MATCH from "./match.js";
import * as SVC from "./services.js";
import * as MYHOME from "./myhome.js";
import * as LOCK from "./applock.js";
import * as MYDATA from "./mydata.js";
import * as TENANTS from "./tenants.js";
import * as VS from "./viewsafe.js";
import * as HOME from "./home.js";
import * as RC from "./receipts.js";
import * as PRES from "./presence.js";
import { fxErr, shrinkImage, ask } from "./fx.js";
import { playSound, soundsOn, setSounds } from "./sound.js";
import { openViewer, detail } from "./pdp.js";
// A damaged address (for example #/home/%E0%A4) is treated as a normal unknown page instead of throwing.
const decodeURIComponent = (s) => { try { return globalThis.decodeURIComponent(s); } catch { return s; } };

const AREAS = [["lekki", "Lekki, Lagos"], ["ajah", "Ajah, Lagos"], ["yaba", "Yaba, Lagos"], ["victoria", "Victoria Island, Lagos"], ["ikate", "Ikate, Lagos"], ["", "All of Lagos"]];
const BUDGETS = [[0, "Any price"], [1500000, "Up to ₦1.5m"], [2500000, "Up to ₦2.5m"], [3600000, "Up to ₦3.6m"], [5000000, "Up to ₦5m"]];
const TYPES = ["Apartment", "House", "Studio"];
// What kind of home a listing is: by bedrooms for apartments, plus shortlets, houses and studios.
const CATS = [["1bed", "1 Bedroom Apartment"], ["2bed", "2 Bedroom Apartment"], ["3bed", "3 Bedroom Apartment"], ["shortlet", "Shortlet"], ["house", "House or Duplex"], ["studio", "Studio"]];
const catOf = (l) => { const t = String(l.type || ""); return l.shortlet || /short/i.test(t) ? "shortlet" : /studio/i.test(t) || l.beds === 0 ? "studio" : /house|duplex|detached|terrace|mansion|villa|bungalow/i.test(t) ? "house" : l.beds === 1 ? "1bed" : l.beds === 2 ? "2bed" : l.beds === 3 ? "3bed" : "house"; };
const catName = (l) => CATS.find((c) => c[0] === catOf(l))[1];
const matchType = (l, t) => !t || catOf(l) === t || l.type === t;
const typeOptions = (sel) => CATS.map(([k, n]) => `<option value="${k}" ${k === sel ? "selected" : ""}>${n}</option>`).join("");
const opts = (list, sel) => list.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(sel) ? "selected" : ""}>${esc(l)}</option>`).join("");
const fmtDate = (s) => { const d = new Date(s); return isNaN(d) ? s : d.toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long" }); };
const fmtTime = (t) => (t?.toDate ? t.toDate() : new Date()).toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" });
const bedsLabel = (n) => (n === 0 ? "Studio" : `${n} bed${n > 1 ? "s" : ""}`);
const rel = (t) => { const s = t?.seconds; if (!s) return "Just now"; const h = (Date.now() / 1000 - s) / 3600; return h < 1 ? "Just now" : h < 24 ? `${Math.floor(h)} hours ago` : `${Math.floor(h / 24)} day${h >= 48 ? "s" : ""} ago`; };
const statusPill = (s) => `<span class="pill ${/pending|review|requested|awaiting/i.test(s) ? "warn" : /flag|reject|cancel/i.test(s) ? "bad" : ""}">${esc(s)}</span>`;

// ---------- cards ----------
// Listing cards, the filters and the property page live in cards.js, home.js and pdp.js.

// ---------- router ----------
export async function route(ctx) {
  const { path } = ctx; let m;
  if ((m = path.match(/^\/onboarding\/([123])$/))) return AV.onboarding(ctx, +m[1]);
  if (path === "/onboarding/setup") return AV.setupOnboarding(ctx);
  if (path === "/login") return AV.authPage(ctx, "login");
  if (path === "/signup") return AV.authPage(ctx, "signup");
  if (path === "/forgot") return AV.forgotPage(ctx);
  if (path === "/terms" || path === "/privacy" || path === "/license") return LEGAL.legalPage(ctx, path.slice(1));
  if (path === "/download") return APPS.downloadPage(ctx);
  if (path === "/") return HOME.discover(ctx);
  if (path === "/search") return HOME.search(ctx);
  if ((m = path.match(/^\/home\/([^/]+)$/))) return detail(ctx, decodeURIComponent(m[1]));
  if (path === "/saved") return HOME.savedPage(ctx);
  if (path === "/help") return PG.helpPage(ctx);
  if (path === "/messages" || path.startsWith("/messages/")) return messages(ctx, decodeURIComponent(path.split("/")[2] || ""));
  if (path === "/bookings") return bookings(ctx);
  if (path === "/myhome" || path.startsWith("/myhome/")) return MYHOME.myHomePage(ctx, path.split("/")[2] || "");
  if (path === "/tenants" || path.startsWith("/tenants/")) return TENANTS.tenantsPage(ctx, path.split("/")[2] || "maintenance");
  if (path === "/match") return MATCH.matchPage(ctx);
  if (path === "/services") return SVC.servicesPage(ctx);
  if (path === "/offers") return OFFERS.offersPage(ctx, PG.rentalsNav);
  if (path === "/payments") return PG.paymentsPage(ctx);
  if (path === "/applications") return PG.applicationsPage(ctx);
  if (path === "/rentals") return PG.rentalPage(ctx);
  if (path === "/documents") return PG.documentsPage(ctx);
  if ((m = path.match(/^\/agent\/([^/]+)$/))) return PG.agentPage(ctx, decodeURIComponent(m[1]));
  if ((m = path.match(/^\/book\/([^/]+)$/))) return PG.bookPage(ctx, decodeURIComponent(m[1]));
  if ((m = path.match(/^\/apply\/([^/]+)$/))) return PG.applyPage(ctx, decodeURIComponent(m[1]));
  if ((m = path.match(/^\/accept-call\/([^/]+)$/))) { const id = decodeURIComponent(m[1]); setTimeout(() => { ctx.go("#/"); CALLS.answerById(ctx, id, true); }); return { title: "Call", html: `<div class="empty"><h2>Connecting your call…</h2></div>` }; }
  if ((m = path.match(/^\/call\/([^/]+)$/))) { const cid = decodeURIComponent(m[1]); setTimeout(() => ctx.go("#/messages/" + cid)); return { title: "Calls", html: `<div class="empty"><h2>Opening your conversation…</h2></div>` }; }
  if (path === "/settings" || path.startsWith("/settings/")) return settings(ctx, path.split("/")[2] || "profile");
  if (path === "/support" || path === "/support/tickets" || path === "/support/suggestions" || path === "/support/data-requests" || path === "/support/services") return (await import("./dash.js")).supportPage(ctx, path.split("/")[2] || "");
  if (path === "/portfolio") return (await import("./dash.js")).ownerPage(ctx, "landlord");
  if (path === "/agency") return (await import("./dash.js")).ownerPage(ctx, "agency");
  if (path === "/agent-dashboard" || /^\/agent-dashboard\/(leads|clients|viewings|listings)$/.test(path)) return (await import("./dash.js")).ownerPage(ctx, "agent", path.split("/")[2] || "");
  if (path === "/admin" || path.startsWith("/admin/")) return admin(ctx, path.split("/")[2] || "");
  return null;
}

// ---------- onboarding, sign up, log in and forgot password live in authviews.js ----------

// ---------- discover, search, property page, saved: see home.js and pdp.js ----------

// ---------- bookings / payments ----------
async function bookings(ctx) {
  const v = await st.myViewings(ctx.S.user);
  // Fill in who the agent is for viewings booked before the safety system existed.
  v.forEach((x) => { if (!x.agentName) x.agentName = "Faxton agent"; });
  let tab = "up"; const up = () => v.filter((x) => !VS.isPast(x)).sort((a, b) => VS.startOf(a) - VS.startOf(b)), past = () => v.filter((x) => VS.isPast(x)).sort((a, b) => VS.startOf(b) - VS.startOf(a));
  const draw = () => {
    const L = tab === "up" ? up() : past();
    return L.length ? L.map((x) => VS.viewingCard(x)).join("") : `<div class="rf-card"><div class="rf-empty"><span class="rf-empty-ic">${icon("cal", 26, 1.5)}</span><h3>${tab === "up" ? "No viewings coming up" : "No past viewings"}</h3><p>${tab === "up" ? "Open a home and choose “Book a viewing” to pick a day and time." : "Viewings you’ve been on, or cancelled, are kept here."}</p>${tab === "up" ? `<a class="btn primary" href="#/search">Find a home</a>` : ""}</div></div>`;
  };
  const tabs = () => `<button type="button" role="tab" aria-selected="${tab === "up"}" class="${tab === "up" ? "on" : ""}" data-vt="up">Upcoming <b>${up().length}</b></button><button type="button" role="tab" aria-selected="${tab === "past"}" class="${tab === "past" ? "on" : ""}" data-vt="past">Past <b>${past().length}</b></button>`;
  return { title: "Viewings", html: `<div class="rf rf-in">${PG.rentalsNav("/bookings")}<header class="rf-ph"><div><span class="rf-eyebrow">My rentals</span><h1 class="rf-h1">Viewings</h1><p class="rf-sub">Your scheduled and past viewings, with safety tools for each one.</p></div><div class="rf-ph-a"><a class="btn primary" href="#/search">${icon("search", 18)} Find a home</a></div></header><div class="rf-seg" id="vwTabs" role="tablist" style="margin-bottom:14px">${tabs()}</div><div class="rf-vw-list" id="vwList">${draw()}</div></div>`,
    mount(root) {
      const redraw = () => { $("#vwTabs", root).innerHTML = tabs(); $("#vwList", root).innerHTML = draw(); wire(); };
      const wire = () => { VS.mountViewings(root, ctx, v, redraw); $$("[data-vt]", root).forEach((b) => (b.onclick = () => { tab = b.dataset.vt; redraw(); })); };
      wire(); VS.watchOverdue(ctx, () => v, redraw);
    } };
}
async function payments(ctx) {
  const a = await st.myApplications(ctx.S.user);
  return { title: "Payments", html: `<div class="page-head"><div><h1>Payments</h1><p>Rental applications and amounts due on move-in</p></div></div><div class="panel">${a.length ? a.map((x) => `<div class="list-row"><img src="${esc(x.image)}" alt=""><div class="grow"><h3>${esc(x.title)}</h3><div class="loc">${icon("pin", 16)}${esc(x.area)}</div><p class="muted" style="margin-top:6px">Move-in ${esc(fmtDate(x.moveIn))}</p></div><div style="text-align:right"><div class="price">${naira(x.amount)}</div>${statusPill(x.status)}</div></div>`).join("") : `<div class="empty">No applications yet.</div>`}</div><p class="muted">Online payments will be available once your application is approved.</p>` };
}

// ---------- messages ----------
// Kept for the whole visit (not per screen), so opening a chat again is instant: thread messages, decoded photos, public photos, listings.
const GPH = (u) => !!u?.providerData?.some((x) => x.providerId === "google.com" && (x.photoURL || u.photoURL));
const MSG_CACHE = new Map(); // conversation id -> messages (newest snapshot)
const BLOBS = new Map(); // data: URL -> blob: URL (a 40 KB photo is parsed and decoded once, not on every repaint)
const PUB_PHOTO = {}, ASKED = new Set(), LISTINGS = new Map();
let CACHE_UID = "";
const LISTS = { uid: "", base: [], dms: [], team: [] }; // the conversation lists from the last visit
// Profile photos and pictures are stored as data: URLs. Repeating one inside every bubble made each repaint parse hundreds of KB, so big ones become short blob: URLs.
const light = (src) => {
  if (typeof src !== "string" || src.length < 1500 || !src.startsWith("data:")) return src;
  if (BLOBS.has(src)) return BLOBS.get(src);
  try {
    const i = src.indexOf(","), head = src.slice(5, i), mime = head.split(";")[0] || "application/octet-stream";
    if (!/;base64$/.test(head)) return src;
    const bin = atob(src.slice(i + 1)), u8 = new Uint8Array(bin.length); for (let k = 0; k < bin.length; k++) u8[k] = bin.charCodeAt(k);
    const url = URL.createObjectURL(new Blob([u8], { type: mime })); BLOBS.set(src, url);
    if (BLOBS.size > 120) { const [k0, v0] = BLOBS.entries().next().value; BLOBS.delete(k0); setTimeout(() => URL.revokeObjectURL(v0), 4000); }
    return url;
  } catch { return src; }
};
const listingOf = (id) => { if (!LISTINGS.has(id)) LISTINGS.set(id, st.getListing(id).then((l) => (l || LISTINGS.delete(id), l), () => (LISTINGS.delete(id), null))); return LISTINGS.get(id); };
const cacheThread = (cid, list) => { MSG_CACHE.delete(cid); MSG_CACHE.set(cid, list); while (MSG_CACHE.size > 12) MSG_CACHE.delete(MSG_CACHE.keys().next().value); };
const EMOJI = ["😀", "😊", "😍", "👍", "🙏", "🎉", "🏠", "🔑", "📅", "📍", "💬", "✅", "❤️", "😅", "🤝", "👋"];
async function messages(ctx, cid) {
  const me = ctx.S.user.uid, staff = !!(ctx.S.isAdmin || ctx.S.isOwner || ctx.S.role === "support");
  const getMode = () => { try { return staff && sessionStorage.getItem("msgMode") === "faxton" ? "faxton" : "personal"; } catch { return "personal"; } };
  const html = `<div class="mx-shell ${cid ? "has-chat" : ""}"><aside class="mx-side" id="mxSide"></aside><section class="mx-chat" id="chat"></section></div>`;
  return { title: "Messages", bare: true, bleed: true, html,
    mount() {
      // An open chat takes the whole phone screen: html.in-chat hides the top bar and the four-icon bar (see chat.css).
      const root = document.documentElement, vv = window.visualViewport;
      root.classList.toggle("in-chat", !!cid);
      // iOS keeps the layout viewport tall while the keyboard is up; follow the visual viewport so the composer stays above it.
      const fitVV = () => { if (!cid || !vv) return root.style.removeProperty("--mx-vvh"); root.style.setProperty("--mx-vvh", Math.round(vv.height) + "px"); if (vv.offsetTop) window.scrollTo(0, 0); const th = document.getElementById("thread"); if (th) th.scrollTop = th.scrollHeight; };
      if (vv) { vv.addEventListener("resize", fitVV); vv.addEventListener("scroll", fitVV); fitVV(); }
      if (CACHE_UID !== me) { LISTS.uid = ""; MSG_CACHE.clear(); BLOBS.forEach((u) => URL.revokeObjectURL(u)); BLOBS.clear(); LISTINGS.clear(); CACHE_UID = me; } // never carry one person's chats over to the next sign-in
      ctx.S.openChat = cid;
      let mine = [], base = [], dms = [], team = [], calls = [], unsubM = null, unsubP = null, tab = "all", term = "", mode = getMode(), teamErr = false, fetched = new Set(), fetchDone = new Set(), loaded = false, dmsLoaded = false, teamLoaded = false, callsLoaded = false, listBelow = false;
      const listsReady = () => loaded && (!staff || (dmsLoaded && teamLoaded));
      const faxton = () => mode === "faxton", convs = () => (faxton() ? team : mine);
      // two icons the shared set doesn't have: reply arrow and push-pin
      const LI = { reply: '<polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/>', pushpin: '<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>' };
      const lic = (n, sz = 18) => `<svg class="ic" width="${sz}" height="${sz}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${LI[n]}</svg>`;
      const iniAv = (name) => "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#0f7a5a"/><text x="32" y="42" font-family="system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif" font-size="28" font-weight="700" fill="#fff" text-anchor="middle">${esc((String(name || "?").trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("") || "?").toUpperCase())}</text></svg>`);
      // Who the person on the other side is, from the point of view of the current mode.
      const byMe = (c) => c.byStaff === me;
      const merge = () => { mine = [...base, ...dms].sort((a, b) => (b.lastAt?.seconds || 0) - (a.lastAt?.seconds || 0)); };
      // the picture the person chose in their profile, used when the conversation itself doesn't carry one (the Google photo is the default)
      const pubPhoto = PUB_PHOTO, asked = ASKED;
      const warmPhotos = (list) => list.forEach((c) => { const u = c.uid; if (!u || c.userPhoto || asked.has(u)) return; asked.add(u); st.getPublic(u).then((pb) => { if (!pb?.photo) return; pubPhoto[u] = pb.photo; if ($("#convs")) drawList(); const hi = $(".mx-hav img"); if (hi && cid && convs().find((x) => x.id === cid)?.uid === u && !hi.dataset.set) { hi.src = light(pb.photo); hi.dataset.set = "1"; } }).catch(() => {}); });
      const userAv = (c) => light(c.userPhoto || pubPhoto[c.uid]) || iniAv(c.userName);
      const other = (c) => byMe(c) ? { name: c.userName || "User", avatar: userAv(c), role: "User", id: c.uid } : faxton() ? { name: c.userName || "User", avatar: userAv(c), role: "User", id: c.uid } : { name: c.agent.name, avatar: light(c.agent.avatar), role: c.listingId === "direct" ? "Faxton team" : "Property Agent", id: c.agent.id };
      const myAv = () => faxton() ? "assets/mark.svg" : light(ctx.S.profile?.photo || ctx.S.user.photoURL) || iniAv(ctx.S.user.displayName || ctx.S.profile?.name || ctx.S.user.email);
      const isMine = (m, c) => (faxton() ? m.from !== c.uid : m.from === me);
      // Which side of the conversation I am on for the ticks: "s" (Faxton team side) or "u" (the person whose inbox it is).
      const sideOf = (c) => (faxton() || byMe(c) ? "s" : "u");
      const unreadOf = (c) => (faxton() || byMe(c) ? !!c.staffUnread : !!c.unread);
      const FILTERS = () => [["all", "chatdots", "All", convs().length], ["unread", "bell", "Unread", convs().filter(unreadOf).length], ["calls", "phone", "Calls", calls.length]];
      const vis = () => convs().filter((c) => (tab === "all" || (tab === "unread" ? unreadOf(c) : true)) && (!term || (other(c).name + " " + c.listingTitle + " " + c.last).toLowerCase().includes(term)));
      const beginCall = async (c, kind) => {
        if (faxton()) return CALLS.startCall(ctx, { convId: c.id, to: c.uid, toName: c.userName || "User", toPhoto: c.userPhoto || "", kind, title: "Faxton team" });
        if (byMe(c)) return CALLS.startCall(ctx, { convId: c.id, to: c.uid, toName: c.userName || "User", toPhoto: c.userPhoto || "", kind, title: "Faxton team" });
        if (c.listingId === "direct") return CALLS.startCall(ctx, { convId: c.id, to: c.byStaff || "staff", toName: "Faxton team", kind, title: "Faxton team" });
        const l = await listingOf(c.listingId); const to = l?.ownerUid && l.ownerUid !== me ? l.ownerUid : "staff";
        CALLS.startCall(ctx, { convId: c.id, to, toName: to === "staff" ? "Faxton team" : c.agent.name, toPhoto: c.agent.avatar, kind, title: c.listingTitle, image: c.image, area: c.area });
      };
      // The left column: title and new-message button, the Me / Faxton switch for staff, search, tabs and the list.
      const lastLine = (c) => {
        const k = calls.filter((x) => x.convId === c.id)[0]; // newest first
        if (k && (k.createdAt?.seconds || 0) >= (c.lastAt?.seconds || 0)) { const [t, sub] = callText(k); return `${icon(k.kind === "video" ? "video" : "phone", 14)} ${esc(t)}${sub ? " · " + esc(sub.split(" · ")[0]) : ""}`; }
        return esc(c.last || (c.listingId === "direct" ? "Say hello" : c.listingTitle));
      };
      const drawList = () => {
        const f = FILTERS(), list = vis();
        f.forEach(([k, , , n]) => { const c = $(`[data-cnt="${k}"]`); if (c) c.textContent = n; });
        const box = $("#convs"); if (!box) return; CALLS.imgFallback(box);
        const nothing = (ic, title, hint, act = "") => `<div class="mx-none"><span class="mx-noi">${icon(ic, 24)}</span><b>${title}</b><p>${hint}</p>${act}</div>`;
        const skel = `<div class="mx-sks" aria-hidden="true">${"<div class=\"mx-sk\"><i></i><div><b></b><p></p></div></div>".repeat(4)}</div>`;
        const h = tab === "calls" ? (calls.length ? calls.filter((c) => !term || ((c.callerName || "") + (c.calleeName || "") + (c.title || "")).toLowerCase().includes(term)).map((c) => CALLS.logRow(c, me, (x) => light(CALLS.peerPhoto(x, me)))).join("") || nothing("phone", "No calls match", "Try a different search.") : callsLoaded ? nothing("phone", "No calls yet", "Open a conversation and tap Call or Video call.") : skel)
          : list.length ? list.map((c) => { const o = other(c), tick = RC.tickHtml(RC.listStatus(c, sideOf(c)), "mini"); return `<a class="mx-conv" data-cid="${esc(c.id)}" href="#/messages/${esc(c.id)}"><img class="mx-av" src="${esc(o.avatar)}" alt="" referrerpolicy="no-referrer" decoding="async"><div><div class="mx-ct"><b>${esc(o.name)}</b><time>${c.lastAt ? fmtTime(c.lastAt) : ""}</time></div><p>${tick}<span class="mx-lp1">${lastLine(c)}</span></p></div>${unreadOf(c) ? '<i class="mx-dot" aria-label="Unread"></i>' : ""}</a>`; }).join("")
          : (!loaded || !listsReady()) && !convs().length ? skel
          : faxton() && teamErr ? nothing("chatdots", "Couldn’t load the inbox", "Check your connection and try again. If it keeps happening, the database rules may not be published yet.")
          : convs().length ? nothing("search", "No conversations match", "Try a different search, or switch tab.")
          : faxton() ? nothing("chatdots", "No one has written yet", "When a renter messages Faxton Rentals, the conversation shows up here.")
          : nothing("chatdots", "No conversations yet", "Open a home and tap “Message agent” to start chatting.", `<a class="btn sm" href="#/search">Find a home</a>`);
        // Only repaint the list when what it shows changed (every snapshot used to rebuild it), and keep its scroll position.
        if (box.__h !== h) {
          const keep = box.scrollTop; box.innerHTML = h; box.__h = h; box.scrollTop = keep; drawList.n = (drawList.n || 0) + 1;
          $$("[data-cb]", box).forEach((b) => (b.onclick = () => { const c = calls.find((x) => x.id === b.dataset.cb); if (!c) return; const out = c.callerUid === me; CALLS.startCall(ctx, { convId: c.convId, to: out ? c.calleeUid : c.callerUid, toName: out ? c.calleeName : c.callerName, kind: b.dataset.k, title: c.title }); }));
        }
        syncOn();
      };
      // Highlight the open conversation in the list without rebuilding it.
      const syncOn = () => $$(".mx-conv").forEach((a) => a.classList.toggle("on", !!cid && a.dataset.cid === cid));
      const drawSide = () => {
        const side = $("#mxSide"); if (!side) return; const f = FILTERS();
        side.innerHTML = `<div class="mx-sidehead"><div class="mx-hrow"><h1>Messages</h1><a class="mx-newi" href="${ctx.S.isAdmin ? "#/admin/users" : faxton() ? "#/admin/users" : "#/search"}" aria-label="New conversation" title="New conversation">${icon("edit", 22)}</a></div>
          ${staff ? `<div class="mx-mode" role="tablist" aria-label="Message as"><button type="button" class="${faxton() ? "" : "on"}" data-mode="personal">Me</button><button type="button" class="${faxton() ? "on" : ""}" data-mode="faxton">Faxton</button></div><p class="mx-hint">Type <b>/switch</b> in a message to change.</p>` : ""}
          <label class="mx-search">${icon("search", 18)}<input id="cs" type="search" placeholder="Search conversations…" value="${esc(term)}" aria-label="Search conversations"></label>
          <div class="mx-tabs" role="tablist">${f.map(([k, , l]) => `<button type="button" role="tab" data-tab="${k}" class="${k === tab ? "on" : ""}">${l} (<span data-cnt="${k}">0</span>)</button>`).join("")}</div></div>
          <div class="mx-convs" id="convs"></div>`;
        $$("[data-tab]", side).forEach((b) => (b.onclick = () => { tab = b.dataset.tab; $$("[data-tab]", side).forEach((x) => x.classList.toggle("on", x === b)); drawList(); }));
        $$("[data-mode]", side).forEach((b) => (b.onclick = () => switchMode(b.dataset.mode)));
        const cs = $("#cs", side); cs.oninput = (e) => { term = e.target.value.trim().toLowerCase(); drawList(); }; cs.onkeydown = (e) => { if (e.key === "Enter" && cs.value.trim().toLowerCase() === "/switch") { e.preventDefault(); term = ""; cs.value = ""; switchMode(); } };
        // open the tapped chat in the same frame as the tap (the address change that follows finds it already open)
        $("#convs", side).addEventListener("click", (e) => { const a = e.target.closest("a.mx-conv"); if (a && !(e.metaKey || e.ctrlKey || e.shiftKey || e.button)) navTo(a.dataset.cid); });
        drawList();
      };
      const switchMode = (to) => {
        if (!staff) return; const next = to || (faxton() ? "personal" : "faxton"); if (next === mode) return;
        mode = next; try { sessionStorage.setItem("msgMode", mode); } catch {} tab = "all"; term = "";
        toast(faxton() ? "Now messaging as Faxton Rentals." : "Now messaging as yourself.");
        const chat = $("#chat"); if (chat) chat.dataset.cid = ""; drawSide(); if (cid && !convs().some((x) => x.id === cid)) { ctx.go("#/messages"); } else drawChat();
      };
      let paintThread = () => {}, tfind = "";
      // Reactions grouped by emoji, with my own highlighted.
      const rxHtml = (m) => { const r = m.reactions || {}, g = {}; Object.entries(r).forEach(([u, e]) => { if (e) (g[e] ||= []).push(u); }); const k = Object.keys(g); return k.length ? `<div class="mx-rx">${k.map((e) => `<button type="button" class="${g[e].includes(me) ? "mine" : ""}" data-rx="${esc(e)}" data-mid2="${esc(m.id)}">${esc(e)}${g[e].length > 1 ? `<b>${g[e].length}</b>` : ""}</button>`).join("")}</div>` : ""; };
      // A stable, voice-like shape for messages that carry no recorded levels: tall in the first third, tapering, ending in small dots.
      const fakeWave = (id) => { let h = 2166136261; for (const ch of String(id)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); const rnd = () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0) / 4294967296); return Array.from({ length: 40 }, (_, i) => (i >= 34 ? 9 : Math.round(Math.max(14, (i < 14 ? 55 + 45 * Math.sin((i / 14) * Math.PI * 0.9 + 0.3) : 62 - (i - 14) * 1.6) * (0.55 + rnd() * 0.6))))); };
      const fmtDurS = (n) => { n = Math.max(0, Math.round(n || 0)); return Math.floor(n / 60) + ":" + String(n % 60).padStart(2, "0"); };
      const fmtSize = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round((n || 0) / 1024)) + " KB");
      const unreadFrom = (cid2) => { try { return +localStorage.getItem("seen_" + cid2) || 0; } catch { return 0; } };
      const dayLabel = (sec) => { const d = new Date(sec * 1000), n = new Date(); const same = (a, b) => a.toDateString() === b.toDateString(); const y = new Date(n); y.setDate(n.getDate() - 1); return same(d, n) ? "Today" : same(d, y) ? "Yesterday" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); };
      const callText = (c) => { const outc = c.callerUid === me || (faxton() && c.callerUid !== (convs().find((x) => x.id === cid)?.uid)), vid = c.kind === "video" ? "video" : "voice", st2 = c.status; return st2 === "missed" || st2 === "cancelled" ? [outc ? `Cancelled ${vid} call` : `Missed ${vid} call`, "No answer"] : st2 === "declined" ? [`Declined ${vid} call`, ""] : st2 === "ringing" ? [`${outc ? "Calling" : "Incoming"} ${vid} call`, "Ringing…"] : [`${outc ? "Outgoing" : "Incoming"} ${vid} call`, c.duration ? `${CALLS.fmtDur(c.duration)} · ${c.duration < 60 ? c.duration + " seconds" : Math.round(c.duration / 60) + " minutes"}` : ""]; };
      const callCard = (c) => { const [t, sub] = callText(c), outc = c.callerUid === me || (faxton() && c.callerUid !== (convs().find((x) => x.id === cid)?.uid)), bad = /Missed|Declined|Cancelled/.test(t), back = bad && !outc; return `<div class="mx-row ${outc ? "me" : ""}"><${back ? 'button type="button" data-cb2="' + esc(c.id) + '"' : "div"} class="mx-cc ${outc ? "me" : ""} ${bad ? "bad" : "ok"}"><span class="mx-ci">${icon(c.kind === "video" ? "video" : "phone", 22)}</span><div><b>${t}</b><small>${back ? "Tap to call back" : sub}</small></div><time>${c.createdAt?.seconds ? fmtTime(c.createdAt) : ""}</time></${back ? "button" : "div"}></div>`; };
      // Ticks on my own messages: a clock while it is sending, one grey tick = sent, two grey = delivered, two blue = read (see receipts.js).
      const rc = { side: "u", pres: null };
      const tk = (mine, m) => (mine ? RC.tickHtml(RC.msgStatus(m, convs().find((x) => x.id === cid) || {}, rc.side, rc.pres)) : "");
      // web addresses in a message become tappable (the text is escaped first, so nothing else can get in)
      const lk = (t) => esc(t).replace(/https?:\/\/(?:(?!&quot;|&#39;|&lt;|&gt;)[^\s<>"'])+/g, (u) => `<a class="mx-ln" href="${u}" target="_blank" rel="noopener noreferrer">${u}</a>`);
      const bubble = (m, c) => {
        const mineB = isMine(m, c), av = mineB ? myAv() : other(c).avatar;
        if (m.type === "booking") return `<div class="mx-row"><div class="mx-bk"><img src="${esc(m.image || "")}" alt=""><div><b class="bk-when">${icon("cal", 18)} ${esc(fmtDate(m.when))}, ${esc(m.slot)}</b><b>${esc(m.title)}</b><span class="muted">${esc(m.area)}</span><a class="btn sm" href="#/bookings">View booking</a></div></div></div>`;
        const q = m.reply ? `<button type="button" class="mx-rq" data-goto="${esc(m.reply.id || "")}"><b>${esc(m.reply.name || "")}</b><span>${esc(m.reply.text || "")}</span></button>` : "";
        const pic = m.image ? `<img class="mx-pic" data-pic="${esc(m.id)}" src="${esc(light(m.image))}" alt="Photo" decoding="async">` : "";
        const wave = (m.wave && m.wave.length ? m.wave : fakeWave(m.id || "")).slice(0, 40);
        const vn = m.audio ? `<div class="mx-vn" data-vn="${esc(m.id)}"><button type="button" class="mx-play" aria-label="Play voice message">${icon("play", 20)}</button><div class="mx-wv" role="slider" tabindex="0" aria-label="Voice message position" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">${wave.map((h) => `<i style="height:${Math.max(8, Math.min(100, h))}%"></i>`).join("")}</div><span class="mx-vd">${fmtDurS(m.dur)}</span></div>` : "";
        const fl = m.file ? `<div class="mx-file"><span class="mx-fi">${icon("doc", 22)}</span><div><b>${esc(m.fname || "File")}</b><small>${fmtSize(m.fsize)} · ${esc((String(m.fname || "").split(".").pop() || "file").toUpperCase())}</small></div><a class="mx-dl" href="#" download="${esc(m.fname || "file")}" aria-label="Download ${esc(m.fname || "file")}">${icon("download", 18)}</a></div>` : "";
        return `<div class="mx-row ${mineB ? "me" : ""}" data-mid="${esc(m.id || "")}"><img class="mx-bav" src="${esc(av)}" alt="" referrerpolicy="no-referrer"><div class="mx-bw"><div class="mx-b ${m.image ? "has-pic" : ""} ${m.audio ? "has-vn" : ""} ${m.file ? "has-file" : ""}">${q}${pic}${vn}${fl}${m.text ? `<span class="mx-tx">${lk(m.text)}</span>` : ""}<time class="in">${m.at ? fmtTime(m.at) : ""}${tk(mineB, m)}</time><button type="button" class="mx-ma" data-act="${esc(m.id || "")}" aria-label="Message options">${icon("chev", 14, 2.2)}</button></div><time class="out">${m.at ? fmtTime(m.at) : ""}${tk(mineB, m)}</time>${rxHtml(m)}</div></div>`;
      };
      const listingCard = (c) => c.listingId === "direct" ? "" : `<div class="mx-lcard"><div class="mx-limg"><img src="${esc(c.image)}" alt=""><span class="mx-badge">Available</span></div><div class="mx-lb"><div class="mx-lt"><h3>${esc(c.listingTitle)}</h3><span class="mx-lp">${naira(c.price)} <small>per year</small></span></div><p class="mx-lloc">${icon("pin", 16)} ${esc(c.area)}${/,/.test(c.area || "") ? "" : ", Lagos"}</p><div class="mx-lf"><span>${icon("bed", 18)} ${c.beds === 0 ? "Studio" : c.beds + " Beds"}</span><span>${icon("bath", 18)} ${c.baths} Baths</span></div></div><div class="mx-lact"><a class="btn mx-vl" href="#/home/${esc(c.listingId)}">View listing</a><a class="mx-ext" href="#/home/${esc(c.listingId)}" aria-label="Open listing">${icon("share", 18)}</a></div></div>`;
      // Everything that belongs to the open thread (its listeners, audio, a recording in progress, document listeners) is released in one place.
      const closeThread = () => {
        unsubM?.(); unsubM = null; unsubP?.(); unsubP = null; clearTimeout(drawChat.presT);
        drawChat.abortVoice?.(); drawChat.abortVoice = null; drawChat.stopAudio?.(); drawChat.stopTyping?.(); drawChat.offDoc?.(); drawChat.offDoc = null;
        drawChat.paintPin = drawChat.paintTyping = drawChat.paintSub = drawChat.sync = drawChat.retry = null; paintThread = () => {}; drawChat.gen = (drawChat.gen || 0) + 1; rc.pres = null;
      };
      const skelRows = (n) => Array.from({ length: n }, (_, i) => `<div class="mx-skb ${i % 3 === 1 ? "me" : ""}"><i style="width:${[46, 62, 38, 70, 54][i % 5]}%"></i></div>`).join("");
      const drawChat = () => {
        const c = convs().find((x) => x.id === cid); const chat = $("#chat"); if (!chat) return;
        if (!cid) { closeThread(); chat.dataset.cid = ""; chat.innerHTML = `<div class="mx-empty"><span>${icon("chatdots", 34)}</span><h2>${convs().length ? "Select a conversation" : "No messages yet"}</h2><p>${faxton() ? "Choose a person to reply as Faxton Rentals." : "Message a listing agent to start chatting."}</p></div>`; return; }
        if (!c) {
          // the list has not brought this conversation yet: show the chat frame with placeholders instead of flashing an empty screen
          const wait = !listsReady() || (staff && fetched.has(cid) && !fetchDone.has(cid)), key = wait ? "wait" : "gone";
          if (chat.dataset.cid === key) return; closeThread(); chat.dataset.cid = key;
          chat.innerHTML = wait ? `<header class="mx-head"><a class="mx-back" href="#/messages" aria-label="Back">${icon("left", 22)}</a><span class="mx-hav sk"></span><div class="mx-hn"><b class="mx-sk-l"></b><span class="mx-sk-l s"></span></div></header><div class="mx-thread" aria-busy="true" aria-label="Loading messages">${skelRows(6)}</div><div class="mx-comp ghost"></div>`
            : `<div class="mx-empty"><span>${icon("chatdots", 34)}</span><h2>This chat isn’t available</h2><p>It may have been removed, or it belongs to another account.</p><a class="btn sm" href="#/messages">Back to messages</a></div>`;
          return;
        }
        if (chat.dataset.cid === cid + mode) { drawChat.paintPin?.(c); drawChat.paintTyping?.(c); drawChat.sync?.(); return; }
        chat.dataset.cid = cid + mode; closeThread();
        const thisCid = cid, gen = drawChat.gen, mySide = sideOf(c), cur = () => convs().find((x) => x.id === thisCid) || c, alive = () => cid === thisCid && gen === drawChat.gen;
        rc.side = mySide;
        // Mark what I have seen: clears my unread flag and stamps rd.<side> (the other person's blue ticks). Only while the chat is on screen, and once per newest message.
        let reading = false, ackAt = 0, ackK = "";
        const ackNow = () => {
          if (!alive() || reading || document.visibilityState !== "visible") return; const cc = cur(); if (!RC.needsRead(cc, mySide)) return;
          // one write per newest message: the local copy of a just-written server time is empty for a moment, which must not trigger a second write
          const k = (cc.lastAt?.seconds || 0) + "." + (cc.lastAt?.nanoseconds || 0) + (cc.unread ? "u" : "") + (cc.staffUnread ? "s" : ""); if (k === ackK && Date.now() - ackAt < 2500) return; ackK = k; ackAt = Date.now(); reading = true;
          st.ackRead(thisCid, mySide).catch(() => { ackAt = 0; }).finally(() => { reading = false; });
        };
        const onVisible = () => { if (document.visibilityState === "visible") ackNow(); }; document.addEventListener("visibilitychange", onVisible);
        const prevOff = drawChat.offDoc; drawChat.offDoc = () => { prevOff?.(); document.removeEventListener("visibilitychange", onVisible); };
        ackNow();
        // The other person's presence (one small document while this thread is open) drives "Online / Last seen" and the delivered tick.
        const pUid = faxton() || byMe(c) ? c.uid : c.byStaff || "";
        let presDoc = null, pres = { state: "unknown", last: 0 };
        let lastSig = ""; const o2 = RC.otherSide(mySide);
        const sigOf = () => { const cc = cur(); return [cc.rd?.[o2]?.seconds, cc.rd?.[o2]?.nanoseconds, cc.dv?.[o2]?.seconds, pres.state, cc.unread, cc.staffUnread, !!cc.rd].join("|"); };
        lastSig = sigOf();
        drawChat.sync = () => { ackNow(); const sg = sigOf(); if (sg !== lastSig) { lastSig = sg; paintThread(); } };
        const applyPres = () => { if (!alive()) return; pres = RC.presenceInfo(presDoc); rc.pres = pres; drawChat.paintSub?.(); drawChat.sync?.(); clearTimeout(drawChat.presT); if (pres.expires) drawChat.presT = setTimeout(applyPres, Math.max(1000, pres.expires - Date.now() + 100)); };
        if (pUid && pUid !== me) unsubP = st.watchPresence(pUid, (d) => { presDoc = d; applyPres(); });
        const o = other(c), direct = c.listingId === "direct", agentView = !faxton() && !direct && !byMe(c);
        const seenAt = unreadFrom(cid); try { localStorage.setItem("seen_" + cid, String(Math.floor(Date.now() / 1000))); } catch {}
        chat.innerHTML = `<header class="mx-head"><a class="mx-back" href="#/messages" aria-label="Back">${icon("left", 22)}</a><button type="button" class="mx-hav" aria-label="View ${esc(o.name)}’s profile"><img src="${esc(o.avatar)}" alt="" referrerpolicy="no-referrer" decoding="async"></button><div class="mx-hn"><b><span class="mx-nm">${esc(o.name)}</span></b><span class="mx-sub" id="mxSub">${faxton() ? "Replying as Faxton Rentals" : esc(o.role)}</span></div>
          <div class="mx-acts"><button type="button" class="mx-ab mx-d" id="mxFind" aria-label="Search in this chat" title="Search in this chat">${icon("search", 21)}</button><button type="button" class="mx-ab" data-call="voice" aria-label="Voice call" title="Voice call">${icon("phone", 21)}</button><button type="button" class="mx-ab" data-call="video" aria-label="Video call" title="Video call">${icon("video", 21)}</button>
          <span class="mx-more"><button type="button" class="mx-dots" id="mxMore" aria-label="More options" aria-haspopup="menu">${icon("dots", 20)}</button><div class="menu mx-menu" id="mxMenu" role="menu" hidden><button role="menuitem" type="button" data-find class="mx-mfind">${icon("search", 18)} Search in chat</button>${agentView ? `<a role="menuitem" href="#/book/${esc(c.listingId)}">${icon("cal", 18)} Schedule viewing</a><a role="menuitem" href="#/agent/${esc(c.agent.id)}">${icon("user", 18)} View profile</a><a role="menuitem" href="#/home/${esc(c.listingId)}">${icon("home", 18)} View listing</a>` : ""}${faxton() ? `<a role="menuitem" href="#/admin/users">${icon("users", 18)} All users</a>` : ""}<a role="menuitem" href="#/messages" data-calls>${icon("phone", 18)} Call history</a>${agentView ? `<span id="mxSafe"></span>` : ""}${staff ? `<button role="menuitem" type="button" data-sw>${icon("share", 18)} Switch to ${faxton() ? "me" : "Faxton"}</button>` : ""}</div></span></div></header>
          <div class="mx-pin" id="mxPin" hidden></div>
          <div class="mx-find" id="mxFindBar" hidden><input id="mxFindIn" type="search" placeholder="Search in this chat…" aria-label="Search in this chat"></div>
          <div class="mx-thread" id="thread"></div><div class="mx-emoji" id="emoji" hidden>${EMOJI.map((e) => `<button type="button">${e}</button>`).join("")}</div>
          <div class="mx-reply" id="mxReply" hidden></div>
          <form class="mx-comp" id="cf" autocomplete="off"><div class="mx-rec" id="mxRec" hidden><button type="button" id="recX" aria-label="Cancel recording">${icon("trash", 20)}</button><i class="mx-rdot"></i><span id="recT">0:00</span><div class="mx-live" id="recW">${"<i></i>".repeat(28)}</div><button type="button" class="mx-recsend" id="recS" aria-label="Send voice message">${icon("send", 20)}</button></div><input type="file" id="mxFile" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv" multiple hidden><button type="button" class="mx-ib mx-circ" id="emojiBtn" aria-label="Emoji">${icon("smile", 22)}</button><button type="button" class="mx-ib mx-circ" id="mxAttach" aria-label="Add a photo" title="Add a photo">${icon("plus", 22)}</button><input id="ci" placeholder="${staff ? "Type a message… or /switch" : "Type a message"}" maxlength="2000" aria-label="Message"><button class="mx-send" id="sendB" aria-label="Send" type="submit"><span class="mx-mic">${icon("mic", 24)}</span><span class="mx-snd">${icon("send", 22)}</span></button></form>`;
        $$("[data-soon]", chat).forEach((b) => (b.onclick = () => toast("Coming soon.")));
        // Back goes one step back when the list is right below this chat in the history; otherwise it replaces the chat with the list (no pile of entries).
        const bk = $(".mx-back", chat); if (bk) bk.onclick = (e) => { e.preventDefault(); if (listBelow && history.length > 1) history.back(); else location.replace(location.href.split("#")[0] + "#/messages"); };
        // --- reply, pin, photos ---
        let replyTo = null, ms = MSG_CACHE.get(thisCid) || [], msLoaded = MSG_CACHE.has(thisCid), msErr = false, firstPaint = true;
        const paintReply = () => { const r = $("#mxReply"); if (!r) return; r.hidden = !replyTo; r.innerHTML = replyTo ? `<div><b>${esc(replyTo.name)}</b><span>${esc(replyTo.text)}</span></div><button type="button" aria-label="Cancel reply">${icon("x", 16)}</button>` : ""; const x = $("button", r); if (x) x.onclick = () => { replyTo = null; paintReply(); }; };
        const msgOf = (id) => ms.find((m) => m.id === id);
        const preview = (m) => (m.text || (m.image ? "📷 Photo" : m.audio ? "🎤 Voice message" : m.file ? "📎 " + (m.fname || "File") : m.type === "booking" ? "📅 Viewing" : "")).slice(0, 140);
        const startReply = (m) => { replyTo = { id: m.id, name: isMine(m, c) ? "You" : o.name, text: preview(m) }; paintReply(); $("#ci")?.focus(); };
        const paintPin = (cc) => { const pn = $("#mxPin"); if (!pn) return; const p0 = cc?.pinned; pn.hidden = !p0; pn.innerHTML = p0 ? `<span>${lic("pushpin", 16)}</span><button type="button" class="mx-pt" data-goto="${esc(p0.id)}"><b>Pinned message</b><span>${esc(p0.text || "📷 Photo")}</span></button><button type="button" class="mx-pu" aria-label="Unpin">${icon("x", 16)}</button>` : ""; const u = $(".mx-pu", pn); if (u) u.onclick = () => st.pinMessage(cid, null).catch((x) => toast(friendlyErr(x))); };
        paintPin(c); drawChat.paintPin = paintPin;
        // "typing…" under the name: the other side writes a small marker (at most every 4 seconds). We time it from when it arrives here, so device clocks never matter.
        let tyAt = c.typing?.at || 0, tyUntil = 0, tyTimer = null; const subTxt = $("#mxSub")?.textContent || "";
        // under the name: "typing…" while they type, else "Online" / "Last seen …" when they share it, else their role
        const paintSub = () => { const sub = $("#mxSub"); if (!sub) return; const on = Date.now() < tyUntil, pl = RC.presenceLine(pres); sub.textContent = on ? "typing…" : pl || subTxt; sub.classList.toggle("typing", on); sub.classList.toggle("online", !on && pres.state === "online"); };
        const paintTyping = (cc) => { const t = cc?.typing; if (!$("#mxSub")) return; if (t && t.uid !== me && t.at !== tyAt) { tyAt = t.at; tyUntil = Date.now() + 5000; clearTimeout(tyTimer); tyTimer = setTimeout(paintSub, 5100); } paintSub(); };
        drawChat.paintTyping = paintTyping; drawChat.paintSub = paintSub; drawChat.stopTyping = () => clearTimeout(tyTimer);
        let tySent = 0; $("#ci").addEventListener("input", (e) => { if (e.target.value.trim() && !String(e.target.value).startsWith("/") && Date.now() - tySent > 4000) { tySent = Date.now(); st.setTyping(cid, me); } });
        const jump = (id) => { const row = $(`[data-mid="${CSS.escape(id)}"]`); if (!row) return toast("That message is further up."); row.scrollIntoView({ block: "center", behavior: "smooth" }); row.classList.add("flash"); setTimeout(() => row.classList.remove("flash"), 1400); };
        const squeeze = (file) => new Promise((res, rej) => { if (!/^image\//.test(file.type)) return rej(new Error("Choose an image file.")); const img = new Image(), url = URL.createObjectURL(file); img.onload = () => { let w = Math.min(1280, img.width), q = 0.78, out = ""; for (let i = 0; i < 6; i++) { const cv = document.createElement("canvas"); cv.width = w; cv.height = Math.round(img.height * w / img.width); cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height); out = cv.toDataURL("image/jpeg", q); if (out.length < 380000) break; w = Math.round(w * 0.8); q = Math.max(0.5, q - 0.08); } URL.revokeObjectURL(url); out.length < 420000 ? res(out) : rej(new Error("That picture is too large.")); }; img.onerror = () => rej(new Error("That picture couldn’t be read.")); img.src = url; });
        const sendPics = async (files) => { for (const f of [...files].filter((x) => /^image\//.test(x.type)).slice(0, 6)) { try { const data = await squeeze(f), extra = { image: data }; if (replyTo) extra.reply = replyTo; replyTo = null; paintReply(); await send("", extra); } catch (x) { toast(friendlyErr(x)); } } };
        const send = (t, extra = {}) => (drawChat.stick = true, faxton() ? st.sendMessage(ctx.S.user, thisCid, t, extra, true, { staffUnread: false }, "s") : st.sendMessage(ctx.S.user, thisCid, t, extra, c.uid !== me, c.listingId === "direct" && c.uid === me ? { staffUnread: true } : {}, mySide));
        const file = $("#mxFile"); $("#mxAttach").onclick = () => file.click(); file.onchange = () => { sendFiles(file.files); file.value = ""; };
        chat.ondragover = (e) => { if ([...(e.dataTransfer?.types || [])].includes("Files")) { e.preventDefault(); chat.classList.add("drop"); } };
        chat.ondragleave = (e) => { if (e.target === chat || !chat.contains(e.relatedTarget)) chat.classList.remove("drop"); };
        chat.ondrop = (e) => { e.preventDefault(); chat.classList.remove("drop"); if (e.dataTransfer?.files?.length) sendFiles(e.dataTransfer.files); };
        $("#ci").addEventListener("paste", (e) => { const fs = [...(e.clipboardData?.files || [])]; if (fs.some((f) => /^image\//.test(f.type))) { e.preventDefault(); sendPics(fs); } });
        // The small menu for one message: reply, pin, copy.
        const react = async (m, emoji) => { try { await st.reactToMessage(cid, m.id, me, m.reactions?.[me] === emoji ? null : emoji); } catch (x) { toast(friendlyErr(x)); } };
        const mm = document.createElement("div"); mm.className = "menu mx-mm"; mm.hidden = true; chat.append(mm);
        const openMM = (id, x, y) => { const m = msgOf(id); if (!m) return; const pinned = c.pinned?.id === id || convs().find((z) => z.id === cid)?.pinned?.id === id; mm.innerHTML = `<div class="mx-react">${["👍", "❤️", "😂", "😮", "😢", "🙏"].map((e) => `<button type="button" data-r="${e}" class="${m.reactions?.[me] === e ? "on" : ""}">${e}</button>`).join("")}<button type="button" data-more aria-label="More emojis">${icon("plus", 18)}</button></div><div class="mx-rmore" hidden>${EMOJI.map((e) => `<button type="button" data-r="${e}">${e}</button>`).join("")}</div><button type="button" data-a="reply">${lic("reply", 16)} Reply</button><button type="button" data-a="pin">${lic("pushpin", 16)} ${pinned ? "Unpin" : "Pin"}</button>${m.text ? `<button type="button" data-a="copy">${icon("doc", 16)} Copy</button>` : ""}`; mm.hidden = false; const r = chat.getBoundingClientRect(); mm.style.left = Math.max(8, Math.min(x - r.left, r.width - 170)) + "px"; mm.style.top = Math.max(8, Math.min(y - r.top, r.height - 140)) + "px";
          mm.onclick = async (e) => { const btn = e.target.closest("button"); if (btn?.dataset.more !== undefined) { e.stopPropagation(); $(".mx-rmore", mm).hidden = false; return; } if (btn?.dataset.r) { mm.hidden = true; return react(m, btn.dataset.r); } const a = btn?.dataset.a; mm.hidden = true; if (a === "reply") startReply(m); else if (a === "copy") { try { await navigator.clipboard.writeText(m.text); toast("Copied."); } catch {} } else if (a === "pin") { try { await st.pinMessage(cid, pinned ? null : { id: m.id, text: preview(m).slice(0, 120), name: isMine(m, c) ? "You" : o.name }); } catch (x) { toast(friendlyErr(x)); } } }; };
        const offMM = (e) => { if (!e.target.closest(".mx-mm")) mm.hidden = true; }; document.addEventListener("click", offMM);
        const thread = $("#thread");
        thread.addEventListener("scroll", () => thread.classList.toggle("away", thread.scrollHeight - thread.scrollTop - thread.clientHeight > 260), { passive: true });
        thread.addEventListener("click", (e) => { if (e.target.closest(".mx-jump")) thread.scrollTo({ top: thread.scrollHeight, behavior: "smooth" }); });
        const sendFiles = async (files) => { for (const f of [...files].slice(0, 6)) { if (/^image\//.test(f.type)) { await sendPics([f]); continue; }
            if (f.size > 400000) { toast("Documents can be up to 400 KB here. Send a smaller file or share a link."); continue; }
            try { const data = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error("That file couldn’t be read.")); r.readAsDataURL(f); }); const extra = { file: data, fname: f.name.slice(0, 80), fsize: f.size }; if (replyTo) extra.reply = replyTo; replyTo = null; paintReply(); await send("", extra); } catch (x) { toast(friendlyErr(x)); } } };
        // --- voice messages ---
        let vr = null;
        const recUi = (on) => { $("#mxRec").hidden = !on; $("#cf").classList.toggle("recording", on); };
        const stopVoice = (send2) => { if (!vr) return; const v = vr; vr = null; v.finish(send2); };
        const startVoice = async () => {
          if (vr) return stopVoice(true);
          if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return toast("Voice messages aren’t supported on this device.");
          let stream; try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); } catch (x) { return toast(/NotFound|Overconstrained|DevicesNotFound/i.test(String(x?.name)) ? "No microphone was found on this device." : /NotReadable|TrackStart|Abort/i.test(String(x?.name)) ? "Your microphone is being used by another app. Close it and try again." : "Allow microphone access in your settings to send voice messages."); }
          const mime = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find((t) => MediaRecorder.isTypeSupported(t)) || "";
          const rec = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: 20000 }), chunks = [], peaks = [];
          rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
          let ac = null, an = null, buf = null; try { ac = new (window.AudioContext || window.webkitAudioContext)(); an = ac.createAnalyser(); an.fftSize = 512; ac.createMediaStreamSource(stream).connect(an); buf = new Uint8Array(an.fftSize); } catch {}
          const t0 = Date.now(), bars = [...$("#recW").children];
          const iv = setInterval(() => { let m = 0; if (an) { an.getByteTimeDomainData(buf); for (const x of buf) m = Math.max(m, Math.abs(x - 128)); } peaks.push(m / 128); bars.forEach((b, i) => { const v = peaks[peaks.length - bars.length + i] ?? 0; b.style.height = Math.max(8, Math.min(100, Math.round(v * 160))) + "%"; }); const sec = (Date.now() - t0) / 1000; $("#recT").textContent = fmtDurS(sec); if (sec >= 90) stopVoice(true); }, 100);
          vr = { finish: (doSend) => { clearInterval(iv); const dur = Math.round((Date.now() - t0) / 1000); rec.onstop = async () => { stream.getTracks().forEach((t) => t.stop()); try { ac?.close(); } catch {} recUi(false); if (!doSend || dur < 1 || !chunks.length) return; const blob = new Blob(chunks, { type: rec.mimeType || mime || "audio/webm" });
              const data = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); }); if (data.length > 560000) return toast("That voice message is too long. Keep it under a minute and a half.");
              const n = 40, wave = Array.from({ length: n }, (_, i) => { const a = Math.floor(i * peaks.length / n), z = Math.max(a + 1, Math.floor((i + 1) * peaks.length / n)); return Math.max(...peaks.slice(a, z), 0.04); }), mx = Math.max(...wave, 0.05);
              const extra = { audio: data, dur, wave: wave.map((w) => Math.max(10, Math.round(w / mx * 100))) }; if (replyTo) extra.reply = replyTo; replyTo = null; paintReply(); try { await send("", extra); } catch (x) { toast(friendlyErr(x)); } };
            try { rec.stop(); } catch { recUi(false); } } };
          rec.start(250); recUi(true); $("#recT").textContent = "0:00";
        };
        $("#recX").onclick = () => stopVoice(false); $("#recS").onclick = () => stopVoice(true); drawChat.startVoice = startVoice;
        drawChat.abortVoice = () => stopVoice(false); // leaving the chat mid-recording must release the microphone
        // play a voice message (the thread is repainted when messages arrive, so the player state is re-applied after every paint)
        let playing = null;
        const paintPlay = () => { $$("[data-vn]", thread).forEach((box) => { const on = !!playing && playing.id === box.dataset.vn, a = playing?.a; const pb = $(".mx-play", box), sl = $(".mx-wv", box), playingNow = on && !a.paused; box.classList.toggle("playing", playingNow); pb.setAttribute("aria-label", playingNow ? "Pause voice message" : "Play voice message"); const mm0 = msgOf(box.dataset.vn), dur0 = on && isFinite(a.duration) && a.duration ? a.duration : mm0?.dur || 0, f = on && dur0 ? Math.min(1, a.currentTime / dur0) : 0; sl.setAttribute("aria-valuenow", String(Math.round(f * 100))); $$(".mx-wv i", box).forEach((b, i, all) => b.classList.toggle("on", on && i / all.length < f)); const vd = $(".mx-vd", box), m = msgOf(box.dataset.vn); if (vd && m) vd.textContent = on && a.currentTime > 0 ? fmtDurS(a.currentTime) : fmtDurS(m.dur); }); };
        drawChat.paintPlay = paintPlay; drawChat.stopAudio = () => { try { playing?.a.pause(); } catch {} playing = null; };
        thread.addEventListener("click", (e) => { const btn = e.target.closest(".mx-play"); if (!btn) return; const box = btn.closest("[data-vn]"), id = box.dataset.vn, m = msgOf(id); if (!m) return;
          if (playing && playing.id === id) { playing.a.paused ? playing.a.play().catch(() => {}) : playing.a.pause(); return; }
          drawChat.stopAudio(); paintPlay();
          const a = new Audio(m.audio); a.preload = "auto"; playing = { id, a };
          ["play", "pause", "timeupdate"].forEach((ev) => a.addEventListener(ev, paintPlay));
          a.addEventListener("ended", () => { if (playing?.a === a) playing = null; paintPlay(); });
          a.addEventListener("error", () => { if (playing?.a === a) playing = null; paintPlay(); });
          a.play().catch(() => { if (playing?.a === a) playing = null; paintPlay(); toast("Couldn’t play that voice message on this device."); }); });
        // tap or arrow-key the waveform to seek (starts the message first if it is not the one playing)
        const seekTo = (box, f) => { const id = box.dataset.vn, m = msgOf(id); if (!m) return; if (!(playing && playing.id === id)) $(".mx-play", box).click(); const a = playing?.a; if (!a) return; const go = () => { const d = isFinite(a.duration) && a.duration ? a.duration : m.dur || 0; if (d) { a.currentTime = Math.min(d - 0.05, Math.max(0, f * d)); paintPlay(); } }; a.readyState > 0 ? go() : a.addEventListener("loadedmetadata", go, { once: true }); };
        thread.addEventListener("click", (e) => { const wv = e.target.closest(".mx-wv"); if (!wv) return; const r = wv.getBoundingClientRect(); seekTo(wv.closest("[data-vn]"), Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))); });
        thread.addEventListener("keydown", (e) => { const wv = e.target.closest?.(".mx-wv"); if (!wv) return; const box = wv.closest("[data-vn]"), now = (+wv.getAttribute("aria-valuenow") || 0) / 100; if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); seekTo(box, now + (e.key === "ArrowRight" ? 0.05 : -0.05)); } else if (e.key === " " || e.key === "Enter") { e.preventDefault(); $(".mx-play", box).click(); } });
        // Tap a picture to see that person's profile; businesses and verified agents get the green tick.
        const showProfile = async () => {
          let uid = "", role = "user";
          if (faxton() || byMe(c)) { uid = c.uid; role = "user"; }
          else if (c.listingId === "direct") role = "team";
          else { const l = await listingOf(c.listingId); uid = l?.ownerUid || c.agent.id || ""; const pb = await st.getPublic(uid); role = ["agent", "agency", "landlord"].includes(pb?.role) ? pb.role : "agent"; }
          const imgs = ms.filter((m) => m.image).map((m) => ({ type: "image", src: m.image }));
          openProfile(ctx, { uid, name: o.name, avatar: o.avatar && !o.avatar.startsWith("data:") ? o.avatar : "", role, area: agentView ? c.area : "", media: ms.filter((m) => m.image || m.file), links: [...new Set(ms.flatMap((m) => (String(m.text || "").match(/https?:\/\/[^\s<>"']+/g) || [])))], onImage: (i) => openViewer(imgs, i),
            pinned: convs().find((z) => z.id === cid)?.pinned, onMessage: () => $("#ci")?.focus(), onCall: (k) => beginCall(c, k), onSearch: () => { const bar = $("#mxFindBar"); bar.hidden = false; $("#mxFindIn").focus(); },
            onMedia: () => (imgs.length ? openViewer(imgs, 0) : toast("Documents are saved with their messages. Use the download button on each one.")), onPinned: () => jump(convs().find((z) => z.id === cid)?.pinned?.id),
            ...(safety && safety.uid() ? { onBlock: () => safety.block(), blocked: safety.blocked() } : {}), ...(safety ? { onReport: () => safety.report() } : {}) });
        };
        const hav = $(".mx-hav"); if (hav) hav.onclick = showProfile;
        thread.addEventListener("click", (e) => { const av = e.target.closest(".mx-bav"); if (av && !av.closest(".me")) showProfile(); });
        // a green tick next to the name when the person is verified
        (async () => { let ver = c.listingId === "direct" && !faxton() && !byMe(c); if (!ver && !faxton() && agentView) { const l = await listingOf(c.listingId); ver = !!(await st.getPublic(l?.ownerUid || c.agent.id))?.verified; } else if (faxton() || byMe(c)) ver = !!(await st.getPublic(c.uid))?.verified; if (!alive()) return; const nm = $(".mx-hn b"); if (ver && nm && !nm.querySelector(".vseal")) nm.insertAdjacentHTML("beforeend", " " + verifiedBadge(18)); })();
        // call back from a missed-call card
        thread.addEventListener("click", (e) => { const cb = e.target.closest("[data-cb2]"); if (cb) beginCall(c, "voice"); });
        thread.addEventListener("click", (e) => { const dl = e.target.closest(".mx-dl"); if (!dl) return; e.preventDefault(); const m = msgOf(dl.closest("[data-mid]")?.dataset.mid); if (m?.file) SAFE.saveFile(m.file, m.fname || "file"); });
        thread.addEventListener("click", (e) => { const a = e.target.closest("[data-act]"); if (a) { e.stopPropagation(); const r = a.getBoundingClientRect(); return openMM(a.dataset.act, r.left - 120, r.bottom + 6); } const g = e.target.closest("[data-goto]"); if (g) return jump(g.dataset.goto); const pc2 = e.target.closest("[data-pic]"); if (pc2) openViewer([{ type: "image", src: pc2.src }], 0); });
        thread.addEventListener("click", (e) => { const rb = e.target.closest("[data-rx]"); if (rb) { const m = msgOf(rb.dataset.mid2); if (m) react(m, rb.dataset.rx); } });
        thread.addEventListener("dblclick", (e) => { const b = e.target.closest(".mx-b"); const row = b?.closest("[data-mid]"); if (row && !e.target.closest("a,button,audio,.mx-vn")) { const m = msgOf(row.dataset.mid); if (m) react(m, "❤️"); } });
        thread.addEventListener("contextmenu", (e) => { const row = e.target.closest("[data-mid]"); if (row) { e.preventDefault(); openMM(row.dataset.mid, e.clientX, e.clientY); } });
        // Swipe a message sideways to reply to it; hold it to open the menu (phones).
        let sx = 0, sy = 0, row = null, dx = 0, lp = null, moved = false;
        thread.addEventListener("touchstart", (e) => { row = e.target.closest("[data-mid]"); if (!row || e.touches.length !== 1) return; sx = e.touches[0].clientX; sy = e.touches[0].clientY; dx = 0; moved = false; const id = row.dataset.mid, t = e.touches[0]; lp = setTimeout(() => { if (!moved) { navigator.vibrate?.(15); openMM(id, t.clientX, t.clientY); } }, 520); }, { passive: true });
        thread.addEventListener("touchmove", (e) => { if (!row) return; const t = e.touches[0], mx = t.clientX - sx, my = t.clientY - sy; if (!moved && Math.abs(mx) > 12 && Math.abs(mx) > Math.abs(my) * 1.4) moved = true; if (Math.abs(my) > 14 && !moved) { clearTimeout(lp); row = null; return; } if (moved) { clearTimeout(lp); dx = Math.max(-80, Math.min(80, mx)); const w = row.querySelector(".mx-bw"); if (w) w.style.transform = `translateX(${dx}px)`; row.classList.toggle("swipe", Math.abs(dx) > 52); } }, { passive: true });
        const endSwipe = () => { clearTimeout(lp); if (!row) return; const w = row.querySelector(".mx-bw"); if (w) { w.style.transition = "transform .18s"; w.style.transform = ""; setTimeout(() => (w.style.transition = ""), 200); } if (moved && Math.abs(dx) > 52) { const m = msgOf(row.dataset.mid); if (m) startReply(m); } row.classList.remove("swipe"); row = null; moved = false; };
        thread.addEventListener("touchend", endSwipe); thread.addEventListener("touchcancel", endSwipe);
        const ciEl = $("#ci"), sendB = $("#sendB"); const syncSend = () => sendB.classList.toggle("has", !!ciEl.value.trim()); ciEl.addEventListener("input", syncSend);
        $("#mxFind").onclick = () => { const bar = $("#mxFindBar"); bar.hidden = !bar.hidden; if (!bar.hidden) $("#mxFindIn").focus(); else { tfind = ""; $("#mxFindIn").value = ""; paintThread(); } };
        $("#mxFindIn").oninput = (e) => { tfind = e.target.value.trim().toLowerCase(); paintThread(); };
        $$("[data-call]", chat).forEach((b) => (b.onclick = () => beginCall(c, b.dataset.call)));
        const menu = $("#mxMenu"); $("#mxMore").onclick = (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; };
        const closeMenu = () => { menu.hidden = true; }; document.addEventListener("click", closeMenu);
        const onEsc = (e) => { if (e.key === "Escape") { mm.hidden = true; menu.hidden = true; } }; document.addEventListener("keydown", onEsc);
        const prevOff2 = drawChat.offDoc; drawChat.offDoc = () => { prevOff2?.(); document.removeEventListener("click", offMM); document.removeEventListener("click", closeMenu); document.removeEventListener("keydown", onEsc); };
        const mf = $("[data-find]", menu); if (mf) mf.onclick = () => { closeMenu(); $("#mxFind").click(); };
        const cl = $("[data-calls]", menu); if (cl) cl.onclick = (e) => { e.preventDefault(); tab = "calls"; drawSide(); closeMenu(); };
        // Block and report the person on the other side (listing owners and agents).
        let safety = null;
        if (agentView) {
          let ouid = "", blocked = false;
          const paint = () => {
            const box = $("#mxSafe"); if (!box || !alive()) return;
            box.innerHTML = `${ouid ? `<button role="menuitem" type="button" data-blk>${icon("shield", 18)} ${blocked ? "Unblock user" : "Block user"}</button>` : ""}<button role="menuitem" type="button" data-rep class="danger-i">${icon("flag", 18)} Report user</button>`;
            const ci = $("#ci"); if (ci) { ci.disabled = blocked; ci.placeholder = blocked ? "You blocked this user. Unblock to message." : "Type a message…"; }
            const bk = $("[data-blk]", box); if (bk) bk.onclick = async () => { closeMenu(); if (blocked) { try { await st.unblockUser(ctx.S.user, ouid); blocked = false; toast("Unblocked."); paint(); } catch (x) { toast(friendlyErr(x)); } } else if (await SAFE.blockDialog(ctx, { uid: ouid, name: o.name })) { blocked = true; paint(); } };
            $("[data-rep]", box).onclick = () => { closeMenu(); SAFE.reportDialog(ctx, { targetUid: ouid || c.agent.id, targetName: o.name, convId: cid }); };
          };
          const doBlock = async () => { if (blocked) { try { await st.unblockUser(ctx.S.user, ouid); blocked = false; toast("Unblocked."); paint(); } catch (x) { toast(friendlyErr(x)); } } else if (await SAFE.blockDialog(ctx, { uid: ouid, name: o.name })) { blocked = true; paint(); } };
          safety = { uid: () => ouid, blocked: () => blocked, block: () => ouid && doBlock(), report: () => SAFE.reportDialog(ctx, { targetUid: ouid || c.agent.id, targetName: o.name, convId: cid }) };
          paint();
          listingOf(c.listingId).then(async (l) => { ouid = l?.ownerUid && l.ownerUid !== me ? l.ownerUid : ""; blocked = ouid ? await st.isBlocked(me, ouid) : false; paint(); }).catch(() => {});
        }
        const sw = $("[data-sw]", menu); if (sw) sw.onclick = () => { closeMenu(); switchMode(); };
        const em = $("#emoji"); $("#emojiBtn").onclick = () => (em.hidden = !em.hidden); em.onclick = (e) => { const b = e.target.closest("button"); if (b) { $("#ci").value += b.textContent; $("#ci").focus(); } };
        $("#cf").onsubmit = async (e) => {
          e.preventDefault(); const i = $("#ci"), t = i.value.trim();
          // an empty box starts a voice note only from the mic button, never from pressing Enter
          if (!t) { if (enterKey) { enterKey = false; return; } return startVoice(); }
          enterKey = false;
          if (staff && t.toLowerCase() === "/switch") { i.value = ""; return switchMode(); }
          i.value = ""; syncSend(); em.hidden = true;
          const was = replyTo; try { const extra = replyTo ? { reply: replyTo } : {}; replyTo = null; paintReply(); await send(t, extra); } catch (x) { toast(friendlyErr(x)); if (!i.value) { i.value = t; syncSend(); } if (was && !replyTo) { replyTo = was; paintReply(); } }
        };
        let enterKey = false; $("#ci").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.isComposing) { enterKey = true; setTimeout(() => (enterKey = false), 300); } });
        paintThread = () => {
          const th = $("#thread"); if (!th) return;
          // nothing to show yet: placeholders while the first snapshot is on its way, a clear message if it failed (never the "say hello" empty state)
          if (!ms.length && !msLoaded) {
            th.setAttribute("aria-busy", String(!msErr));
            th.innerHTML = msErr ? `<div class="mx-err" role="alert"><b>Couldn’t load this conversation</b><p>Check your connection and try again.</p><button type="button" class="btn sm" data-retry>Try again</button></div>` : skelRows(7);
            const rt = $("[data-retry]", th); if (rt) rt.onclick = () => drawChat.retry?.();
            return;
          }
          th.removeAttribute("aria-busy");
          const near = th.scrollHeight - th.scrollTop - th.clientHeight < 80, keepTop = th.scrollTop, firstReal = firstPaint && ms.length > 0;
          const items = [...ms.map((m) => ({ t: m.at?.seconds || Date.now() / 1000, m })), ...calls.filter((x) => x.convId === cid && x.callerUid && (x.status !== "ringing" || Date.now() / 1000 - (x.createdAt?.seconds || 0) < 90)).map((x) => ({ t: x.createdAt?.seconds || Date.now() / 1000, k: x }))].sort((a, b) => a.t - b.t);
          const out = []; let day = "", first = true;
          let divDone = false; const newCount = items.filter((x) => !x.k && !isMine(x.m, c) && x.t > seenAt).length;
          items.forEach((it) => {
            if (!divDone && seenAt && newCount && !it.k && !isMine(it.m, c) && it.t > seenAt) { divDone = true; out.push(`<div class="mx-unread"><span>${newCount} unread message${newCount > 1 ? "s" : ""}</span></div>`); }
            const d = dayLabel(it.t); if (d !== day) { day = d; out.push(`<span class="mx-day">${d}</span>`); }
            if (it.k) out.push(callCard(it.k)); else if (!tfind || String(it.m.text || "").toLowerCase().includes(tfind)) { out.push(bubble(it.m, c)); if (first) { out.push(listingCard(c)); first = false; } }
          });
          if (first) out.push(listingCard(c));
          th.innerHTML = `${out.join("") || `<div class="mx-hello">Say hello to ${esc(o.name.split(" ")[0])} 👋</div>`}${agentView ? `<div class="mx-quick"><a href="#/book/${esc(c.listingId)}">${icon("cal", 20)}<span>Schedule Viewing</span></a><a href="#/documents">${icon("doc", 20)}<span>Send Documents</span></a><button type="button" data-qcall>${icon("phone", 20)}<span>Call Agent</span></button></div>` : ""}<div class="mx-jumpw"><button type="button" class="mx-jump" aria-label="Jump to the latest message">${icon("chev", 20, 2.2)}</button></div>`;
          const q = $("[data-qcall]", th); if (q) q.onclick = () => beginCall(c, "voice");
          drawChat.paintPlay?.();
          // the first time a chat opens with unread messages, land on them (like a phone messenger) instead of the very bottom
          const u0 = firstPaint && ms.length ? $(".mx-unread", th) : null; if (ms.length) firstPaint = false;
          if (u0) { th.scrollTop += u0.getBoundingClientRect().top - th.getBoundingClientRect().top - 56; return; }
          if (near || firstReal || items.length < 3 || drawChat.stick) { th.scrollTop = th.scrollHeight; drawChat.stick = false; $$("img.mx-pic,.mx-lcard img", th).forEach((im) => { if (!im.complete) im.addEventListener("load", () => { if (!th.classList.contains("away")) th.scrollTop = th.scrollHeight; }, { once: true }); }); }
          else th.scrollTop = keepTop; // somebody scrolled up to read: a repaint (new tick, new reaction) must not move them
        };
        // the thread: shown at once from what was loaded before (if anything), then kept live by one listener that is released when the chat closes or switches
        let n0 = -1;
        const subMsgs = () => {
          unsubM?.(); msErr = false;
          unsubM = st.watchMessages(thisCid, (list) => {
            if (!alive()) return; const lm = list[list.length - 1];
            if (n0 >= 0 && list.length > n0 && lm && lm.at && lm.from !== me) playSound("message");
            n0 = list.length; ms = list; msLoaded = true; msErr = false; cacheThread(thisCid, list); paintThread(); ackNow();
          }, () => { if (!alive()) return; msErr = true; paintThread(); });
        };
        drawChat.retry = () => { if (!alive()) return; msErr = false; paintThread(); subMsgs(); };
        subMsgs(); paintThread();
      };
      const refresh = () => {
        // A conversation opened from the admin console belongs to the Faxton inbox. If the lists haven't brought it, fetch it directly (once).
        if (staff && cid && listsReady() && !mine.some((x) => x.id === cid) && !team.some((x) => x.id === cid) && !fetched.has(cid)) {
          fetched.add(cid);
          st.getConversation(cid).then((c) => { if (c && c.byStaff === me) { dms = [c, ...dms.filter((x) => x.id !== c.id)]; merge(); } else if (c && c.listingId === "direct") team = [c, ...team.filter((x) => x.id !== c.id)]; fetchDone.add(cid); refresh(); });
        }
        if (staff && cid && mode === "personal" && !mine.some((x) => x.id === cid) && team.some((x) => x.id === cid)) { mode = "faxton"; try { sessionStorage.setItem("msgMode", mode); } catch {} drawSide(); } else if ($("#convs")) { drawList(); } else drawSide();
        if (staff) PRES.ackDelivery([...dms, ...team], "s");
        warmPhotos(faxton() ? team : dms); drawChat();
      };
      const remember = () => { LISTS.uid = me; LISTS.base = base; LISTS.dms = dms; LISTS.team = team; };
      // Open or leave a chat without re-running the page: the lists and listeners stay, only the thread pane changes (called by main.js on hashchange).
      const navTo = (next) => {
        next = next || ""; if (next === cid) return;
        listBelow = !cid && !!next; cid = next; ctx.S.openChat = cid;
        $(".mx-shell")?.classList.toggle("has-chat", !!cid); root.classList.toggle("in-chat", !!cid);
        const axr = document.querySelector(".ax"); if (axr) { if (cid) axr.setAttribute("data-chat", ""); else axr.removeAttribute("data-chat"); }
        fitVV(); syncOn(); refresh();
      };
      ctx.S.msgNav = (path) => { if (!(path === "/messages" || path.startsWith("/messages/"))) return false; navTo(decodeURIComponent(path.split("/")[2] || "")); return true; };
      // Seed from the last visit so a full page re-run never starts from empty lists.
      if (LISTS.uid === me) { base = LISTS.base; dms = LISTS.dms; team = LISTS.team; merge(); loaded = true; dmsLoaded = teamLoaded = true; }
      const unsubC = st.watchConversations(ctx.S.user, (c) => { loaded = true; base = c; merge(); remember(); refresh(); });
      const unsubD = staff ? st.watchStaffDMs(me, (c) => { dmsLoaded = true; dms = c; merge(); remember(); refresh(); }) : null;
      const unsubT = staff ? st.watchStaffConversations((c) => { teamLoaded = true; team = c.length || !team.length ? c : team; teamErr = false; remember(); refresh(); }, () => { teamLoaded = true; teamErr = true; refresh(); }) : null;
      const unsubL = CALLS.watchLogs(me, (l) => { callsLoaded = true; calls = l; CALLS.warmPeers(l, me, () => { if ($("#convs") && tab === "calls") drawList(); }); if ($("#convs")) drawList(); else drawSide(); paintThread(); });
      drawSide(); drawChat();
      ctx.S.cleanups.push(() => { unsubC(); unsubD?.(); unsubT?.(); unsubL(); closeThread(); ctx.S.msgNav = null; ctx.S.openChat = ""; root.classList.remove("in-chat"); root.style.removeProperty("--mx-vvh"); vv?.removeEventListener("resize", fitVV); vv?.removeEventListener("scroll", fitVV); });
    } };
}

// ---------- settings ----------
const SET_NAV = [["profile", "user", "Profile"], ["account", "shield", "Account and security"], ["notifications", "bell", "Notifications"], ["privacy", "lock", "Privacy"], ["appearance", "monitor", "Appearance"], ["help", "help", "Help and app"]];
const SET_TITLE = { profile: ["Profile", "Your details, photo and what you’re looking for."], account: ["Account and security", "How you sign in, and keeping your account safe."], notifications: ["Notifications", "Choose which alerts you see in the app."], appearance: ["Appearance", "Pick how Faxton Rentals looks on this device."], privacy: ["Privacy", "Decide what agents can see, and ask for your data."], help: ["Help and app", "Answers, the quick tour and app updates."] };
const BUD = [["", "No preference"], ["0-2000000", "Up to ₦2,000,000"], ["2000000-4000000", "₦2,000,000 to ₦4,000,000"], ["4000000-6000000", "₦4,000,000 to ₦6,000,000"], ["6000000-0", "₦6,000,000 and above"]];
const NOTIFY = [["messages", "mail", "New messages", "When an agent or owner replies to you."], ["viewings", "cal", "Viewing updates", "Confirmations, changes and reminders for your viewings."], ["applications", "doc", "Application updates", "When the status of an application changes."], ["payments", "wallet", "Payment updates", "When a payment you sent is confirmed or needs attention."], ["offers", "tag", "Offers", "Replies and counter-offers on your rent offers."]];
const PRIVACY = [["sharePhone", "phone", "Share my phone number", "Let agents I message see my phone number."], ["sharePrefs", "sliders3", "Share my rental preferences", "Help agents suggest homes that suit you."], ["showOnline", "eye", "Show when I’m online", "People you message can see when you’re online and your last seen time, and get a delivery tick when your app receives a message. Turn it off and they only see a read tick once you open the chat."]];
const sw = (g, k, on, label) => `<button type="button" class="switch ${on ? "on" : ""}" role="switch" aria-checked="${!!on}" data-sw="${g}.${k}" aria-label="${esc(label || k)}"><i></i></button>`;
const swRow = (g, k, ic, t, d, on) => `<div class="rf-sw"><span class="rf-sw-ic">${icon(ic, 20, 1.7)}</span><div><b>${t}</b><p>${d}</p></div>${sw(g, k, on, t)}</div>`;
const themeCards = (pref) => `<div class="rf-theme" role="radiogroup" aria-label="Theme">${[["light", "sun", "Light"], ["dark", "moon", "Dark"], ["system", "monitor", "Match my device"]].map(([k, i, l]) => `<button type="button" class="${pref === k ? "on" : ""}" role="radio" aria-checked="${pref === k}" data-theme-pref="${k}"><span class="rf-theme-prev ${k}"><i></i><i></i><i></i></span>${icon(i, 20, 1.6)}<b>${l}</b><em class="rf-rd"></em></button>`).join("")}</div>`;

function settings(ctx, section) {
  const u = ctx.S.user, p = ctx.S.profile || {}, role = ctx.S.isOwner ? "owner" : ctx.S.role;
  if (!SET_TITLE[section]) section = "profile";
  const notify = { messages: true, viewings: true, applications: true, payments: true, offers: true, ...(p.notify || {}) }, privacy = { sharePhone: false, sharePrefs: true, showOnline: true, ...(p.privacy || {}) };
  const pr = p.prefs || {}, name = u.displayName || p.name || "", pwd = u.providerData.some((x) => x.providerId === "password"), google = u.providerData.some((x) => x.providerId === "google.com");
  const verified = `<span class="rf-pill ${u.emailVerified ? "ok" : "warn"}"><i></i>${u.emailVerified ? "Verified" : "Not verified"}</span>`;
  const nav = `<aside class="rf-set-nav" aria-label="Settings sections"><h2>Settings</h2><div class="rf-set-links">${SET_NAV.map(([k, ic, l]) => `<a class="${k === section ? "on" : ""}" href="#/settings/${k}" ${k === section ? 'aria-current="page"' : ""}>${icon(ic, 20)}<span>${l}</span></a>`).join("")}</div><button type="button" id="out" class="rf-set-out">${icon("logout", 20)}<span>Sign out</span></button></aside>`;
  const card = (t, sub, inner, cls = "") => `<section class="rf-card ${cls}"><div class="rf-card-h"><div><h3>${t}</h3>${sub ? `<p>${sub}</p>` : ""}</div></div>${inner}</section>`;
  const lastDl = () => { const t = MYDATA.lastDownload(u.uid); return t ? `Last download: ${new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.` : "You haven’t downloaded your data yet."; };
  const dataCard = () => card("Your data", "Under Nigeria’s data protection law you can get a copy of the personal data we hold about you, ask us to correct it, or delete it.", `<div class="rf-actions" style="margin-top:0"><button class="btn primary" id="dataDl">${icon("download", 17)} Download my data</button><button class="btn" id="dataReq">Ask us to email it</button></div>
      <p class="rf-meta" style="margin-top:10px"><span id="dataLast">${lastDl()}</span> We check it’s you first, and keep a note that you downloaded it, never what was in it.</p>
      <div class="rf-actions"><button class="btn ghost" id="dataFix">Ask for a correction</button><a class="btn ghost" href="#/privacy">Read the Privacy Policy</a></div>
      <p class="rf-meta" style="margin-top:6px">To have your account and data deleted, use “Delete account” below.</p>`);
  const shell = APPS.shellInfo(), autoUpd = !!pr.autoUpdate;
  const updCard = card("App updates", shell ? `You’re using the ${shell.platform.startsWith("mac") ? "Mac" : shell.platform === "windows" ? "Windows" : shell.platform === "android" ? "Android" : "iPhone"} app, version ${esc(shell.version)}.` : "On the web you always get the newest version automatically. Installed apps can update themselves too.",
    `<div class="rf-sw first"><span class="rf-sw-ic">${icon("download", 20, 1.7)}</span><div><b>Automatic updates</b><p>Download new versions as soon as they’re ready.</p></div><button type="button" class="switch ${autoUpd ? "on" : ""}" role="switch" aria-checked="${autoUpd}" id="autoUpd" aria-label="Automatic updates"><i></i></button></div>${shell ? `<div class="rf-actions"><button class="btn" id="chkUpd">Check for updates</button></div>` : ""}`);
  const apCard = card("Theme", "Choose how Faxton Rentals looks on your device.", themeCards(ctx.themePref()));
  const ntCard = card("Alerts", "These show up in the bell and as banners in the app. We don’t send marketing email.", NOTIFY.map(([k, ic, t, d], i) => swRow("notify", k, ic, t, d, notify[k]).replace('class="rf-sw"', i ? 'class="rf-sw"' : 'class="rf-sw first"')).join(""));
  const avatar = p.photo ? `<img class="rf-avatar" src="${esc(p.photo)}" alt="">` : `<span class="rf-avatar">${esc(initials(name || u.email))}</span>`;
  let body;
  if (section === "profile") body = `<form id="pf" class="rf-col" novalidate>
      ${card("Your profile", "", `<div class="rf-pd"><div class="rf-avwrap">${avatar}<button type="button" class="rf-avcam" id="photoBtn" aria-label="Change photo">${icon("camera", 16)}</button><input type="file" id="photo" accept="image/*" hidden></div><div><b class="rf-pd-name">${esc(name || "Your name")}</b><p class="rf-meta">${esc(u.email)}</p><div class="rf-pd-btns"><button type="button" class="btn sm" id="photoBtn2">${icon("camera", 15)} ${p.photo ? "Change photo" : "Add a photo"}</button>${GPH(u) ? `<button type="button" class="btn sm" id="photoG">Use my Google photo</button>` : ""}${p.photo ? `<button type="button" class="btn sm ghost" id="photoRm">Remove</button>` : ""}</div></div></div>
        <div class="rf-form"><div class="rf-grid2"><label class="rf-fl">Full name<input id="nm" value="${esc(name)}" autocomplete="name" maxlength="120"></label>
          <label class="rf-fl">Email address<span class="rf-input-wrap"><input value="${esc(u.email)}" disabled>${verified.replace('class="rf-pill', 'class="rf-tag rf-pill')}</span></label>
          <label class="rf-fl">Phone number<input id="ph" type="tel" inputmode="tel" placeholder="e.g. 0803 000 0000" value="${esc(p.phone || "")}" autocomplete="tel" maxlength="30"></label>
          <label class="rf-fl">About you <span class="rf-help">Shown on your profile card</span><input id="ab" maxlength="160" placeholder="A short line about you" autocomplete="off"></label>
          ${locFields({ style: "rf", ids: { country: "lcc", state: "lcs", lga: "lct" }, ...legacyLoc(p) })}</div>
        <p class="rf-meta">Your phone number is only shared when you choose. See Privacy.</p></div>`)}
      ${card("Rental preferences", "Helps us show you homes that fit.", `<div class="rf-grid3"><label class="rf-fl">Where<select id="pl">${AREAS.filter((a) => a[0]).map(([c, l]) => `<option value="${c}" ${c === (pr.area || "lekki") ? "selected" : ""}>${l}</option>`).join("")}</select></label>
        <label class="rf-fl">Home type<select id="pt"><option value="">Any type</option>${typeOptions(pr.type)}</select></label>
        <label class="rf-fl">Yearly budget<select id="pb">${BUD.map(([v, l]) => `<option value="${v}" ${v === (pr.budget || "") ? "selected" : ""}>${l}</option>`).join("")}</select></label></div>`)}
      <p class="rf-err" id="perr" role="alert"></p>
      <div class="rf-actions" style="margin:0"><button class="btn primary" type="submit">Save changes</button><button class="btn ghost" type="button" id="cancel">Discard</button></div></form>`;
  else if (section === "account") body = `<div class="rf-col">${card("Sign-in", "", `<div class="rf-kv"><div><span>Email</span><b class="rf-kv-em">${esc(u.email)} ${verified}</b></div><div><span>Account type</span><b style="text-transform:capitalize">${esc(role)}</b></div><div><span>Sign-in method</span><b>${u.providerData.map((x) => (x.providerId === "google.com" ? "Google" : "Email and password")).join(", ")}</b></div></div>
      ${!u.emailVerified && pwd ? `<div class="rf-actions"><button class="btn" id="resendV">Resend verification email</button></div>` : ""}`)}
      <div id="lockCard"></div>
      ${pwd ? card("Password", "Change it with a secure link we email to you. Nobody can see or read your password, not even us.", `<div class="rf-actions" style="margin-top:0"><button class="btn" id="resetPw">${icon("mail", 17)} Email me a password reset link</button></div><p class="rf-meta" id="resetNote" style="margin-top:10px"></p>`) : card("Password", "", `<p class="rf-muted">You sign in with Google, so there’s no Faxton password. To change how you sign in, manage your Google account.</p>`)}
      ${card("Signed in on other devices?", "", `<p class="rf-muted" style="margin:0 0 12px">Sign out here at any time. If you think someone else has access, reset your password: that signs your account out on your other devices.${google && !pwd ? " For a Google account, also review security in your Google account." : ""}</p><div class="rf-actions" style="margin-top:0"><button class="btn" id="out2">${icon("logout", 17)} Sign out on this device</button>${pwd ? `<button class="btn" id="resetPw2">Reset password to sign out other devices</button>` : ""}</div>`)}
      ${dataCard()}
      ${(() => { const d = ctx.S.profile?.deletion; return d?.status === "pending" ? card("Account deletion requested", "", `<p class="rf-muted" style="margin:0 0 12px">You asked to delete your account on ${new Date(d.requestedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}. Our team reviews every request, which takes about a day. Nothing is deleted until then, and you can cancel now.</p><div class="rf-actions" style="margin-top:0"><button class="btn" id="cancelDel">Cancel deletion</button></div>`, "rf-danger") : d?.status === "approved" ? card("Account scheduled for deletion", "", `<p class="rf-muted" style="margin:0">Your request was approved. Your account will be removed the next time it’s opened after the one-day review period ends.</p>`, "rf-danger") : card("Delete account", "Remove your account and its data.", `<p class="rf-muted" style="margin:0 0 12px">Our team reviews every request, which takes about a day, and you can cancel before it’s approved. Some records, like payment confirmations, may be kept where the law requires.</p><div class="rf-actions" style="margin-top:0"><button class="btn red-o" id="delAcct">${icon("trash", 17)} Delete my account</button></div>`, "rf-danger"); })()}
      ${ctx.S.isAdmin ? card("Admin console", "Manage listings, users, applications and viewings.", `<div class="rf-actions" style="margin-top:0"><a class="btn" href="#/admin">Open admin console</a></div>`) : ""}</div>`;
  else if (section === "notifications") body = `<div class="rf-col">${ntCard}${card("Sounds", "A short, soft sound for new messages and calls ending.", `<div class="rf-sw first"><span class="rf-sw-ic">${icon("bell", 20, 1.7)}</span><div><b>Notification sounds</b><p>Play a sound when something new arrives while the app is open.</p></div><button type="button" class="switch ${soundsOn() ? "on" : ""}" role="switch" aria-checked="${soundsOn()}" id="sndSw" aria-label="Notification sounds"><i></i></button></div>`)}<p class="rf-meta">Saved to your account as you switch them. Important account and security messages are always sent.</p></div>`;
  else if (section === "appearance") body = `<div class="rf-col">${apCard}</div>`;
  else if (section === "privacy") body = `<div class="rf-col">${card("What agents can see", "Your contact details are only shared when you choose.", PRIVACY.map(([k, ic, t, d], i) => swRow("privacy", k, ic, t, d, privacy[k]).replace('class="rf-sw"', i ? 'class="rf-sw"' : 'class="rf-sw first"')).join(""))}
      ${card("Your data", "You can download a copy of your data, ask us to correct it, or delete your account.", `<div class="rf-actions" style="margin-top:0"><a class="btn primary" href="#/settings/account">${icon("download", 17)} Download my data</a><a class="btn ghost" href="#/privacy">Read the Privacy Policy</a></div>`)}</div>`;
  else body = `<div class="rf-col">${card("Quick answers", "", `<div class="rf-actions" style="margin-top:0"><a class="btn primary" href="#/help">${icon("help", 17)} Open the Help centre</a></div>`)}
      ${card("Product tour", "Replay the quick tour of Faxton Rentals.", `<div class="rf-actions" style="margin-top:0"><button class="btn" id="tour">Replay tour</button></div>`)}
      ${updCard}${card("Install the app", "Add Faxton Rentals to your home screen or desktop.", `<div class="rf-actions" style="margin-top:0"><button class="btn" id="install">Install</button><a class="btn" href="#/download">All download options</a></div><p class="rf-meta" style="margin-top:10px">App version ${BUILD}</p>`)}</div>`;
  // Owners and admins: the call relay comes first on the landing page, then Appearance, then the usual cards.
  if (ctx.S.isAdmin && section === "profile") body = `<div class="rf-col"><div id="relayHost"><div class="rf-card" style="min-height:140px" aria-hidden="true"></div></div>${apCard}${body}</div>`;
  const [h1, sub] = ctx.S.isAdmin && section === "profile" ? ["Settings", "The call relay, how the console looks, and your own details."] : SET_TITLE[section];
  return { title: "Settings", html: `<div class="rf-set">${nav}<div class="rf-set-main"><div class="rf-set-head"><div><h1 class="rf-h1">${h1}</h1><p class="rf-sub">${sub}</p></div><button type="button" class="back-btn" data-back aria-label="Go back">${icon("left", 18)} Back</button></div>${body}</div></div>`,
    mount() {
      if (ctx.S.isAdmin && section === "profile") import("./dash.js").then((m) => m.mountRelayCard($("#relayHost"), ctx)).catch(() => {});
      const save = async (patch, msg = "Saved.") => { try { await st.saveProfile(u.uid, patch); ctx.S.profile = { ...(ctx.S.profile || {}), ...patch }; toast(msg); } catch (x) { toast(fxErr(x)); throw x; } };
      const lk = $("#lockCard"); if (lk) LOCK.mountCard(lk, ctx.S.user, ctx.logout);
      const del = $("#delAcct"); if (del) del.onclick = () => { const m = modal(`<div class="rf-dlg"><h2>Delete your account?</h2><p class="rf-dlg-p">Our team reviews deletion requests, which takes about a day. Your saved homes, messages and details are removed once it’s approved. You can cancel before then.</p><label class="rf-fl">Type <b>DELETE</b> to confirm<input id="dc" autocomplete="off"></label><div class="rf-dlg-act"><button class="btn" id="dcNo">Keep my account</button><button class="btn red" id="dcYes" disabled>Request deletion</button></div></div>`);
        $("#dc", m.el).oninput = (e) => ($("#dcYes", m.el).disabled = e.target.value.trim() !== "DELETE"); $("#dcNo", m.el).onclick = () => m.close();
        $("#dcYes", m.el).onclick = async () => { try { const d = { status: "pending", requestedAt: Date.now() }; await st.setDeletion(u.uid, d); ctx.S.profile = { ...(ctx.S.profile || {}), deletion: d }; m.close(); toast("Request sent. We’ll review it within about a day."); ctx.render(); } catch (x) { toast(fxErr(x)); } }; };
      const cd = $("#cancelDel"); if (cd) cd.onclick = async () => { try { await st.setDeletion(u.uid, null); const p2 = { ...(ctx.S.profile || {}) }; delete p2.deletion; ctx.S.profile = p2; toast("Deletion cancelled."); ctx.render(); } catch (x) { toast(fxErr(x)); } };
      const signOut = async () => { if (await ctx.confirmSignOut()) { await ctx.logout(); ctx.go("#/login"); } };
      $("#out").onclick = signOut; const o2 = $("#out2"); if (o2) o2.onclick = signOut;
      $$("[data-theme-pref]").forEach((b) => (b.onclick = () => { ctx.setThemePref(b.dataset.themePref); $$("[data-theme-pref]").forEach((x) => { const on = x === b; x.classList.toggle("on", on); x.setAttribute("aria-checked", on); }); }));
      const sn = $("#sndSw"); if (sn) sn.onclick = async () => { const next = !sn.classList.contains("on"); sn.classList.toggle("on", next); sn.setAttribute("aria-checked", next); setSounds(next); if (next) { playSound("message"); } try { await save({ prefs: { ...(ctx.S.profile?.prefs || {}), sounds: next } }, next ? "Sounds are on." : "Sounds are off."); } catch { sn.classList.toggle("on", !next); sn.setAttribute("aria-checked", !next); setSounds(!next); } };
      $$("[data-sw]").forEach((b) => (b.onclick = async () => {
        const [g, k] = b.dataset.sw.split("."), cur = ctx.S.profile?.[g] || {}, base = g === "notify" ? notify : privacy, next = !(cur[k] ?? base[k]);
        b.classList.toggle("on", next); b.setAttribute("aria-checked", next);
        try { await save({ [g]: { ...base, ...cur, [k]: next } }); if (g === "privacy" && k === "showOnline") PRES.refresh(); } catch { b.classList.toggle("on", !next); b.setAttribute("aria-checked", !next); }
      }));
      const au = $("#autoUpd"); if (au) au.onclick = async () => { const next = !au.classList.contains("on"); au.classList.toggle("on", next); au.setAttribute("aria-checked", next); try { await save({ prefs: { ...(ctx.S.profile?.prefs || {}), autoUpdate: next } }, next ? "Automatic updates are on." : "Automatic updates are off."); APPS.syncShellAutoUpdate(next); } catch { au.classList.toggle("on", !next); au.setAttribute("aria-checked", !next); } };
      const cu = $("#chkUpd"); if (cu) cu.onclick = () => { const r = APPS.checkNow(ctx.S); if (r === "current") toast("You’re on the latest version."); };
      const pf = $("#pf");
      if (pf) {
        const loc = mountLoc(pf, { ids: { country: "lcc", state: "lcs", lga: "lct" } });
        st.getPublic(ctx.S.user.uid).then((pp) => { const a = $("#ab"); if (a && pp?.about) a.value = pp.about; });
        $("#cancel").onclick = () => ctx.render();
        pf.onsubmit = async (e) => {
          e.preventDefault(); const err = $("#perr"), nm = $("#nm").value.trim(); err.textContent = "";
          if (!nm) return (err.textContent = "Enter your full name.");
          const ph = $("#ph").value.trim(); if (ph && !/^[+\d][\d\s-]{6,}$/.test(ph)) return (err.textContent = "That phone number doesn’t look right. Use digits, like 0803 000 0000.");
          const btn = pf.querySelector("button[type=submit]"); btn.disabled = true;
          try { await updateProfile(auth.currentUser, { displayName: nm }); const L = loc.commit(), country = L.country, city = L.lga.trim() || L.city, about = ($("#ab")?.value || "").trim();
            await save({ name: nm, phone: ph, ...resFields({ country, state: L.state, lga: L.lga, city }), prefs: { ...(ctx.S.profile?.prefs || {}), area: $("#pl").value, type: $("#pt").value, budget: $("#pb").value } }, "Profile saved.");
            st.syncPublic(ctx.S.user.uid, { name: nm, about, city, country, ...(ctx.S.profile?.photo ? { photo: ctx.S.profile.photo } : {}) }); ctx.render(); } catch {} finally { btn.disabled = false; }
        };
        const pick = () => $("#photo").click(); $("#photoBtn").onclick = pick; $("#photoBtn2").onclick = pick;
        $("#photo").onchange = async (e) => {
          const f = e.target.files[0]; e.target.value = ""; if (!f) return;
          try { const data = await shrinkImage(f, { square: 192, bytes: 40000 }); await save({ photo: data }, "Photo updated."); st.syncPublic(ctx.S.user.uid, { photo: data }); ctx.render(); } catch (x) { if (x.userMessage) toast(x.userMessage); }
        };
        const gb = $("#photoG"); if (gb) gb.onclick = async () => { gb.disabled = true; try { const GP = await import("./gphoto.js"); await GP.useGooglePhoto(ctx.S); toast("Photo updated."); ctx.render(); } catch (x) { toast(x.userMessage || "We couldn’t use your Google photo. Choose one from your device instead."); gb.disabled = false; } };
        const rm = $("#photoRm"); if (rm) rm.onclick = async () => { try { await save({ photo: "" }, "Photo removed."); st.syncPublic(ctx.S.user.uid, { photo: "" }); ctx.render(); } catch {} };
      }
      const rs = $("#resendV"); if (rs) rs.onclick = async () => { try { await ctx.resendVerification(); toast("Verification email sent."); } catch (x) { toast(fxErr(x)); } };
      const resetPw = async (b) => { b.disabled = true; try { await ctx.resetPassword(u.email); toast("Check your email for the reset link."); const n = $("#resetNote"); if (n) n.textContent = `We sent a link to ${u.email}. It can take a minute, so check spam too.`; let s = 45; const t = setInterval(() => { s--; b.textContent = s > 0 ? `Sent. Resend in ${s}s` : "Email me a password reset link"; if (s <= 0) { clearInterval(t); b.disabled = false; } }, 1000); ctx.S.cleanups.push(() => clearInterval(t)); } catch (x) { toast(fxErr(x)); b.disabled = false; } };
      const rp = $("#resetPw"); if (rp) rp.onclick = () => resetPw(rp);
      const rp2 = $("#resetPw2"); if (rp2) rp2.onclick = async () => { rp2.disabled = true; try { await ctx.resetPassword(u.email); toast("Check your email for the reset link."); } catch (x) { toast(fxErr(x)); } rp2.disabled = false; };
      const ticket = async (subject, message, title, body) => { if (!(await ask({ title, body, ok: "Send request", no: "Not now" }))) return; try { await st.addTicket(u, { subject, message }); toast("Request sent. We’ll reply by email."); } catch (x) { toast(fxErr(x)); } };
      const dr = $("#dataReq"); if (dr) dr.onclick = () => ticket("Data request", "Please send me a copy of the personal data you hold about me (Nigeria Data Protection Act 2023).", "Ask us to email your data?", "We’ll open a support request. Our team replies by email, usually within a few days. You can also download it yourself right away.");
      const df = $("#dataFix"); if (df) df.onclick = () => ticket("Data correction request", "Please correct some of the personal data you hold about me (Nigeria Data Protection Act 2023). What needs to change: ", "Ask for a correction?", "We’ll open a support request. Reply to it with what needs to change, and we’ll update it and let you know.");
      const dd = $("#dataDl"); if (dd) dd.onclick = async () => { dd.disabled = true; try { const m = await import("./mydata-ui.js"); m.openDataDialog(ctx)?.onDone(() => { const n = $("#dataLast"); if (n) n.textContent = lastDl(); }); } catch { toast("Couldn’t open that just now. Please try again."); } dd.disabled = false; };
      if (section === "account" && MYDATA.hasLink()) import("./mydata-ui.js").then((m) => m.resumeIfLink(ctx)?.onDone(() => { const n = $("#dataLast"); if (n) n.textContent = lastDl(); })).catch(() => {});
      const tr = $("#tour"); if (tr) tr.onclick = () => { ctx.resetTour(u); const h = "#" + ctx.dashHome(); ctx.go(h); };
      const ins = $("#install"); if (ins) ins.onclick = async () => { if (ctx.canInstall()) return void (await ctx.installApp()); ctx.go("#/download"); };
    } };
}

// ---------- admin ----------
// The console is a set of modules loaded only for staff: ax.js (components), ax-list.js (list + drawer), admin2.js (pages), dash.js (dashboards).
async function admin(ctx, sub) {
  if (!ctx.S.isAdmin) return { title: "Admin", html: `<div class="empty"><h2>Admin access required</h2><p>Your account isn’t an administrator. Ask the owner to promote your account.</p><p style="margin-top:14px"><a class="btn" href="#/">Back home</a></p></div>` };
  if (sub === "get-app") return APPS.installationsPage(ctx);
  return (await import("./admin2.js")).route(ctx, sub);
}
