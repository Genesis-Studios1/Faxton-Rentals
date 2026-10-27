import { detectTenant } from "./myhome.js";
import * as G from "./gate.js";
import * as LOCK from "./applock.js";
import { auth, db, google, reauthenticateWithCredential, reauthenticateWithPopup } from "./firebase.js";
import { GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, signInWithCredential, signOut, updateProfile, sendPasswordResetEmail, sendEmailVerification, deleteUser, setPersistence, browserLocalPersistence, browserSessionPersistence }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { patch as patchDoc } from "./store.js";
import { $, $$, esc, icon, logo, initials, toast, friendlyErr, modal } from "./ui.js";
import { getProfile, getSaved, toggleSaved, getOwnerUid, claimOwnership, watchConversations, watchProfile, hasAccountMarker, writeAccountMarker, watchNotifications, watchAllNotifications, markNotificationRead, watchPendingVerifications, deleteProfile, saveProfile, logStaffEvent, watchStaffEvents } from "./store.js";
import * as V from "./views.js";
import { startUpdateWatch, stopUpdateWatch, syncShellAutoUpdate } from "./apps.js";
import { startTour, tourSeen, resetTour } from "./tour.js";
import { playSound, setSounds } from "./sound.js";
import { verifyPopup, verifiedPopup, askResidence } from "./onboard.js";
import { resFields } from "./loc.js";
import { watchIncoming } from "./calls.js";
import "./lightbox.js";
import { siteFooter, wireFooter } from "./footer.js";
import { syncPublic } from "./store.js";
import * as PRES from "./presence.js";

export const S = { notes: [], shownNotes: new Set(), pendingV: 0, nav: 0, unread: 0, unsubConvs: null, user: null, profile: null, saved: new Set(), ready: false, cleanups: [], ownerUid: null, isOwner: false, isAdmin: false, role: "renter" };
const app = $("#app");

// ---------- theme ----------
export const theme = () => document.documentElement.dataset.theme;
export const themePref = () => { try { return localStorage.getItem("theme") || "light"; } catch { return "light"; } };
const resolveTheme = (p) => (p === "dark" || (p === "system" && matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light");
export function setThemePref(p) {
  try { localStorage.setItem("theme", p); } catch {}
  document.documentElement.dataset.theme = resolveTheme(p);
  $$("[data-theme-btn]").forEach((b) => (b.innerHTML = icon(theme() === "dark" ? "sun" : "moon", 20))); paintThemeSw();
}
matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => { if (themePref() === "system") document.documentElement.dataset.theme = resolveTheme("system"); });
export function toggleTheme() {
  const n = theme() === "dark" ? "light" : "dark"; document.documentElement.dataset.theme = n;
  try { localStorage.setItem("theme", n); } catch {}
  $$("[data-theme-btn]").forEach((b) => (b.innerHTML = icon(n === "dark" ? "sun" : "moon", 20))); paintThemeSw();
}
export const themeBtn = () => `<button class="icon-btn toggle-theme" data-theme-btn aria-label="Switch between light and dark mode">${icon(theme() === "dark" ? "sun" : "moon", 20)}</button>`;

// ---------- routing ----------
export const go = (h) => { if (location.hash === h) render(); else location.hash = h; };
const parse = () => { const [p, q] = (location.hash.slice(1) || "/").split("?"); return { path: p.replace(/\/+$/, "") || "/", q: Object.fromEntries(new URLSearchParams(q || "")) }; };

const NAV = [["/", "home", "Home"], ["/search", "search", "Search"], ["/saved", "heart", "Saved"], ["/messages", "msg", "Messages"], ["/bookings", "cal", "Bookings"], ["/payments", "doc", "Payments"]];
const TOPNAV = [["/", "Home", "home"], ["/search", "Find a home", "search"], ["/saved", "Saved homes", "heart"], ["/messages", "Messages", "msg"], ["/rentals", "My rentals", "cal"], ["/help", "Contact us", "help"]];
const topnav = () => (S.tenant ? TOPNAV.map((x) => (x[0] === "/rentals" ? ["/myhome", "My home", "home"] : x)) : TOPNAV);
// (the console sidebar now lives in ax-shell.js)
export const avatarHtml = (cls = "") => (S.profile?.photo ? `<img class="avatar ${cls}" src="${esc(S.profile.photo)}" alt="" referrerpolicy="no-referrer">` : `<span class="avatar ${cls}">${esc(initials(userName()))}</span>`);
const userName = () => S.user?.displayName || S.profile?.name || S.user?.email || "Guest";
const isCollapsed = () => { try { return localStorage.getItem("rail") === "1"; } catch { return false; } };
const WRAPPED = ["/bookings"];
const isSettings = (p) => p === "/settings" || p.startsWith("/settings/");

function shell(path, inner, o = {}) {
  const { admin = false, role = "" } = o, staff = !!(S.user && (S.isAdmin || ROLE_UI[S.role]));
  // Staff also see Messages and Settings inside their own console (sidebar and top bar stay).
  if (AXS && (role || admin || (staff && (path.startsWith("/messages") || isSettings(path))))) return adminShell(path, inner, o, role || (admin || S.isAdmin ? "" : S.role));
  return appShell(path, inner);
}
// Console chrome for the other staff roles: same header and sidebar, with only the pages that role can use.
const ROLE_UI = {
  support: { title: "Support console", home: "/support", nav: [["/support", "home", "Dashboard"], ["/support/tickets", "msg", "Tickets"], ["/support/suggestions", "chatlines", "Suggestions"], ["/support/data-requests", "download", "Data requests"], ["/support/services", "wrench", "Service requests"], ["/help", "help", "Help centre"], ["/settings", "gear", "Settings"]] },
  landlord: { title: "Owner portal", home: "/portfolio", nav: [["/portfolio", "home", "Dashboard"], ["/offers", "tag", "Offers"], ["/tenants", "users", "Tenants"], ["/messages", "msg", "Messages"], ["/settings", "gear", "Settings"], ["/verification", "shield", "Identity check"]] },
  agency: { title: "Agency portal", home: "/agency", nav: [["/agency", "home", "Dashboard"], ["/offers", "tag", "Offers"], ["/tenants", "users", "Tenants"], ["/messages", "msg", "Messages"], ["/settings", "gear", "Settings"], ["/verification", "shield", "Identity check"]] },
  agent: { title: "Agent portal", home: "/agent-dashboard", nav: [["/agent-dashboard", "home", "Overview"], ["/agent-dashboard/leads", "users", "Leads"], ["/agent-dashboard/listings", "clipList", "Listings"], ["/agent-dashboard/viewings", "calDots", "Viewings"], ["/agent-dashboard/clients", "user", "Clients"], ["/offers", "tag", "Offers"], ["/tenants", "users", "Tenants"], ["/messages", "chatdots", "Messages"], ["/settings", "gear", "Settings"], ["/verification", "shield", "Identity check"]] },
};
const roleHome = () => (S.isAdmin ? "/admin" : ROLE_UI[S.role]?.home || null);
// Admin console and staff portals: grouped sidebar, top bar, four-icon phone bar and More sheet (ax-shell.js, loaded for staff only).
let AXS = null;
function adminShell(path, inner, view, role = "") {
  AXS.setHost({ S, go, render, theme, themePref, setThemePref, toggleTheme, logout, confirmSignOut, noteDot, verifyBanner, userName, noteCount: noteUnread });
  setTimeout(() => AXS.afterRender(), 0);
  return AXS.renderShell(path, inner, view || {}, role);
}
// ---- navigation chrome: the desktop header, the phone's four-icon bar and its "Me" sheet ----
// Phone bar (<= 860px): Home, Search, Messages, Me. Everything else lives in the Me sheet. The staff consoles (adminShell) draw their own bar.
const BAR = [["/", "home", "homeFill", "Home"], ["/search", "search", "searchFill", "Search"], ["/messages", "msg", "msgFill", "Messages"]];
const ME_PATHS = ["/settings", "/saved", "/bookings", "/payments", "/documents", "/rentals", "/applications", "/apply", "/book", "/offers", "/myhome", "/match", "/help", "/compare"];
const pathIs = (path, h) => path === h || path.startsWith(h + "/");
const navOn = (path, h) => (h === "/" ? path === "/" : h === "/search" ? path === "/search" || path.startsWith("/home/") : h === "/rentals" ? ["/rentals", "/bookings", "/payments", "/documents", "/applications", "/apply", "/offers"].some((p) => pathIs(path, p)) : pathIs(path, h));
const unreadTxt = (n) => (n > 99 ? "99+" : n || "");
const roleLabel = () => (S.isOwner ? "Owner" : S.tenant ? "Tenant" : { renter: "Renter", landlord: "Home owner", agency: "Agency", agent: "Agent", support: "Support", admin: "Admin" }[S.role] || "Member");
// One list feeds both the desktop account menu and the phone sheet. A fourth entry of 1 means "the top bar already links here" (left out of the desktop menu).
const meGroups = () => {
  const dash = S.isAdmin ? ["/admin", "building", "Admin console"] : ROLE_UI[S.role] ? [ROLE_UI[S.role].home, "building", "My dashboard"] : null;
  return [
    [S.tenant ? ["/myhome", "home", "My home"] : ["/rentals", "folder", "My rentals"], ["/saved", "heart", "Saved homes", 1], ["/bookings", "calDots", "Viewings"], ["/offers", "tag", "Offers"], ["/payments", "card", "Payments"], ["/documents", "doc", "Documents"]],
    [["/match", "sparkle", "Smart Home Match"], ["/help", "headset", "Contact us", 1], ["/settings", "cog", "Settings"]],
    [["/?to=app", "download", "Get the app"], ...(dash ? [dash] : [])],
  ];
};
function meMenuHtml() {
  const rows = (it) => it.filter((x) => !x[3]).map(([h, ic, l]) => `<a role="menuitem" class="fx-mi" href="#${h}">${icon(ic, 18)}<span>${l}</span></a>`).join("");
  return `<div class="fx-menu" id="meMenu" role="menu" aria-label="Account" hidden><div class="fx-mhead">${avatarHtml("lg")}<span class="fx-mwho"><b>${esc(userName())}</b><small>${esc(S.user?.email || "")}</small></span><em class="fx-role">${esc(roleLabel())}</em></div>
    ${meGroups().map((it) => `<div class="fx-mgrp" role="none">${rows(it)}</div>`).join("")}
    <div class="fx-mgrp" role="none"><button type="button" role="menuitem" class="fx-mi out" id="logoutBtn" data-signout>${icon("logout", 18)}<span>Sign out</span></button></div></div>`;
}
// The site's navigation: a glass top bar (logo, centred page links, theme, bell, account) and, on phones, the four-icon bar.
function appShell(path, inner) {
  const links = topnav().map(([h, l]) => { const o = navOn(path, h); return `<a class="${o ? "on" : ""}" href="#${h}" ${o ? 'aria-current="page"' : ""}><span class="fx-lbl">${l}</span>${h === "/messages" ? `<b class="fx-badge" data-unread ${S.unread ? "" : "hidden"}>${unreadTxt(S.unread)}</b>` : ""}</a>`; }).join("");
  const menu = `<div class="me-wrap"><button type="button" class="me-btn" id="meBtn" aria-haspopup="menu" aria-expanded="false" aria-label="Account menu">${avatarHtml()}${icon("chev", 16, 2)}</button>${meMenuHtml()}</div>`;
  const tabs = BAR.map(([h, ic, icf, l]) => { const o = h === "/messages" ? pathIs(path, h) : navOn(path, h); return `<a class="fx-tab ${o ? "on" : ""}" href="#${h}" ${o ? 'aria-current="page"' : ""}><span class="fx-ic">${icon(o ? icf : ic, 22, o ? 1.9 : 1.7)}${h === "/messages" ? `<b class="fx-badge" data-unread ${S.unread ? "" : "hidden"}>${unreadTxt(S.unread)}</b>` : ""}</span><span class="fx-tl">${l}</span></a>`; }).join("");
  const meOn = ME_PATHS.some((p) => pathIs(path, p));
  const meTab = `<button type="button" class="fx-tab ${meOn ? "on" : ""}" id="fxMe" aria-haspopup="dialog" aria-expanded="false" aria-label="Me: account and more"><span class="fx-ic">${S.profile?.photo ? `<img class="fx-me-img" src="${esc(S.profile.photo)}" alt="" referrerpolicy="no-referrer">` : icon(meOn ? "userFill" : "user", 22, meOn ? 1.9 : 1.7)}</span><span class="fx-tl">Me</span></button>`;
  const body = WRAPPED.includes(path) ? `<div class="wrap">${inner}</div>` : inner;
  const back = path === "/" || path.startsWith("/messages") || isSettings(path) ? "" : `<div class="wrap backbar"><button type="button" class="back-btn" data-back aria-label="Go back">${icon("left", 20)} Back</button></div>`;
  return `<a class="fx-skip" href="#" data-skip-main>Skip to content</a><header class="fx-top"><div class="fx-in">${logo()}<nav class="fx-links" aria-label="Main">${links}</nav>
    <div class="fx-right">${themeBtn()}<button type="button" class="icon-btn bell ${noteDot()}" id="bell" data-bell aria-label="Notifications" aria-haspopup="true" aria-expanded="false">${icon("bell", 20)}</button>${menu}</div></div></header>
    <main class="main-top page ${isSettings(path) ? "is-settings" : ""}" id="main" tabindex="-1">${verifyBanner()}${back}${body}</main>${path.startsWith("/messages") ? "" : siteFooter()}
    <nav class="fx-bar${path.startsWith("/messages/") ? " is-off" : ""}" aria-label="Primary">${tabs}${meTab}</nav>`;
}
// Drag a sheet down by its handle to dismiss it (phones).
function dragClose(handle, sheetEl, close) {
  if (!handle) return; let y0 = null, dy = 0;
  handle.addEventListener("pointerdown", (e) => { y0 = e.clientY; dy = 0; try { handle.setPointerCapture(e.pointerId); } catch {} sheetEl.style.transition = "none"; });
  handle.addEventListener("pointermove", (e) => { if (y0 === null) return; dy = Math.max(0, e.clientY - y0); sheetEl.style.transform = `translateY(${dy}px)`; });
  const end = () => { if (y0 === null) return; y0 = null; sheetEl.style.transition = ""; if (dy > 80) close(); else sheetEl.style.transform = ""; };
  handle.addEventListener("pointerup", end); handle.addEventListener("pointercancel", end);
}
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])';
const trapTab = (el) => (e) => { if (e.key !== "Tab") return; const f = $$(FOCUSABLE, el).filter((x) => x.offsetParent !== null); if (!f.length) return; const a = f[0], z = f[f.length - 1]; if (e.shiftKey && (document.activeElement === a || document.activeElement === el)) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); } };
// The "Me" sheet: photo and name, every personal page, appearance, sign out.
let sheet = null;
function meSheetHtml() {
  const dark = theme() === "dark";
  const row = ([h, ic, l]) => `<a class="fx-row" href="#${h}"><span class="fx-ti">${icon(ic, 20)}</span><span class="fx-rl">${l}</span>${icon("chevR", 18, 2)}</a>`;
  const who = S.profile?.photo ? `<img class="avatar xl" src="${esc(S.profile.photo)}" alt="" referrerpolicy="no-referrer">` : `<span class="avatar xl">${esc(initials(userName()))}</span>`;
  const g = meGroups();
  return `<div class="fx-grab" aria-hidden="true"><i></i></div><div class="fx-scroll">
    <a class="fx-who" href="#/settings">${who}<span class="fx-wt"><b>${esc(userName())}</b><small>${esc(S.user?.email || "")}</small></span><em class="fx-role">${esc(roleLabel())}</em>${icon("chevR", 18, 2)}</a>
    <div class="fx-grp">${g[0].map(row).join("")}</div>
    <div class="fx-grp">${g[1].map(row).join("")}<button type="button" class="fx-row fx-sw" role="switch" aria-checked="${dark}" data-theme-sw><span class="fx-ti">${icon(dark ? "sun" : "moon", 20)}</span><span class="fx-rl">Dark mode</span><span class="fx-switch" aria-hidden="true"><i></i></span></button></div>
    <div class="fx-grp">${g[2].map(row).join("")}</div>
    <div class="fx-grp"><button type="button" class="fx-row out" data-signout><span class="fx-ti">${icon("logout", 20)}</span><span class="fx-rl">Sign out</span></button></div></div>`;
}
function paintThemeSw() {
  const sw = $("[data-theme-sw]"); if (!sw) return; const dark = theme() === "dark";
  sw.setAttribute("aria-checked", String(dark)); const t = $(".fx-ti", sw); if (t) t.innerHTML = icon(dark ? "sun" : "moon", 20);
}
function openMeSheet() {
  if (sheet) return closeSheet();
  closeNotes(true); closeMenu();
  const back = document.createElement("div"); back.className = "fx-back";
  const el = document.createElement("div"); el.className = "fx-sheet"; el.id = "meSheet"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "Me"); el.tabIndex = -1;
  el.innerHTML = meSheetHtml(); document.body.append(back, el);
  document.documentElement.classList.add("fx-lock");
  sheet = { el, back, from: document.activeElement };
  const me = $("#fxMe"); me?.setAttribute("aria-expanded", "true"); me?.classList.add("open");
  requestAnimationFrame(() => requestAnimationFrame(() => { back.classList.add("in"); el.classList.add("in"); }));
  el.focus({ preventScroll: true });
  back.onclick = () => closeSheet();
  el.addEventListener("click", (e) => {
    if (e.target.closest("[data-theme-sw]")) return toggleTheme();
    if (e.target.closest("[data-signout]")) { closeSheet(); return doSignOut(); }
    if (e.target.closest("a[href]")) closeSheet();
  });
  el.addEventListener("keydown", trapTab(el));
  dragClose($(".fx-grab", el), el, () => closeSheet());
}
function closeSheet(instant) {
  if (!sheet) return; const { el, back, from } = sheet; sheet = null;
  document.documentElement.classList.remove("fx-lock");
  const me = $("#fxMe"); me?.setAttribute("aria-expanded", "false"); me?.classList.remove("open");
  const rm = () => { el.remove(); back.remove(); };
  if (instant) return rm();
  el.style.transform = ""; el.classList.remove("in"); back.classList.remove("in"); setTimeout(rm, 280);
  try { from?.focus?.({ preventScroll: true }); } catch {}
}
function closeMenu() { const mm = $("#meMenu"), mb = $("#meBtn"); if (mm && !mm.hidden) { mm.hidden = true; mb?.setAttribute("aria-expanded", "false"); } }
async function doSignOut() { if (await confirmSignOut()) { await logout(); go("#/login"); } }
const isPhone = () => matchMedia("(max-width: 860px)").matches;
// Header, bar and menu behaviour is wired once for the whole page (the markup is re-created on every route).
let chromeWired = false;
function wireChrome() {
  if (chromeWired) return; chromeWired = true;
  const root = document.documentElement, TEXTY = 'input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=button]):not([type=submit]):not([type=file]):not([type=color]),textarea,select,[contenteditable="true"]';
  document.addEventListener("click", (e) => {
    const t = e.target;
    const sk = t.closest?.("[data-skip-main]"); if (sk) { e.preventDefault(); const m = $("#main"); m?.focus({ preventScroll: true }); m?.scrollIntoView?.({ block: "start" }); return; }
    const mb = t.closest?.("#meBtn");
    if (mb) { e.preventDefault(); if (isPhone()) return openMeSheet(); const mm = $("#meMenu"); if (mm) { mm.hidden = !mm.hidden; mb.setAttribute("aria-expanded", String(!mm.hidden)); if (!mm.hidden) mm.querySelector("a,button")?.focus({ preventScroll: true }); } return; }
    if (t.closest?.("#fxMe")) { e.preventDefault(); return openMeSheet(); }
    const so = t.closest?.("#meMenu [data-signout]"); if (so) { closeMenu(); return doSignOut(); }
    if (!t.closest?.("#meMenu") || t.closest?.("#meMenu a")) closeMenu();
  });
  document.addEventListener("keydown", (e) => {
    const mm = $("#meMenu");
    if (e.key === "Escape") { if (sheet) closeSheet(); if (mm && !mm.hidden) { closeMenu(); $("#meBtn")?.focus(); } return; }
    if (mm && !mm.hidden && (e.key === "ArrowDown" || e.key === "ArrowUp")) { e.preventDefault(); const f = $$("a,button", mm), i = f.indexOf(document.activeElement); f[(i + (e.key === "ArrowDown" ? 1 : -1) + f.length) % f.length]?.focus(); }
  });
  // Haptic-like feedback on the phone bar (where the device supports it).
  document.addEventListener("pointerdown", (e) => { if (e.pointerType === "touch" && e.target.closest?.(".fx-tab")) { try { navigator.vibrate?.(6); } catch {} } }, { passive: true });
  // The bar slides away while the on-screen keyboard is up, so it never squeezes the page or the composer.
  const coarse = matchMedia("(pointer: coarse)");
  document.addEventListener("focusin", (e) => { if (coarse.matches && e.target.matches?.(TEXTY)) root.classList.add("fx-kbd"); });
  document.addEventListener("focusout", () => setTimeout(() => { if (!document.activeElement?.matches?.(TEXTY)) root.classList.remove("fx-kbd"); }, 120));
}
function topbar() {
  return `<div class="admin-top"><label class="input">${icon("search", 20)}<input type="search" placeholder="Search properties, users, applications…" aria-label="Search"></label><span style="flex:1"></span>${themeBtn()}<button type="button" class="icon-btn bell ${noteDot()}" data-bell aria-label="Notifications" aria-haspopup="true">${icon("bell", 20)}</button><span class="me"><span class="avatar">${esc(initials(userName()))}</span><span style="line-height:1.2"><b style="color:var(--head)">${esc(userName().split(" ")[0])}</b><br><small class="muted">${S.isOwner ? "Owner" : "Admin"}</small></span></span></div>`;
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
  const pub = path === "/terms" || path === "/privacy" || path === "/license";
  if (!S.user && !open && !pub) return go(path === "/" ? "#/onboarding/1" : "#/login?next=" + encodeURIComponent(location.hash.slice(1)));
  if (S.user && open) return go("#" + (q.next || "/"));
  // Staff accounts open their own dashboard first, once per visit.
  if (S.user && path === "/" && roleHome()) { let seen = false; try { seen = sessionStorage.getItem("landed") === S.user.uid; sessionStorage.setItem("landed", S.user.uid); } catch {} if (!seen) return go("#" + roleHome()); }

  const ctx = { confirmSignOut, dashHome: () => roleHome() || "/", path, q, S, go, refreshUser, setThemePref, themePref, resendVerification, refreshProfile, resetTour, installApp, canInstall: () => !!installPrompt, shell, render, toggleTheme, themeBtn, signIn, signUp, signInGoogle, reauthGoogle, logout, setSaved, resetPassword };
  bar(true);
  let view;
  try { view = S.user && G.needsVerify(S.user) && !LEGAL_PATHS.includes(path) ? G.verifyView(ctx) : await V.route(ctx); } catch (err) { console.error(err); if (id !== renderId) return; bar(false); app.innerHTML = shell(path, `<div class="fx-state" role="alert"><span class="fx-st-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 0115.5-6.2L21 8M21 3v5h-5M21 12a9 9 0 01-15.5 6.2L3 16M3 21v-5h5"/></svg></span><h2>This page didn’t load</h2><p>Check your internet connection and try again.</p><div class="fx-st-row"><button type="button" class="btn primary" data-fx-retry>Try again</button><a class="btn" href="#/">Go home</a></div></div>`); return wire(); }
  if (id !== renderId) return;
  bar(false);
  if (!AXS && view && !view.full && S.user && (S.isAdmin || ROLE_UI[S.role]) && (view.admin || view.role || path.startsWith("/messages") || isSettings(path))) { try { AXS = await import("./ax-shell.js"); } catch (e) { console.error(e); } if (id !== renderId) return; }
  if (!view) { app.innerHTML = shell(path, `<div class="fx-state"><span class="fx-st-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5M8.5 11h5"/></svg></span><span class="fx-st-code">Error 404</span><h1>We couldn’t find that page</h1><p>The link may be old, or the home may have been taken down.</p><div class="fx-st-row"><a class="btn primary" href="#/">Go home</a><a class="btn" href="#/search">Find a home</a></div></div>`); return wire(); }
  app.innerHTML = view.full ? view.html : shell(path, view.html, view);
  document.title = (view.title ? view.title + " · " : "") + "Faxton Rentals";
  wire();
  scrollTo(0, 0);
  view.mount?.(app, ctx);
  if (S.user) { startUpdateWatch(S); syncShellAutoUpdate(S.profile?.prefs?.autoUpdate); } else stopUpdateWatch();
  // Never start a tour on top of the "Check your email" screen or a legal page; it starts once the account is verified and the real home shows.
  const gated = !!S.user && (G.needsVerify(S.user) || LEGAL_PATHS.includes(path));
  const tk = !S.user || gated ? null : path === "/" ? (S.isAdmin || ROLE_UI[S.role] ? null : "renter") : S.isAdmin && path === "/admin" ? "admin" : ROLE_UI[S.role]?.home === path ? S.role : null;
  // After the splash, on the home page (or a staff member's dashboard), anyone without an area of residence is asked once.
  const homeish = path === "/" || path === roleHome();
  if (S.user && S.profile && !S.profile.country && homeish) whenReady(() => {
    if (S.askingRes || S.profile?.country || !(parse().path === "/" || parse().path === roleHome())) return; S.askingRes = true;
    askResidence({ required: true }).then(async (r) => { if (!r) { S.askingRes = false; return; } try { const rf = resFields(r); await saveProfile(S.user.uid, rf); S.profile = { ...S.profile, ...rf }; toast("Thanks! Your area of residence is saved."); setTimeout(askNotifications, 800); } catch (e) { toast(friendlyErr(e)); } finally { S.askingRes = false; } });
  });
  else if (S.user && S.profile && homeish && S.profile.country && !G.needsVerify(S.user)) whenReady(async () => {
    // Google accounts without a Faxton picture are asked once (never over the splash, the lock, the verify screen or another window).
    try { const GP = await import("./gphoto.js"); if (S.askingPhoto || !S.user || G.needsVerify(S.user) || !(parse().path === "/" || parse().path === roleHome()) || document.querySelector("dialog[open]") || !GP.shouldOffer(S.user, S.profile)) return setTimeout(askNotifications, 600); S.askingPhoto = true; GP.askGooglePhoto(S, () => { S.askingPhoto = false; render(); setTimeout(askNotifications, 800); }); } catch { askNotifications(); }
  });
  else if (S.user && homeish) whenReady(() => setTimeout(askNotifications, 600));
  if (tk && !tourSeen(S.user, tk)) whenReady(() => { if (parse().path === path && S.user && !G.needsVerify(S.user)) startTour(S.user, (S.user.displayName || "").split(" ")[0], tk); });
}
const LEGAL_PATHS = ["/terms", "/privacy", "/license"];
// Prompts and tours wait for the splash, and for the app lock to be opened (a dialog under the lock screen would block it).
const whenReady = (f) => { const run = () => (document.documentElement.classList.contains("locked") ? document.addEventListener("applock-open", () => setTimeout(run, 900), { once: true }) : f()); return document.documentElement.classList.contains("ready") ? setTimeout(run, 900) : document.addEventListener("splash-done", () => setTimeout(run, 1100), { once: true }); };
function wire() {
  wireFooter(); wireNotes(); wireChrome(); closeNotes(true); closeSheet(true); paintBell();
  // Tab strips that scroll sideways open with the current tab in view.
  requestAnimationFrame(() => $$(".rn-tabs, .set-nav, .adm-side nav, .dt-tabs").forEach((c) => { const on = c.querySelector(".on, [aria-current]"); if (on && c.scrollWidth > c.clientWidth) c.scrollLeft = Math.max(0, on.offsetLeft - (c.clientWidth - on.offsetWidth) / 2); }));
  const rs = $("[data-resend]"), rf = $("[data-refresh]");
  if (rs) rs.onclick = async () => { try { await resendVerification(); toast("Verification email sent."); } catch (e) { toast(friendlyErr(e)); } };
  if (rf) rf.onclick = async () => { try { await refreshUser(); } catch (e) { toast(friendlyErr(e)); } };
  $$("[data-theme-btn]").forEach((b) => (b.onclick = toggleTheme));
  $$("[data-back]").forEach((b) => (b.onclick = () => (S.nav > 0 ? history.back() : go("#/"))));
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
    d.role = role; if (extra.photo) d.photo = extra.photo; // a Google picture is offered after sign-in, never copied silently
    const res = extra.residence || (extra.details?.country ? { country: extra.details.country, state: extra.details.state, lga: extra.details.lga, city: extra.details.city } : null);
    if (res?.country) Object.assign(d, resFields(res));
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
    // Firebase hides whether an email exists (on purpose), so a wrong password and a missing account look the same. Say so honestly instead of guessing.
    throw e;
  }
  const p = await rejectIfBanned(c.user);
  writeAccountMarker(email);
  announce(c.user, p, "login");
  return p?.role || "renter";
}
async function signUp(name, email, pw, role, details, photo, residence) {
  const c = await createUserWithEmailAndPassword(auth, email, pw);
  try { await updateProfile(c.user, { displayName: name }); } catch {}
  writeAccountMarker(email);
  const mk = () => ensureProfile(c.user, { name, role: ["agent", "landlord", "agency"].includes(role) ? role : "renter", details, photo, residence });
  try { await mk(); } catch { await mk(); }
  try { await sendEmailVerification(c.user); } catch {}
  // Load the new profile now so the app opens signed in on the home page.
  await refreshAuthState(auth.currentUser);
  announce(c.user, S.profile, "signup");
}
// Tells the Faxton team (admins and support see it live) that someone signed up or in. Logins are sent at most once per person per 30 minutes.
function announce(user, profile, type) {
  try {
    if (type === "login") { const k = "evl_" + user.uid, last = +localStorage.getItem(k) || 0; if (Date.now() - last < 18e5) return; localStorage.setItem(k, String(Date.now())); }
  } catch {}
  logStaffEvent(user, profile, type);
}
// ---- the notifications panel under the bell (a popover on desktop, a bottom sheet on phones) ----
const allNotes = () => [...(S.evNotes || []), ...(S.notes || [])].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
const noteUnread = () => allNotes().filter((n) => !n.read).length;
const noteDot = () => (noteUnread() ? "dot" : "");
const paintBell = () => $$("[data-bell]").forEach((b) => { b.classList.toggle("dot", noteUnread() > 0); const n = noteUnread(); if (n) b.dataset.n = n > 99 ? "99+" : n; else delete b.dataset.n; });
const agoText = (sec) => { if (!sec) return ""; const d = Math.max(0, Date.now() / 1000 - sec); return d < 60 ? "Just now" : d < 3600 ? Math.floor(d / 60) + " min ago" : d < 86400 ? Math.floor(d / 3600) + " h ago" : new Date(sec * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short" }); };
const NOTE_IC = { verified: "check", rejected: "x", info: "info" };
// Unread items sit under "New"; the rest are grouped by age.
const noteGroup = (n) => { if (!n.read) return "New"; const d = new Date(); d.setHours(0, 0, 0, 0); const t = d.getTime() / 1000, s = n.createdAt?.seconds || 0; return s >= t ? "Today" : s >= t - 6 * 86400 ? "This week" : "Earlier"; };
const markRead = (n) => (n.ev ? markEvRead(n.id) : markNotificationRead(n.id));
// ---- live "someone signed up / signed in" entries for admins and support (one small listener on the newest 30 staffEvents) ----
const evKey = (u, w) => `staffEv${w}_${u.uid}`;
const lsGet = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const ROLE_NAME = { owner: "Owner", admin: "Admin", agent: "Agent", landlord: "Property owner", agency: "Agency", support: "Support", renter: "Renter" };
function markEvRead(id) { const u = S.user; if (!u) return; const r = lsGet(evKey(u, "Read"), []); if (!r.includes(id)) lsSet(evKey(u, "Read"), [...r, id].slice(-120)); }
function startStaffEvents(u) {
  let base = lsGet(evKey(u, "Base"), 0); if (!base) { base = Date.now(); lsSet(evKey(u, "Base"), base); }
  const staffHref = S.isAdmin ? "/admin/users" : undefined;
  let first = true;
  return watchStaffEvents((list, added) => {
    if (S.user?.uid !== u.uid) return;
    const read = new Set(lsGet(evKey(u, "Read"), []));
    S.evNotes = list.filter((e) => e.at?.seconds && e.uid !== u.uid).map((e) => {
      const nm = e.name || "Someone", rl = ROLE_NAME[e.role] || "Renter", su = e.type === "signup";
      return { id: e.id, ev: true, kind: su ? "verified" : "info", title: su ? `New sign-up: ${nm} (${rl})` : `${nm} signed in`, body: "", href: staffHref, createdAt: e.at, read: read.has(e.id) || e.at.seconds * 1000 <= base };
    });
    if (!first) { const fresh = S.evNotes.filter((n) => added.includes(n.id) && !n.read); if (fresh.length) { toast(fresh[0].title + (fresh.length > 1 ? ` (+${fresh.length - 1} more)` : "")); playSound("staff"); } }
    first = false; paintBell(); if ($("#notePanel")) drawNotes();
  });
}
function drawNotes() {
  const box = $("#notePanel"); if (!box) return; const list = allNotes(), un = noteUnread(), groups = {};
  list.forEach((n) => (groups[noteGroup(n)] ||= []).push(n));
  const item = (n) => `<div class="fxn-item ${n.read ? "" : "new"}" data-id="${esc(n.id)}" ${n.href ? `data-href="${esc(n.href)}" role="link"` : 'role="button"'} tabindex="0"><span class="fxn-ic ${esc(n.kind || "")}">${icon(NOTE_IC[n.kind] || "bell", 18)}</span><span class="fxn-tx"><b>${esc(n.title || "")}</b>${n.body ? `<span class="fxn-b">${esc(n.body)}</span>` : ""}<small>${agoText(n.createdAt?.seconds)}</small></span>${n.read ? "" : `<i class="fxn-dot" title="Unread"></i><span class="sr">Unread</span>`}</div>`;
  box.innerHTML = `<div class="fxn-grab" aria-hidden="true"><i></i></div>
    <div class="fxn-head"><h2>Notifications</h2>${un ? `<span class="fxn-count num">${un} new</span>` : ""}<span class="fxn-sp"></span>${un ? `<button type="button" class="fxn-all" id="npAll">Mark all as read</button>` : ""}<button type="button" class="fxn-x" data-npclose aria-label="Close notifications">${icon("x", 18)}</button></div>
    <div class="fxn-list">${list.length ? ["New", "Today", "This week", "Earlier"].filter((g) => groups[g]).map((g) => `<section class="fxn-sec"><h3 class="fxn-gh">${g}</h3>${groups[g].map(item).join("")}</section>`).join("") : `<div class="fxn-empty"><span class="fxn-eic">${icon("bell", 26)}</span><b>You’re all caught up</b><p>Replies, viewing updates and account news will show up here.</p></div>`}</div>
    <a class="fxn-foot" href="#/messages">Open messages${S.unread ? ` <b class="num">${unreadTxt(S.unread)}</b>` : ""}</a>`;
  const open = (x) => { const n = list.find((m) => m.id === x.dataset.id); if (n && !n.read) { n.read = true; markRead(n); paintBell(); } if (x.dataset.href) { closeNotes(); go("#" + x.dataset.href); } else drawNotes(); };
  $$(".fxn-item", box).forEach((x) => { x.onclick = () => open(x); x.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(x); } }; });
  const all = $("#npAll", box); if (all) all.onclick = () => { allNotes().filter((n) => !n.read).forEach((n) => { n.read = true; markRead(n); }); paintBell(); drawNotes(); };
  const x = $("[data-npclose]", box); if (x) x.onclick = () => closeNotes();
  dragClose($(".fxn-grab", box), box, () => closeNotes());
}
function closeNotes(instant) {
  const box = $("#notePanel"), back = $("#noteBack"); if (!box && !back) return;
  document.documentElement.classList.remove("fx-lock");
  $("#bell")?.setAttribute("aria-expanded", "false");
  const rm = () => { box?.remove(); back?.remove(); };
  if (instant || !back) return rm();
  box.style.transform = ""; box.classList.remove("in"); back.classList.remove("in"); box.id = ""; back.id = ""; setTimeout(rm, 260);
}
function openNotes(btn) {
  if ($("#notePanel")) return closeNotes();
  closeSheet(true); closeMenu();
  const phone = isPhone();
  const box = document.createElement("div"); box.id = "notePanel"; box.className = "fxn"; box.setAttribute("role", "dialog"); box.setAttribute("aria-label", "Notifications"); box.tabIndex = -1;
  if (phone) { const back = document.createElement("div"); back.id = "noteBack"; back.className = "fx-back"; document.body.append(back); requestAnimationFrame(() => requestAnimationFrame(() => back.classList.add("in"))); document.documentElement.classList.add("fx-lock"); }
  document.body.append(box); btn.setAttribute("aria-expanded", "true");
  if (!phone) { const r = btn.getBoundingClientRect(); box.style.top = Math.round(r.bottom + 10) + "px"; box.style.right = Math.max(12, Math.round(innerWidth - r.right - 4)) + "px"; }
  drawNotes();
  requestAnimationFrame(() => requestAnimationFrame(() => box.classList.add("in")));
  box.focus({ preventScroll: true });
}
let notesWired = false;
function wireNotes() {
  if (notesWired) return; notesWired = true;
  document.addEventListener("click", (e) => { const b = e.target.closest?.("[data-bell]"); if (b) { e.preventDefault(); e.stopPropagation(); return openNotes(b); } if (!e.target.closest?.("#notePanel") || e.target.closest?.(".fxn-foot")) closeNotes(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && $("#notePanel")) { closeNotes(); $("#bell")?.focus(); } });
}
function showNotification(n) {
  if (n.kind === "verified") { markNotificationRead(n.id); verifiedPopup(n.title, n.body, "Go to my dashboard", () => go("#" + (roleHome() || "/"))); }
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
// ---- Google sign-in inside the Android / iPhone app --------------------------------------------------------------
// Google refuses OAuth in embedded browsers (error 403 disallowed_useragent), so the app asks Google natively
// (Android Credential Manager / iOS Google Sign-In) and hands the ID token to Firebase. The web pop-up is never used inside the app.
const GOOGLE_WEB_CLIENT_ID = "426381186757-t53dbg3io0h01d0rbpuo5g93qcl74f6r.apps.googleusercontent.com"; // the WEB client of google-services.json: the token audience Firebase expects
const inAppShell = () => { const ua = navigator.userAgent; return /FaxtonApp\/mobile/.test(ua) || window.Capacitor?.isNativePlatform?.() === true || /; wv\)/.test(ua); };
const jwtAud = (t) => { try { return JSON.parse(atob(String(t).split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).aud; } catch { return null; } };
// Turn whatever the native plugin rejects with (it has a message and usually no code) into one of a few kinds.
function classifyGoogleError(e) {
  const raw = `${e?.code || ""} ${e?.message || e || ""}`, num = Number((/(?:^|\s)(\d{1,5})\s*:/.exec(raw) || /\[(\d{1,5})\]/.exec(raw) || [])[1]) || 0;
  if (/cancel|dismiss|12501/i.test(raw) || num === 12501) return { kind: "cancelled", num };
  if (num === 10 || num === 28444 || /developer console|developer_error|WILL_BE_OVERRIDDEN|invalid.*client/i.test(raw)) return { kind: "not-registered", num: num || 10 };
  if (num === 7 || num === 20 || /network|timed? ?out|unreachable|unknownhost/i.test(raw)) return { kind: "network", num };
  if (/no credential|credentials? available|cannot find a matching|NoCredential/i.test(raw)) return { kind: "no-account", num };
  if (/play services|service_missing|service_version|service_disabled|api_unavailable|ProviderConfiguration|not supported|unsupported/i.test(raw) || num === 1 || num === 2 || num === 3 || num === 9 || num === 16) return { kind: "play-services", num };
  return { kind: "failed", num };
}
const GOOGLE_CODES = { cancelled: "G-CANCEL", "not-registered": "G-DEV", network: "G-NET", "no-account": "G-NOCRED", "play-services": "G-PLAY", failed: "G-FAIL" };
function googleError(k, e) {
  console.warn("[google-signin]", k.kind, e?.code, e?.message);
  // Never leave a dead end: put the cursor in the email box so the person can sign in with email and password instead.
  if (k.kind !== "cancelled") setTimeout(() => { try { document.querySelector("#email")?.focus({ preventScroll: false }); } catch {} }, 50);
  return Object.assign(new Error(e?.message || "Google sign-in failed"), { code: "google/" + k.kind, gcode: GOOGLE_CODES[k.kind] + (k.num ? "/" + k.num : "") });
}
async function nativeGoogleToken() {
  const cap = window.Capacitor;
  if (/FaxtonNoGoogle/.test(navigator.userAgent)) throw Object.assign(new Error("Google sign-in is not configured in this build"), { code: "app/google-unavailable", gcode: "G-IOS" });
  if (!cap || (cap.isPluginAvailable && !cap.isPluginAvailable("FirebaseAuthentication"))) throw Object.assign(new Error("Google sign-in plugin missing"), { code: "app/plugin-missing", gcode: "G-PLUGIN" });
  const native = cap.registerPlugin ? cap.registerPlugin("FirebaseAuthentication") : cap.Plugins?.FirebaseAuthentication;
  if (!native) throw Object.assign(new Error("Google sign-in plugin missing"), { code: "app/plugin-missing", gcode: "G-PLUGIN" });
  const android = cap.getPlatform?.() === "android";
  let r;
  try { r = await native.signInWithGoogle({ skipNativeAuth: true }); }
  catch (e1) {
    const k1 = classifyGoogleError(e1);
    // Credential Manager found nothing: try Google Play services' classic account chooser (it can also add an account). If this app build
    // isn't registered with Google it answers with developer error 10, which tells us exactly what is wrong.
    if (!(android && k1.kind === "no-account")) throw googleError(k1, e1);
    try { r = await native.signInWithGoogle({ skipNativeAuth: true, useCredentialManager: false }); }
    catch (e2) { const k2 = classifyGoogleError(e2); throw googleError(k2.kind === "failed" ? { kind: "no-account", num: k2.num } : k2, e2); }
  }
  const idToken = r?.credential?.idToken;
  if (!idToken) throw Object.assign(new Error("No Google token returned"), { code: "app/no-token", gcode: "G-TOKEN" });
  const aud = jwtAud(idToken);
  if (aud && aud !== GOOGLE_WEB_CLIENT_ID) throw Object.assign(new Error("Google token audience " + aud), { code: "google/audience", gcode: "G-AUD" });
  return { idToken, accessToken: r.credential.accessToken };
}
async function signInGoogle(chosen = "renter", details, residence, photo) {
  if (inAppShell()) {
    const { idToken, accessToken } = await nativeGoogleToken();
    let c;
    try { c = await signInWithCredential(auth, GoogleAuthProvider.credential(idToken, accessToken || undefined)); }
    catch (e) {
      const code = e?.code || "error";
      if (["auth/invalid-credential", "auth/invalid-idp-response", "auth/missing-or-invalid-nonce"].includes(code)) throw Object.assign(new Error(e?.message), { code: "google/token-rejected", gcode: "G-AUD" });
      if (["auth/operation-not-allowed", "auth/network-request-failed", "auth/user-disabled", "auth/account-exists-with-different-credential", "auth/too-many-requests", "auth/unauthorized-domain"].includes(code)) throw e;
      throw Object.assign(new Error(e?.message), { code: `firebase/${code}${window.__csp ? " | " + window.__csp : ""}` });
    }
    const was = S.justCreated; S.justCreated = null; await ensureProfile(c.user, { role: chosen, details, residence, photo }); const p = await rejectIfBanned(c.user); announce(c.user, p, S.justCreated ? "signup" : "login"); S.justCreated ||= was; return p?.role || "renter";
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
  const was = S.justCreated; S.justCreated = null;
  await ensureProfile(c.user, { role: ["landlord", "agency", "agent"].includes(chosen) ? chosen : "renter", details, residence, photo });
  const p = await rejectIfBanned(c.user); announce(c.user, p, S.justCreated ? "signup" : "login"); S.justCreated ||= was;
  return p?.role || "renter";
}
// Proves the signed-in person still controls their Google account (used by "Download my data"). In the Android / iPhone app the native Google
// plugin gives the token; on the web a pop-up does. Firebase refuses it if the Google account is not the one signed in.
async function reauthGoogle(user) {
  if (inAppShell()) { const { idToken, accessToken } = await nativeGoogleToken(); await reauthenticateWithCredential(user, GoogleAuthProvider.credential(idToken, accessToken || undefined)); return; }
  await reauthenticateWithPopup(user, google);
}
const logout = () => { PRES.stop(); return signOut(auth); };
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
  if (!u) { S.unsubCalls?.(); S.unsubCalls = null; S.unsubNotes?.(); S.unsubNotes = null; S.notes = []; S.unsubVerif?.(); S.unsubVerif = null; S.pendingV = 0; S.unsubStaffEv?.(); S.unsubStaffEv = null; S.evNotes = []; }
  S.user = u; S.profile = null; S.tenant = null; S.saved = new Set(); S.isOwner = S.isAdmin = false; S.role = "renter";
  if (!u) { S.unsubProfile?.(); S.unsubProfile = null; }
  if (u) {
    [S.profile, S.ownerUid] = await Promise.all([getProfile(u.uid), getOwnerUid()]);
    if (S.profile?.banned) { S.bannedNote = true; S.unsubProfile?.(); S.unsubProfile = null; try { await signOut(auth); } catch {} return refreshAuthState(null); }
    S.bannedNote = false;
    // Keep my public card (name, photo, role, about) up to date for the people who tap my picture.
    { const pr = S.profile || {}; if (pr.name || u.displayName) syncPublic(u.uid, { name: (pr.role === "agency" && pr.agency?.business) || pr.name || u.displayName || "User", photo: pr.photo || "", role: pr.role || "renter", city: pr.city || "", country: pr.country || "", website: pr.agency?.website || "" }); }
    if (S.profile?.deletion?.status === "approved" && Date.now() >= (S.profile.deletion.requestedAt || 0) + 864e5) return finalizeDeletion(u);
    if (!S.profile) { try { await ensureProfile(u); S.profile = await getProfile(u.uid); } catch { /* rules refused; leave signed in without a profile */ } }
    // Last active and sign-in method, for the admin Users table: stamped at most once an hour, and never in anyone's way.
    if (S.profile) { const la = S.profile.lastActive, t0 = la?.seconds ? la.seconds * 1000 : la?.toMillis ? la.toMillis() : 0, prov = u.providerData.some((x) => x.providerId === "google.com") ? "google" : "password";
      // emailVerified lets the admin Users list show unverified sign-ups as Pending; it is written only when it changes.
      if (Date.now() - t0 > 36e5 || S.profile.provider !== prov) patchDoc("users", u.uid, { lastActive: serverTimestamp(), provider: prov }).catch(() => {});
      if (S.profile.emailVerified !== !!u.emailVerified) (async () => { try { if (u.emailVerified) await u.getIdToken(true); await patchDoc("users", u.uid, { emailVerified: !!u.emailVerified }); if (S.profile) S.profile.emailVerified = !!u.emailVerified; } catch {} })();
      if (typeof S.profile.prefs?.sounds === "boolean") setSounds(S.profile.prefs.sounds); }
    S.unsubProfile?.(); S.unsubProfile = watchProfile(u.uid, (p) => {
      if (S.user?.uid !== u.uid || !p) return;
      if (p.banned) { S.bannedNote = true; signOut(auth); return; }
      const was = S.profile; S.profile = p;
      // A role change or a verification decision made by an admin shows up straight away.
      if (was && (p.role !== was.role)) refreshAuthState(auth.currentUser || u).then(render);
      else if (was && (p.verified !== was.verified || p.verification?.status !== was.verification?.status)) render();
    });
    S.unsubNotes?.(); S.unsubNotes = watchAllNotifications(u.uid, (list) => { S.notes = list; paintBell(); list.filter((n) => !n.read).forEach((n) => { if (S.shownNotes.has(n.id)) return; S.shownNotes.add(n.id); showNotification(n); }); if ($("#notePanel")) drawNotes(); });
    // While there is no owner, a verified account may try to claim it. Firestore rules only allow the designated owner.
    if (!S.ownerUid && u.emailVerified) {
      try { await ensureProfile(u); await claimOwnership(u); S.ownerUid = u.uid; S.profile = await getProfile(u.uid); toast("You are the owner of Faxton Rentals."); } catch { /* not the owner: expected */ }
    }
    S.isOwner = S.ownerUid === u.uid;
    S.role = S.isOwner ? "owner" : S.profile?.role === "owner" ? "admin" : S.profile?.role || "renter";
    S.isAdmin = S.isOwner || S.role === "admin";
    // Approved tenants get a My Home dashboard instead of "My rentals". The lookup never holds up sign-in for long.
    S.tenant = null; if (!S.isAdmin && S.role === "renter") S.tenant = await Promise.race([detectTenant(u).catch(() => null), new Promise((r) => setTimeout(() => r(null), 2500))]);
    S.unsubCalls?.(); S.unsubCalls = watchIncoming({ S, user: u }, S.isAdmin || S.role === "support");
    S.unsubVerif?.(); S.unsubVerif = null;
    S.unsubStaffEv?.(); S.unsubStaffEv = null; S.evNotes = [];
    if (S.isAdmin || S.role === "support") S.unsubStaffEv = startStaffEvents(u);
    if (S.isAdmin) { let first = true; S.unsubVerif = watchPendingVerifications((list) => { const n = list.length, grew = n > (S.pendingV || 0); S.pendingV = n; $$("[data-vbadge]").forEach((b) => { b.textContent = n || ""; b.hidden = !n; });
      if (first && n) toast(`${n} verification request${n > 1 ? "s" : ""} waiting for you.`); else if (!first && grew) toast("New verification request: an agency or agent is waiting for you."); first = false; }); }
  }
  // App lock: ask for the fingerprint once when the app opens (and again after being away; see applock.js).
  if (u) { if (S.lockedFor !== u.uid) { S.lockedFor = u.uid; LOCK.arm(u, logout); } else LOCK.refreshArm(u, logout); } else S.lockedFor = null;
  S.saved = new Set(u ? S.profile?.saved || [] : await getSaved(u));
  S.unsubConvs?.(); S.unsubConvs = null; S.unread = 0; S.hasConvs = false; S.openChat = "";
  PRES.stop(false);
  if (u) PRES.start(u.uid, { shows: () => S.profile?.privacy?.showOnline !== false, wanted: () => S.hasConvs || S.isAdmin || S.role === "support" });
  let firstConv = true;
  if (u) S.unsubConvs = watchConversations(u, (c) => {
    // A conversation that is open and on screen is being read right now: it never counts as unread and never pings.
    const open = document.visibilityState === "visible" ? S.openChat : "";
    const has = c.length > 0; if (has !== S.hasConvs) { S.hasConvs = has; PRES.refresh(); }
    PRES.ackDelivery(c, "u");
    const n = c.filter((x) => x.unread && x.id !== open).length; const wasFirst = firstConv; firstConv = false; if (n === S.unread) return; if (n > S.unread) { sysNotify("New message", "You have a new message on Faxton Rentals."); if (!wasFirst) playSound("message"); } S.unread = n;
    $$("[data-unread]").forEach((b) => { b.textContent = unreadTxt(n); b.hidden = !n; });
  });
}
onAuthStateChanged(auth, async (u) => { try { await LOCK.handleEmailRecoveryLink(u); await refreshAuthState(auth.currentUser || u); } catch (e) { console.error(e); } S.ready = true; render(); });
// Opening or leaving a chat inside Messages swaps the thread in place (no new page, no new listeners); see views.js messages().
addEventListener("hashchange", () => { if (AXS?.softNav() || S.msgNav?.(parse().path)) { S.nav++; return; } S.nav++; render(); });
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
// The service worker is registered and kept up to date by js/robust.js (it also shows the "A new version is ready" prompt).
