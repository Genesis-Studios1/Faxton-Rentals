import { auth, db, google } from "./firebase.js";
import { GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, signInWithCredential, signOut, updateProfile, sendPasswordResetEmail, sendEmailVerification, setPersistence, browserLocalPersistence, browserSessionPersistence }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { $, $$, esc, icon, logo, initials, toast, friendlyErr } from "./ui.js";
import { getProfile, getSaved, toggleSaved, getOwnerUid, claimOwnership, watchConversations } from "./store.js";
import * as V from "./views.js";
import { startUpdateWatch, stopUpdateWatch, syncShellAutoUpdate } from "./apps.js";
import { startTour, tourSeen, resetTour } from "./tour.js";

export const S = { nav: 0, unread: 0, unsubConvs: null, user: null, profile: null, saved: new Set(), ready: false, cleanups: [], ownerUid: null, isOwner: false, isAdmin: false, role: "renter" };
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
const ANAV = [["/admin", "home", "Overview"], ["/admin/listings", "building", "Listings"], ["/admin/users", "users", "Users"], ["/admin/applications", "doc", "Applications"], ["/admin/viewings", "cal", "Viewings"], ["/admin/payments", "wallet", "Payments"], ["/admin/support", "msg", "Support"], ["/admin/reports", "chart", "Reports"], ["/admin/get-app", "download", "Installations"]];
export const avatarHtml = (cls = "") => (S.profile?.photo ? `<img class="avatar ${cls}" src="${esc(S.profile.photo)}" alt="">` : `<span class="avatar ${cls}">${esc(initials(userName()))}</span>`);
const userName = () => S.user?.displayName || S.profile?.name || S.user?.email || "Guest";
const isCollapsed = () => { try { return localStorage.getItem("rail") === "1"; } catch { return false; } };
const WRAPPED = ["/bookings"];
const isSettings = (p) => p === "/settings" || p.startsWith("/settings/");

function shell(path, inner, { admin = false, pending = 0 } = {}) {
  return admin ? adminShell(path, inner, pending) : appShell(path, inner);
}
// Admin console: its own header + labelled sidebar, with a way back to the site.
function adminShell(path, inner, pending) {
  const on = (p) => (p === "/admin" ? path === p : path === p || path.startsWith(p + "/"));
  const items = ANAV.map(([h, ic, l]) => `<a class="item ${on(h) ? "on" : ""}" href="#${h}" ${on(h) ? 'aria-current="page"' : ""}>${icon(ic, 24)}<span>${l}</span>${l === "Listings" && pending ? `<b class="badge">${pending}</b>` : ""}</a>`).join("");
  return `<div class="adm"><header class="adm-top"><a class="logo" href="#/admin" aria-label="Admin overview">${logo().match(/<svg.*<\/svg>/s)[0]}<span class="logo-word"><b>Faxton</b> Rentals</span></a><span class="vr"></span><span class="adm-title">Admin console</span><span style="flex:1"></span>
      <label class="adm-search">${icon("search", 20)}<input type="search" placeholder="Search listings, users, applications…" aria-label="Search"></label><a class="icon-btn bell ${S.unread ? "dot" : ""}" href="#/messages" aria-label="Notifications">${icon("bell", 22)}</a>
      <a class="me-btn" href="#/settings" aria-label="Account">${avatarHtml()}${icon("chev", 18)}</a></header>
    <div class="adm-body"><aside class="adm-side" aria-label="Admin navigation"><nav>${items}</nav><a class="adm-back" href="#/">${icon("left", 20)} Go back to Faxton Rentals</a></aside>
    <main class="adm-main page" id="main">${verifyBanner()}${inner}</main></div></div>`;
}
// The site's navigation: a top bar with the logo at the left, the page tabs, the bell and the account menu.
function appShell(path, inner) {
  const on = (h) => (h === "/" ? path === "/" : h === "/search" ? path === "/search" || path.startsWith("/home/") : h === "/rentals" ? ["/rentals", "/bookings", "/payments", "/documents", "/applications", "/apply"].some((p) => path === p || path.startsWith(p + "/")) : path === h || path.startsWith(h + "/"));
  const links = TOPNAV.map(([h, l, ic]) => `<a class="${on(h) ? "on" : ""}" href="#${h}" ${on(h) ? 'aria-current="page"' : ""}><span class="tn-ic">${icon(ic, 24)}</span><span class="tn-lb">${l}</span>${h === "/messages" ? `<b class="tn-badge" data-unread ${S.unread ? "" : "hidden"}>${S.unread || ""}</b>` : ""}</a>`).join("");
  const menu = `<div class="me-wrap"><button class="me-btn" id="meBtn" aria-haspopup="menu" aria-expanded="false" aria-label="Account menu">${avatarHtml()}${icon("chev", 18)}</button>
      <div class="menu" id="meMenu" role="menu" hidden><div class="menu-head"><b>${esc(userName())}</b><small>${esc(S.isOwner ? "Owner" : S.role)}</small></div>
      <a role="menuitem" href="#/settings">${icon("gear", 18)} Settings</a><a role="menuitem" href="#/rentals">${icon("cal", 18)} My rentals</a><a role="menuitem" href="#/payments">${icon("doc", 18)} Payments</a>
      ${S.isAdmin ? `<a role="menuitem" href="#/admin">${icon("building", 18)} Admin console</a>` : ""}<button role="menuitem" id="logoutBtn">${icon("logout", 18)} Sign out</button></div></div>`;
  const body = WRAPPED.includes(path) ? `<div class="wrap">${inner}</div>` : inner;
  const back = !(path === "/search" || path.startsWith("/home/")) ? "" : `<div class="wrap backbar"><button type="button" class="back-btn" data-back aria-label="Go back">${icon("left", 20)} Back</button></div>`;
  return `<header class="topnav"><div class="tn-in">${logo()}<nav class="tn-links" aria-label="Main">${links}</nav>
    <div class="tn-right"><a class="icon-btn bell ${S.unread ? "dot" : ""}" id="bell" href="#/messages" aria-label="Messages and notifications">${icon("bell", 22)}</a>${menu}</div></div></header>
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
  const open = path.startsWith("/onboarding/") || path === "/login" || path === "/signup" || path === "/forgot";
  if (!S.user && !open) return go(path === "/" ? "#/onboarding/1" : "#/login?next=" + encodeURIComponent(location.hash.slice(1)));
  if (S.user && open) return go("#" + (q.next || "/"));

  const ctx = { path, q, S, go, refreshUser, setThemePref, themePref, resendVerification, refreshProfile, resetTour, installApp, canInstall: () => !!installPrompt, shell, render, toggleTheme, themeBtn, signIn, signUp, signInGoogle, logout, setSaved, resetPassword };
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
  if (path === "/" && S.user && !tourSeen(S.user)) whenReady(() => { if (parse().path === "/") startTour(S.user, (S.user.displayName || "").split(" ")[0]); });
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
    const lo = $("#logoutBtn"); if (lo) lo.onclick = async () => { await logout(); go("#/login"); };
  }
  const c = $("#collapse"); if (c) c.onclick = () => { const s = c.closest(".shell,.home-grid"); s.classList.toggle("collapsed"); try { localStorage.setItem("rail", s.classList.contains("collapsed") ? "1" : "0"); } catch {} };
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
export async function refreshProfile() { if (S.user) S.profile = await getProfile(S.user.uid); }
export async function resendVerification() { await sendEmailVerification(auth.currentUser); }
export async function refreshUser() { await auth.currentUser.reload(); await refreshAuthState(auth.currentUser); render(); }
async function signInGoogle() {
  // Google blocks sign-in inside an app's embedded browser, so the Android app asks Google natively and hands the result to Firebase.
  const native = window.Capacitor?.Plugins?.FirebaseAuthentication;
  if (native && /FaxtonApp\/mobile/.test(navigator.userAgent)) {
    const r = await native.signInWithGoogle({ skipNativeAuth: true });
    const idToken = r?.credential?.idToken;
    if (!idToken) throw new Error("Google sign-in was cancelled.");
    const c = await signInWithCredential(auth, GoogleAuthProvider.credential(idToken, r.credential.accessToken));
    return ensureProfile(c.user);
  }
  const c = await signInWithPopup(auth, google); await ensureProfile(c.user);
}
const logout = () => signOut(auth);
async function setSaved(id, on) {
  on ? S.saved.add(id) : S.saved.delete(id);
  try { await toggleSaved(S.user, id, on); } catch (e) { on ? S.saved.delete(id) : S.saved.add(id); toast(friendlyErr(e)); }
}
export const resetPassword = (email) => sendPasswordResetEmail(auth, email);

async function refreshAuthState(u) {
  S.user = u; S.profile = null; S.saved = new Set(); S.isOwner = S.isAdmin = false; S.role = "renter";
  if (u) {
    [S.profile, S.ownerUid] = await Promise.all([getProfile(u.uid), getOwnerUid()]);
    // While there is no owner, a verified account may try to claim it. Firestore rules only allow the designated owner.
    if (!S.ownerUid && u.emailVerified) {
      try { await ensureProfile(u); await claimOwnership(u); S.ownerUid = u.uid; S.profile = await getProfile(u.uid); toast("You are the owner of Faxton Rentals."); } catch { /* not the owner: expected */ }
    }
    S.isOwner = S.ownerUid === u.uid;
    S.role = S.isOwner ? "owner" : S.profile?.role === "owner" ? "admin" : S.profile?.role || "renter";
    S.isAdmin = S.isOwner || S.role === "admin";
  }
  S.saved = new Set(u ? S.profile?.saved || [] : await getSaved(u));
  S.unsubConvs?.(); S.unsubConvs = null; S.unread = 0;
  if (u) S.unsubConvs = watchConversations(u, (c) => {
    const n = c.filter((x) => x.unread).length; if (n === S.unread) return; S.unread = n;
    $$("[data-unread]").forEach((b) => { b.textContent = n || ""; b.hidden = !n; });
    $$("#bell").forEach((b) => b.classList.toggle("dot", n > 0));
  });
}
onAuthStateChanged(auth, async (u) => { try { await refreshAuthState(u); } catch (e) { console.error(e); } S.ready = true; render(); });
addEventListener("hashchange", () => { S.nav++; render(); });
matchMedia("(max-width: 860px)").addEventListener?.("change", () => render());
render();

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
