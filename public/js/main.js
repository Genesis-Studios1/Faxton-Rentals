import { auth, db, google } from "./firebase.js";
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, signOut, updateProfile, sendPasswordResetEmail }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { $, $$, esc, icon, logo, initials, toast, friendlyErr } from "./ui.js";
import { getProfile, getSaved, toggleSaved } from "./store.js";
import * as V from "./views.js";

export const S = { user: null, profile: null, saved: new Set(), ready: false, cleanups: [] };
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
const ANAV = [["/admin", "home", "Overview"], ["/admin/listings", "building", "Listings"], ["/admin/users", "users", "Users"], ["/admin/applications", "doc", "Rental applications"], ["/admin/viewings", "cal", "Viewings"], ["/admin/payments", "wallet", "Payments"], ["/admin/reports", "chart", "Reports"], ["/admin/support", "headset", "Support"], ["/settings", "gear", "Settings"]];
const userName = () => S.user?.displayName || S.profile?.name || S.user?.email || "Guest";

function shell(path, inner, { admin = false, bare = false, pending = 0 } = {}) {
  const collapsed = (() => { try { return localStorage.getItem("rail") === "1"; } catch { return false; } })();
  const on = (p) => (p === "/" ? path === "/" : path === p || path.startsWith(p + "/") || (p === "/search" && path.startsWith("/home/")));
  const items = (admin ? ANAV : NAV).map(([h, ic, l]) => `<a class="item ${on(h) ? "on" : ""}" href="#${h}" ${on(h) ? 'aria-current="page"' : ""}>${icon(ic, 24)}<span>${l}</span>${admin && l === "Listings" && pending ? `<b class="badge">${pending}</b>` : ""}</a>`).join("");
  const user = S.user ? `<a class="rail-user" href="#/settings"><span class="avatar">${esc(initials(userName()))}</span><span>${esc(userName().replace(/(\S+)\s+(\S).*/, "$1 $2."))}</span></a>`
    : `<a class="rail-user" href="#/login"><span class="avatar">${icon("user", 18)}</span><span>Sign in</span></a>`;
  return `<div class="shell ${collapsed ? "collapsed" : ""} ${admin ? "admin" : ""}">
    <aside class="rail" aria-label="Main navigation">
      <div class="rail-top">${admin ? logo("Admin console") : `<a class="logo" href="#/" aria-label="Faxton Rentals home">${logo().match(/<svg.*<\/svg>/s)[0]}</a>`}
        <button class="rail-collapse" id="collapse" aria-label="Collapse sidebar">${icon("dchev", 22)}</button></div>
      <nav>${items}</nav>
      <div class="rail-bottom">${admin ? "" : `<a class="item ${on("/settings") ? "on" : ""}" href="#/settings" style="display:grid;gap:4px;padding:12px 14px;border-radius:12px;font-weight:500;font-size:.93rem">${icon("gear", 24)}<span>Settings</span></a>`}${user}</div>
    </aside>
    <main class="main" id="main">${bare ? "" : topbar(admin)}${inner}</main></div>`;
}
function topbar(admin) {
  const me = S.user ? `<a class="me" href="#/settings" aria-label="Account"><span class="avatar">${esc(initials(userName()))}</span></a>` : `<a class="btn sm primary" href="#/login">Sign in</a>`;
  if (admin) return `<div class="admin-top"><label class="input">${icon("search", 20)}<input type="search" placeholder="Search properties, users, applications…" aria-label="Search"></label><span style="flex:1"></span>${themeBtn()}<button class="icon-btn dot" aria-label="Notifications">${icon("bell", 20)}</button><span class="me"><span class="avatar">${esc(initials(userName()))}</span><span style="line-height:1.2"><b style="color:var(--head)">${esc(userName().split(" ")[0])}</b><br><small class="muted">Super Admin</small></span></span></div>`;
  return `<div class="topbar">${themeBtn()}<button class="icon-btn dot" aria-label="Notifications">${icon("bell", 20)}</button>${me}</div>`;
}

let renderId = 0;
export async function render() {
  const id = ++renderId;
  S.cleanups.splice(0).forEach((f) => f());
  const { path, q } = parse();
  if (!S.ready) { app.innerHTML = `<div class="splash"><div>${V.splashMark()}</div></div>`; return; }
  const seen = (() => { try { return localStorage.getItem("seen") === "1"; } catch { return true; } })();
  if (path === "/" && !S.user && !seen && !q.skip) return go("#/splash");
  if (needsAuth.some((p) => path === p || path.startsWith(p + "/")) && !S.user) return go("#/login?next=" + encodeURIComponent(location.hash.slice(1)));
  if (["/login", "/signup"].includes(path) && S.user) return go("#" + (q.next || "/"));

  const ctx = { path, q, S, go, shell, render, toggleTheme, themeBtn, signIn, signUp, signInGoogle, logout, setSaved, resetPassword };
  const view = await V.route(ctx);
  if (id !== renderId) return;
  if (!view) { app.innerHTML = shell(path, `<div class="empty"><h2>Page not found</h2><p><a class="link" href="#/">Go home</a></p></div>`); return wire(); }
  app.innerHTML = view.full ? view.html : shell(path, view.html, view);
  document.title = (view.title ? view.title + " · " : "") + "Faxton Rentals";
  wire();
  scrollTo(0, 0);
  view.mount?.(app, ctx);
}
function wire() {
  $$("[data-theme-btn]").forEach((b) => (b.onclick = toggleTheme));
  const c = $("#collapse"); if (c) c.onclick = () => { const s = $(".shell"); s.classList.toggle("collapsed"); try { localStorage.setItem("rail", s.classList.contains("collapsed") ? "1" : "0"); } catch {} };
}

// ---------- auth ----------
async function ensureProfile(u, extra = {}) {
  const ref = doc(db, "users", u.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) await setDoc(ref, { name: u.displayName || extra.name || "", email: u.email, role: extra.role || "renter", saved: [], createdAt: serverTimestamp() });
}
const signIn = (email, pw) => signInWithEmailAndPassword(auth, email, pw);
async function signUp(name, email, pw, role) {
  const c = await createUserWithEmailAndPassword(auth, email, pw);
  await updateProfile(c.user, { displayName: name });
  await ensureProfile(c.user, { name, role: role === "agent" ? "agent" : "renter" });
}
async function signInGoogle() { const c = await signInWithPopup(auth, google); await ensureProfile(c.user); }
const logout = () => signOut(auth);
async function setSaved(id, on) {
  on ? S.saved.add(id) : S.saved.delete(id);
  try { await toggleSaved(S.user, id, on); } catch (e) { on ? S.saved.delete(id) : S.saved.add(id); toast(friendlyErr(e)); }
}
export const resetPassword = (email) => sendPasswordResetEmail(auth, email);

onAuthStateChanged(auth, async (u) => {
  S.user = u; S.profile = null; S.saved = new Set();
  if (u) { S.profile = await getProfile(u.uid); }
  S.saved = new Set(await getSaved(u));
  S.ready = true;
  render();
});
addEventListener("hashchange", render);
render();
