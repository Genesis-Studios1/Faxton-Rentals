// Admin: Manage listings, Users & agents and Support inbox (two/three-pane designs).
import { $, $$, esc, naira, icon, toast, modal, friendlyErr, initials } from "./ui.js";
import * as st from "./store.js";

const rel = (t) => { const s = t?.seconds; if (!s) return "Just now"; const m = (Date.now() / 1000 - s) / 60; return m < 60 ? `${Math.max(1, Math.floor(m))} min ago` : m < 1440 ? `${Math.floor(m / 60)} hr ago` : `${Math.floor(m / 1440)} day${m >= 2880 ? "s" : ""} ago`; };
const searchBox = (id, ph) => `<label class="a2-search">${icon("search", 18)}<input id="${id}" type="search" placeholder="${ph}" autocomplete="off"></label>`;
const sel = (id, label, list) => `<label class="a2-sel"><select id="${id}" aria-label="${label}">${list.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join("")}</select></label>`;
const pillFor = (s) => { const k = String(s).toLowerCase(); return `<span class="pill ${/pending|review|open|invited/.test(k) ? "warn" : /flag|reject|suspend|urgent|high/.test(k) ? "bad" : /archiv|resolved|inactive/.test(k) ? "mute" : ""}">${esc(s)}</span>`; };
const listingState = (l) => (l.archived ? "Archived" : /pending|flag/i.test(l.status || "") ? "Pending Review" : "Active");

// ---------- Listings ----------
export function listings(ctx, ls) {
  const tabs = [["all", "All"], ["Pending Review", "Pending"], ["Active", "Active"], ["Archived", "Archived"]];
  const count = (k) => (k === "all" ? ls.length : ls.filter((l) => listingState(l) === k).length);
  const html = `<div class="page-head"><div><h1>Manage listings</h1><p>Review, approve and manage all listings on Faxton Rentals.</p></div><button class="btn primary" id="addl">${icon("plus", 18)} Add listing</button></div>
  <div class="a2-bar">${searchBox("lq", "Search listings, areas or agents...")}${sel("lc", "City", [["", "All cities"], ...[...new Set(ls.map((l) => l.city).filter(Boolean))].map((c) => [c, c])])}${sel("lt", "Type", [["", "All types"], ["Apartment", "Apartment"], ["House", "House"], ["Studio", "Studio"]])}</div>
  <div class="a2-tabs" role="tablist">${tabs.map(([k, l], i) => `<button role="tab" class="${i ? "" : "on"}" data-tab="${esc(k)}">${l} <b>${count(k)}</b></button>`).join("")}</div>
  <div class="a2-split"><div class="panel a2-list"><div class="tbl-wrap"><table><thead><tr><th>Property</th><th>Agent</th><th>Price</th><th>Status</th><th>Submitted</th></tr></thead><tbody id="lrows"></tbody></table></div></div><aside class="panel a2-side" id="lside"></aside></div>`;
  return { html, mount(root) {
    let tab = "all", cur = ls.find((l) => listingState(l) === "Pending Review")?.id || ls[0]?.id;
    const filtered = () => { const q = $("#lq", root).value.trim().toLowerCase(), c = $("#lc", root).value, t = $("#lt", root).value;
      return ls.filter((l) => (tab === "all" || listingState(l) === tab) && (!c || l.city === c) && (!t || l.type === t) && (!q || `${l.title} ${l.area} ${l.city} ${l.agent?.name || ""}`.toLowerCase().includes(q))); };
    const paint = () => { const rows = filtered(); if (rows.length && !rows.some((l) => l.id === cur)) cur = rows[0].id;
      $("#lrows", root).innerHTML = rows.map((l) => `<tr class="${l.id === cur ? "sel" : ""}" data-l="${esc(l.id)}" tabindex="0"><td><div class="cell"><img class="th" src="${esc(l.thumb || l.images?.[0] || "img/palm-court.webp")}" alt=""><div><b>${esc(l.title)}</b><small>${esc(l.area)}, ${esc(l.city)}</small></div></div></td><td>${esc(l.agent?.name || "—")}</td><td>${naira(l.price)}<small class="muted" style="display:block">/ year</small></td><td>${pillFor(listingState(l))}</td><td>${rel(l.createdAt)}</td></tr>`).join("") || `<tr><td colspan="5" class="muted">No listings match.</td></tr>`;
      $$("tr[data-l]", root).forEach((r) => { const go = () => { cur = r.dataset.l; paint(); }; r.onclick = go; r.onkeydown = (e) => { if (e.key === "Enter") go(); }; });
      side(); };
    const side = () => { const l = ls.find((x) => x.id === cur), el = $("#lside", root);
      if (!l) { el.innerHTML = `<div class="empty"><h3>No listing selected</h3><p>Select a listing to review it here.</p></div>`; return; }
      const st0 = listingState(l);
      el.innerHTML = `<h3>Review listing</h3><img class="a2-hero" src="${esc(l.images?.[0] || l.thumb || "img/palm-court.webp")}" alt=""><h4>${esc(l.title)}</h4><p class="muted">${esc(l.area)}, ${esc(l.city)}</p>${pillFor(st0)}
      <dl class="a2-dl"><div><dt>Agent</dt><dd>${esc(l.agent?.name || "—")}</dd></div><div><dt>Type</dt><dd>${esc(l.type || "—")}</dd></div><div><dt>Rent</dt><dd>${naira(l.price)} / year</dd></div><div><dt>Bedrooms</dt><dd>${l.beds === 0 ? "Studio" : l.beds ?? "—"}</dd></div><div><dt>Size</dt><dd>${l.sqm ? l.sqm + " sqm" : "—"}</dd></div></dl>
      <p class="a2-desc">${esc(l.desc || "")}</p>
      <div class="a2-act"><button class="btn" id="media">${icon("img", 18)} Photos &amp; videos</button></div>
      <div class="a2-act">${st0 === "Active" ? `<button class="btn" data-do="archive">Archive listing</button>` : st0 === "Archived" ? `<button class="btn primary" data-do="restore">Restore listing</button>` : `<button class="btn primary" data-do="approve">Approve listing</button><button class="btn" data-do="changes">Request changes</button>`}</div>`;
      $("#media", el).onclick = () => { const m = modal(`<h2>Photos &amp; videos</h2><form id="mf" class="a2-form"><div class="field"><label>Photo links (one per line, first is the cover)</label><textarea name="im" rows="5" placeholder="https://…">${esc((l.images || []).join("\n"))}</textarea></div><div class="field"><label>Video links (one per line: YouTube, Vimeo or a direct .mp4)</label><textarea name="vd" rows="3" placeholder="https://www.youtube.com/watch?v=…">${esc((l.videos || []).join("\n"))}</textarea></div><p class="err" id="me" role="alert"></p><div class="a2-act"><button class="btn primary" type="submit">Save</button></div></form>`);
        $("#mf", m.el).onsubmit = async (e) => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)), lines = (t) => String(t || "").split("\n").map((x) => x.trim()).filter(Boolean);
          const im = lines(f.im), vd = lines(f.vd);
          if (!im.length) return ($("#me", m.el).textContent = "Add at least one photo.");
          if (im.some((u) => !/^(https:\/\/|img\/)/.test(u)) || vd.some((u) => !/^https:\/\//.test(u))) return ($("#me", m.el).textContent = "Links must start with https://");
          try { await st.patch("listings", l.id, { images: im.slice(0, 20), thumb: im[0], videos: vd.slice(0, 6) }); l.images = im; l.thumb = im[0]; l.videos = vd; m.close(); toast("Media saved."); paint(); } catch (er) { toast(friendlyErr(er)); } }; };
      $$("[data-do]", el).forEach((b) => (b.onclick = async () => { b.disabled = true; const a = b.dataset.do;
        try { if (a === "approve" || a === "restore") await st.patch("listings", l.id, { status: "active", archived: false }); else if (a === "archive") await st.patch("listings", l.id, { archived: true }); else await st.patch("listings", l.id, { status: "flagged" });
          toast(a === "approve" ? "Listing approved." : a === "changes" ? "Changes requested." : "Listing updated."); ctx.render(); } catch (e) { toast(friendlyErr(e)); b.disabled = false; } })); };
    $$("[data-tab]", root).forEach((b) => (b.onclick = () => { tab = b.dataset.tab; $$("[data-tab]", root).forEach((x) => x.classList.toggle("on", x === b)); paint(); }));
    ["lq", "lc", "lt"].forEach((id) => ($("#" + id, root).oninput = paint));
    $("#addl", root).onclick = () => { const m = modal(`<h2>Add listing</h2><form id="nl" class="a2-form"><div class="field"><label>Title</label><input name="title" required maxlength="80"></div><div class="f2"><div class="field"><label>Area</label><input name="area" required maxlength="60"></div><div class="field"><label>City</label><input name="city" value="Lagos" required maxlength="40"></div><div class="field"><label>Yearly rent (₦)</label><input name="price" type="number" min="0" required></div><div class="field"><label>Bedrooms</label><input name="beds" type="number" min="0" max="20" value="2" required></div></div><div class="field"><label>Description</label><textarea name="desc" rows="3" maxlength="800"></textarea></div><div class="field"><label>Photo links (optional, one per line)</label><textarea name="im" rows="2" placeholder="https://…"></textarea></div><div class="field"><label>Video links (optional: YouTube, Vimeo or .mp4)</label><textarea name="vd" rows="2" placeholder="https://…"></textarea></div><div class="a2-act"><button class="btn primary" type="submit">Create listing</button></div></form>`);
      $("#nl", m.el).onsubmit = async (e) => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)); const lines = (t) => String(t || "").split("\n").map((x) => x.trim()).filter((x) => /^https:\/\//.test(x)), imgs = lines(f.im).slice(0, 20), vids = lines(f.vd).slice(0, 6); if (!imgs.length) imgs.push("img/palm-court.webp"); const id = f.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) + "-" + Date.now().toString(36).slice(-4);
        try { await st.createListing({ id, title: f.title.trim(), area: f.area.trim(), city: f.city.trim(), price: +f.price, beds: +f.beds, baths: Math.max(1, +f.beds), sqm: 0, type: +f.beds === 0 ? "Studio" : "Apartment", desc: f.desc.trim(), status: "active", service: 0, deposit: 0, lat: 6.45, lng: 3.47, images: imgs, thumb: imgs[0], videos: vids, amenities: [], agent: { id: "daniel", name: "Daniel Okafor", avatar: "img/av-daniel.webp", photo: "img/agent-daniel.webp" } }); m.close(); toast("Listing created."); ctx.render(); } catch (er) { toast(friendlyErr(er)); } }; };
    paint(); } };
}

// ---------- Users & agents ----------
export function users(ctx, us) {
  const me = ctx.S.user.uid, owner = ctx.S.ownerUid, canManage = ctx.S.isOwner;
  const ROLES = [["renter", "Renter"], ["agent", "Agent"], ["landlord", "Property owner"], ["agency", "Agency"], ["support", "Support"], ["admin", "Admin"]];
  const roleOf = (u) => (u.id === owner ? "Owner" : u.role === "owner" || u.role === "admin" ? "Admin" : ROLES.find(([v]) => v === u.role)?.[1] || "Renter");
  const html = `<div class="page-head"><div><h1>Users &amp; agents</h1><p>${canManage ? "As the owner you can set each person’s role (renter, agent, property owner, agency, support or admin) and transfer ownership." : "Only the owner can change roles."}</p></div><button class="btn primary" id="inv">${icon("plus", 18)} Invite user</button></div>
  <div class="a2-bar">${searchBox("uq", "Search users by name or email...")}${sel("ur", "Role", [["", "All roles"], ["Owner", "Owner"], ["Admin", "Admin"], ["Agent", "Agent"], ["Renter", "Renter"]])}</div>
  <div class="a2-split"><div class="panel a2-list u"><div class="tbl-wrap"><table><thead><tr><th>User</th><th>Role</th><th>Status</th><th>Joined</th></tr></thead><tbody id="urows"></tbody></table></div></div><aside class="panel a2-side" id="uside"></aside></div>`;
  return { html, mount(root) {
    let cur = us.find((u) => u.id === me)?.id || us[0]?.id;
    const filtered = () => { const q = $("#uq", root).value.trim().toLowerCase(), r = $("#ur", root).value; return us.filter((u) => (!r || roleOf(u) === r) && (!q || `${u.name || ""} ${u.email || ""}`.toLowerCase().includes(q))); };
    const paint = () => { const rows = filtered(); if (rows.length && !rows.some((u) => u.id === cur)) cur = rows[0].id;
      $("#urows", root).innerHTML = rows.map((u) => `<tr class="${u.id === cur ? "sel" : ""}" data-u="${esc(u.id)}" tabindex="0"><td><div class="cell"><span class="avatar a2-av">${esc(initials(u.name || u.email))}</span><div><b>${esc(u.name || "—")}${u.id === me ? " (you)" : ""}</b><small>${esc(u.email)}</small></div></div></td><td>${pillFor(roleOf(u))}</td><td>${pillFor(u.banned ? "Banned" : "Active")}</td><td>${u.createdAt?.seconds ? new Date(u.createdAt.seconds * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"}</td></tr>`).join("") || `<tr><td colspan="4" class="muted">No users match.</td></tr>`;
      $$("tr[data-u]", root).forEach((r) => { const go = () => { cur = r.dataset.u; paint(); }; r.onclick = go; r.onkeydown = (e) => { if (e.key === "Enter") go(); }; }); side(); };
    const side = () => { const u = us.find((x) => x.id === cur), el = $("#uside", root); if (!u) { el.innerHTML = `<div class="empty"><h3>No user selected</h3></div>`; return; }
      const r = roleOf(u), mine = u.id === me;
      el.innerHTML = `<h3>Profile</h3><div class="a2-prof"><span class="avatar a2-av big">${esc(initials(u.name || u.email))}</span><h4>${esc(u.name || "—")}</h4><p class="muted">${esc(u.email)}</p>${pillFor(r)}</div>
      <dl class="a2-dl"><div><dt>Phone</dt><dd>${esc(u.phone || "—")}</dd></div><div><dt>Location</dt><dd>${esc(u.location || "—")}</dd></div><div><dt>Saved homes</dt><dd>${(u.saved || []).length}</dd></div></dl>
      ${canManage && r !== "Owner" ? `<div class="field"><label for="rsel">Role</label><select id="rsel">${ROLES.map(([v, l]) => `<option value="${v}" ${l === r ? "selected" : ""}>${l}</option>`).join("")}</select></div><div class="a2-act"><button class="btn" id="xfer">Transfer ownership</button></div>` : `<p class="muted">${r === "Owner" ? "The owner account can’t be changed here." : "Only the owner can change roles."}</p>`}
      ${ctx.S.isAdmin && r !== "Owner" && !mine && (canManage || r !== "Admin") ? `<div class="a2-act"><button class="btn ${u.banned ? "" : "danger"}" id="banBtn">${u.banned ? "Unban this user" : "Ban this user"}</button></div>${u.banned ? `<p class="muted">Banned users are signed out and can’t sign back in.</p>` : ""}` : ""}`;
      const bb = $("#banBtn", el); if (bb) bb.onclick = async () => { const on = !u.banned; if (on && !confirm(`Ban ${u.name || u.email}? They will be signed out and can’t sign back in until you unban them.`)) return; try { await st.setBanned(u.id, on); u.banned = on; toast(on ? "User banned." : "User unbanned."); paint(); } catch (e) { toast(friendlyErr(e)); } };
      const rs = $("#rsel", el); if (rs) rs.onchange = async () => { try { await st.setRole(u.id, rs.value); u.role = rs.value; toast("Role updated."); paint(); } catch (e) { toast(friendlyErr(e)); } };
      const xf = $("#xfer", el); if (xf) xf.onclick = () => { const m = modal(`<h2>Transfer ownership</h2><p class="muted" style="margin-bottom:14px">${esc(u.name || u.email)} will become the owner of Faxton Rentals and you will become an admin. Only they will be able to change roles or transfer ownership again.</p><form id="tf"><div class="field"><label for="tc">Type <b>${esc(u.email)}</b> to confirm</label><input id="tc" autocomplete="off"><p class="err" id="te"></p></div><div class="a2-act"><button class="btn primary" type="submit">Transfer ownership</button></div></form>`);
        $("#tf", m.el).onsubmit = async (e) => { e.preventDefault(); if ($("#tc", m.el).value.trim().toLowerCase() !== String(u.email).toLowerCase()) return ($("#te", m.el).textContent = "Email doesn’t match."); try { await st.transferOwnership(me, u.id); m.close(); toast("Ownership transferred."); await ctx.refreshUser?.(); ctx.render(); } catch (er) { toast(friendlyErr(er)); } }; }; };
    ["uq", "ur"].forEach((id) => ($("#" + id, root).oninput = paint));
    $("#inv", root).onclick = () => { const link = location.origin + "/#/signup"; const m = modal(`<h2>Invite user</h2><p class="muted" style="margin-bottom:14px">Share this link. Once they sign up you can promote them to agent or admin from this page.</p><div class="field"><input readonly value="${esc(link)}" id="il"></div><div class="a2-act"><button class="btn primary" id="cp">Copy link</button></div>`);
      $("#cp", m.el).onclick = async () => { try { await navigator.clipboard.writeText(link); toast("Link copied."); } catch { $("#il", m.el).select(); } }; };
    paint(); } };
}

// ---------- Support inbox ----------
export function support(ctx, tks) {
  const by = [...tks].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  const group = (t) => (/resolved|closed/i.test(t.status) ? "Resolved" : /progress/i.test(t.status) ? "In progress" : "Open");
  const html = `<div class="page-head"><div><h1>Support inbox</h1><p>Manage and respond to renter and agent support requests.</p></div></div>
  <div class="a2-tabs" role="tablist">${["Open", "In progress", "Resolved"].map((k, i) => `<button role="tab" class="${i ? "" : "on"}" data-tab="${k}">${k} <b>${by.filter((t) => group(t) === k).length}</b></button>`).join("")}</div>
  <div class="a2-three"><div class="panel a2-tix" id="tlist"></div><section class="panel a2-thread" id="tthread"></section><aside class="panel a2-side" id="tdet"></aside></div>`;
  return { html, mount(root) {
    let tab = "Open", cur = by.find((t) => group(t) === "Open")?.id || by[0]?.id, note = false;
    const paint = () => { const rows = by.filter((t) => group(t) === tab); if (rows.length && !rows.some((t) => t.id === cur)) cur = rows[0].id;
      $("#tlist", root).innerHTML = rows.map((t) => `<button class="a2-t ${t.id === cur ? "on" : ""}" data-t="${esc(t.id)}"><span class="avatar a2-av">${esc(initials(t.name || "?"))}</span><span class="tx"><b>${esc(t.subject)}</b><small>${esc(t.name || "")}</small><em>${esc(String(t.message || "").slice(0, 70))}</em></span><span class="tm">${rel(t.createdAt)}</span></button>`).join("") || `<p class="muted pad">No ${tab.toLowerCase()} tickets.</p>`;
      $$("[data-t]", root).forEach((b) => (b.onclick = () => { cur = b.dataset.t; paint(); })); thread(); };
    const thread = () => { const t = by.find((x) => x.id === cur), th = $("#tthread", root), dt = $("#tdet", root);
      if (!t) { th.innerHTML = `<div class="empty"><h3>No ticket selected</h3><p>Select a ticket to read the conversation.</p></div>`; dt.innerHTML = ""; return; }
      const reps = t.replies || [];
      th.innerHTML = `<header><h3>${esc(t.subject)}</h3><small class="muted">#${esc(t.ref || "")} · ${rel(t.createdAt)}</small></header><div class="a2-msgs"><div class="m in"><span class="avatar a2-av">${esc(initials(t.name || "?"))}</span><div><b>${esc(t.name || "")}</b><p>${esc(t.message)}</p></div></div>${reps.map((r) => `<div class="m ${r.internal ? "note" : "out"}"><div><b>${esc(r.by || "Support")}${r.internal ? " · internal note" : ""}</b><p>${esc(r.text)}</p></div></div>`).join("")}</div>
      <form id="rf" class="a2-reply"><div class="a2-rt"><button type="button" class="${note ? "" : "on"}" data-m="reply">Reply</button><button type="button" class="${note ? "on" : ""}" data-m="note">Internal note</button></div><textarea id="rt" rows="3" maxlength="1500" placeholder="${note ? "Add a private note for your team..." : "Write your reply..."}" required></textarea><div class="a2-act"><button class="btn primary" type="submit">${note ? "Add note" : "Send reply"}</button></div></form>`;
      $$("[data-m]", th).forEach((b) => (b.onclick = () => { note = b.dataset.m === "note"; thread(); }));
      $("#rf", th).onsubmit = async (e) => { e.preventDefault(); const text = $("#rt", th).value.trim(); if (!text) return; const next = [...reps, { by: ctx.S.user.displayName || "Support", text, internal: note, at: Date.now() }];
        try { await st.patch("tickets", t.id, { replies: next, ...(note || /progress/i.test(t.status) ? {} : { status: "In progress" }) }); t.replies = next; if (!note && group(t) === "Open") t.status = "In progress"; toast(note ? "Note added." : "Reply saved."); tab = group(t); $$("[data-tab]", root).forEach((x) => x.classList.toggle("on", x.dataset.tab === tab)); paint(); } catch (er) { toast(friendlyErr(er)); } };
      dt.innerHTML = `<h3>Ticket details</h3><div class="field"><label for="ts">Status</label><select id="ts">${["Open", "In progress", "Resolved"].map((s) => `<option ${group(t) === s ? "selected" : ""}>${s}</option>`).join("")}</select></div><div class="field"><label for="tp">Priority</label><select id="tp">${["Low", "Medium", "High"].map((s) => `<option ${(t.priority || "Medium") === s ? "selected" : ""}>${s}</option>`).join("")}</select></div><div class="field"><label for="ta">Assignee</label><select id="ta"><option value="">Unassigned</option><option value="${esc(ctx.S.user.displayName || ctx.S.user.email)}" ${t.assignee ? "selected" : ""}>${esc(ctx.S.user.displayName || ctx.S.user.email)} (me)</option></select></div>
      <dl class="a2-dl"><div><dt>From</dt><dd>${esc(t.name || "—")}</dd></div><div><dt>Reference</dt><dd>#${esc(t.ref || "")}</dd></div></dl><div class="a2-act"><button class="btn primary" id="res">${group(t) === "Resolved" ? "Reopen ticket" : "Mark as resolved"}</button></div>`;
      const save = async (p, msg) => { try { await st.patch("tickets", t.id, p); Object.assign(t, p); toast(msg); paint(); } catch (er) { toast(friendlyErr(er)); } };
      $("#ts", dt).onchange = (e) => save({ status: e.target.value }, "Status updated.");
      $("#tp", dt).onchange = (e) => save({ priority: e.target.value }, "Priority updated.");
      $("#ta", dt).onchange = (e) => save({ assignee: e.target.value }, "Assignee updated.");
      $("#res", dt).onclick = () => save({ status: group(t) === "Resolved" ? "Open" : "Resolved" }, group(t) === "Resolved" ? "Ticket reopened." : "Ticket resolved."); };
    $$("[data-tab]", root).forEach((b) => (b.onclick = () => { tab = b.dataset.tab; $$("[data-tab]", root).forEach((x) => x.classList.toggle("on", x === b)); paint(); }));
    paint(); } };
}
