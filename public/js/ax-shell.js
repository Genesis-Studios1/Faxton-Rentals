// ax-shell.js: the console chrome (grouped sidebar with a collapsible rail, top bar with breadcrumbs, four-icon phone bar and More sheet),
// the Ctrl/Cmd+K command palette, live count badges and the keyboard shortcuts. Loaded only for signed-in staff.
import { $, $$, esc, I, dialog, menu, data, hooks, hq, avatar } from "./ax.js";
import * as st from "./store.js";
import { icon, logoMark } from "./ui.js";

export let host = null;
export const setHost = (h) => { host = h; };
export const counts = {};

// [route, icon, label, badge key]
const ADMIN = [
  { l: "", items: [["/admin", "home", "Overview"], ["/admin/queue", "doccheck", "Review queue", "queue"]] },
  { l: "Marketplace", items: [["/admin/listings", "clipList", "Listings", "listings"], ["/admin/users", "users", "Users"], ["/admin/verifications", "shield", "Verifications", "verif"]] },
  { l: "Activity", items: [["/admin/applications", "doc", "Applications", "apps"], ["/admin/viewings", "calDots", "Viewings", "sos"], ["/offers", "tag", "Offers", "offers"], ["/tenants", "building", "Tenants", "maint"], ["/admin/payments", "card", "Payments", "proofs"]] },
  { l: "Support", items: [["/admin/support", "chatdots", "Support", "tickets"], ["/messages", "msg", "Messages", "unread"], ["/admin/suggestions", "chatlines", "Suggestions", "sugg"], ["/admin/user-reports", "flag", "User reports", "reports"]] },
  { l: "Insights", items: [["/admin/reports", "bars3", "Reports"]] },
  { l: "System", items: [["/admin/calls", "phone", "Call setup", "relay"], ["/admin/get-app", "download", "Installations"], ["/settings", "gear", "Settings"]] },
];
const OWNER = (home) => [{ l: "Portfolio", items: [[home, "home", "Dashboard"]] }, { l: "Rentals", items: [["/offers", "tag", "Offers", "offers"], ["/tenants", "building", "Tenants", "maint"]] }, { l: "Communication", items: [["/messages", "msg", "Messages", "unread"]] }, { l: "Account", items: [["/settings", "gear", "Settings"]] }];
export const ROLES = {
  admin: { title: "Admin console", crumb: "Console", home: "/admin", groups: ADMIN, tabs: [["/admin", "home", "Overview"], ["/admin/queue", "doccheck", "Review", "queue"], ["/admin/support", "chatdots", "Inbox", "tickets"]] },
  landlord: { title: "Owner portal", crumb: "Owner portal", home: "/portfolio", groups: OWNER("/portfolio"), tabs: [["/portfolio", "home", "Dashboard"], ["/offers", "tag", "Offers", "offers"], ["/tenants", "building", "Tenants", "maint"]] },
  agency: { title: "Agency portal", crumb: "Agency portal", home: "/agency", groups: OWNER("/agency"), tabs: [["/agency", "home", "Dashboard"], ["/offers", "tag", "Offers", "offers"], ["/tenants", "building", "Tenants", "maint"]] },
  agent: { title: "Agent portal", crumb: "Agent portal", home: "/agent-dashboard",
    groups: [{ l: "Work", items: [["/agent-dashboard", "home", "Overview"], ["/agent-dashboard/leads", "users", "Leads"], ["/agent-dashboard/listings", "clipList", "Listings"], ["/agent-dashboard/viewings", "calDots", "Viewings", "views"], ["/agent-dashboard/clients", "user", "Clients"]] }, { l: "Deals", items: [["/offers", "tag", "Offers", "offers"], ["/tenants", "building", "Tenants", "maint"]] }, { l: "Communication", items: [["/messages", "msg", "Messages", "unread"]] }, { l: "Account", items: [["/settings", "gear", "Settings"]] }],
    tabs: [["/agent-dashboard", "home", "Overview"], ["/agent-dashboard/leads", "users", "Leads"], ["/agent-dashboard/viewings", "calDots", "Viewings", "views"]] },
  support: { title: "Support console", crumb: "Support console", home: "/support",
    groups: [{ l: "Work", items: [["/support", "home", "Dashboard"], ["/support/tickets", "chatdots", "Tickets", "tickets"], ["/support/suggestions", "chatlines", "Suggestions", "sugg"], ["/messages", "msg", "Messages", "unread"]] }, { l: "Help", items: [["/help", "help", "Help centre"], ["/settings", "gear", "Settings"]] }],
    tabs: [["/support", "home", "Dashboard"], ["/support/tickets", "chatdots", "Tickets", "tickets"], ["/support/suggestions", "chatlines", "Suggestions", "sugg"]] },
};
const cfgFor = (role) => ROLES[role] || ROLES.admin;
const isOn = (path, h, home) => (h === home || h === "/admin" ? path === h : path === h || path.startsWith(h + "/"));
const BADGE_TONE = { sos: "alert", sugg: "grey", relay: "grey", unread: "mint", proofs: "amber" };

const badge = (key) => { const n = badgeVal(key); return `<b class="ax-badge" data-axb="${key}" data-t="${key === "queue" && counts.sos ? "alert" : BADGE_TONE[key] || "amber"}" ${key === "verif" ? "data-vbadge" : ""} ${key === "unread" ? "data-unread" : ""} ${n ? "" : "hidden"}>${n > 99 ? "99+" : n || ""}</b>`; };
const badgeVal = (key) => (key === "verif" ? (host?.S.pendingV || 0) + (counts.dels || 0) : key === "unread" ? host?.S.unread || 0 : key === "relay" ? 0 : counts[key] || 0);

const flat = (c) => c.groups.flatMap((g) => g.items.map((i) => ({ i, g: g.l })));
const findItem = (c, path) => flat(c).filter((x) => isOn(path, x.i[0], c.home)).sort((a, b) => b.i[0].length - a.i[0].length)[0];

export function renderShell(path, inner, view = {}, role = "") {
  const key = role || "admin", c = cfgFor(key), S = host.S, hit = findItem(c, path), rail = railFor();
  const nav = c.groups.map((g) => `${g.l ? `<div class="ax-gl">${esc(g.l)}</div>` : ""}${g.items.map((it) => `<a class="ax-nav" href="#${it[0]}" ${isOn(path, it[0], c.home) && hit?.i === it ? 'aria-current="page"' : ""} data-tip="${esc(it[2])}">${I(it[1], 18)}<span class="ax-nl">${esc(it[2])}</span>${it[3] ? badge(it[3]) : ""}</a>`).join("")}`).join("");
  const me = host.userName(), roleLabel = S.isOwner ? "Owner" : S.role === "admin" ? "Admin" : ({ landlord: "Property owner", agency: "Agency", agent: "Agent", support: "Support" }[S.role] || S.role);
  const crumbs = [`<a href="#${c.home}">${esc(c.crumb)}</a>`, hit?.g ? `<span>${esc(hit.g)}</span>` : "", `<b aria-current="page">${esc(hit?.i[2] || (path === "/admin/queue" ? "Review queue" : "Page"))}</b>`].filter(Boolean).join(`<i aria-hidden="true">${I("chevR", 12, 2)}</i>`);
  const tabs = c.tabs.map((it) => { const on = isOn(path, it[0], c.home); return `<a class="ax-bt" href="#${it[0]}" ${on ? 'aria-current="page"' : ""}><span class="ax-bi">${I(it[1], 22)}${it[3] ? badge(it[3]) : ""}</span><span>${esc(it[2])}</span></a>`; }).join("");
  const moreOn = !c.tabs.some((it) => isOn(path, it[0], c.home));
  const create = quickItems(key).length;
  const dark = host.theme() === "dark";
  return `<div class="ax" data-rail="${rail}" data-role="${key}" ${/^\/messages\//.test(path) ? "data-chat" : ""}>
  <button type="button" class="ax-skip" data-ax="skip">Skip to content</button>
  <aside class="ax-side" id="ax-side" aria-label="Console navigation"><a class="ax-brand" href="#${c.home}" aria-label="${esc(c.title)}">${logoMark()}<span class="ax-bw"><b>Faxton</b> Rentals</span></a>
    <nav class="ax-snav" aria-label="${esc(c.title)}">${nav}</nav>
    <div class="ax-sfoot"><a class="ax-nav" href="#/" data-tip="Go back to Faxton">${I("left", 18)}<span class="ax-nl">Go back to Faxton</span></a>
      <button type="button" class="ax-acct me-btn" data-ax="account" aria-haspopup="menu" aria-label="Account menu">${avatar(me, S.user?.uid, 32, S.profile?.photo)}<span class="ax-an"><b>${esc(me)}</b><small>${esc(roleLabel)}</small></span>${I("more", 18)}</button></div></aside>
  <div class="ax-side-scrim" data-ax="rail-close"></div>
  <div class="ax-frame"><header class="ax-top"><button type="button" class="ax-ib ax-toggle" data-ax="rail" aria-label="Toggle sidebar" aria-expanded="${rail === "0"}" aria-controls="ax-side">${I("panel", 20)}</button>
      <a class="ax-mlogo" href="#${c.home}" aria-label="${esc(c.title)}">${logoMark()}</a><nav class="ax-crumbs" aria-label="Breadcrumb">${crumbs}<span class="ax-rec" data-crumb-rec></span></nav><div class="ax-ptitle">${esc(hit?.i[2] || c.title)}</div><span class="ax-grow"></span>
      <button type="button" class="ax-searchbtn" data-ax="palette" aria-label="Search" aria-keyshortcuts="Control+K Meta+K">${I("search", 18)}<span class="ax-sl">Search listings, users, applications…</span><kbd>${navigator.platform.includes("Mac") ? "⌘K" : "Ctrl K"}</kbd></button>
      ${create ? `<button type="button" class="ax-btn ax-create" data-v="soft" data-ax="create" aria-haspopup="menu" aria-label="Quick create">${I("plus", 18)}<span>New</span></button>` : ""}
      <button type="button" class="ax-ib toggle-theme" data-theme-btn aria-label="Toggle dark mode">${icon(dark ? "sun" : "moon", 20)}</button>
      <button type="button" class="ax-ib bell ${host.noteDot()}" data-bell aria-label="Notifications" aria-haspopup="true">${icon("bell", 20)}</button></header>
    <main class="ax-main ${view.bleed ? "bleed" : ""}" id="main" tabindex="-1">${host.verifyBanner()}${inner}</main></div>
  <nav class="ax-bottom" aria-label="Primary">${tabs}<button type="button" class="ax-bt" data-ax="more" aria-haspopup="dialog" ${moreOn ? 'aria-current="true"' : ""}><span class="ax-bi">${I("grid", 22)}<b class="ax-badge dot" data-axb="more" data-t="${counts.sos ? "alert" : "amber"}" ${counts.sos || host.S.pendingV || counts.reports ? "" : "hidden"}></b></span><span>More</span></button></nav></div>`;
}
const railFor = () => { if (innerWidth < 1280) return "1"; try { const v = localStorage.getItem("axRail"); if (v === "0" || v === "1") return v; } catch {} return "0"; };

function quickItems(role) {
  const S = host.S;
  if (role === "admin") return [{ label: "Add listing", icon: "clipList", href: "/admin/listings?new=1" }, { label: "Invite user", icon: "users", href: "/admin/users?invite=1" }, { label: "New release", icon: "download", href: "/admin/get-app?new=1" }, { label: "Open support inbox", icon: "chatdots", href: "/admin/support" }];
  if (role === "landlord") return [{ label: "Add property", icon: "plus", href: "/portfolio?new=1" }];
  if (role === "agency") return [{ label: "Add property", icon: "plus", href: "/agency?new=1" }];
  if (role === "agent") return [{ label: "Add property", icon: "plus", href: "/agent-dashboard?new=1" }];
  return [];
}
const roleKey = () => (host.S.isAdmin ? "admin" : host.S.role);

// ---------- live counts ----------
const BADGE_COLS = ["listings", "applications", "viewings", "tickets", "offers", "maintenance", "reports", "suggestions"];
const OPEN_OFFER = (o) => !["Accepted", "Declined", "Withdrawn"].includes(o.status);
export function recompute() {
  const S = host?.S; if (!S?.user) return; const g = (c, u) => data.peek(c, u) || [], k = roleKey();
  if (k === "admin") {
    const ls = g("listings"), ap = g("applications"), vw = g("viewings"), tk = g("tickets"), of = g("offers"), mt = g("maintenance"), rp = g("reports"), sg = g("suggestions"), us = g("users");
    counts.listings = ls.filter((l) => /pending|flag/i.test(l.status || "") && !l.archived).length; counts.dels = us.filter((u) => u.deletion?.status === "pending").length;
    counts.sos = vw.filter((v) => v.sos && !v.sos.resolved).length; counts.apps = ap.filter((a) => /review/i.test(a.status || "")).length; counts.offers = of.filter(OPEN_OFFER).length;
    counts.maint = mt.filter((m) => m.status === "Open").length; counts.tickets = tk.filter((t) => !/resolved|closed/i.test(t.status || "")).length; counts.reports = rp.filter((r) => (r.status || "New") === "New").length; counts.sugg = sg.filter((s) => (s.status || "New") === "New").length;
    counts.proofs = g("paymentProofs").filter((p) => /submitted/i.test(p.status || "")).length;
    counts.queue = counts.listings + (S.pendingV || 0) + counts.dels + counts.sos;
  } else if (k === "support") { counts.tickets = g("tickets").filter((t) => !/resolved|closed/i.test(t.status || "")).length; counts.sugg = g("suggestions").filter((s) => (s.status || "New") === "New").length; }
  else { const u = S.user.uid; counts.offers = g("offers", u).filter(OPEN_OFFER).length; counts.maint = g("maintenance", u).filter((m) => m.status === "Open").length; counts.views = g("viewings", u).filter((v) => v.status === "Requested").length; }
  paintBadges();
}
export function paintBadges() {
  $$("[data-axb]").forEach((b) => { const key = b.dataset.axb; if (key === "more") { b.hidden = !(counts.sos || host.S.pendingV || counts.reports); b.dataset.t = counts.sos ? "alert" : "amber"; return; } const n = badgeVal(key); b.textContent = n > 99 ? "99+" : n || ""; b.hidden = !n; if (key === "queue") b.dataset.t = counts.sos ? "alert" : "amber"; });
  const bell = $(".ax-top .bell"); if (bell) bell.dataset.alert = counts.sos ? "1" : "";
}
let badgeTimer;
export async function loadBadges() {
  const S = host?.S; if (!S?.user) return; const k = roleKey();
  try {
    if (k === "admin") await Promise.all(BADGE_COLS.map((c) => data.get(c, { maxAge: 300000 }).catch(() => [])));
    else if (k === "support") await Promise.all(["tickets", "suggestions"].map((c) => data.get(c, { maxAge: 300000 }).catch(() => [])));
    else await Promise.all(["offers", "maintenance", "viewings"].map((c) => data.get(c, { uid: S.user.uid, maxAge: 300000 }).catch(() => [])));
    if (k === "admin") { const ice = await st.getIce().catch(() => null); counts.relayOff = ice ? !(ice.servers.length || ice.credsUrl) : false; $$('[data-axb="relay"]').forEach((b) => { b.hidden = !counts.relayOff; b.textContent = counts.relayOff ? "Not set" : ""; b.dataset.t = "grey"; b.classList.add("txt"); }); }
  } catch {}
  recompute();
}

// ---------- the More sheet (phones) ----------
export function openMore() {
  const key = roleKey(), c = cfgFor(key), S = host.S, path = hq().path, shown = new Set(c.tabs.map((t) => t[0])), pref = host.themePref(), me = host.userName();
  const roleLabel = S.isOwner ? "Owner" : S.role === "admin" ? "Admin" : S.role;
  const groups = c.groups.map((g) => ({ l: g.l, items: g.items.filter((i) => !shown.has(i[0])) })).filter((g) => g.items.length);
  const tile = (i) => `<a class="ax-tile-l" href="#${i[0]}" data-x>${`<span class="ax-ti">${I(i[1], 22)}${i[3] ? badge(i[3]) : ""}</span>`}<span>${esc(i[2])}</span></a>`;
  const d = dialog({ sheet: true, size: "sheet", title: "More", body: `<a class="ax-acard" href="#/settings" data-x>${avatar(me, S.user?.uid, 44, S.profile?.photo)}<div><b>${esc(me)}</b><small>${esc(S.user?.email || "")}</small></div><span class="ax-chip" data-t="mute">${esc(roleLabel)}</span></a>
    ${groups.map((g) => `<section><h3 class="ax-eyebrow">${esc(g.l || "Console")}</h3><div class="ax-tgrid">${g.items.map(tile).join("")}</div></section>`).join("")}
    <section><h3 class="ax-eyebrow">Appearance</h3><div class="ax-seg" role="radiogroup" aria-label="Appearance">${[["light", "Light"], ["dark", "Dark"], ["system", "System"]].map(([v, l]) => `<button type="button" role="radio" aria-checked="${pref === v}" data-th="${v}">${l}</button>`).join("")}</div></section>
    <div class="ax-mrows"><a href="#/" class="ax-mrow" data-x>${I("left", 18)}<span>Go back to Faxton</span></a><button type="button" class="ax-mrow" data-t="bad" data-out>${I("logout", 18)}<span>Sign out</span></button></div>` });
  d.el.addEventListener("click", (e) => { if (e.target.closest("a[data-x]")) d.close(); const t = e.target.closest("[data-th]"); if (t) { host.setThemePref(t.dataset.th); $$("[data-th]", d.el).forEach((x) => x.setAttribute("aria-checked", x === t)); } if (e.target.closest("[data-out]")) { d.close(); signOut(); } });
}
async function signOut() { if (await host.confirmSignOut()) { await host.logout(); host.go("#/login"); } }

// ---------- command palette ----------
let pal = null; const recent = [];
const norm = (s) => String(s || "").toLowerCase();
export async function openPalette() {
  if (pal) return pal.input.focus();
  const key = roleKey(), c = cfgFor(key), S = host.S;
  const ov = document.createElement("div"); ov.className = "ax-fl ax-pal-ov"; ov.innerHTML = `<div class="ax-pal" role="dialog" aria-modal="true" aria-label="Search"><div class="ax-pal-i">${I("search", 18)}<input type="text" role="combobox" aria-expanded="true" aria-controls="axPalL" aria-autocomplete="list" placeholder="Search listings, users, applications…" autocomplete="off" spellcheck="false"><button type="button" class="ax-btn" data-v="ghost" data-size="sm" data-x>Esc</button></div><div class="ax-pal-l" id="axPalL" role="listbox"></div><div class="ax-pal-f"><span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>Enter</kbd> open</span><span><kbd>Esc</kbd> close</span></div></div>`;
  document.body.append(ov); document.documentElement.classList.add("ax-lock");
  const input = $("input", ov), list = $("#axPalL", ov), back = document.activeElement; let items = [], idx = 0, index = null;
  const close = () => { document.removeEventListener("keydown", key2, true); ov.remove(); pal = null; document.documentElement.classList.remove("ax-lock"); try { back?.focus?.(); } catch {} };
  pal = { input, close };
  const pages = flat(c).map(({ i }) => ({ type: "Page", icon: i[1], title: i[2], href: i[0], h: norm(i[2]) }));
  const actions = [...quickItems(key).map((q) => ({ type: "Action", icon: q.icon, title: q.label, href: q.href, h: norm(q.label) })), { type: "Action", icon: host.theme() === "dark" ? "sun" : "moon", title: "Toggle theme", act: () => host.toggleTheme(), h: "toggle theme dark light mode" }, { type: "Action", icon: "left", title: "Go back to Faxton", href: "/", h: "go back faxton site home" }, { type: "Action", icon: "logout", title: "Sign out", act: signOut, h: "sign out log out" }];
  const buildIndex = async () => {
    if (key === "admin") { const [ls, us, ap, vw, tk] = await Promise.all(["listings", "users", "applications", "viewings", "tickets"].map((x) => data.get(x, { maxAge: 300000 }).catch(() => [])));
      return [...ls.map((l) => ({ type: "Listing", icon: "clipList", title: l.title, sub: [l.area, l.city].filter(Boolean).join(", "), href: "/admin/listings?id=" + encodeURIComponent(l.id), h: norm(`${l.title} ${l.area} ${l.city} ${l.id} ${l.agent?.name || ""}`) })),
        ...us.map((u) => ({ type: "User", icon: "user", title: u.name || u.email || "User", sub: u.email, href: "/admin/users?id=" + encodeURIComponent(u.id), h: norm(`${u.name} ${u.email} ${u.phone || ""}`) })),
        ...ap.map((a) => ({ type: "Application", icon: "doc", title: `${a.name || "Applicant"}: ${a.title || ""}`, sub: a.status, href: "/admin/applications?id=" + encodeURIComponent(a.id), h: norm(`${a.name} ${a.email} ${a.title}`) })),
        ...vw.map((v) => ({ type: "Viewing", icon: "calDots", title: `${v.name || "Renter"}: ${v.title || ""}`, sub: v.status, href: "/admin/viewings?id=" + encodeURIComponent(v.id), h: norm(`${v.name} ${v.title} ${v.agentName || ""}`) })),
        ...tk.map((t) => ({ type: "Ticket", icon: "chatdots", title: t.subject || "Ticket", sub: `#${t.ref || ""} · ${t.name || ""}`, href: "/admin/support?id=" + encodeURIComponent(t.id), h: norm(`${t.ref} ${t.subject} ${t.name}`) }))]; }
    if (key === "support") { const tk = await data.get("tickets", { maxAge: 300000 }).catch(() => []); return tk.map((t) => ({ type: "Ticket", icon: "chatdots", title: t.subject || "Ticket", sub: `#${t.ref || ""} · ${t.name || ""}`, href: "/support/tickets?id=" + encodeURIComponent(t.id), h: norm(`${t.ref} ${t.subject} ${t.name}`) })); }
    const u = S.user.uid, ls = await data.get("listings", { uid: u, maxAge: 300000 }).catch(() => []); return ls.map((l) => ({ type: "Listing", icon: "clipList", title: l.title, sub: [l.area, l.city].filter(Boolean).join(", "), href: "/home/" + encodeURIComponent(l.id), h: norm(`${l.title} ${l.area} ${l.city}`) }));
  };
  const score = (it, ws) => { let s = 0; for (const w of ws) { const p = it.h.indexOf(w); if (p < 0) return -1; s += p === 0 ? 3 : it.h.includes(" " + w) ? 2 : 1; } return s; };
  const draw = () => {
    const q = norm(input.value).trim(), ws = q.split(/\s+/).filter(Boolean); let out = [];
    if (!q) out = [...recent.slice(0, 5).map((r) => ({ ...r, group: "Recent" })), ...actions.slice(0, 4).map((a) => ({ ...a, group: "Actions" }))];
    else { const m = (arr, n) => arr.map((it) => [it, score(it, ws)]).filter((x) => x[1] >= 0).sort((a, b) => b[1] - a[1]).slice(0, n).map((x) => x[0]);
      out = [...m(pages, 4).map((a) => ({ ...a, group: "Pages" })), ...(index ? ["Listing", "User", "Application", "Viewing", "Ticket"].flatMap((t) => m(index.filter((i) => i.type === t), 5).map((a) => ({ ...a, group: "Records" }))).slice(0, 8) : []), ...m(actions, 3).map((a) => ({ ...a, group: "Actions" }))]; }
    items = out; idx = Math.min(idx, Math.max(0, items.length - 1));
    let last = "", html = ""; items.forEach((it, i) => { if (it.group !== last) { html += `<div class="ax-pg">${it.group}</div>`; last = it.group; } html += `<div class="ax-pi" role="option" id="axp${i}" data-i="${i}" aria-selected="${i === idx}">${I(it.icon, 18)}<span class="ax-pt"><b>${esc(it.title)}</b>${it.sub ? `<small>${esc(it.sub)}</small>` : ""}</span><em>${esc(it.type)}</em></div>`; });
    if (!items.length) html = q && !index ? `<div class="ax-pe">${"<i class=ax-skel style='height:14px;width:60%'></i>"}</div>` : `<div class="ax-pe">No matches. Try a name, email or reference.</div>`;
    list.innerHTML = html; input.setAttribute("aria-activedescendant", items.length ? "axp" + idx : "");
  };
  const go = (it) => { if (!it) return; close(); if (it.type !== "Action") { recent.unshift({ type: it.type, icon: it.icon, title: it.title, sub: it.sub, href: it.href, h: it.h }); const seen = new Set(); recent.splice(0, recent.length, ...recent.filter((r) => !seen.has(r.href) && seen.add(r.href)).slice(0, 5)); } if (it.act) it.act(); else host.go("#" + it.href); };
  const mv = (d) => { idx = (idx + d + items.length) % Math.max(1, items.length); $$(".ax-pi", list).forEach((x, i) => x.setAttribute("aria-selected", i === idx)); input.setAttribute("aria-activedescendant", "axp" + idx); $(`#axp${idx}`, list)?.scrollIntoView({ block: "nearest" }); };
  const key2 = (e) => { if (!pal) return; if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); } else if (e.key === "ArrowDown") { e.preventDefault(); mv(1); } else if (e.key === "ArrowUp") { e.preventDefault(); mv(-1); } else if (e.key === "Enter") { e.preventDefault(); go(items[idx]); } else if (e.key === "Tab") { e.preventDefault(); const gs = [...new Set(items.map((i) => i.group))]; if (gs.length > 1) { const cur = items[idx]?.group, ni = items.findIndex((i) => i.group === gs[(gs.indexOf(cur) + 1) % gs.length]); idx = ni; mv(0); } } };
  document.addEventListener("keydown", key2, true);
  input.oninput = () => { idx = 0; draw(); };
  list.addEventListener("click", (e) => { const r = e.target.closest(".ax-pi"); if (r) go(items[+r.dataset.i]); });
  list.addEventListener("pointermove", (e) => { const r = e.target.closest(".ax-pi"); if (r && +r.dataset.i !== idx) { idx = +r.dataset.i; $$(".ax-pi", list).forEach((x, i) => x.setAttribute("aria-selected", i === idx)); } });
  ov.addEventListener("pointerdown", (e) => { if (e.target === ov) close(); }); $("[data-x]", ov).onclick = close;
  draw(); input.focus();
  buildIndex().then((ix) => { index = ix; if (pal) draw(); });
}

function shortcuts() {
  dialog({ title: "Keyboard shortcuts", size: "md", icon: "kbd", body: `<dl class="ax-keys">${[["Ctrl / ⌘ + K", "Search everything"], ["/", "Search this page"], ["[", "Collapse or expand the sidebar"], ["J / K", "Next or previous record"], ["X", "Select the focused row"], ["Enter", "Open the focused row"], ["Ctrl / ⌘ + Enter", "Send or save"], ["Esc", "Close the top layer"], ["?", "Show this list"]].map(([k, v]) => `<div><dt>${k.split(" + ").map((x) => `<kbd>${esc(x)}</kbd>`).join("+")}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>` });
}

// ---------- one-time global wiring ----------
let wired = false;
function setRail(v, store) { const ax = $(".ax"); if (!ax) return; ax.dataset.rail = v; $$("[data-ax=rail]").forEach((b) => b.setAttribute("aria-expanded", v === "0")); if (store && innerWidth >= 1280) try { localStorage.setItem("axRail", v); } catch {} }
export function wireOnce() {
  if (wired) return; wired = true;
  document.addEventListener("click", (e) => {
    const a = e.target.closest?.("[data-ax]"); if (!a) { if (e.target.closest?.(".ax-snav .ax-nav") && innerWidth < 1280) setRail("1"); return; }
    const k = a.dataset.ax;
    if (k === "rail") setRail($(".ax")?.dataset.rail === "1" ? "0" : "1", true);
    else if (k === "rail-close") setRail("1");
    else if (k === "palette") openPalette();
    else if (k === "more") openMore();
    else if (k === "skip") $("#main")?.focus();
    else if (k === "refresh") { data.invalidate(); const r = $(".ax-main")?.parentElement; host.render(); }
    else if (k === "retry") { data.invalidate(); host.render(); }
    else if (k === "create") menu(a, quickItems(roleKey()).map((q) => ({ label: q.label, icon: q.icon, href: q.href })), { label: "Quick create" });
    else if (k === "account") menu(a, [{ label: "Settings", icon: "gear", href: "/settings" }, { label: "Go back to Faxton", icon: "left", href: "/" }, { sep: 1 }, { label: "Sign out", icon: "logout", tone: "bad", act: signOut }], { title: host.userName(), align: innerWidth >= 900 ? "left" : "right" });
  });
  document.addEventListener("keydown", (e) => {
    if (!$(".ax")) return; const t = document.activeElement, typing = /^(INPUT|TEXTAREA|SELECT)$/.test(t?.tagName) || t?.isContentEditable;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); pal ? pal.close() : openPalette(); return; }
    if (typing || e.ctrlKey || e.metaKey || e.altKey || document.querySelector(".ax-ov,.ax-pal-ov")) return;
    if (e.key === "[") { e.preventDefault(); setRail($(".ax")?.dataset.rail === "1" ? "0" : "1", true); }
    else if (e.key === "?") { e.preventDefault(); shortcuts(); }
    else if (e.key === "/" && !$(".ax-search input")) { e.preventDefault(); openPalette(); }
  });
  if (window.visualViewport) visualViewport.addEventListener("resize", () => document.documentElement.classList.toggle("ax-kb", visualViewport.height < innerHeight * 0.7));
  hooks.changed.push(() => recompute());
  setInterval(() => { if (document.visibilityState === "visible" && $(".ax")) loadBadges(); }, 300000);
  addEventListener("resize", () => { const ax = $(".ax"); if (ax && innerWidth < 1280 && ax.dataset.rail === "0" && !ax.dataset.keep) setRail("1"); });
}
// Called by main.js right after the console HTML is in the page.
export function afterRender() {
  wireOnce(); recompute(); loadBadges();
  const nav = $(".ax-snav"); const on = nav && $("[aria-current]", nav); if (on) on.scrollIntoView({ block: "nearest" });
  const b = $(".ax-bottom [aria-current]"); b?.scrollIntoView?.({ inline: "nearest", block: "nearest" });
}
export { softNav } from "./ax.js";
