import { auth, db, google } from "./firebase.js";
import { GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, signInWithCredential, signOut, updateProfile, sendPasswordResetEmail, sendEmailVerification, deleteUser, setPersistence, browserLocalPersistence, browserSessionPersistence }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { $, $$, esc, icon, logo, initials, toast, friendlyErr, modal } from "./ui.js";
import { getProfile, getSaved, toggleSaved, getOwnerUid, claimOwnership, watchConversations, watchProfile, hasAccountMarker, writeAccountMarker, watchNotifications, markNotificationRead, watchPendingVerifications, deleteProfile, saveProfile } from "./store.js";
import * as V from "./views.js";
import { startUpdateWatch, stopUpdateWatch, syncShellAutoUpdate } from "./apps.js";
import { startTour, tourSeen, resetTour } from "./tour.js";
import { verifyPopup, verifiedPopup, askResidence } from "./onboard.js";
import { watchIncoming } from "./calls.js";

export const S = { shownNotes: new Set(), pendingV: 0, nav: 0, unread: 0, unsubConvs: null, user: null, profile: null, saved: new Set(), ready: false, cleanups: [], ownerUid: null, isOwner: false, isAdmin: false, role: "renter" };
const app = $("#app");

// ---------- theme ----------
export const theme = () => document.documentElement.dataset.theme;
export const themePref = () => { try { return localStorage.getItem("theme") || "light"; } catch { return "light"; } };
const resolveTheme = (p) => (p === "dark" || (p === "system" && matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light");
export function setThemePref(p) {
  try { localStorage.setItem("theme", p); } catch {}
  document.documentElement.dataset.theme = resolveTheme(p);
  $$("[data-theme-btn]").forEach((b) => (b.innerHTML = icon(theme() === "dark" ? "sun" : "moon", 20)));
}
matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => { if (themePref() === "system") document.documentElement.dataset.theme = resolveTheme("system"); });
export function toggleTheme() {
  const n = theme() === "dark" ? "light" : "dark"; document.documentElement.dataset.theme = n;
  try { localStorage.setItem("theme", n); } catch {}
  $$("[data-theme-btn]").forEach((b) => (b.innerHTML = icon(n === "dark" ? "sun" : "moon", 20)));
}
export const themeBtn = () => `<button class="icon-btn toggle-theme" data-theme-btn aria-label="Toggle dark mode">${icon(theme() === "dark" ? "sun" : "moon", 20)}</button>`;

// ---------- routing ----------
export const go = (h) => { if (location.hash === h) render(); else location.hash = h; };
const parse = () => { const [p, q] = (location.hash.slice(1) || "/").split("?"); return { path: p.replace(/\/+$/, "") || "/", q: Object.fromEntries(new URLSearchParams(q || "")) }; };

const NAV = [["/", "home", "Home"], ["/search", "search", "Search"], ["/saved", "heart", "Saved"], ["/messages", "msg", "Messages"], ["/bookings", "cal", "Bookings"], ["/payments", "doc", "Payments"]];
const TOPNAV = [["/", "Home", "home"], ["/search", "Find a home", "search"], ["/saved", "Saved homes", "heart"], ["/messages", "Messages", "msg"], ["/rentals", "My rentals", "cal"], ["/help", "Contact us", "help"]];
const ANAV = [["/admin", "home", "Overview"], ["/admin/listings", "building", "Listings"], ["/admin/users", "users", "Users"], ["/admin/applications", "doc", "Applications"], ["/admin/viewings", "cal", "Viewings"], ["/admin/payments", "wallet", "Payments"], ["/admin/verifications", "shield", "Verifications"], ["/admin/support", "msg", "Support"], ["/admin/suggestions", "chatlines", "Suggestions"], ["/admin/reports", "chart", "Reports"], ["/admin/get-app", "download", "Installations"]];
export const avatarHtml = (cls = "") => (S.profile?.photo ? `<img class="avatar ${cls}" src="${esc(S.profile.photo)}" alt="">` : `<span class="avatar ${cls}">${esc(initials(userName()))}</span>`);
const userName = () => S.user?.displayName || S.profile?.name || S.user?.email || "Guest";
const isCollapsed = () => { try { return localStorage.getItem("rail") === "1"; } catch { return false; } };
const WRAPPED = ["/bookings"];
const isSettings = (p) => p === "/settings" || p.startsWith("/settings/");

function shell(path, inner, { admin = false, pending = 0, role = "" } = {}) {
  return role ? adminShell(path, inner, 0, role) : admin ? adminShell(path, inner, pending) : appShell(path, inner);
}
// Console chrome for the other staff roles: same header and sidebar, with only the pages that role can use.
const ROLE_UI = {
  support: { title: "Support console", home: "/support", nav: [["/support", "home", "Dashboard"], ["/support/tickets", "msg", "Tickets"], ["/support/suggestions", "chatlines", "Suggestions"], ["/help", "help", "Help centre"], ["/settings", "gear", "Settings"]] },
  landlord: { title: "Owner portal", home: "/portfolio", nav: [["/portfolio", "home", "Dashboard"], ["/messages", "msg", "Messages"], ["/settings", "gear", "Settings"]] },
  agency: { title: "Agency portal", home: "/agency", nav: [["/agency", "home", "Dashboard"], ["/messages", "msg", "Messages"], ["/settings", "gear", "Settings"]] },
  agent: { title: "Agent portal", home: "/agent-dashboard", nav: [["/agent-dashboard", "home", "Dashboard"], ["/messages", "msg", "Messages"], ["/settings", "gear", "Settings"]] },
};
const roleHome = () => (S.isAdmin ? "/admin" : ROLE_UI[S.role]?.home || null);
// Admin console: its own header + labelled sidebar, with a way back to the site.
function adminShell(path, inner, pending, role = "") {
  const R = ROLE_UI[role];
  const on = (p) => (p === "/admin" || (R && p === R.home) ? path === p : path === p || path.startsWith(p + "/"));
  const items = (R ? R.nav : ANAV).map(([h, ic, l]) => `<a class="item ${on(h) ? "on" : ""}" href="#${h}" ${on(h) ? 'aria-current="page"' : ""}>${icon(ic, 24)}<span>${l}</span>${l === "Listings" && pending ? `<b class="badge">${pending}</b>` : ""}${l === "Verifications" ? `<b class="badge" data-vbadge ${S.pendingV ? "" : "hidden"}>${S.pendingV || ""}</b>` : ""}</a>`).join("");
  return `<div class="adm"><header class="adm-top"><a class="logo" href="#${R ? R.home : "/admin"}" aria-label="Dashboard">${logo().match(/<svg.*<\/svg>/s)[0]}<span class="logo-word"><b>Faxton</b> Rentals</span></a><span class="vr"></span><span class="adm-title">${R ? R.title : "Admin console"}</span><span style="flex:1"></span>
      <label class="adm-search">${icon("search", 20)}<input type="search" placeholder="Search listings, users, applications…" aria-label="Search"></label>${themeBtn()}<a class="icon-btn bell ${S.unread ? "dot" : ""}" href="#/messages" aria-label="Notifications">${icon("bell", 22)}</a>
      <a class="me-btn" href="#/settings" aria-label="Account">${avatarHtml()}${icon("chev", 18)}</a></header>
    <div class="adm-body"><aside class="adm-side" aria-label="Admin navigation"><nav>${items}</nav><a class="adm-back" href="#/">${icon("left", 20)} Back to site</a></aside>
    <main class="adm-main page" id="main">${verifyBanner()}${path === "/admin" || (R && path === R.home) ? "" : `<div class="adm-backbar"><button type="button" class="back-btn" data-back aria-label="Go back">${icon("left", 20)} Back</button></div>`}${inner}</main></div></div>`;
}
// The site's navigation: a top bar with the logo at the left, the page tabs, the bell and the account menu.
function appShell(path, inner) {
  const on = (h) => (h === "/" ? path === "/" : h === "/search" ? path === "/search" || path.startsWith("/home/") : h === "/rentals" ? ["/rentals", "/bookings", "/payments", "/documents", "/applications", "/apply"].some((p) => path === p || path.startsWith(p + "/")) : path === h || path.startsWith(h + "/"));
  const links = TOPNAV.map(([h, l, ic]) => `<a class="${on(h) ? "on" : ""}" href="#${h}" ${on(h) ? 'aria-current="page"' : ""}><span class="tn-ic">${icon(ic, 24)}</span><span class="tn-lb">${l}</span>${h === "/messages" ? `<b class="tn-badge" data-unread ${S.unread ? "" : "hidden"}>${S.unread || ""}</b>` : ""}</a>`).join("");
  const menu = `<div class="me-wrap"><button class="me-btn" id="meBtn" aria-haspopup="menu" aria-expanded="false" aria-label="Account menu">${avatarHtml()}${icon("chev", 18)}</button>
      <div class="menu" id="meMenu" role="menu" hidden><div class="menu-head"><b>${esc(userName())}</b><small>${esc(S.isOwner ? "Owner" : S.role)}</small></div>
      <a role="menuitem" href="#/settings">${icon("gear", 18)} Settings</a><a role="menuitem" href="#/rentals">${icon("cal", 18)} My rentals</a><a role="menuitem" href="#/payments">${icon("doc", 18)} Payments</a><a role="menuitem" href="#/download">${icon("download", 18)} Get the app</a>
      ${S.isAdmin ? `<a role="menuitem" href="#/admin">${icon("building", 18)} Admin console</a>` : ROLE_UI[S.role] ? `<a role="menuitem" href="#${ROLE_UI[S.role].home}">${icon("building", 18)} My dashboard</a>` : ""}<button role="menuitem" id="logoutBtn">${icon("logout", 18)} Sign out</button></div></div>`;
  const body = WRAPPED.includes(path) ? `<div class="wrap">${inner}</div>` : inner;
  const back = path === "/" || path.startsWith("/messages") || isSettings(path) ? "" : `<div class="wrap backbar"><button type="button" class="back-btn" data-back aria-label="Go back">${icon("left", 20)} Back</button></div>`;
  return `<header class="topnav"><div class="tn-in">${logo()}<nav class="tn-links" aria-label="Main">${links}</nav>
    <div class="tn-right">${themeBtn()}<a class="icon-btn bell ${S.unread ? "dot" : ""}" id="bell" href="#/messages" aria-label="Messages and notifications">${icon("bell", 22)}</a>${menu}</div></div></header>
    <main class="main-top page ${isSettings(path) ? "is-settings" : ""}" id="main">${verifyBanner()}${back}${body}</main>`;
}
function topbar() {
  return `<div class="admin-top"><label class="input">${icon("search", 20)}<input type="search" placeholder="Search properties, users, applications…" aria-label="Search"></label><span style="flex:1"></span>${themeBtn()}<a class="icon-btn ${S.unread ? "dot" : ""}" href="#/messages" aria-label="Notifications">${icon("bell", 20)}</a><span class="me"><span class="avatar">${esc(initials(userName()))}</span><span style="line-height:1.2"><b style="color:var(--head)">${esc(userName().split(" ")[0])}</b><br><small class="muted">${S.isOwner ? "Owner" : "Admin"}</small></span></span></div>`;
}

function verifyBanner() {
  if (!S.user || S.user.emailVerified || S.user.providerData.every((p) => p.providerId !== "password")) return "";
  return `<div class="notice" role="status"><span>Please verify <b>${esc(S.user.email)}</b> — check your inbox for the link.</span><span><button class="btn sm" data-resend>Resend email</button> <button class="btn sm primary" data-refresh>I’ve verified</button></span></div>`;
}
let renderId = 0;
const bar = (on) => { let b = $("#nprogress"); if (!b) { b = document.createElement("div"); b.id = "nprogress"; document.body.append(b); } b.className = on ? "run" : "done"; };
export async function render() {
  const id = ++renderId;
  S.cleanups.splice(0).forEach((f) => f());
  const { path, q } = parse();
  if (!S.ready) return;
  // Everything except onboarding, login and sign-up needs an account. Signed-out visitors start at the onboarding.
  const open = path.startsWith("/onboarding/") || path === "/login" || path === "/signup" || path === "/forgot" || path === "/download";
  if (!S.user && !open) return go(path === "/" ? "#/onboarding/1" : "#/login?next=" + encodeURIComponent(location.hash.slice(1)));
  if (S.user && open) return go("#" + (q.next || "/"));
  // Staff accounts open their own dashboard first, once per visit.
  if (S.user && path === "/" && roleHome()) { let seen = false; try { seen = sessionStorage.getItem("landed") === S.user.uid; sessionStorage.setItem("landed", S.user.uid); } catch {} if (!seen) return go("#" + roleHome()); }

  const ctx = { confirmSignOut, dashHome: () => roleHome() || "/", path, q, S, go, refreshUser, setThemePref, themePref, resendVerification, refreshProfile, resetTour, installApp, canInstall: () => !!installPrompt, shell, render, toggleTheme, themeBtn, signIn, signUp, signInGoogle, logout, setSaved, resetPassword };
  bar(true);
  let view;
  try { view = await V.route(ctx); } catch (err) { console.error(err); if (id !== renderId) return; bar(false); app.innerHTML = shell(path, `<div class="empty"><h2>Something went wrong</h2><p>This page couldn’t load. Please refresh, or go back home.</p><p style="margin-top:14px"><a class="btn primary" href="#/">Go home</a></p></div>`); return wire(); }
  if (id !== renderId) return;
  bar(false);
  if (!view) { app.innerHTML = shell(path, `<div class="empty"><h2>Page not found</h2><p><a class="link" href="#/">Go home</a></p></div>`); return wire(); }
  app.innerHTML = view.full ? view.html : shell(path, view.html, view);
  document.title = (view.title ? view.title + " · " : "") + "Faxton Rentals";
  wire();
  scrollTo(0, 0);
  view.mount?.(app, ctx);
  if (S.user) { startUpdateWatch(S); syncShellAutoUpdate(S.profile?.prefs?.autoUpdate); } else stopUpdateWatch();
  const tk = !S.user ? null : path === "/" ? (S.isAdmin || ROLE_UI[S.role] ? null : "renter") : S.isAdmin && path === "/admin" ? "admin" : ROLE_UI[S.role]?.home === path ? S.role : null;
  if (S.user && S.profile && !S.profile.country && !S.askingRes) { S.askingRes = true; askResidence({ required: true }).then(async (r) => { if (!r) return; try { await saveProfile(S.user.uid, { country: r.country, city: r.city, location: `${r.city}, ${r.country}` }); S.profile = { ...S.profile, ...r }; toast("Thanks! Your location is saved."); } catch (e) { toast(friendlyErr(e)); } finally { S.askingRes = false; } }); }
  else if (S.user && (path === "/" || path === roleHome())) whenReady(() => setTimeout(askNotifications, 600));
  if (tk && !tourSeen(S.user, tk)) whenReady(() => { if (parse().path === path) startTour(S.user, (S.user.displayName || "").split(" ")[0], tk); });
}
const whenReady = (fn) => (document.documentElement.classList.contains("ready") ? setTimeout(fn, 900) : document.addEventListener("splash-done", () => setTimeout(fn, 1100), { once: true }));
function wire() {
  const rs = $("[data-resend]"), rf = $("[data-refresh]");
  if (rs) rs.onclick = async () => { try { await resendVerification(); toast("Verification email sent."); } catch (e) { toast(friendlyErr(e)); } };
  if (rf) rf.onclick = async () => { try { await refreshUser(); } catch (e) { toast(friendlyErr(e)); } };
  $$("[data-theme-btn]").forEach((b) => (b.onclick = toggleTheme));
  $$("[data-back]").forEach((b) => (b.onclick = () => (S.nav > 0 ? history.back() : go("#/"))));
  const mb = $("#meBtn"), mm = $("#meMenu");
  if (mb && mm) {
    const close = () => { mm.hidden = true; mb.setAttribute("aria-expanded", "false"); };
    mb.onclick = (e) => { e.stopPropagation(); mm.hidden = !mm.hidden; mb.setAttribute("aria-expanded", String(!mm.hidden)); };
    mm.onclick = (e) => { if (e.target.closest("a,button")) close(); };
    document.addEventListener("click", close, { once: true });
    mm.addEventListener("keydown", (e) => { if (e.key === "Escape") { close(); mb.focus(); } });
    const lo = $("#logoutBtn"); if (lo) lo.onclick = async () => { if (await confirmSignOut()) { await logout(); go("#/login"); } };
  }
  const c = $("#collapse"); if (c) c.onclick = () => { const s = c.closest(".shell,.home-grid"); s.classList.toggle("collapsed"); try { localStorage.setItem("rail", s.classList.contains("collapsed") ? "1" : "0"); } catch {} };
}

// ---------- auth ----------
async function ensureProfile(u, extra = {}) {
  const ref = doc(db, "users", u.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    let role = extra.role || "renter";
    const d = { name: u.displayName || extra.name || "", email: u.email, saved: [], createdAt: serverTimestamp() };
    // Agencies and agents join unverified, with their business details attached, until an admin verifies them.
    if (role === "agency" && extra.details) { d.agency = extra.details; d.verification = { status: "pending", kind: "agency", requestedAt: Date.now() }; }
    else if (role === "agent" && extra.details) { d.agentInfo = extra.details; d.verification = { status: "pending", kind: "agent", requestedAt: Date.now() }; }
    else if (role === "agency" || role === "agent") role = "renter";
    d.role = role; if (extra.photo) d.photo = extra.photo;
    const res = extra.residence || (extra.details?.country ? { country: extra.details.country, city: extra.details.city } : null);
    if (res?.country) { d.country = res.country; d.city = res.city; d.location = `${res.city}, ${res.country}`; }
    await setDoc(ref, d); S.justCreated = role;
  }
  if (u.email) writeAccountMarker(u.email);
}
// A banned account is signed out straight away and told why.
async function rejectIfBanned(u) {
  const p = await getProfile(u.uid);
  if (p?.banned) { S.bannedNote = true; try { await signOut(auth); } catch {} throw Object.assign(new Error("banned"), { code: "app/banned" }); }
  return p;
}
async function signIn(email, pw, remember = true) {
  await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
  let c;
  try { c = await signInWithEmailAndPassword(auth, email, pw); }
  catch (e) {
    if (["auth/invalid-credential", "auth/user-not-found", "auth/wrong-password"].includes(e?.code) && (await hasAccountMarker(email)) === false) throw Object.assign(new Error("no account"), { code: "app/no-account" });
    throw e;
  }
  const p = await rejectIfBanned(c.user);
  writeAccountMarker(email);
  return p?.role || "renter";
}
async function signUp(name, email, pw, role, details, photo, residence) {
  const c = await createUserWithEmailAndPassword(auth, email, pw);
  try { await updateProfile(c.user, { displayName: name }); } catch {}
  const mk = () => ensureProfile(c.user, { name, role: ["agent", "landlord", "agency"].includes(role) ? role : "renter", details, photo, residence });
  try { await mk(); } catch { await mk(); }
  try { await sendEmailVerification(c.user); } catch {}
  // Load the new profile now so the app opens signed in on the home page.
  await refreshAuthState(auth.currentUser);
}
function showNotification(n) {
  markNotificationRead(n.id);
  if (n.kind === "verified") verifiedPopup(n.title, n.body, "Go to my dashboard", () => go("#" + (roleHome() || "/")));
  else toast(n.title + (n.body ? ": " + n.body : ""));
  sysNotify(n.title, n.body);
}
export async function refreshProfile() { if (S.user) S.profile = await getProfile(S.user.uid); }
export async function resendVerification() { await sendEmailVerification(auth.currentUser); }
export async function refreshUser() { await auth.currentUser.reload(); await refreshAuthState(auth.currentUser); render(); }
// Remember the last blocked request so network errors can say which address was refused.
addEventListener("securitypolicyviolation", (e) => { window.__csp = `${e.violatedDirective} blocked ${String(e.blockedURI).slice(0, 80)}`; });
// After a network failure, test each address Google sign-in needs so the error says which one is unreachable.
async function probeGoogle() {
  const k = auth.app.options.apiKey, d = auth.app.options.authDomain;
  const t = [["api", `https://identitytoolkit.googleapis.com/v1/projects?key=${k}`, "cors"], ["frame", `https://${d}/__/auth/iframe`, "no-cors"], ["gapi", "https://apis.google.com/js/api.js", "no-cors"], ["acct", "https://accounts.google.com/favicon.ico", "no-cors"]];
  const r = await Promise.all(t.map(async ([n, u, mode]) => { const s = performance.now(), c = new AbortController(), id = setTimeout(() => c.abort(), 6000); try { await fetch(u, { mode, signal: c.signal, cache: "no-store" }); return `${n}:ok${Math.round(performance.now() - s)}`; } catch (x) { return `${n}:${x?.name === "AbortError" ? "timeout" : "fail"}`; } finally { clearTimeout(id); } }));
  const seen = performance.getEntriesByType("resource").filter((x) => /googleapis|firebaseapp|google\.com|gstatic/.test(x.name) && !/identitytoolkit.*projects\?key/.test(x.name) || /accounts:|projects/.test(x.name)).slice(-4).map((x) => `${new URL(x.name).host.split(".")[0]}${new URL(x.name).pathname.split("/").pop().slice(0, 14)}:${x.responseStatus || 0}/${Math.round(x.duration)}`);
  return "|" + r.join(",") + "|seen:" + seen.join(",") + (window.__csp ? "|" + window.__csp : "");
}
async function signInGoogle(chosen = "renter", details, residence) {
  // Google blocks sign-in inside an app's embedded browser, so the mobile app asks Google natively and hands the result to Firebase.
  const cap = window.Capacitor;
  if (/FaxtonApp\/mobile/.test(navigator.userAgent) && cap) {
    const native = cap.registerPlugin ? cap.registerPlugin("FirebaseAuthentication") : cap.Plugins?.FirebaseAuthentication;
    if (!native) throw Object.assign(new Error("Google sign-in plugin missing"), { code: "app/plugin-missing" });
    let r;
    try { r = await native.signInWithGoogle({ skipNativeAuth: true }); }
    catch (e) { throw Object.assign(new Error(e?.message || "Google step failed"), { code: "google/" + (e?.code || e?.message || "error") }); }
    const idToken = r?.credential?.idToken;
    if (!idToken) throw Object.assign(new Error("No Google token returned"), { code: "app/no-token" });
    let c;
    try { c = await signInWithCredential(auth, GoogleAuthProvider.credential(idToken, r.credential.accessToken)); }
    catch (e) { throw Object.assign(new Error(e?.message), { code: `firebase/${e?.code || "error"}${window.__csp ? " | " + window.__csp : ""}` }); }
    await ensureProfile(c.user, { role: chosen, details, residence }); return (await rejectIfBanned(c.user))?.role || "renter";
  }
  const t0 = performance.now();
  let c;
  try { c = await signInWithPopup(auth, google); }
  catch (e) {
    const known = ["auth/popup-closed-by-user", "auth/cancelled-popup-request", "auth/unauthorized-domain", "auth/operation-not-allowed", "auth/too-many-requests", "auth/popup-blocked"];
    if (known.includes(e?.code)) throw e;
    const ms = Math.round(performance.now() - t0);
    const probes = e?.code === "auth/network-request-failed" ? await probeGoogle() : "";
    throw Object.assign(new Error(e?.message), { code: `${String(e?.code || "error").replace("auth/", "")}|${ms}ms|${String(e?.customData?.message || "-").slice(0, 30)}${window.__csp ? "|csp" : ""}${probes}` });
  }
  await ensureProfile(c.user, { role: ["landlord", "agency", "agent"].includes(chosen) ? chosen : "renter", details, residence });
  return (await rejectIfBanned(c.user))?.role || "renter";
}
const logout = () => signOut(auth);
// "Are you sure?" before signing out, with a red button.
function confirmSignOut() {
  return new Promise((res) => {
    const m = modal(`<div class="so-pop"><span class="vf-ic bad">${icon("logout", 30)}</span><h2>Sign out?</h2><p class="muted">Are you sure you want to sign out of Faxton Rentals?</p><div class="so-act"><button class="btn" id="soNo">Cancel</button><button class="btn red" id="soYes">Sign out</button></div></div>`);
    let yes = false; m.el.addEventListener("close", () => res(yes));
    $("#soNo", m.el).onclick = () => m.close(); $("#soYes", m.el).onclick = () => { yes = true; m.close(); };
  });
}
// Browser notifications: asked once, on the first visit after signing in or up.
const sysNotify = (title, body = "") => { try { if ("Notification" in window && Notification.permission === "granted" && document.hidden) new Notification(title, { body, icon: "assets/mark.svg" }); } catch {} };
function askNotifications() {
  const k = "notif_" + S.user.uid;
  try { if (!("Notification" in window) || Notification.permission !== "default" || localStorage.getItem(k)) return; localStorage.setItem(k, "1"); } catch { return; }
  const m = modal(`<div class="so-pop"><span class="vf-ic">${icon("bell", 30)}</span><h2>Turn on notifications?</h2><p class="muted">Get alerts for new messages, viewing confirmations and account updates, so you never miss a reply.</p><div class="so-act"><button class="btn" id="nfNo">Not now</button><button class="btn primary" id="nfYes">Turn on</button></div></div>`);
  $("#nfNo", m.el).onclick = () => m.close();
  $("#nfYes", m.el).onclick = async () => { m.close(); try { const r = await Notification.requestPermission(); toast(r === "granted" ? "Notifications are on." : "Notifications stay off. You can change this in your browser settings."); } catch {} };
}
// An approved deletion request is carried out once its one-day review period has passed.
async function finalizeDeletion(u) {
  const recent = Date.now() - new Date(u.metadata.lastSignInTime || 0).getTime() < 5 * 60 * 1000;
  if (!recent) { S.deleteNote = true; try { await signOut(auth); } catch {} return refreshAuthState(null); }
  try { await deleteProfile(u.uid); await deleteUser(u); toast("Your account has been deleted."); } catch (e) { toast(friendlyErr(e)); try { await signOut(auth); } catch {} }
  return refreshAuthState(null);
}
async function setSaved(id, on) {
  on ? S.saved.add(id) : S.saved.delete(id);
  try { await toggleSaved(S.user, id, on); } catch (e) { on ? S.saved.delete(id) : S.saved.add(id); toast(friendlyErr(e)); }
}
export const resetPassword = (email) => sendPasswordResetEmail(auth, email);

async function refreshAuthState(u) {
  if (!u) { S.unsubCalls?.(); S.unsubCalls = null; S.unsubNotes?.(); S.unsubNotes = null; S.unsubVerif?.(); S.unsubVerif = null; S.pendingV = 0; }
  S.user = u; S.profile = null; S.saved = new Set(); S.isOwner = S.isAdmin = false; S.role = "renter";
  if (!u) { S.unsubProfile?.(); S.unsubProfile = null; }
  if (u) {
    [S.profile, S.ownerUid] = await Promise.all([getProfile(u.uid), getOwnerUid()]);
    if (S.profile?.banned) { S.bannedNote = true; S.unsubProfile?.(); S.unsubProfile = null; try { await signOut(auth); } catch {} return refreshAuthState(null); }
    S.bannedNote = false;
    if (S.profile?.deletion?.status === "approved" && Date.now() >= (S.profile.deletion.requestedAt || 0) + 864e5) return finalizeDeletion(u);
    if (!S.profile) { try { await ensureProfile(u); S.profile = await getProfile(u.uid); } catch { /* rules refused; leave signed in without a profile */ } }
    S.unsubProfile?.(); S.unsubProfile = watchProfile(u.uid, (p) => {
      if (S.user?.uid !== u.uid || !p) return;
      if (p.banned) { S.bannedNote = true; signOut(auth); return; }
      const was = S.profile; S.profile = p;
      // A role change or a verification decision made by an admin shows up straight away.
      if (was && (p.role !== was.role)) refreshAuthState(auth.currentUser || u).then(render);
      else if (was && (p.verified !== was.verified || p.verification?.status !== was.verification?.status)) render();
    });
    S.unsubNotes?.(); S.unsubNotes = watchNotifications(u.uid, (list) => list.forEach((n) => { if (S.shownNotes.has(n.id)) return; S.shownNotes.add(n.id); showNotification(n); }));
    // While there is no owner, a verified account may try to claim it. Firestore rules only allow the designated owner.
    if (!S.ownerUid && u.emailVerified) {
      try { await ensureProfile(u); await claimOwnership(u); S.ownerUid = u.uid; S.profile = await getProfile(u.uid); toast("You are the owner of Faxton Rentals."); } catch { /* not the owner: expected */ }
    }
    S.isOwner = S.ownerUid === u.uid;
    S.role = S.isOwner ? "owner" : S.profile?.role === "owner" ? "admin" : S.profile?.role || "renter";
    S.isAdmin = S.isOwner || S.role === "admin";
    S.unsubCalls?.(); S.unsubCalls = watchIncoming({ S, user: u }, S.isAdmin || S.role === "support");
    S.unsubVerif?.(); S.unsubVerif = null;
    if (S.isAdmin) { let first = true; S.unsubVerif = watchPendingVerifications((list) => { const n = list.length, grew = n > (S.pendingV || 0); S.pendingV = n; $$("[data-vbadge]").forEach((b) => { b.textContent = n || ""; b.hidden = !n; });
      if (first && n) toast(`${n} verification request${n > 1 ? "s" : ""} waiting for you.`); else if (!first && grew) toast("New verification request: an agency or agent is waiting for you."); first = false; }); }
  }
  S.saved = new Set(u ? S.profile?.saved || [] : await getSaved(u));
  S.unsubConvs?.(); S.unsubConvs = null; S.unread = 0;
  if (u) S.unsubConvs = watchConversations(u, (c) => {
    const n = c.filter((x) => x.unread).length; if (n === S.unread) return; if (n > S.unread) sysNotify("New message", "You have a new message on Faxton Rentals."); S.unread = n;
    $$("[data-unread]").forEach((b) => { b.textContent = n || ""; b.hidden = !n; });
    $$("#bell").forEach((b) => b.classList.toggle("dot", n > 0));
  });
}
onAuthStateChanged(auth, async (u) => { try { await refreshAuthState(u); } catch (e) { console.error(e); } S.ready = true; render(); });
addEventListener("hashchange", () => { S.nav++; render(); });
matchMedia("(max-width: 860px)").addEventListener?.("change", () => render());
render();
// Give every table cell its column name, so phones can show tables as stacked cards.
new MutationObserver(() => $$(".tbl-wrap table").forEach((t) => { const hd = [...(t.tHead?.rows[0]?.cells || [])].map((c) => c.textContent.trim()); [...t.tBodies].forEach((b) => [...b.rows].forEach((r) => [...r.cells].forEach((c, i) => { if (hd[i] && c.dataset.label !== hd[i]) c.dataset.label = hd[i]; }))); })).observe(app, { childList: true, subtree: true });

// ---------- splash: plays once per session, dismisses when the app is ready ----------
(function splash() {
  const el = $("#splash"), root = document.documentElement;
  if (!el || root.classList.contains("no-splash")) return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches, started = performance.now(), MIN = reduce ? 600 : 2800;
  let done = false;
  const finish = () => { if (done) return; done = true; try { sessionStorage.setItem("splashed", "1"); } catch {} el.classList.add("leave"); root.classList.add("ready"); document.dispatchEvent(new Event("splash-done")); setTimeout(() => el.remove(), 1000); };
  const poll = setInterval(() => { if (S.ready && performance.now() - started >= MIN) { clearInterval(poll); finish(); } }, 100);
  el.addEventListener("click", () => { if (S.ready) { clearInterval(poll); finish(); } });
  setTimeout(() => { clearInterval(poll); finish(); }, 9000); // never get stuck, even offline
})();

// ---------- installable app (PWA) ----------
export let installPrompt = null;
addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installPrompt = e; document.dispatchEvent(new Event("installable")); });
addEventListener("appinstalled", () => { installPrompt = null; toast("Faxton Rentals installed."); });
export async function installApp() { if (!installPrompt) return false; installPrompt.prompt(); await installPrompt.userChoice; installPrompt = null; return true; }
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) addEventListener("load", () => {
  // The service worker is network-first, so new deploys show up on the next load without forcing a reload.
  navigator.serviceWorker.register("sw.js").then((r) => r.update()).catch(() => {});
});
