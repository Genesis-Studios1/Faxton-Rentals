// ax.js: shared building blocks for the owner/admin console and the staff portals (landlord, agency, agent, support).
// Plain functions that return HTML strings, plus small mount helpers wired by event delegation. No framework.
import { db } from "./firebase.js";
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { esc, icon as baseIcon } from "./ui.js";

export { esc };
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const phone = () => matchMedia("(max-width:720px)").matches;
const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
let uid = 0;
export const nid = (p = "ax") => p + ++uid + Math.random().toString(36).slice(2, 5);

// ---------- icons: the shared set plus a few console-only glyphs ----------
const X = {
  panel: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M9.5 4.5v15"/>',
  alert: '<path d="M12 3.5L2.5 20h19z"/><path d="M12 10v4.5M12 17.5h.01"/>',
  filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 010 12h-3"/>',
  up: '<path d="M12 19V6M6 12l6-6 6 6"/>',
  down: '<path d="M12 5v13M6 12l6 6 6-6"/>',
  chevR: '<path d="M9 6l6 6-6 6"/>', chevL: '<path d="M15 6l-6 6 6 6"/>', chevU: '<path d="M6 15l6-6 6 6"/>', chevD: '<path d="M6 9l6 6 6-6"/>',
  ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3"/>',
  more: '<circle cx="5" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="19" cy="12" r="1.4" fill="currentColor"/>',
  inbox: '<path d="M3 13l3-8h12l3 8v6H3z"/><path d="M3 13h5l1 3h6l1-3h5"/>',
  trend: '<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/>',
  sortUp: '<path d="M8 14l4-5 4 5"/>', sortDn: '<path d="M8 10l4 5 4-5"/>',
  rows: '<path d="M4 7h16M4 12h16M4 17h16"/>', rowsLg: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  kbd: '<rect x="2.5" y="6" width="19" height="12" rx="2.5"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
  lockc: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
  mapPin: '<path d="M12 21s-7-6-7-11a7 7 0 0114 0c0 5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  checkc: '<circle cx="12" cy="12" r="9"/><path d="M8 12.500l3 3 5-6"/>',
  receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  crown: '<path d="M3.5 8l4.500 4 4.500-6.500L16.500 12 20.500 8l-1.500 10h-14z"/><path d="M5 21h14"/>',
  device: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.500h2"/>',
  reply: '<path d="M9 14L4 9l5-5"/><path d="M4 9h9a7 7 0 017 7v2"/>',
  starF: '<path d="M12 3.400l2.700 5.600 6.100.9-4.400 4.300 1 6.100L12 17.400 6.600 20.300l1-6.100L3.200 9.900l6.100-.9z" fill="currentColor"/>',
  tool: '<path d="M14.700 6.300a4 4 0 00-5.400 5.100L3 17.700 6.300 21l6.300-6.300a4 4 0 005.100-5.400l-2.500 2.500-2.300-.4-.4-2.300z"/>',
};
export const I = (n, s = 18, sw = 1.75) => (X[n] ? `<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${X[n]}</svg>` : baseIcon(n, s, sw));

// ---------- formatting ----------
export const ms = (t) => (!t ? 0 : typeof t === "number" ? t : t.seconds != null ? t.seconds * 1000 : t.toMillis ? t.toMillis() : t instanceof Date ? t.getTime() : typeof t === "string" ? Date.parse(t) || 0 : 0);
const DAY = 864e5;
export const fmt = {
  num: (n) => (n == null || n === "" || !Number.isFinite(+n) ? "—" : (+n).toLocaleString("en-NG")),
  naira: (n) => (n == null || n === "" || !Number.isFinite(+n) || +n === 0 ? "—" : "₦" + Math.round(+n).toLocaleString("en-NG")),
  nairaC(n) { n = +n; if (!Number.isFinite(n) || !n) return "—"; if (n >= 1e9) return "₦" + (n / 1e9).toFixed(1).replace(/\.0$/, "") + "B"; if (n >= 1e6) return "₦" + (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M"; return "₦" + Math.round(n).toLocaleString("en-NG"); },
  date(t) { const m = ms(t); return m ? new Date(m).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"; },
  dateShort(t) { const m = ms(t); return m ? new Date(m).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—"; },
  dateTime(t) { const m = ms(t); return m ? new Date(m).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "—"; },
  rel(t) { const m = ms(t); if (!m) return "—"; const s = (Date.now() - m) / 1000; if (s < 60) return "Just now"; if (s < 3600) return Math.floor(s / 60) + " min ago"; if (s < 86400) return Math.floor(s / 3600) + " h ago"; if (s < 7 * 86400) return Math.floor(s / 86400) + " d ago"; return fmt.date(t); },
  age(t) { const m = ms(t); if (!m) return ""; const h = (Date.now() - m) / 36e5; return h < 1 ? "under 1 h" : h < 48 ? Math.floor(h) + " h" : Math.floor(h / 24) + " days"; },
  ageTone(t) { const h = (Date.now() - ms(t)) / 36e5; return !ms(t) ? "" : h > 72 ? "bad" : h > 24 ? "warn" : ""; },
  day(s) { const d = new Date(String(s || "").slice(0, 10) + "T00:00:00"); return isNaN(d) ? String(s || "—") : d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }); },
  title: (s) => String(s || "").replace(/^./, (c) => c.toUpperCase()),
};
export const pctDelta = (cur, prev) => { if (!cur && !prev) return null; if (!prev) return { dir: "new", text: "New" }; const p = Math.round(((cur - prev) / prev) * 100); return { dir: p > 0 ? "up" : p < 0 ? "down" : "flat", text: (p > 0 ? "+" : p < 0 ? "−" : "") + Math.min(999, Math.abs(p)) + "%" }; };
export const first = (s) => String(s || "").trim().split(/\s+/)[0] || "";

// ---------- status chips ----------
const CH = {
  listing: { active: ["ok", "Active"], pending: ["warn", "Pending review"], flagged: ["bad", "Changes requested"], rejected: ["bad", "Rejected"], archived: ["mute", "Archived"], occupied: ["info", "Occupied"], available: ["ok", "Available"] },
  verification: { pending: ["warn", "Pending"], verified: ["ok", "Verified"], rejected: ["bad", "Rejected"] },
  user: { banned: ["bad", "Banned"], active: ["ok", "Active"], owner: ["info", "Owner"], admin: ["mute", "Admin"], support: ["mute", "Support"], agency: ["mute", "Agency"], agent: ["mute", "Agent"], landlord: ["mute", "Property owner"], renter: ["mute", "Renter"] },
  application: { "under review": ["warn", "Under review"], "awaiting documents": ["info", "Awaiting documents"], approved: ["ok", "Approved"], active: ["ok", "Active"], rejected: ["bad", "Rejected"] },
  viewing: { requested: ["warn", "Requested"], confirmed: ["info", "Confirmed"], completed: ["ok", "Completed"], cancelled: ["mute", "Cancelled"], declined: ["mute", "Declined"] },
  offer: { pending: ["warn", "Pending"], countered: ["info", "Countered"], accepted: ["ok", "Accepted"], declined: ["bad", "Declined"], withdrawn: ["mute", "Withdrawn"] },
  ticket: { open: ["warn", "Open"], "in progress": ["info", "In progress"], resolved: ["ok", "Resolved"], closed: ["ok", "Resolved"] },
  priority: { low: ["mute", "Low"], medium: ["info", "Medium"], high: ["bad", "High"], overdue: ["bad", "Overdue"] },
  report: { new: ["warn", "New"], reviewing: ["info", "Reviewing"], "action taken": ["ok", "Action taken"], dismissed: ["mute", "Dismissed"] },
  dataRequest: { "verified-downloaded": ["info", "Downloaded"], downloaded: ["info", "Downloaded"], reviewed: ["ok", "Reviewed"] },
  suggestion: { new: ["warn", "New"], reviewed: ["info", "Reviewed"], planned: ["info", "Planned"], done: ["ok", "Done"] },
  maintenance: { open: ["warn", "Open"], "in progress": ["info", "In progress"], resolved: ["ok", "Resolved"], done: ["ok", "Done"] },
  charge: { due: ["warn", "Due"], paid: ["ok", "Paid"], overdue: ["bad", "Overdue"], confirmed: ["ok", "Confirmed"] },
  release: { published: ["ok", "Published"], draft: ["mute", "Draft"], required: ["bad", "Required update"] },
  relay: { on: ["ok", "Relay on"], off: ["mute", "Not set"] },
  proof: { submitted: ["warn", "Submitted"], confirmed: ["ok", "Confirmed"], rejected: ["bad", "Rejected"] },
  lead: { "new lead": ["info", "New lead"], "viewing scheduled": ["info", "Viewing scheduled"], viewed: ["mute", "Viewed"], application: ["warn", "Application"], closed: ["ok", "Closed"], declined: ["bad", "Declined"] },
  service: { new: ["warn", "New"], contacted: ["info", "Contacted"], scheduled: ["info", "Scheduled"], done: ["ok", "Done"], cancelled: ["mute", "Cancelled"] },
  sos: { open: ["alert", "Safety alert"], resolved: ["mute", "Alert resolved"] },
};
export const chipFor = (entity, value, label) => {
  const hit = (CH[entity] || {})[String(value ?? "").toLowerCase().trim()];
  const tone = hit ? hit[0] : "mute", text = label || (hit ? hit[1] : String(value || "—"));
  return tone === "alert" ? `<span class="ax-chip" data-t="alert">${I("alert", 14)}${esc(text)}</span>` : `<span class="ax-chip" data-t="${tone}"><i></i>${esc(text)}</span>`;
};
export const chip = (tone, text) => `<span class="ax-chip" data-t="${tone}"><i></i>${esc(text)}</span>`;

// ---------- avatars, thumbnails ----------
const okSrc = (s) => /^(https:|data:image\/|img\/|assets\/|icons\/)/.test(String(s || ""));
export const avatar = (name, id = "", size = 32, photo = "") => {
  const t = [...String(id || name || "?")].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % 5, ini = String(name || "?").trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";
  return okSrc(photo) ? `<img class="ax-av" style="--s:${size}px" src="${esc(photo)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-fb="${esc(ini)}" data-t="${t}">` : `<span class="ax-av" style="--s:${size}px" data-t="${t}">${esc(ini)}</span>`;
};
export const thumb = (src, size = 32, ic = "home") => (okSrc(src) ? `<img class="ax-th" style="--s:${size}px" src="${esc(src)}" alt="" loading="lazy" decoding="async" data-fb="">` : `<span class="ax-th ax-th-ph" style="--s:${size}px">${I(ic, Math.round(size * 0.5))}</span>`);
document.addEventListener("error", (e) => { const t = e.target; if (t?.tagName === "IMG" && t.dataset.fb !== undefined) { const s = document.createElement("span"); s.className = t.classList.contains("ax-av") ? "ax-av" : "ax-th ax-th-ph"; s.style.cssText = t.style.cssText; if (t.dataset.t) s.dataset.t = t.dataset.t; s.innerHTML = t.dataset.fb || I("home", 16); t.replaceWith(s); } }, true);

// ---------- buttons, empty and error states, skeletons ----------
export const btn = (label, o = {}) => { const a = `class="ax-btn ${o.cls || ""}" data-v="${o.v || "outline"}" ${o.size ? `data-size="${o.size}"` : ""} ${o.attrs || ""}`; const inner = `${o.ic ? I(o.ic, 18) : ""}${label ? `<span>${label}</span>` : ""}`; return o.href ? `<a ${a} href="${esc(o.href)}">${inner}</a>` : `<button type="${o.type || "button"}" ${a}>${inner}</button>`; };
export const empty = ({ icon: ic = "inbox", title, hint, action = "", tone = "" }) => `<div class="ax-empty"><span class="ax-tile" data-t="${tone}">${I(ic, 22)}</span><h3>${esc(title)}</h3>${hint ? `<p>${esc(hint)}</p>` : ""}${action}</div>`;
export const errorState = (what = "this page") => empty({ icon: "alert", tone: "bad", title: `We couldn’t load ${what}`, hint: "Check your connection and try again.", action: btn("Try again", { v: "outline", ic: "refresh", attrs: "data-ax=retry" }) });
const sk = (w, h = 12, r = 6) => `<i class="ax-skel" style="width:${w};height:${h}px;border-radius:${r}px"></i>`;
export const skeleton = {
  rows: (n = 6) => `<div class="ax-card ax-tablecard" aria-hidden="true">${Array.from({ length: n }, () => `<div class="ax-skrow">${sk("32px", 32, 8)}<span>${sk("42%", 12)}${sk("26%", 10)}</span>${sk("64px", 20, 99)}</div>`).join("")}</div>`,
  kpis: (n = 4) => `<div class="ax-kpis" aria-hidden="true">${Array.from({ length: n }, () => `<div class="ax-card ax-kpi">${sk("46%", 10)}${sk("34%", 26, 8)}${sk("62%", 10)}</div>`).join("")}</div>`,
  card: (h = 200) => `<div class="ax-card" style="padding:16px" aria-hidden="true">${sk("30%", 12)}<div style="height:12px"></div>${sk("100%", h, 10)}</div>`,
  page: () => `${skeleton.kpis(4)}<div class="ax-grid" style="margin-top:16px"><div class="ax-c8">${skeleton.card(180)}</div><div class="ax-c4">${skeleton.card(180)}</div></div>`,
};

// ---------- data cache: each collection is loaded once per minute ----------
const TTL = 60000, store = new Map();
const keyOf = (col, u) => (u ? col + "@" + u : col);
export const data = {
  get(col, { uid: u, fresh, maxAge } = {}) {
    const k = keyOf(col, u), e = store.get(k);
    if (e && !fresh && Date.now() - e.t < (maxAge ?? TTL)) return e.p;
    const p = getDocs(u ? query(collection(db, col), where("ownerUid", "==", u)) : collection(db, col)).then((s) => s.docs.map((d) => ({ ...d.data(), id: d.id })));
    const ent = { t: Date.now(), p, v: null }; store.set(k, ent);
    p.then((v) => { ent.v = v; }, () => { if (store.get(k) === ent) store.delete(k); });
    return p;
  },
  safe: (col, o) => data.get(col, o).catch(() => []),
  peek: (col, u) => store.get(keyOf(col, u))?.v || null,
  invalidate(col) { if (!col) return store.clear(); [...store.keys()].forEach((k) => (k === col || k.startsWith(col + "@")) && store.delete(k)); },
};
export const hooks = { changed: [] };
export const changed = () => hooks.changed.forEach((f) => { try { f(); } catch {} });

// ---------- hash query helpers (the router reads location.hash, so these only touch the query part) ----------
export const hq = () => { const [p, q] = (location.hash.slice(1) || "/").split("?"); return { path: p.replace(/\/+$/, "") || "/", q: Object.fromEntries(new URLSearchParams(q || "")) }; };
export const setQ = (obj, mode = "replace") => {
  const { path, q } = hq(), n = { ...q, ...obj }; Object.keys(n).forEach((k) => (n[k] === "" || n[k] == null) && delete n[k]);
  const qs = new URLSearchParams(n).toString(), url = location.pathname + location.search + "#" + path + (qs ? "?" + qs : "");
  if (url === location.pathname + location.search + location.hash) return;
  try { history[mode === "push" ? "pushState" : "replaceState"](history.state, "", url); } catch {}
};
// A page registers here; main.js asks softNav() on hashchange so drawer and filter changes do not re-render the whole page.
export const page = { path: null, onSoft: null };
export function softNav() { const { path, q } = hq(); if (page.path && path === page.path && page.onSoft) { page.onSoft(q); return true; } return false; }

// ---------- csv ----------
export function csv(name, head, rows) {
  const q = (v) => { let s = String(v == null ? "" : v); if (typeof v !== "number" && /^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
  const blob = new Blob(["﻿" + [head, ...rows].map((r) => r.map(q).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }), a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name.endsWith(".csv") ? name : name + ".csv"; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}
export const day = () => new Date().toISOString().slice(0, 10);

// ---------- toasts with undo ----------
let toastBox;
export function toast(msg, o = {}) {
  if (!toastBox || !toastBox.isConnected) { toastBox = document.createElement("div"); toastBox.className = "ax-fl ax-toasts"; document.body.append(toastBox); }
  const el = document.createElement("div"), bad = o.tone === "bad"; el.className = "ax-toast"; el.setAttribute("role", bad ? "alert" : "status"); if (o.tone) el.dataset.t = o.tone;
  el.innerHTML = `<span>${esc(msg)}</span>${o.action ? `<button type="button" class="ax-toast-a">${esc(o.action)}</button>` : ""}`;
  toastBox.append(el); while (toastBox.children.length > 3) toastBox.firstChild.remove();
  const kill = () => { el.classList.add("out"); setTimeout(() => el.remove(), 160); };
  let t = setTimeout(kill, o.ms || (o.action ? 6000 : bad ? 5000 : 3600));
  el.querySelector(".ax-toast-a")?.addEventListener("click", () => { clearTimeout(t); kill(); o.onAction?.(); });
  return { set(m) { el.firstChild.textContent = m; clearTimeout(t); t = setTimeout(kill, o.ms || 3000); }, hold(m) { el.firstChild.textContent = m; clearTimeout(t); }, close: kill };
}

// ---------- popover menu (a bottom sheet on phones) ----------
let openMenu = null;
export const closeMenus = () => openMenu?.close();
export function menu(anchor, items, o = {}) {
  if (openMenu?.anchor === anchor) { openMenu.close(); return openMenu = null; }
  closeMenus();
  const ph = phone(), el = document.createElement("div"), scrim = ph ? document.createElement("div") : null;
  el.className = "ax-fl ax-menu" + (ph ? " is-sheet" : ""); el.setAttribute("role", "menu"); if (o.label) el.setAttribute("aria-label", o.label);
  el.innerHTML = (o.title ? `<div class="ax-menu-h">${esc(o.title)}</div>` : "") + items.map((it, i) => it.sep ? "<hr>" : `<button type="button" role="${it.checked != null ? "menuitemradio" : "menuitem"}" ${it.checked != null ? `aria-checked="${!!it.checked}"` : ""} class="ax-mi" ${it.tone ? `data-t="${it.tone}"` : ""} data-i="${i}" ${it.disabled ? "disabled" : ""}>${it.icon ? I(it.icon, 18) : '<span class="ax-sp"></span>'}<span>${esc(it.label)}</span>${it.checked ? I("check", 16) : ""}</button>`).join("");
  if (scrim) { scrim.className = "ax-fl ax-scrim"; document.body.append(scrim); }
  document.body.append(el); anchor.setAttribute("aria-expanded", "true");
  if (!ph) {
    const r = anchor.getBoundingClientRect(), w = el.offsetWidth, h = el.offsetHeight;
    let left = o.align === "left" ? r.left : r.right - w; left = Math.max(8, Math.min(left, innerWidth - w - 8));
    let top = r.bottom + 6; if (top + h > innerHeight - 8) top = Math.max(8, r.top - h - 6);
    el.style.cssText = `left:${left}px;top:${top}px`;
  }
  const close = () => { document.removeEventListener("pointerdown", out, true); document.removeEventListener("keydown", key, true); removeEventListener("resize", close); removeEventListener("scroll", sc, true); el.remove(); scrim?.remove(); anchor.setAttribute("aria-expanded", "false"); if (openMenu?.el === el) openMenu = null; };
  const out = (e) => { if (!el.contains(e.target) && !anchor.contains(e.target)) close(); }, sc = (e) => { if (!el.contains(e.target)) close(); };
  const live = () => $$(".ax-mi:not([disabled])", el);
  const key = (e) => {
    if (e.key === "Escape") { e.stopPropagation(); close(); anchor.focus?.(); } else if (e.key === "Tab") close();
    else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) { e.preventDefault(); const l = live(), i = l.indexOf(document.activeElement); l[e.key === "Home" ? 0 : e.key === "End" ? l.length - 1 : (i + (e.key === "ArrowDown" ? 1 : -1) + l.length) % l.length]?.focus(); }
  };
  document.addEventListener("pointerdown", out, true); document.addEventListener("keydown", key, true); addEventListener("resize", close); addEventListener("scroll", sc, true);
  scrim?.addEventListener("click", close);
  el.addEventListener("click", (e) => { const b = e.target.closest(".ax-mi"); if (!b) return; const it = items[+b.dataset.i]; close(); if (it.href) location.hash = it.href.replace(/^#?/, "#"); else it.act?.(); });
  openMenu = { el, anchor, close }; setTimeout(() => (live().find((b) => b.getAttribute("aria-checked") === "true") || live()[0])?.focus(), 0);
  return openMenu;
}

// ---------- dialogs ----------
let locks = 0;
const lock = (on) => { locks += on ? 1 : -1; document.documentElement.classList.toggle("ax-lock", locks > 0); };
const FOCUS = 'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
export function dialog(o) {
  const ov = document.createElement("div"), id = nid("axd"), back = document.activeElement; ov.className = "ax-fl ax-ov" + (o.sheet ? " is-sheet" : "");
  ov.innerHTML = `<div class="ax-dlg" role="dialog" aria-modal="true" aria-labelledby="${id}" data-size="${o.size || "md"}" tabindex="-1"><header class="ax-dlg-h">${o.icon ? `<span class="ax-tile" data-t="${o.tone || ""}">${I(o.icon, 20)}</span>` : ""}<h2 id="${id}">${esc(o.title)}</h2><button type="button" class="ax-ib" data-x aria-label="Close">${I("x", 18)}</button></header><div class="ax-dlg-b">${o.body || ""}</div>${o.footer ? `<footer class="ax-dlg-f">${o.footer}</footer>` : ""}</div>`;
  document.body.append(ov); lock(true);
  const el = ov.firstElementChild; let done = false;
  const p0 = hq().path, onHash = () => { if (hq().path !== p0) close(); }; addEventListener("hashchange", onHash);
  const close = (v) => { if (done) return; done = true; lock(false); removeEventListener("hashchange", onHash); ov.removeEventListener("keydown", key); ov.classList.add("out"); setTimeout(() => ov.remove(), 140); try { back?.focus?.({ preventScroll: true }); } catch {} o.onClose?.(v); };
  const tryClose = () => { if (o.dirty?.()) return false; close(); return true; };
  const key = (e) => {
    if (e.key === "Escape" && !e.defaultPrevented) { e.stopPropagation(); tryClose(); }
    else if (e.key === "Tab") { const f = $$(FOCUS, el).filter((x) => x.offsetParent !== null); if (!f.length) return; const a = f[0], z = f[f.length - 1]; if (e.shiftKey && (document.activeElement === a || document.activeElement === el)) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); } }
    else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { const b = $("[data-ok],[type=submit]", el); if (b && !b.disabled) { e.preventDefault(); b.click(); } }
  };
  ov.addEventListener("keydown", key);
  ov.addEventListener("pointerdown", (e) => { if (e.target === ov) ov._dn = true; }); ov.addEventListener("click", (e) => { if (e.target === ov && ov._dn) tryClose(); ov._dn = false; });
  el.addEventListener("click", (e) => { if (e.target.closest("[data-x]")) tryClose(); });
  requestAnimationFrame(() => { ov.classList.add("in"); (o.focus ? $(o.focus, el) : $("[data-af]", el) || $("input:not([type=hidden]):not([type=checkbox]):not([type=radio]),textarea,select", el) || $("[data-ok]", el) || el)?.focus({ preventScroll: true }); });
  o.onMount?.(el, close);
  return { el, ov, close, body: $(".ax-dlg-b", el), footer: $(".ax-dlg-f", el) };
}
export const confirm = (o) => new Promise((res) => {
  let ok = false; const danger = o.tone === "danger";
  const d = dialog({ title: o.title, size: "sm", icon: o.icon || (danger ? "alert" : "info"), tone: danger ? "bad" : "", body: `<p class="ax-p">${o.body || ""}</p>`, footer: `${btn("Cancel", { attrs: "data-x data-af" })}${btn(esc(o.confirmLabel || "Confirm"), { v: danger ? "danger-solid" : "primary", attrs: "data-ok" })}`, onClose: () => res(ok) });
  $("[data-ok]", d.el).onclick = () => { ok = true; d.close(); };
});
export const reason = (o) => new Promise((res) => {
  let val = null; const id = nid("axr");
  const d = dialog({ title: o.title, size: "md", icon: o.icon || "msg", tone: o.tone, body: `${o.body ? `<p class="ax-p">${o.body}</p>` : ""}<label class="ax-lbl" for="${id}">${esc(o.label || "Reason")}</label><textarea id="${id}" class="ax-input" rows="4" maxlength="300" placeholder="${esc(o.placeholder || "Write a short note")}">${esc(o.value || "")}</textarea>
      <div class="ax-presets">${(o.presets || []).map((p, i) => `<button type="button" class="ax-pre" data-p="${i}">${esc(p)}</button>`).join("")}</div><p class="ax-help">${esc(o.helper || "This message is shown to the person.")}</p>`,
    footer: `${btn("Cancel", { attrs: "data-x" })}${btn(esc(o.confirmLabel || "Send"), { v: o.tone === "bad" ? "danger-solid" : "primary", attrs: "data-ok disabled" })}`, onClose: () => res(val) });
  const ta = $("textarea", d.el), ok = $("[data-ok]", d.el), sync = () => (ok.disabled = !ta.value.trim() && o.required !== false);
  ta.oninput = sync; sync(); $$("[data-p]", d.el).forEach((b) => (b.onclick = () => { ta.value = o.presets[+b.dataset.p]; sync(); ta.focus(); }));
  ok.onclick = () => { val = ta.value.trim(); d.close(); };
});
export const typed = (o) => new Promise((res) => {
  let ok = false; const id = nid("axt");
  const d = dialog({ title: o.title, size: "md", icon: "alert", tone: "bad", body: `<p class="ax-p">${o.body}</p><label class="ax-lbl" for="${id}">Type <b>${esc(o.expect)}</b> to confirm</label><input id="${id}" class="ax-input" autocomplete="off" spellcheck="false"><p class="ax-err" role="alert"></p>`, footer: `${btn("Cancel", { attrs: "data-x" })}${btn(esc(o.confirmLabel || "Confirm"), { v: "danger-solid", attrs: "data-ok" })}`, onClose: () => res(ok) });
  const inp = $("input", d.el);
  $("[data-ok]", d.el).onclick = () => { if (inp.value.trim().toLowerCase() !== String(o.expect).toLowerCase()) { $(".ax-err", d.el).textContent = "That doesn’t match. Check it and try again."; inp.focus(); return; } ok = true; d.close(); };
});

// ---------- right-hand drawer (a full-height sheet on phones) ----------
let dr = null, drCfg = null, drBack = null, drPushed = false;
function drEl() {
  if (dr?.isConnected) return dr;
  dr = document.createElement("aside"); dr.className = "ax-fl ax-drawer"; dr.setAttribute("role", "dialog"); dr.setAttribute("aria-modal", "false"); dr.setAttribute("aria-labelledby", "axDrT"); dr.hidden = true;
  dr.innerHTML = `<header class="ax-dr-h"><button type="button" class="ax-ib ax-dr-back" data-dr="close" aria-label="Back">${I("left", 20)}</button><div class="ax-dr-t"><h2 id="axDrT" tabindex="-1"></h2><div class="ax-dr-s"></div></div><div class="ax-dr-nav"><button type="button" class="ax-ib" data-dr="prev" aria-label="Previous">${I("chevU", 18)}</button><button type="button" class="ax-ib" data-dr="next" aria-label="Next">${I("chevD", 18)}</button></div><button type="button" class="ax-ib ax-dr-x" data-dr="close" aria-label="Close">${I("x", 18)}</button></header><div class="ax-dr-b"></div><footer class="ax-dr-f" hidden></footer>`;
  document.body.append(dr);
  const sc = document.createElement("div"); sc.className = "ax-fl ax-dr-scrim"; sc.hidden = true; document.body.append(sc); dr._sc = sc; sc.onclick = () => drawer.close();
  dr.addEventListener("click", (e) => { const b = e.target.closest("[data-dr]"); if (!b) return; const a = b.dataset.dr; if (a === "close") drawer.close(); else if (a === "prev") drCfg?.prev?.(); else if (a === "next") drCfg?.next?.(); });
  dr.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.stopPropagation(); drawer.close(); } else if (e.key === "Tab" && !dockMode()) { const f = $$(FOCUS, dr).filter((x) => x.offsetParent !== null); if (!f.length) return; const a = f[0], z = f[f.length - 1]; if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); } } });
  return dr;
}
const dockMode = () => innerWidth >= 1440;
export const drawer = {
  get isOpen() { return !!dr && !dr.hidden; },
  open(cfg) {
    const el = drEl(), was = !el.hidden; drCfg = cfg;
    if (!was) { drBack = document.activeElement; el.hidden = false; el._sc.hidden = dockMode(); document.documentElement.classList.add("ax-dr-open"); $(".ax")?.setAttribute("data-drawer", "1"); if (!dockMode() && phone()) lock(true), (drawer._lk = true); requestAnimationFrame(() => el.classList.add("in")); }
    drawer.set(cfg);
    if (!was) setTimeout(() => $("#axDrT")?.focus({ preventScroll: true }), 30);
    return el;
  },
  set(cfg) {
    const el = drEl(); drCfg = { ...drCfg, ...cfg }; if (cfg.w) el.dataset.w = cfg.w; else delete el.dataset.w;
    $("#axDrT", el).textContent = cfg.title || ""; $(".ax-dr-s", el).innerHTML = cfg.sub || "";
    const b = $(".ax-dr-b", el), top = b.scrollTop; b.innerHTML = cfg.body || ""; if (cfg.keepScroll) b.scrollTop = top; else b.scrollTop = 0;
    const f = $(".ax-dr-f", el); f.hidden = !cfg.footer; f.innerHTML = cfg.footer || "";
    $$("[data-dr=prev]", el).forEach((x) => (x.disabled = !cfg.prev)); $$("[data-dr=next]", el).forEach((x) => (x.disabled = !cfg.next)); $(".ax-dr-nav", el).hidden = !cfg.prev && !cfg.next;
    cfg.mount?.(el, b, f);
  },
  close({ silent } = {}) {
    if (!dr || dr.hidden) return; const cfg = drCfg; dr.classList.remove("in"); dr.hidden = true; dr._sc.hidden = true; document.documentElement.classList.remove("ax-dr-open"); $(".ax")?.removeAttribute("data-drawer");
    if (drawer._lk) { lock(false); drawer._lk = false; }
    drCfg = null; if (!silent) { cfg?.onClose?.(); try { drBack?.focus?.({ preventScroll: true }); } catch {} }
  },
};

// ---------- tabs with counts ----------
export const tabs = (items, active, o = {}) => `<div class="ax-tabs" role="tablist" ${o.label ? `aria-label="${esc(o.label)}"` : ""}>${items.map((t) => `<button type="button" role="tab" id="${nid("axtab")}" class="ax-tab" data-k="${esc(t.k)}" aria-selected="${t.k === active}" tabindex="${t.k === active ? 0 : -1}" ${t.tone ? `data-t="${t.tone}"` : ""}>${esc(t.label)}${t.count != null ? `<b>${t.count > 99 ? "99+" : t.count}</b>` : ""}</button>`).join("")}</div>`;
export function mountTabs(root, onPick) {
  const bar = $(".ax-tabs", root); if (!bar || bar._m) return; bar._m = 1;
  const pick = (b) => { $$(".ax-tab", bar).forEach((x) => { x.setAttribute("aria-selected", x === b); x.tabIndex = x === b ? 0 : -1; }); b.scrollIntoView?.({ block: "nearest", inline: "center" }); onPick(b.dataset.k); };
  bar.addEventListener("click", (e) => { const b = e.target.closest(".ax-tab"); if (b) pick(b); });
  bar.addEventListener("keydown", (e) => { const l = $$(".ax-tab", bar), i = l.indexOf(document.activeElement); if (i < 0) return; const n = e.key === "ArrowRight" ? l[(i + 1) % l.length] : e.key === "ArrowLeft" ? l[(i - 1 + l.length) % l.length] : e.key === "Home" ? l[0] : e.key === "End" ? l[l.length - 1] : null; if (n) { e.preventDefault(); n.focus(); pick(n); } });
}

// ---------- KPI cards, attention tiles, progress ----------
export const delta = (d, vs = "") => (d ? `<span class="ax-delta" data-d="${d.dir}">${d.dir === "up" ? I("up", 12, 2.4) : d.dir === "down" ? I("down", 12, 2.4) : ""}${esc(d.text)}</span>${vs ? `<span class="ax-vs">${esc(vs)}</span>` : ""}` : "");
export function kpi({ label, value, d, vs, sub, href, sp, icon: ic = "chart", count, title, tag, tone }) {
  const T = href ? "a" : "div", inner = `<div class="ax-kpi-h"><span class="ax-tile sm" ${tone ? `data-t="${tone}"` : ""}>${I(ic, 18)}</span><span class="ax-eyebrow">${esc(label)}</span></div><div class="ax-kpi-v num" ${title ? `title="${esc(title)}" aria-label="${esc(label)}: ${esc(title)}"` : ""} ${count != null ? `data-count="${count}"` : ""}>${value}</div><div class="ax-kpi-m">${delta(d, vs)}${sub ? `<span class="ax-sub">${esc(sub)}</span>` : ""}</div>${sp || ""}`;
  return `<${T} class="ax-card ax-kpi ${href ? "is-link" : ""}" ${href ? `href="#${esc(href)}"` : ""} ${tag ? `data-t="${tag}"` : ""}>${inner}</${T}>`;
}
export const mini = ({ label, value, sub, icon: ic = "chart", href }) => { const T = href ? "a" : "div"; return `<${T} class="ax-card ax-mini ${href ? "is-link" : ""}" ${href ? `href="#${esc(href)}"` : ""}><span class="ax-tile" >${I(ic, 20)}</span><div><b class="num">${value}</b><span>${esc(label)}</span>${sub ? `<em>${esc(sub)}</em>` : ""}</div></${T}>`; };
export const attn = ({ label, count, href, alert, icon: ic = "doc" }) => { const z = !count; return `<a class="ax-attn ${z ? "is-zero" : ""}" ${alert && count ? 'data-t="alert" role="status"' : ""} href="#${esc(href)}"><span class="ax-tile sm">${alert && count ? '<i class="ax-pulse"></i>' : ""}${I(z ? "check" : ic, 18)}</span><b class="num" ${count > 0 && count < 1e5 ? `data-count="${count}"` : ""}>${count || 0}</b><span class="ax-attn-l">${esc(label)}<em>${z ? "All clear" : ""}</em></span>${I("chevR", 16)}</a>`; };
export const progress = (v, max = 100, tone = "") => { const p = max ? Math.max(0, Math.min(100, (v / max) * 100)) : 0; return `<span class="ax-prog" ${tone ? `data-t="${tone}"` : ""} role="progressbar" aria-valuenow="${Math.round(p)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${p}%"></i></span>`; };
export function animateCounts(root = document) {
  if (reduce()) return;
  $$("[data-count]", root).forEach((el) => { if (el._c) return; el._c = 1; const n = +el.dataset.count; if (!n || n > 1e5) return; const t0 = performance.now(), txt = el.textContent, fix = /^[^\d]*$/.test(txt) ? null : txt; if (fix === null) return;
    const suffix = txt.replace(/[\d,]+/, "\u0000"); const step = (t) => { const k = Math.max(0, Math.min(1, (t - t0) / 600)), e = 1 - Math.pow(1 - k, 3); el.textContent = suffix.replace("\u0000", Math.round(n * e).toLocaleString("en-NG")); if (k < 1) requestAnimationFrame(step); else el.textContent = txt; }; requestAnimationFrame(step); });
}

// ---------- charts: inline SVG, no library ----------
const CHARTS = new Map(); let tip;
const nice = (m) => { m = Math.max(4, m); const p = Math.pow(10, Math.floor(Math.log10(m))), n = m / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p; };
const cvar = (i) => `var(--ax-c${i + 1})`;
const noData = (a) => !a.some((s) => s.data.some((v) => v > 0));
const legendHtml = (series) => (series.length > 1 ? `<div class="ax-legend">${series.map((s, i) => `<span><i style="background:${cvar(i)}"></i>${esc(s.name)}</span>`).join("")}</div>` : "");
const tableAlt = (series, labels) => `<details class="ax-vat"><summary>View as table</summary><div class="ax-scroll"><table class="ax-table"><thead><tr><th>Period</th>${series.map((s) => `<th class="al-right">${esc(s.name)}</th>`).join("")}</tr></thead><tbody>${labels.map((l, i) => `<tr><td>${esc(l)}</td>${series.map((s) => `<td class="al-right num">${s.data[i] ?? 0}</td>`).join("")}</tr>`).join("")}</tbody></table></div></details>`;
function chartShell(kind, cfg, aria) { const id = nid("axc"); CHARTS.set(id, { kind, ...cfg }); return `<figure class="ax-chart" data-cid="${id}" data-kind="${kind}"><div class="ax-cv" role="img" aria-label="${esc(aria)}"></div>${kind === "bar" ? legendHtml(cfg.series) : ""}${tableAlt(cfg.series, cfg.labels)}</figure>`; }
export const areaChart = (series, labels, o = {}) => chartShell("area", { series, labels, h: o.h || 200, fmtv: o.fmtv }, o.aria || `${series.map((s) => s.name).join(", ")} over time`);
export const barChart = (series, labels, o = {}) => chartShell("bar", { series, labels, h: o.h || 200, fmtv: o.fmtv }, o.aria || `${series.map((s) => s.name).join(" and ")} by period`);
function drawChart(fig) {
  const c = CHARTS.get(fig.dataset.cid), host = $(".ax-cv", fig); if (!c || !host) return;
  const W = Math.max(220, Math.floor(host.clientWidth || fig.clientWidth || 300)), narrow = W < 420, H = narrow ? Math.min(c.h, 170) : c.h, L = 34, R = 8, T = 10, B = 24, pw = W - L - R, ph = H - T - B, n = c.labels.length;
  const gid = nid("axg"), mx = nice(Math.max(...c.series.flatMap((s) => s.data), 0)), y = (v) => T + ph - (v / mx) * ph, fv = c.fmtv || ((v) => v.toLocaleString("en-NG"));
  const every = Math.max(1, Math.ceil(n / (narrow ? 4 : 7)));
  let g = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true">`;
  if (c.kind === "area") g += `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--ax-accent)" stop-opacity=".22"/><stop offset="1" stop-color="var(--ax-accent)" stop-opacity="0"/></linearGradient></defs>`;
  for (let k = 0; k <= 3; k++) { const v = (mx / 3) * k, yy = y(v); g += `<line class="gl" x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}"/><text class="yt" x="${L - 6}" y="${yy + 3.5}" text-anchor="end">${fv(Math.round(v * 10) / 10)}</text>`; }
  const step = n > 1 ? pw / (n - 1) : 0, xs = (i) => (c.kind === "area" ? L + (n > 1 ? i * step : pw / 2) : L + (pw / n) * (i + 0.5));
  c.labels.forEach((l, i) => { if (i % every === 0 || i === n - 1 && n - 1 - (n - 1) % every < every - 1 && false) g += `<text class="xt" x="${xs(i)}" y="${H - 6}" text-anchor="${c.kind === "area" && i === 0 ? "start" : c.kind === "area" && i === n - 1 ? "end" : "middle"}">${esc(l)}</text>`; });
  if (noData(c.series)) g += `<text class="nd" x="${L + pw / 2}" y="${T + ph / 2}" text-anchor="middle">No activity in this period</text>`;
  else if (c.kind === "area") {
    const s = c.series[0], pts = s.data.map((v, i) => [xs(i), y(v)]), d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
    g += `<path d="${d} L${pts[n - 1][0]} ${T + ph} L${pts[0][0]} ${T + ph}Z" fill="url(#${gid})"/><path class="ln" d="${d}"/>`;
    const last = pts[n - 1]; g += `<circle class="dot" cx="${last[0]}" cy="${last[1]}" r="4"/>`;
  } else {
    const k = c.series.length, gw = pw / n, bw = Math.min(24, (gw * 0.7 - (k - 1) * 2) / k), tot = bw * k + (k - 1) * 2;
    c.series.forEach((s, si) => s.data.forEach((v, i) => { if (!v) return; const bx = L + gw * i + (gw - tot) / 2 + si * (bw + 2), by = y(v), bh = T + ph - by; g += `<path class="bar" fill="${cvar(si)}" d="M${bx} ${T + ph}V${by + Math.min(4, bh)}Q${bx} ${by} ${bx + Math.min(4, bw / 2)} ${by}H${bx + bw - Math.min(4, bw / 2)}Q${bx + bw} ${by} ${bx + bw} ${by + Math.min(4, bh)}V${T + ph}Z"/>`; }));
  }
  const hw = c.kind === "area" ? Math.max(24, step) : pw / n;
  for (let i = 0; i < n; i++) g += `<rect class="hit" data-i="${i}" x="${xs(i) - hw / 2}" y="${T}" width="${hw}" height="${ph}"/>`;
  host.innerHTML = g + "</svg>"; host._w = W;
}
function showTip(fig, i, x, y) {
  const c = CHARTS.get(fig.dataset.cid); if (!c) return;
  if (!tip) { tip = document.createElement("div"); tip.className = "ax-fl ax-tip"; tip.setAttribute("role", "tooltip"); document.body.append(tip); }
  tip.innerHTML = `<b>${esc(c.labels[i])}</b>${c.series.map((s, k) => `<div><i style="background:${cvar(k)}"></i>${esc(s.name)}<em class="num">${(c.fmtv || ((v) => v.toLocaleString("en-NG")))(s.data[i] ?? 0)}</em></div>`).join("")}`; tip.hidden = false;
  const w = tip.offsetWidth; tip.style.left = Math.max(8, Math.min(x - w / 2, innerWidth - w - 8)) + "px"; tip.style.top = Math.max(8, y - tip.offsetHeight - 10) + "px";
}
const hideTip = () => tip && (tip.hidden = true);
let ro;
export function mountCharts(root = document) {
  $$(".ax-chart", root).forEach((fig) => { if (fig._m) return; fig._m = 1; drawChart(fig);
    if (!ro) ro = new ResizeObserver((es) => es.forEach((e) => { const f = e.target.closest(".ax-chart"); if (!f?.isConnected) { ro.unobserve(e.target); return; } if (Math.abs((e.target._w || 0) - e.contentRect.width) > 4) { clearTimeout(f._rt); f._rt = setTimeout(() => drawChart(f), 80); } }));
    ro.observe($(".ax-cv", fig));
    const move = (e) => { const h = e.target.closest?.(".hit"); if (!h) return hideTip(); const r = h.getBoundingClientRect(); showTip(fig, +h.dataset.i, r.left + r.width / 2, r.top); };
    fig.addEventListener("pointermove", move); fig.addEventListener("pointerdown", move); fig.addEventListener("pointerleave", hideTip);
  });
}
export function spark(values, { tone = "" } = {}) {
  const n = values.length, mx = Math.max(...values, 0);
  if (n < 2 || !mx) return `<div class="ax-spark is-flat" aria-hidden="true"><svg viewBox="0 0 100 36" preserveAspectRatio="none"><line x1="0" x2="100" y1="30" y2="30" /></svg></div>`;
  const pts = values.map((v, i) => [(i / (n - 1)) * 100, 32 - (v / mx) * 28]), d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" "), last = pts[n - 1];
  return `<div class="ax-spark" aria-hidden="true" ${tone ? `data-t="${tone}"` : ""}><svg viewBox="0 0 100 36" preserveAspectRatio="none"><path class="a" d="${d} L100 36 L0 36Z"/><path class="l" d="${d}"/></svg><i style="left:${last[0]}%;top:${(last[1] / 36) * 100}%"></i></div>`;
}
export function donut(items, centre = {}) {
  const tot = items.reduce((a, x) => a + x[1], 0), R = 70, C = 2 * Math.PI * R; let acc = 0;
  const list = items.slice(0, 5), rest = items.slice(5).reduce((a, x) => a + x[1], 0), all = rest ? [...list, ["Other", rest]] : list;
  const segs = tot ? all.map(([l, v], i) => { const len = (v / tot) * C, gap = all.length > 1 ? 2 : 0, o = `<circle class="seg" tabindex="0" r="${R}" cx="80" cy="80" fill="none" stroke="${i === 5 ? "var(--ax-c6)" : cvar(i)}" stroke-width="20" stroke-dasharray="${Math.max(0, len - gap)} ${C - Math.max(0, len - gap)}" stroke-dashoffset="${-acc}" transform="rotate(-90 80 80)" aria-label="${esc(l)}: ${v} (${Math.round((v / tot) * 100)}%)"/>`; acc += len; return o; }).join("") : `<circle r="${R}" cx="80" cy="80" fill="none" stroke="var(--ax-border-strong)" stroke-width="20"/>`;
  return `<div class="ax-donut"><svg viewBox="0 0 160 160" width="160" height="160" role="img" aria-label="${esc(centre.label || "Breakdown")}: ${all.map(([l, v]) => l + " " + v).join(", ") || "no data"}">${segs}</svg><div class="ax-dc"><b class="num">${tot ? esc(String(centre.value ?? tot)) : "—"}</b><span>${tot ? esc(centre.label || "") : "No data yet"}</span></div>
    <ul class="ax-dl-leg">${all.map(([l, v], i) => `<li><i style="background:${i === 5 ? "var(--ax-c6)" : cvar(i)}"></i><span>${esc(l)}</span><b class="num">${v}</b><em class="num">${tot ? Math.round((v / tot) * 100) : 0}%</em></li>`).join("") || `<li class="ax-muted">Nothing to show yet.</li>`}</ul></div>`;
}
export function rank(rows) {
  const mx = Math.max(1, ...rows.map((r) => r.value));
  return `<ul class="ax-rank">${rows.map((r, i) => { const T = r.href ? "a" : "div"; return `<li><${T} ${r.href ? `href="#${esc(r.href)}"` : ""}><span class="ax-rk-l">${esc(r.label)}</span><b class="num">${esc(String(r.text ?? r.value))}</b><i style="--w:${(r.value / mx) * 100}%" ${i ? 'data-n="1"' : ""}></i></${T}></li>`; }).join("") || `<li class="ax-muted">No data yet.</li>`}</ul>`;
}

// ---------- bulk work ----------
export async function bulkRun(ids, fn, { label = "Working", cap = 50 } = {}) {
  const list = ids.slice(0, cap), t = toast(`${label} 0 of ${list.length}`, { ms: 60000 }); let ok = [], bad = 0;
  for (let i = 0; i < list.length; i += 10) { const chunk = list.slice(i, i + 10), r = await Promise.allSettled(chunk.map((id) => fn(id))); r.forEach((x, k) => (x.status === "fulfilled" ? ok.push(chunk[k]) : bad++)); t.hold(`${label} ${Math.min(list.length, i + 10)} of ${list.length}`); }
  t.close(); return { ok, bad, total: list.length };
}

// ---------- page frame ----------
export const pageHead = ({ eyebrow, title, sub, actions = "" }) => `<header class="ax-ph"><div class="ax-ph-t">${eyebrow ? `<span class="ax-eyebrow">${esc(eyebrow)}</span>` : ""}<h1>${esc(title)}</h1>${sub ? `<p class="ax-sub">${esc(sub)}</p>` : ""}</div><div class="ax-ph-a">${actions}<button type="button" class="ax-ib ax-refresh" data-ax="refresh" aria-label="Refresh">${I("refresh", 18)}</button></div></header>`;
export const staffFlags = (ctx) => (ctx.S.isAdmin ? { admin: true, pending: 0 } : { role: ctx.S.role });
export function pageView(ctx, o) {
  const cols = o.cols || [], body = o.skeleton || (o.kpis ? skeleton.page() : skeleton.rows(7));
  return { title: o.title, ...staffFlags(ctx), html: `${o.head === false ? "" : pageHead({ eyebrow: o.eyebrow, title: o.title, sub: o.sub, actions: o.actions || "" })}<div id="axBody" class="ax-body">${body}</div>`,
    mount(root) {
      const bodyEl = $("#axBody", root); let alive = true, gen = 0;
      ctx.S.cleanups.push(() => { alive = false; page.path = null; page.onSoft = null; drawer.close({ silent: true }); closeMenus(); });
      page.path = hq().path; page.onSoft = null;
      const load = async (fresh) => {
        const g = ++gen; bodyEl.innerHTML = body;
        try {
          const loaded = {}; await Promise.all(cols.map(async (c) => { const [k, src] = typeof c === "string" ? [c, c] : c; loaded[k] = typeof src === "function" ? await src() : await data.get(src, { fresh }); }));
          if (!alive || g !== gen) return;
          const v = await o.render(loaded, { ctx, root, body: bodyEl, reload: () => load(true), repaint: () => load(false) });
          if (!alive || g !== gen) return;
          bodyEl.innerHTML = v.html || ""; v.mount?.(bodyEl); mountCharts(bodyEl); animateCounts(bodyEl);
        } catch (e) { if (!alive) return; console.warn("[console]", e?.code || e?.message || e); bodyEl.innerHTML = errorState(o.what || "this page"); }
      };
      root._axReload = () => { data.invalidate(); load(true); };
      load(false);
    } };
}
export const copy = async (text, msg = "Copied.") => { try { await navigator.clipboard.writeText(text); toast(msg); } catch { toast("Couldn’t copy. Select the text and copy it by hand.", { tone: "bad" }); } };
export const dl = (rows) => `<dl class="ax-dl">${rows.filter(Boolean).map(([k, v]) => (v == null || v === "" || v === false ? "" : `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`)).join("")}</dl>`;
export const section = (title, html, extra = "") => `<section class="ax-sec"><h3 class="ax-eyebrow">${esc(title)}${extra}</h3>${html}</section>`;
export const timeline = (items) => `<ol class="ax-tl">${items.map((i) => `<li ${i.tone ? `data-t="${i.tone}"` : ""}><i></i><div><b>${esc(i.title)}</b>${i.text ? `<p>${i.html ? i.text : esc(i.text)}</p>` : ""}<small>${esc(i.meta || "")}</small></div></li>`).join("")}</ol>`;
export const safeUrl = (u) => (/^https:\/\//.test(String(u || "")) ? u : "");
