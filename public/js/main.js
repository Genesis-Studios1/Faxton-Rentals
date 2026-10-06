import { auth, db, google } from "./firebase.js";
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, signOut, updateProfile, sendPasswordResetEmail, sendEmailVerification, setPersistence, browserLocalPersistence, browserSessionPersistence }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { $, $$, esc, icon, logo, initials, toast, friendlyErr } from "./ui.js";
import { getProfile, getSaved, toggleSaved, getOwnerUid, claimOwnership, watchConversations } from "./store.js";
import * as V from "./views.js";

export const S = { unread: 0, unsubConvs: null, user: null, profile: null, saved: new Set(), ready: false, cleanups: [], ownerUid: null, isOwner: false, isAdmin: false, role: "renter" };
const app = $("#app");

// ---------- theme ----------
export const theme = () => document.documentElement.dataset.theme;
export function toggleTheme() {
  const n = theme() === "dark" ? "light" : "dark"; document.documentElement.dataset.theme = n;
  try { localStorage.setItem("theme", n); } catch {}
  $$("[data-theme-btn]").forEach((b) => (b.innerHTML = icon(n === "dark" ? "sun" : "moon", 20)));
}
export const themeBtn = () => `<button class="icon-btn toggle-theme" data-theme-btn aria-label="Toggle dark mode">${icon(theme() === "dark" ? "sun" : "moon", 20)}</button>`;

// ---------- routing ----------
export const go = (h) => { if (location.hash === h) render(); else location.hash = h; };
const parse = () => { const [p, q] = (location.hash.slice(1) || "/").split("?"); return { path: p.replace(/\/+$/, "") || "/", q: Object.fromEntries(new URLSearchParams(q || "")) }; };
const needsAuth = ["/saved", "/messages", "/bookings", "/payments", "/settings", "/admin"];

const NAV = [["/", "home", "Home"], ["/search", "search", "Search"], ["/saved", "heart", "Saved"], ["/messages", "msg", "Messages"], ["/bookings", "cal", "Bookings"], ["/payments", "doc", "Payments"]];
const TOPNAV = [["/", "Discover"], ["/saved", "Saved homes"], ["/bookings", "My rentals"], ["/messages", "Messages"]];
const ANAV = [["/admin", "home", "Overview"], ["/admin/listings", "building", "Listings"], ["/admin/users", "users", "Users"], ["/admin/applications", "doc", "Rental applications"], ["/admin/viewings", "cal", "Viewings"], ["/admin/payments", "wallet", "Payments"], ["/admin/reports", "chart", "Reports"], ["/admin/support", "headset", "Support"], ["/settings", "gear", "Settings"]];
const userName = () => S.user?.displayName || S.profile?.name || S.user?.email || "Guest";
// Browsing pages use the top navigation (as designed); account pages use the icon sidebar; the admin console has its own sidebar.
const isBrowse = (p) => p === "/" || p === "/search" || p.startsWith("/home/");

function shell(path, inner, { admin = false, bare = false, pending = 0 } = {}) {
  if (!admin && isBrowse(path)) return topShell(path, inner);
  const collapsed = (() => { try { return localStorage.getItem("rail") === "1"; } catch { return false; } })();
  const on = (p) => (p === "/" || p === "/admin" ? path === p : path === p || path.startsWith(p + "/"));
  const badge = (l) => (admin && l === "Listings" && pending ? `<b class="badge">${pending}</b>` : !admin && l === "Messages" && S.unread ? `<b class="badge" data-unread>${S.unread}</b>` : "");
  const items = (admin ? ANAV : NAV).map(([h, ic, l]) => `<a class="item ${on(h) ? "on" : ""}" href="#${h}" ${on(h) ? 'aria-current="page"' : ""}>${icon(ic, 24)}<span>${l}</span>${badge(l)}</a>`).join("");
  const user = S.user ? `<a class="rail-user" href="#/settings"><span class="avatar">${esc(initials(userName()))}</span><span>${esc(userName().replace(/(\S+)\s+(\S).*/, "$1 $2."))}</span></a>`
    : `<a class="rail-user" href="#/login"><span class="avatar">${icon("user", 18)}</span><span>Sign in</span></a>`;
  return `<div class="shell ${collapsed ? "collapsed" : ""} ${admin ? "admin" : ""}">
    <aside class="rail" aria-label="Main navigation">
      <div class="rail-top">${admin ? logo("Admin console") : `<a class="logo" href="#/" aria-label="Faxton Rentals home">${logo().match(/<svg.*<\/svg>/s)[0]}</a>`}
        <button class="rail-collapse" id="collapse" aria-label="Collapse sidebar">${icon("dchev", 22)}</button></div>
      <nav>${items}</nav>
      <div class="rail-bottom">${admin ? "" : `<a class="item ${on("/settings") ? "on" : ""}" href="#/settings">${icon("gear", 24)}<span>Settings</span></a>`}${user}</div>
    </aside>
    <main class="main page" id="main">${bare ? "" : topbar(admin)}${verifyBanner()}${inner}</main></div>`;
}
function topShell(path, inner) {
  const on = (h) => (h === "/" ? isBrowse(path) : path === h);
  const links = TOPNAV.map(([h, l]) => `<a class="${on(h) ? "on" : ""}" href="#${h}" ${on(h) ? 'aria-current="page"' : ""}>${l}</a>`).join("");
  const menu = S.user ? `<div class="me-wrap"><button class="me-btn" id="meBtn" aria-haspopup="menu" aria-expanded="false" aria-label="Account menu"><span class="avatar">${esc(initials(userName()))}</span>${icon("chev", 18)}</button>
      <div class="menu" id="meMenu" role="menu" hidden><div class="menu-head"><b>${esc(userName())}</b><small>${esc(S.isOwner ? "Owner" : S.role)}</small></div>
      <a role="menuitem" href="#/settings">${icon("gear", 18)} Settings</a><a role="menuitem" href="#/bookings">${icon("cal", 18)} Bookings</a><a role="menuitem" href="#/payments">${icon("doc", 18)} Payments</a>
      ${S.isAdmin ? `<a role="menuitem" href="#/admin">${icon("building", 18)} Admin console</a>` : ""}<button role="menuitem" id="logoutBtn">${icon("logout", 18)} Sign out</button></div></div>`
    : `<a class="btn sm primary" href="#/login">Sign in</a>`;
  return `<header class="topnav"><div class="tn-in">${logo()}<nav class="tn-links" aria-label="Main">${links}</nav>
    <div class="tn-right">${themeBtn()}<a class="icon-btn ${S.unread ? "dot" : ""}" id="bell" href="#/messages" aria-label="Messages and notifications">${icon("bell", 20)}</a>${menu}</div></div></header>
    <main class="main-top page" id="main">${verifyBanner()}${inner}</main>`;
}
function topbar(admin) {
  const me = S.user ? `<a class="me" href="#/settings" aria-label="Account"><span class="avatar">${esc(initials(userName()))}</span></a>` : `<a class="btn sm primary" href="#/login">Sign in</a>`;
  if (admin) return `<div class="admin-top"><label class="input">${icon("search", 20)}<input type="search" placeholder="Search properties, users, applications…" aria-label="Search"></label><span style="flex:1"></span>${themeBtn()}<a class="icon-btn ${S.unread ? "dot" : ""}" href="#/messages" aria-label="Notifications">${icon("bell", 20)}</a><span class="me"><span class="avatar">${esc(initials(userName()))}</span><span style="line-height:1.2"><b style="color:var(--head)">${esc(userName().split(" ")[0])}</b><br><small class="muted">${S.isOwner ? "Owner" : "Admin"}</small></span></span></div>`;
  return `<div class="topbar">${themeBtn()}<a class="icon-btn ${S.unread ? "dot" : ""}" href="#/messages" aria-label="Notifications">${icon("bell", 20)}</a>${me}</div>`;
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
  const seen = (() => { try { return localStorage.getItem("seen") === "1"; } catch { return true; } })();
  if (path === "/" && !S.user && !seen && !q.skip) return go("#/onboarding/1");
  if (needsAuth.some((p) => path === p || path.startsWith(p + "/")) && !S.user) return go("#/login?next=" + encodeURIComponent(location.hash.slice(1)));
  if (["/login", "/signup"].includes(path) && S.user) return go("#" + (q.next || "/"));

  const ctx = { path, q, S, go, refreshUser, installApp, canInstall: () => !!installPrompt, shell, render, toggleTheme, themeBtn, signIn, signUp, signInGoogle, logout, setSaved, resetPassword };
  bar(true);
  const view = await V.route(ctx);
  if (id !== renderId) return;
  bar(false);
  if (!view) { app.innerHTML = shell(path, `<div class="empty"><h2>Page not found</h2><p><a class="link" href="#/">Go home</a></p></div>`); return wire(); }
  app.innerHTML = view.full ? view.html : shell(path, view.html, view);
  document.title = (view.title ? view.title + " · " : "") + "Faxton Rentals";
  wire();
  scrollTo(0, 0);
  view.mount?.(app, ctx);
}
function wire() {
  const rs = $("[data-resend]"), rf = $("[data-refresh]");
  if (rs) rs.onclick = async () => { try { await resendVerification(); toast("Verification email sent."); } catch (e) { toast(friendlyErr(e)); } };
  if (rf) rf.onclick = async () => { try { await refreshUser(); } catch (e) { toast(friendlyErr(e)); } };
  $$("[data-theme-btn]").forEach((b) => (b.onclick = toggleTheme));
  const mb = $("#meBtn"), mm = $("#meMenu");
  if (mb && mm) {
    const close = () => { mm.hidden = true; mb.setAttribute("aria-expanded", "false"); };
    mb.onclick = (e) => { e.stopPropagation(); mm.hidden = !mm.hidden; mb.setAttribute("aria-expanded", String(!mm.hidden)); };
    mm.onclick = (e) => { if (e.target.closest("a,button")) close(); };
    document.addEventListener("click", close, { once: true });
    mm.addEventListener("keydown", (e) => { if (e.key === "Escape") { close(); mb.focus(); } });
    const lo = $("#logoutBtn"); if (lo) lo.onclick = async () => { await logout(); go("#/login"); };
  }
  const c = $("#collapse"); if (c) c.onclick = () => { const s = $(".shell"); s.classList.toggle("collapsed"); try { localStorage.setItem("rail", s.classList.contains("collapsed") ? "1" : "0"); } catch {} };
}

// ---------- auth ----------
async function ensureProfile(u, extra = {}) {
  const ref = doc(db, "users", u.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) await setDoc(ref, { name: u.displayName || extra.name || "", email: u.email, role: extra.role || "renter", saved: [], createdAt: serverTimestamp() });
}
async function signIn(email, pw, remember = true) {
  await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
  await signInWithEmailAndPassword(auth, email, pw);
}
async function signUp(name, email, pw, role) {
  const c = await createUserWithEmailAndPassword(auth, email, pw);
  await updateProfile(c.user, { displayName: name });
  await ensureProfile(c.user, { name, role: role === "agent" ? "agent" : "renter" });
  try { await sendEmailVerification(c.user); } catch {}
}
export async function resendVerification() { await sendEmailVerification(auth.currentUser); }
export async function refreshUser() { await auth.currentUser.reload(); await refreshAuthState(auth.currentUser); render(); }
async function signInGoogle() { const c = await signInWithPopup(auth, google); await ensureProfile(c.user); }
const logout = () => signOut(auth);
async function setSaved(id, on) {
  on ? S.saved.add(id) : S.saved.delete(id);
  try { await toggleSaved(S.user, id, on); } catch (e) { on ? S.saved.delete(id) : S.saved.add(id); toast(friendlyErr(e)); }
}
export const resetPassword = (email) => sendPasswordResetEmail(auth, email);

async function refreshAuthState(u) {
  S.user = u; S.profile = null; S.saved = new Set(); S.isOwner = S.isAdmin = false; S.role = "renter";
  if (u) {
    S.profile = await getProfile(u.uid);
    S.ownerUid = await getOwnerUid();
    // While there is no owner, a verified account may try to claim it. Firestore rules only allow the designated owner.
    if (!S.ownerUid && u.emailVerified) {
      try { await ensureProfile(u); await claimOwnership(u); S.ownerUid = u.uid; S.profile = await getProfile(u.uid); toast("You are the owner of Faxton Rentals."); } catch { /* not the owner: expected */ }
    }
    S.isOwner = S.ownerUid === u.uid;
    S.role = S.isOwner ? "owner" : S.profile?.role === "owner" ? "admin" : S.profile?.role || "renter";
    S.isAdmin = S.isOwner || S.role === "admin";
  }
  S.saved = new Set(await getSaved(u));
  S.unsubConvs?.(); S.unsubConvs = null; S.unread = 0;
  if (u) S.unsubConvs = watchConversations(u, (c) => {
    const n = c.filter((x) => x.unread).length; if (n === S.unread) return; S.unread = n;
    $$("#bell,.topbar .icon-btn[href='#/messages']").forEach((b) => b.classList.toggle("dot", n > 0));
    $$("[data-unread]").forEach((b) => (b.textContent = n));
  });
}
onAuthStateChanged(auth, async (u) => { await refreshAuthState(u); S.ready = true; render(); });
addEventListener("hashchange", render);
render();

// ---------- splash: plays once per session, dismisses when the app is ready ----------
(function splash() {
  const el = $("#splash"), root = document.documentElement;
  if (!el || root.classList.contains("no-splash")) return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches, started = performance.now(), MIN = reduce ? 600 : 3600;
  let done = false;
  const finish = () => { if (done) return; done = true; try { sessionStorage.setItem("splashed", "1"); } catch {} el.classList.add("leave"); root.classList.add("ready"); setTimeout(() => el.remove(), 1000); };
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
  const had = !!navigator.serviceWorker.controller; let reloaded = false;
  // When a new version of the app takes over, reload once so you always see the latest changes.
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (had && !reloaded) { reloaded = true; location.reload(); } });
  navigator.serviceWorker.register("sw.js").then((r) => r.update()).catch(() => {});
});
