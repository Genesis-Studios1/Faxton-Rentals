// Role dashboards: platform analytics (admin and owner), customer care (support), owner portfolio (landlord) and agency.
// Every number comes from the live database; charts that have no data yet simply show zeros.
import { $, $$, esc, icon, naira, toast, modal, friendlyErr, initials } from "./ui.js";
import * as st from "./store.js";

// ---------- data helpers ----------
const secOf = (d) => (d?.createdAt?.seconds || 0) * 1000;
const months = (n = 12) => { const now = new Date(), a = []; for (let i = n - 1; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); a.push({ start: d.getTime(), end: new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime(), label: d.toLocaleString("en-GB", { month: "short" }), full: d.toLocaleString("en-GB", { month: "long", year: "numeric" }) }); } return a; };
const perMonth = (docs, ms, pick = secOf) => ms.map((m) => docs.filter((d) => { const t = pick(d); return t >= m.start && t < m.end; }).length);
const cumulative = (docs, ms, pick = secOf) => ms.map((m) => docs.filter((d) => { const t = pick(d); return t && t < m.end; }).length);
const pct = (a, b) => (b ? Math.round(((a - b) / b) * 100) : a ? 100 : 0);
const ago = (t) => { const s = t?.seconds; if (!s) return "Just now"; const m = (Date.now() / 1000 - s) / 60; return m < 60 ? `${Math.max(1, Math.floor(m))} min ago` : m < 1440 ? `${Math.floor(m / 60)} hours ago` : `${Math.floor(m / 1440)} days ago`; };
const day = (t) => (t?.seconds ? new Date(t.seconds * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");
const isActive = (l) => l.status === "active" && !l.archived;
const isResolved = (t) => /resolved|closed/i.test(t.status || "");
const isOpenTk = (t) => !isResolved(t);
const first = (ctx) => (ctx.S.user.displayName || ctx.S.profile?.name || "").split(" ")[0] || "there";

// ---------- building blocks ----------
const head = ({ eyebrow, title, sub, actions = "" }) => `<div class="dsh-head"><div>${eyebrow ? `<span class="dsh-eye">${esc(eyebrow)}</span>` : ""}<h1>${esc(title)}</h1><p>${esc(sub)}</p></div><div class="dsh-act">${actions}</div></div>`;
const arrow = (p) => (p ? `<span class="dsh-d ${p < 0 ? "dn" : "up"}">${p > 0 ? "↑" : "↓"} ${Math.abs(p)}%</span>` : "");
const kpi = ({ ic, label, value, sub, d, tone = "g", href }) => { const tag = href ? `a href="#${href}"` : "div"; return `<${tag} class="dsh-kpi t-${tone}"><span class="dsh-ki">${icon(ic, 22)}</span><div><small>${esc(label)}</small><div class="dsh-kv"><b>${value}</b>${d == null ? "" : arrow(d)}</div><em>${esc(sub || "")}</em></div></${href ? "a" : "div"}>`; };
const panel = (title, sub, body, right = "", cls = "") => `<section class="dsh-p ${cls}"><header><div><h3>${esc(title)}</h3>${sub ? `<p>${esc(sub)}</p>` : ""}</div>${right}</header>${body}</section>`;
const link = (href, text = "View all →") => `<a class="dsh-link" href="#${href}">${text}</a>`;
const bars = (series, labels) => { const max = Math.max(1, ...series.flat()); return `<div class="dsh-bars" role="img" aria-label="Bar chart by month">${labels.map((l, i) => `<div class="dsh-b">${series.map((s, k) => `<i class="s${k}" style="height:${Math.max(s[i] ? 5 : 2, (s[i] / max) * 100)}%" title="${esc(l)}: ${s[i]}"></i>`).join("")}<em>${esc(l)}</em></div>`).join("")}</div>`; };
const legend = (items) => `<div class="dsh-legend">${items.map(([l, k]) => `<span><i class="s${k}"></i>${esc(l)}</span>`).join("")}</div>`;
const line = (vals, labels) => { const max = Math.max(1, ...vals), n = vals.length, pts = vals.map((v, i) => `${n > 1 ? (i / (n - 1)) * 100 : 50},${37 - (v / max) * 33}`); return `<div class="dsh-line"><span class="dsh-top">${vals[n - 1] ?? 0}</span><svg viewBox="0 0 100 40" preserveAspectRatio="none" role="img" aria-label="Growth over the last 12 months"><polygon points="0,40 ${pts.join(" ")} 100,40"/><polyline points="${pts.join(" ")}"/></svg><div class="dsh-axis">${labels.map((l) => `<em>${esc(l)}</em>`).join("")}</div></div>`; };
const COLORS = ["#10b981", "#3b82f6", "#a855f7", "#f59e0b", "#94a3b8", "#ef4444"];
const donut = (items, top, sub) => { const tot = items.reduce((a, x) => a + x[1], 0); let acc = 0; const stops = tot ? items.map(([, v], i) => { const a = (acc / tot) * 100; acc += v; return `${COLORS[i % 6]} ${a}% ${(acc / tot) * 100}%`; }).join(",") : "var(--border) 0 100%";
  return `<div class="dsh-donut"><div class="ring" style="background:conic-gradient(${stops})"><div><b>${top}</b><small>${esc(sub)}</small></div></div><ul>${items.map(([l, v], i) => `<li><i style="background:${COLORS[i % 6]}"></i><span>${esc(l)}</span><b>${tot ? Math.round((v / tot) * 100) : 0}%</b><em>${v}</em></li>`).join("") || `<li class="muted">No data yet.</li>`}</ul></div>`; };
const rank = (rows) => { const max = Math.max(1, ...rows.map((r) => r[1])); return `<ul class="dsh-rank">${rows.map(([l, v, t]) => `<li><span>${esc(l)}</span><div><i style="width:${(v / max) * 100}%"></i></div><b>${t ?? v}</b></li>`).join("") || `<li class="muted">No data yet.</li>`}</ul>`; };
const tbl = (cols, rows, empty = "Nothing here yet.") => `<div class="tbl-wrap dsh-tbl"><table><thead><tr>${cols.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>${rows.join("") || `<tr><td colspan="${cols.length}" class="muted">${esc(empty)}</td></tr>`}</tbody></table></div>`;
const pill = (s) => { const k = String(s); return `<span class="pill ${/pending|review|requested|open|waiting|overdue/i.test(k) ? "warn" : /flag|reject|cancel|high/i.test(k) ? "bad" : /progress/i.test(k) ? "info" : ""}">${esc(s)}</span>`; };
const thumb = (l) => `<img class="th" src="${esc(l.images?.[0] || l.thumb || "img/palm-court.webp")}" alt="" loading="lazy">`;
const csv = (name, head, rows) => { const q = (v) => `"${String(v).replace(/"/g, '""')}"`, b = new Blob([[head, ...rows].map((r) => r.map(q).join(",")).join("\n")], { type: "text/csv" }), a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };

// ---------- 1. platform analytics (admin and owner) ----------
export function platform(ctx, { ls, apps, views, users, tks }) {
  const ms = months(12), L = ms.length - 1, mname = ms.map((m) => m.label);
  const uM = perMonth(users, ms), lM = perMonth(ls, ms), aM = perMonth(apps, ms), vM = perMonth(views, ms), tM = perMonth(tks, ms);
  const active = ls.filter(isActive), pending = ls.filter((l) => /pending|flag/i.test(l.status || "")), toReview = apps.filter((a) => /review/i.test(a.status || ""));
  const byCity = {}; active.forEach((l) => (byCity[l.city || "Other"] = (byCity[l.city || "Other"] || 0) + 1));
  const roles = {}; users.forEach((u) => { const r = u.id === ctx.S.ownerUid ? "Owner" : { admin: "Admin", owner: "Admin", agent: "Agent", landlord: "Landlord", agency: "Agency", support: "Support" }[u.role] || "Renter"; roles[r] = (roles[r] || 0) + 1; });
  const byType = {}; active.forEach((l) => { const t = l.type || "Other"; (byType[t] ||= []).push(l.price || 0); });
  const kpis = [
    kpi({ ic: "users", label: "Total users", value: users.length, d: pct(uM[L], uM[L - 1]), sub: `+${uM[L]} this month`, href: "/admin/users" }),
    kpi({ ic: "user", label: "New signups", value: uM[L], d: pct(uM[L], uM[L - 1]), sub: `vs ${uM[L - 1]} last month`, tone: "b" }),
    kpi({ ic: "home", label: "Active listings", value: active.length, sub: `${pending.length} awaiting approval`, href: "/admin/listings" }),
    kpi({ ic: "chart", label: "Listing growth", value: `+${lM[L]}`, d: pct(lM[L], lM[L - 1]), sub: "new listings this month", tone: "p" }),
    kpi({ ic: "doc", label: "Applications", value: apps.length, d: pct(aM[L], aM[L - 1]), sub: `${toReview.length} to review`, tone: "y", href: "/admin/applications" }),
    kpi({ ic: "headset", label: "Open tickets", value: tks.filter(isOpenTk).length, sub: `${tks.length} in total`, tone: "r", href: "/admin/support" }),
  ].join("");
  const types = Object.entries(byType).sort((a, b) => b[1].length - a[1].length);
  const attention = [["/admin/listings", "doc", "Listings awaiting approval", pending.length], ["/admin/applications", "users", "Applications to review", toReview.length], ["/admin/viewings", "cal", "Viewing requests", views.filter((v) => v.status === "Requested").length], ["/admin/support", "msg", "Open support tickets", tks.filter(isOpenTk).length]];
  const table6 = ms.slice(-6).reverse().map((m, i) => { const k = L - i; return `<tr><td><b>${m.full}</b></td><td>${uM[k]}</td><td>${lM[k]}</td><td>${aM[k]}</td><td>${vM[k]}</td><td>${tM[k]}</td></tr>`; });
  const html = `<div class="dsh">${head({ eyebrow: "Business performance", title: "Platform analytics", sub: `A complete view of Faxton Rentals’ growth and activity over the last 12 months.`, actions: `${!ls.length ? `<button class="btn" id="seed">Add sample listings</button>` : ""}<button class="btn primary" id="export">${icon("download", 18)} Export report</button>` })}
    <div class="dsh-kpis k6">${kpis}</div>
    <div class="dsh-grid g3">${panel("New signups", "People who joined each month", bars([uM], mname))}${panel("Listings growth", "Total listings on the platform", line(cumulative(ls, ms), mname))}${panel("Applications & viewings", "Requests received each month", legend([["Applications", 0], ["Viewings", 1]]) + bars([aM, vM], mname))}</div>
    <div class="dsh-grid g3">${panel("Listings by city", "Active listings, by location", rank(Object.entries(byCity).sort((a, b) => b[1] - a[1]).slice(0, 6)))}${panel("Users by role", "Everyone on the platform", donut(Object.entries(roles).sort((a, b) => b[1] - a[1]), users.length, "Total users"))}${panel("Property categories", "Active listings and average rent", tbl(["Category", "Listings", "Avg rent / yr", "Share"], types.map(([t, p]) => `<tr><td><b>${esc(t)}</b></td><td>${p.length}</td><td>${naira(Math.round(p.reduce((a, b) => a + b, 0) / p.length))}</td><td>${active.length ? Math.round((p.length / active.length) * 100) : 0}%</td></tr>`)))}</div>
    <div class="dsh-grid g13">${panel("Needs attention", "Things waiting for you", `<ul class="dsh-att">${attention.map(([h, ic, t, n]) => `<li><a href="#${h}"><span class="dsh-ki sm">${icon(ic, 18)}</span><span>${t}</span><b>${n}</b>${icon("chev", 16).replace("<svg", '<svg style="transform:rotate(-90deg)"')}</a></li>`).join("")}</ul>`)}${panel("Monthly platform metrics", "The last six months", tbl(["Month", "New users", "New listings", "Applications", "Viewings", "Tickets"], table6))}</div></div>`;
  return { html, mount(root) {
    $("#export", root).onclick = () => csv("faxton-platform-report.csv", ["Month", "New users", "New listings", "Applications", "Viewings", "Tickets"], ms.map((m, i) => [m.full, uM[i], lM[i], aM[i], vM[i], tM[i]]));
    const seed = $("#seed", root); if (seed) seed.onclick = async () => { seed.disabled = true; try { await st.seedListings(); toast("Sample listings added."); ctx.render(); } catch (e) { toast(friendlyErr(e)); seed.disabled = false; } };
  } };
}

// ---------- 2. customer care support ----------
export function support(ctx, { tks, convs }) {
  const ms = months(12), L = ms.length - 1, mname = ms.map((m) => m.label), now = Date.now();
  const open = tks.filter((t) => !isResolved(t) && !/progress/i.test(t.status || "")), prog = tks.filter((t) => /progress/i.test(t.status || "")), done = tks.filter(isResolved);
  const live = tks.filter(isOpenTk), overdue = live.filter((t) => secOf(t) && now - secOf(t) > 48 * 36e5);
  const wk = tks.filter((t) => now - secOf(t) < 7 * 864e5).length, pw = tks.filter((t) => { const a = now - secOf(t); return a >= 7 * 864e5 && a < 14 * 864e5; }).length;
  const unread = convs.filter((c) => c.unread).length;
  const cats = {}; tks.forEach((t) => { cats[t.subject || "Other"] = (cats[t.subject || "Other"] || 0) + 1; });
  const queue = [...live].sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)).slice(0, 6);
  const prio = (t) => (overdue.includes(t) ? "Overdue" : "Normal");
  const row = (t) => `<tr data-go="/support/tickets"><td>#${esc(t.ref || "")}</td><td><div class="cell"><span class="avatar a2-av">${esc(initials(t.name || "?"))}</span><div><b>${esc(t.name || "Customer")}</b></div></div></td><td>${esc(t.subject || "")}</td><td>${pill(prio(t))}</td><td>${pill(/progress/i.test(t.status || "") ? "In progress" : "Open")}</td><td class="muted">${ago(t.createdAt)}</td></tr>`;
  const chats = [...convs].sort((a, b) => (b.lastAt?.seconds || 0) - (a.lastAt?.seconds || 0)).slice(0, 5);
  const html = `<div class="dsh">${head({ title: "Customer care support", sub: "Handle customer issues efficiently and deliver exceptional support.", actions: `<a class="btn primary" href="#/support/tickets">${icon("headset", 18)} Open ticket queue</a><a class="btn" href="#/help">${icon("help", 18)} Help centre</a>` })}
    <div class="dsh-kpis k6">${[
      kpi({ ic: "msg", label: "Open tickets", value: open.length, sub: `${live.length} still unresolved`, tone: "g", href: "/support/tickets" }),
      kpi({ ic: "clock", label: "In progress", value: prog.length, sub: "being handled now", tone: "b" }),
      kpi({ ic: "check", label: "Resolved", value: done.length, sub: `${tks.length ? Math.round((done.length / tks.length) * 100) : 0}% of all tickets`, tone: "g" }),
      kpi({ ic: "chart", label: "New this week", value: wk, d: pct(wk, pw), sub: `vs ${pw} last week`, tone: "p" }),
      kpi({ ic: "chatdots", label: "Live chats", value: convs.length, sub: `${unread} with new messages`, tone: "b" }),
      kpi({ ic: "flag", label: "Overdue (48h+)", value: overdue.length, sub: "waiting more than two days", tone: "r" }),
    ].join("")}</div>
    <div class="dsh-grid g21">${panel("Support ticket queue", "Oldest unresolved tickets first", tbl(["#", "Customer", "Issue type", "Priority", "Status", "Opened"], queue.map(row), "No unresolved tickets. Nice work."), link("/support/tickets"))}${panel("Live chat conversations", `${convs.length} conversation${convs.length === 1 ? "" : "s"}`, `<ul class="dsh-chats">${chats.map((c) => `<li><span class="avatar a2-av">${esc(initials(c.userName || "?"))}</span><div><b>${esc(c.userName || "Customer")}</b><small>${esc(c.last || c.listingTitle || "")}</small></div><span class="muted">${ago(c.lastAt)}</span>${c.unread ? `<i class="dsh-dot"></i>` : ""}</li>`).join("") || `<li class="muted">No conversations yet.</li>`}</ul>`)}</div>
    <div class="dsh-grid g3">${panel("Support volume trend", "Tickets received and resolved", legend([["Received", 0], ["Resolved", 1]]) + bars([perMonth(tks, ms), perMonth(done, ms)], mname))}${panel("Ticket categories", "Breakdown by issue type", donut(Object.entries(cats).sort((a, b) => b[1] - a[1]).slice(0, 6), tks.length, "Total tickets"))}${panel("Recent escalations", "Tickets waiting more than 48 hours", tbl(["#", "Customer", "Issue", "Waiting"], overdue.slice(0, 5).map((t) => `<tr data-go="/support/tickets"><td>#${esc(t.ref || "")}</td><td>${esc(t.name || "")}</td><td>${esc(t.subject || "")}</td><td class="muted">${ago(t.createdAt)}</td></tr>`), "Nothing is overdue."), link("/support/tickets"))}</div></div>`;
  return { html, mount(root) { $$("[data-go]", root).forEach((r) => { r.style.cursor = "pointer"; r.onclick = () => ctx.go("#" + r.dataset.go); }); } };
}

// ---------- add-property form shared by landlords and agencies ----------
export function addProperty(ctx, done) {
  const m = modal(`<h2>Add a property</h2><p class="muted" style="margin-bottom:12px">New listings are reviewed by the Faxton team before they go live.</p><form id="np" class="a2-form"><div class="field"><label>Title</label><input name="title" required maxlength="80" placeholder="3 Bedroom Apartment"></div>
    <div class="f2"><div class="field"><label>Area</label><input name="area" required maxlength="60" placeholder="Lekki Phase 1"></div><div class="field"><label>City</label><input name="city" value="Lagos" required maxlength="40"></div><div class="field"><label>Yearly rent (₦)</label><input name="price" type="number" min="0" required></div><div class="field"><label>Bedrooms</label><input name="beds" type="number" min="0" max="20" value="2" required></div><div class="field"><label>Bathrooms</label><input name="baths" type="number" min="1" max="20" value="2" required></div><div class="field"><label>Type</label><select name="type"><option>Apartment</option><option>House</option><option>Studio</option><option>Duplex</option></select></div></div>
    <div class="field"><label>Description</label><textarea name="desc" rows="3" maxlength="800"></textarea></div><div class="field"><label>Photo links (one per line)</label><textarea name="im" rows="2" placeholder="https://…"></textarea></div><div class="field"><label>Video links (optional)</label><textarea name="vd" rows="2" placeholder="https://…"></textarea></div><p class="err" id="npe" role="alert"></p><div class="a2-act"><button class="btn primary" type="submit">Submit for review</button></div></form>`);
  $("#np", m.el).onsubmit = async (e) => {
    e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)), lines = (t) => String(t || "").split("\n").map((x) => x.trim()).filter((x) => /^https:\/\//.test(x));
    const imgs = lines(f.im).slice(0, 20); if (!imgs.length) imgs.push("img/palm-court.webp");
    const u = ctx.S.user, id = f.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) + "-" + Date.now().toString(36).slice(-4);
    try {
      await st.createListing({ id, title: f.title.trim(), area: f.area.trim(), city: f.city.trim(), price: +f.price, beds: +f.beds, baths: +f.baths, sqm: 0, type: f.type, desc: f.desc.trim(), status: "pending", service: 0, deposit: 0, lat: 6.45, lng: 3.47, images: imgs, thumb: imgs[0], videos: lines(f.vd).slice(0, 6), amenities: [], ownerUid: u.uid, agent: { id: u.uid, name: u.displayName || ctx.S.profile?.name || "Faxton owner", avatar: ctx.S.profile?.photo || "img/av-daniel.webp", photo: ctx.S.profile?.photo || "img/av-daniel.webp" } });
      m.close(); toast("Property submitted for review."); done?.();
    } catch (er) { $("#npe", m.el).textContent = friendlyErr(er); }
  };
}

// ---------- 3 and 4. property owner portfolio and agency ----------
export function portfolio(ctx, { ls, apps, views }, agency = false) {
  const ms = months(12), L = ms.length - 1, mname = ms.map((m) => m.label);
  const live = ls.filter(isActive), pend = ls.filter((l) => /pending|flag/i.test(l.status || ""));
  const tenants = apps.filter((a) => /approved|active/i.test(a.status || "")), occupied = new Set([...tenants.map((a) => a.listingId), ...ls.filter((l) => l.available === false).map((l) => l.id)]);
  const occ = ls.length ? Math.round((occupied.size / ls.length) * 100) : 0, roll = ls.filter((l) => occupied.has(l.id)).reduce((a, l) => a + (l.price || 0), 0);
  const enq = [...apps, ...views], eM = perMonth(enq, ms), pv = views.filter((v) => v.status === "Requested");
  const perL = (id) => enq.filter((x) => x.listingId === id).length;
  const kpis = [
    kpi({ ic: "home", label: agency ? "Active listings" : "Total listings", value: agency ? live.length : ls.length, sub: `${pend.length} awaiting review`, tone: "g" }),
    kpi({ ic: "users", label: "Active tenants", value: tenants.length, sub: `${apps.filter((a) => /review/i.test(a.status || "")).length} applications to review`, tone: "b" }),
    kpi({ ic: "wallet", label: "Annual rent roll", value: naira(roll), sub: "rent from occupied properties", tone: "g" }),
    kpi({ ic: "chart", label: "Occupancy rate", value: occ + "%", sub: `${occupied.size} of ${ls.length} properties`, tone: "c" }),
    kpi({ ic: "cal", label: "Viewing requests", value: views.length, d: pct(perMonth(views, ms)[L], perMonth(views, ms)[L - 1]), sub: `${pv.length} pending response`, tone: "p" }),
  ].join("");
  const props = ls.map((l) => `<tr><td><div class="cell">${thumb(l)}<div><b>${esc(l.title)}</b><small>${esc(l.area || "")}, ${esc(l.city || "")}</small></div></div></td><td>${naira(l.price)}</td><td>${perL(l.id)}</td><td>${pill(/pending|flag/i.test(l.status || "") ? "Pending review" : occupied.has(l.id) ? "Occupied" : l.archived ? "Archived" : "Available")}</td><td>${isActive(l) ? `<a class="btn sm" href="#/home/${esc(l.id)}">View</a>` : ""}</td></tr>`);
  const by = (a) => [...a].sort((x, y) => secOf(y) - secOf(x));
  const recentApps = by(apps).slice(0, 5).map((a) => `<tr><td><div class="cell"><span class="avatar a2-av">${esc(initials(a.name || "?"))}</span><div><b>${esc(a.name || "Applicant")}</b><small>${esc(a.title || "")}</small></div></div></td><td>${pill(a.status || "Under review")}</td><td class="muted">${day(a.createdAt)}</td></tr>`);
  const reqs = by(views).slice(0, 5).map((v) => `<tr><td><b>${esc(v.name || "")}</b><small class="muted" style="display:block">${esc(v.title || "")}</small></td><td>${esc(v.when || "")}${v.slot ? `, ${esc(v.slot)}` : ""}</td><td><select data-view="${esc(v.id)}" aria-label="Status">${["Requested", "Confirmed", "Completed", "Cancelled"].map((s) => `<option ${s === v.status ? "selected" : ""}>${s}</option>`).join("")}</select></td></tr>`);
  const areas = {}; live.forEach((l) => { const a = (l.area || "Other").split(",")[0]; areas[a] = (areas[a] || 0) + 1; });
  const agents = {}; ls.forEach((l) => { const n = l.agent?.name || "Unassigned"; (agents[n] ||= { n, l: 0, e: 0 }).l++; agents[n].e += perL(l.id); });
  const funnel = [["New enquiries", pv.length + apps.filter((a) => /review/i.test(a.status || "")).length], ["Viewings confirmed", views.filter((v) => v.status === "Confirmed").length], ["Applications", apps.length], ["Approved tenants", tenants.length]];
  const fmax = Math.max(1, ...funnel.map((f) => f[1]));
  const html = `<div class="dsh">${head({ eyebrow: `Welcome back, ${first(ctx)} 👋`, title: agency ? "Agency dashboard" : "Your rental portfolio", sub: agency ? "Here’s your team’s performance and business overview." : "Here’s what’s happening with your properties.", actions: `<button class="btn primary" id="addp">${icon("plus", 18)} Add property</button>` })}
    <div class="dsh-kpis k5">${kpis}</div>
    <div class="dsh-grid g21">${panel(agency ? "Leads pipeline" : "Enquiries trend", agency ? "From new enquiry to approved tenant" : "Viewing requests and applications per month", agency ? `<ul class="dsh-funnel">${funnel.map(([l, v], i) => `<li><span>${esc(l)}</span><div><i style="width:${Math.max(v ? 8 : 2, (v / fmax) * 100)}%;opacity:${1 - i * 0.18}"></i></div><b>${v}</b></li>`).join("")}</ul>` : bars([eM], mname))}${panel(agency ? "Listings by neighbourhood" : "Occupancy", agency ? "Active listings" : "Occupied and vacant properties", agency ? rank(Object.entries(areas).sort((a, b) => b[1] - a[1]).slice(0, 6)) : donut([["Occupied", occupied.size], ["Vacant", Math.max(0, ls.length - occupied.size)]], occ + "%", "Occupied"))}</div>
    <div class="dsh-grid g21">${panel(agency ? "Your listings" : "Your properties", `${ls.length} propert${ls.length === 1 ? "y" : "ies"}`, tbl(["Property", "Rent / yr", "Enquiries", "Status", ""], props, "You haven’t added a property yet. Choose Add property to get started."))}${panel("Recent applications", "Latest people who applied", tbl(["Applicant", "Status", "Date"], recentApps, "No applications yet."))}</div>
    <div class="dsh-grid ${agency ? "g21" : "g1"}">${panel("Viewing requests", "Confirm or decline requests", tbl(["Prospect", "When", "Status"], reqs, "No viewing requests yet."))}${agency ? panel("Team performance", "Listings and enquiries by agent", tbl(["Agent", "Listings", "Enquiries"], Object.values(agents).map((a) => `<tr><td><b>${esc(a.n)}</b></td><td>${a.l}</td><td>${a.e}</td></tr>`), "No listings yet.")) : ""}</div></div>`;
  return { html, mount(root) {
    $("#addp", root).onclick = () => addProperty(ctx, () => ctx.render());
    $$("select[data-view]", root).forEach((s) => (s.onchange = async () => { try { await st.setStatus("viewings", s.dataset.view, s.value); toast("Status updated."); } catch (e) { toast(friendlyErr(e)); } }));
  } };
}

// ---------- page loaders used by the router ----------
export const allowed = (ctx, kind) => (kind === "support" ? ctx.S.isAdmin || ctx.S.role === "support" : kind === "landlord" ? ctx.S.isAdmin || ctx.S.role === "landlord" : ctx.S.isAdmin || ctx.S.role === "agency");
export const denied = () => ({ title: "Not available", html: `<div class="empty"><h2>This area isn’t available for your account</h2><p>Ask the Faxton owner to give your account access.</p><p style="margin-top:14px"><a class="btn" href="#/">Back home</a></p></div>` });
export async function supportPage(ctx, sub) {
  if (!allowed(ctx, "support")) return denied();
  const [tks, convs] = await Promise.all([st.adminAll("tickets"), st.adminAll("conversations")]);
  if (sub === "tickets") { const A2 = await import("./admin2.js"); const v = A2.support(ctx, tks); return { title: "Tickets", role: "support", html: v.html, mount: v.mount }; }
  const v = support(ctx, { tks, convs }); return { title: "Support dashboard", role: "support", html: v.html, mount: v.mount };
}
export async function ownerPage(ctx, agency) {
  if (!allowed(ctx, agency ? "agency" : "landlord")) return denied();
  const uid = ctx.S.user.uid, [ls, apps, views] = await Promise.all([st.ownedDocs("listings", uid), st.ownedDocs("applications", uid), st.ownedDocs("viewings", uid)]);
  const v = portfolio(ctx, { ls, apps, views }, agency); return { title: agency ? "Agency dashboard" : "My portfolio", role: agency ? "agency" : "landlord", html: v.html, mount: v.mount };
}
