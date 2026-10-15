// Console pages for the owner and admins: review queue, listings, users, verifications, applications and viewings.
// The overview, payments, support inbox, suggestions, reports, call setup and the staff portals live in dash.js.
import * as CALLS from "./calls.js";
import { friendlyErr } from "./ui.js";
import * as st from "./store.js";
import * as VS from "./viewsafe.js";
import * as SVC from "./services.js";
import * as AX from "./ax.js";
import { createList } from "./ax-list.js";
import { emailPending } from "./gate.js";

const { $, $$, esc, I, btn, chipFor, chip, avatar, thumb, fmt, toast, dialog, confirm, reason, typed, menu, drawer, data, empty, tabs, mountTabs, dl, section, timeline, setQ, hq, changed, copy, pageView, csv, bulkRun, bulkRun: _b } = AX;
const fe = (e) => friendlyErr(e).replace(/\s*\([^)]*\)\s*$/, "");
const bad = (e) => toast(fe(e), { tone: "bad" });
const meName = (ctx) => ctx.S.profile?.name || ctx.S.user.displayName || ctx.S.user.email || "Admin";
const DEF = { archived: false, changeNote: "", status: "pending" };
const lines = (t) => String(t || "").split("\n").map((x) => x.trim()).filter(Boolean);
const naira = fmt.naira;

// Write a change, keep the previous values in memory and offer Undo.
async function write(col, row, patch, { msg, after, undo = true }) {
  const prev = Object.fromEntries(Object.keys(patch).map((k) => [k, row[k] ?? DEF[k] ?? null]));
  await st.patch(col, row.id, patch); Object.assign(row, patch); changed(); after?.();
  toast(msg, undo ? { action: "Undo", onAction: async () => { try { await st.patch(col, row.id, prev); Object.assign(row, prev); changed(); after?.(); } catch (e) { bad(e); } } } : {});
}
const notify = (uid, n) => (uid ? st.notify(uid, n).catch(() => {}) : null);
const busy = (b, on) => { if (!b) return; b.classList.toggle("is-busy", on); b.disabled = on; };

export function notFound(ctx) {
  return { title: "Page not found", ...AX.staffFlags(ctx), html: `${AX.pageHead({ eyebrow: "Console", title: "Page not found" })}<div class="ax-card" style="margin-top:8px">${empty({ icon: "search", title: "Nothing here", hint: "That page does not exist or moved.", action: btn("Go to Overview", { v: "primary", href: "#/admin" }) })}</div>` };
}
export async function route(ctx, sub) {
  const D = () => import("./dash.js");
  switch (sub) {
    case "": return (await D()).overview(ctx);
    case "queue": return queue(ctx);
    case "listings": return listings(ctx);
    case "users": return (await import("./ax-sections.js")).usersPage(ctx);
    case "agents": return (await import("./ax-sections.js")).agents(ctx);
    case "team": return (await import("./ax-sections.js")).team(ctx);
    case "feedback": return (await import("./ax-sections.js")).feedback(ctx);
    case "verifications": return verifications(ctx);
    case "applications": return applications(ctx);
    case "viewings": return viewings(ctx);
    case "services": return serviceRequests(ctx);
    case "payments": return (await D()).payments(ctx);
    case "support": return (await import("./ax-sections.js")).ticketCenter(ctx);
    case "suggestions": return (await D()).suggestions(ctx);
    case "user-reports": return (await D()).userReports(ctx);
    case "reports": return (await D()).reports(ctx);
    case "calls": return (await D()).callsRedirect(ctx);
    default: return notFound(ctx);
  }
}

// ---------- shared status helpers ----------
export const listingState = (l) => (l.archived ? "archived" : l.status === "rejected" ? "rejected" : /flag/i.test(l.status || "") ? "flagged" : /pending/i.test(l.status || "") ? "pending" : "active");
export const isPendingL = (l) => ["pending", "flagged"].includes(listingState(l));
const thumbOf = (l) => l.thumb || l.images?.[0] || "";
const where = (l) => [l.area, l.city].filter(Boolean).join(", ");
export const roleOf = (ctx, u) => (u.id === ctx.S.ownerUid ? "owner" : u.role === "owner" ? "admin" : u.role || "renter");
export const ROLE_LABEL = { owner: "Owner", admin: "Admin", support: "Support", agency: "Agency", agent: "Agent", landlord: "Property owner", renter: "Renter" };
export { emailPending };
export const userVerified = (u) => u.verified === true || u.verification?.status === "verified";

// ---------- listings ----------
const REJ_PRESETS = ["Photos too dark", "Missing details", "Price looks wrong"];
function mediaDialog(l, done) {
  const d = dialog({ title: "Photos and videos", size: "md", icon: "img", body: `<form id="mf"><label class="ax-lbl" for="mfi">Photo links (one per line, the first is the cover)</label><textarea id="mfi" class="ax-input" rows="5" placeholder="https://…">${esc((l.images || []).join("\n"))}</textarea><label class="ax-lbl" for="mfv" style="margin-top:12px">Video links (YouTube, Vimeo or a direct .mp4)</label><textarea id="mfv" class="ax-input" rows="3" placeholder="https://www.youtube.com/watch?v=…">${esc((l.videos || []).join("\n"))}</textarea><p class="ax-err" id="mfe" role="alert"></p></form>`, footer: `${btn("Cancel", { attrs: "data-x" })}${btn("Save", { v: "primary", attrs: "data-ok" })}` });
  $("[data-ok]", d.el).onclick = async (e) => {
    const im = lines($("#mfi", d.el).value), vd = lines($("#mfv", d.el).value), err = $("#mfe", d.el); err.textContent = "";
    if (!im.length) return (err.textContent = "Add at least one photo link.");
    if (im.length > 20 || vd.length > 6) return (err.textContent = "Use up to 20 photos and 6 videos.");
    if (im.some((u) => !/^(https:\/\/|img\/)/.test(u)) || vd.some((u) => !/^https:\/\//.test(u))) return (err.textContent = "Links must start with https://");
    busy(e.currentTarget, true);
    try { await st.patch("listings", l.id, { images: im, thumb: im[0], videos: vd }); Object.assign(l, { images: im, thumb: im[0], videos: vd }); d.close(); toast("Photos and videos saved."); done?.(); } catch (x) { err.textContent = fe(x); busy(e.currentTarget, false); }
  };
}
async function loadUsers() { return data.safe("users"); }
async function addListingDialog(ctx, ls, list) {
  const users = await loadUsers(), me = ctx.S.user.uid;
  const agents = users.filter((u) => ["agent", "agency", "landlord"].includes(u.role) || u.id === me).sort((a, b) => (a.id === me ? -1 : b.id === me ? 1 : String(a.name).localeCompare(String(b.name))));
  const d = dialog({ title: "Add listing", size: "md", icon: "clipList", body: `<form id="nl" class="ax-form" novalidate>
    <label class="ax-field full"><span>Title</span><input class="ax-input" name="title" required maxlength="80" placeholder="3 Bedroom Apartment"></label>
    <label class="ax-field"><span>Area</span><input class="ax-input" name="area" required maxlength="60" placeholder="Lekki Phase 1"></label>
    <label class="ax-field"><span>City</span><input class="ax-input" name="city" value="Lagos" required maxlength="40"></label>
    <label class="ax-field"><span>Yearly rent (₦)</span><input class="ax-input" name="price" type="number" min="0" inputmode="numeric" required></label>
    <label class="ax-field"><span>Type</span><select class="ax-input" name="type"><option>Apartment</option><option>House</option><option>Duplex</option><option>Studio</option><option>Shortlet</option></select></label>
    <label class="ax-field"><span>Bedrooms</span><input class="ax-input" name="beds" type="number" min="0" max="20" value="2" required></label>
    <label class="ax-field"><span>Bathrooms</span><input class="ax-input" name="baths" type="number" min="1" max="20" value="2" required></label>
    <label class="ax-field full"><span>Listed by</span><select class="ax-input" name="agent">${agents.map((u) => `<option value="${esc(u.id)}" ${u.id === me ? "selected" : ""}>${esc(u.name || u.email)}${u.id === me ? " (me)" : ""} · ${esc(ROLE_LABEL[roleOf(ctx, u)] || "")}</option>`).join("") || `<option value="${esc(me)}">${esc(meName(ctx))} (me)</option>`}</select></label>
    <label class="ax-field full"><span>Description</span><textarea class="ax-input" name="desc" rows="3" maxlength="800"></textarea></label>
    <label class="ax-field full"><span>Photo links (one per line)</span><textarea class="ax-input" name="im" rows="2" placeholder="https://…"></textarea></label>
    <label class="ax-field full"><span>Video links (optional)</span><textarea class="ax-input" name="vd" rows="2" placeholder="https://…"></textarea></label>
    <p class="ax-err full" role="alert" id="nle"></p></form>`, footer: `${btn("Cancel", { attrs: "data-x" })}${btn("Create listing", { v: "primary", attrs: "data-ok" })}` });
  $("[data-ok]", d.el).onclick = async (e) => {
    const f = Object.fromEntries(new FormData($("#nl", d.el))), err = $("#nle", d.el); err.textContent = "";
    const im = lines(f.im), vd = lines(f.vd);
    if (!f.title.trim() || !f.area.trim() || !f.city.trim()) return (err.textContent = "Add a title, area and city.");
    if (!(+f.price > 0)) return (err.textContent = "Enter the yearly rent in naira.");
    if (im.length > 20 || vd.length > 6) return (err.textContent = "Use up to 20 photos and 6 videos.");
    if (im.some((u) => !/^https:\/\//.test(u)) || vd.some((u) => !/^https:\/\//.test(u))) return (err.textContent = "Photo and video links must start with https://");
    const u = users.find((x) => x.id === f.agent), self = !u || u.id === me, name = (u?.name || u?.email || meName(ctx)), photo = u?.photo || (self ? ctx.S.profile?.photo : "") || "";
    const id = f.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) + "-" + Date.now().toString(36).slice(-4);
    const doc = { id, title: f.title.trim(), area: f.area.trim(), city: f.city.trim(), price: +f.price, beds: +f.beds, baths: Math.max(1, +f.baths), sqm: 0, type: f.type, desc: f.desc.trim(), status: "active", service: 0, deposit: 0, lat: 6.45, lng: 3.47, images: im, thumb: im[0] || "", videos: vd, amenities: [], ...(self ? {} : { ownerUid: u.id }), agent: { id: self ? me : u.id, name, avatar: photo, photo } };
    busy(e.currentTarget, true);
    try { await st.createListing(doc); ls.unshift({ ...doc, createdAt: { seconds: Math.floor(Date.now() / 1000) } }); changed(); list.repaint(); d.close(); toast("Listing created."); } catch (x) { err.textContent = fe(x); busy(e.currentTarget, false); }
  };
}
function listingDrawer(ctx, l, api, { viewOnly } = {}) {
  const s = listingState(l), imgs = (l.images || []).filter(Boolean);
  const body = `${imgs[0] ? `<img class="ax-hero" src="${esc(imgs[0])}" alt="" loading="lazy">${imgs.length > 1 ? `<div class="ax-strip">${imgs.slice(1, 5).map((u) => `<img src="${esc(u)}" alt="" loading="lazy">`).join("")}</div>` : ""}` : `<div class="ax-hero" style="display:grid;place-items:center;color:var(--ax-faint)">${I("img", 32)}</div>`}
    <div style="margin-top:16px">${section("Summary", dl([["Agent", esc(l.agent?.name || "—")], ["Type", esc(l.type || "—")], ["Rent", l.price ? `${naira(l.price)} <span class="ax-muted">/ year</span>` : "—"], ["Bedrooms", l.beds === 0 ? "Studio" : fmt.num(l.beds)], ["Size", l.sqm ? l.sqm + " m²" : ""], ["Deposit", l.deposit ? naira(l.deposit) : ""], ["Service charge", l.service ? naira(l.service) : ""]]))}
    ${l.changeNote && /flag|reject/.test(s) ? section("Note sent to the owner", `<p class="ax-clamp" style="-webkit-line-clamp:6">${esc(l.changeNote)}</p>`) : ""}
    ${section("Description", l.desc ? `<p class="ax-clamp" data-clamp>${esc(l.desc)}</p>${l.desc.length > 220 ? `<button type="button" class="ax-link" data-more style="border:0;background:none;padding:4px 0;cursor:pointer">Show more</button>` : ""}` : `<span class="ax-muted">No description yet.</span>`)}
    ${section("Media", `<div style="display:flex;align-items:center;justify-content:space-between;gap:8px"><span>${imgs.length} photo${imgs.length === 1 ? "" : "s"}, ${(l.videos || []).length} video${(l.videos || []).length === 1 ? "" : "s"}</span>${btn("Photos and videos", { size: "sm", ic: "img", attrs: "data-media" })}</div>`)}
    ${section("Owner", `<div class="ax-id" data-owner>${avatar(l.agent?.name, l.ownerUid || l.agent?.id, 36, l.agent?.photo || l.agent?.avatar)}<div><b>${esc(l.agent?.name || "Faxton")}</b><small data-ownersub>${l.ownerUid ? "Property owner account" : "Added by the Faxton team"}</small></div></div>${l.ownerUid ? `<div style="display:flex;gap:8px;margin-top:10px">${btn("Text", { size: "sm", ic: "msg", attrs: "data-text" })}${btn("Call", { size: "sm", ic: "phone", attrs: "data-call" })}</div>` : ""}`)}
    ${section("History", timeline([{ title: "Submitted", meta: fmt.dateTime(l.createdAt) }, ...(s === "active" ? [{ title: "Live on Faxton", meta: "Approved" }] : []), ...(s === "flagged" ? [{ title: "Changes requested", text: l.changeNote || "", tone: "bad" }] : []), ...(s === "rejected" ? [{ title: "Rejected", text: l.changeNote || "", tone: "bad" }] : []), ...(s === "archived" ? [{ title: "Archived", tone: "mute" }] : [])]))}</div>`;
  const footer = viewOnly ? "" : s === "active" ? btn("Archive listing", { v: "outline", attrs: "data-do=archive" }) + (l.status === "active" ? btn("View live page", { v: "ghost", href: "#/home/" + encodeURIComponent(l.id) }) : "") : s === "archived" || s === "rejected" ? btn("Restore listing", { v: "primary", attrs: "data-do=restore" }) : btn("Approve listing", { v: "primary", attrs: "data-do=approve" }) + btn("Request changes", { attrs: "data-do=changes" }) + btn("Reject", { v: "danger", attrs: "data-do=reject" });
  return { title: l.title, sub: `${chipFor("listing", s)}<span>${esc(where(l))}</span>`, body, footer,
    mount(el) {
      $("[data-more]", el)?.addEventListener("click", (e) => { $("[data-clamp]", el).classList.remove("ax-clamp"); e.target.remove(); });
      $("[data-media]", el)?.addEventListener("click", () => mediaDialog(l, () => api.refresh()));
      $("[data-text]", el)?.addEventListener("click", () => data.safe("users").then((us) => { const u = us.find((x) => x.id === l.ownerUid); if (u) openChat(ctx, u); else toast("We couldn’t find that owner’s account.", { tone: "bad" }); }));
      $("[data-call]", el)?.addEventListener("click", () => CALLS.startCall(ctx, { to: l.ownerUid, toName: l.agent?.name || "Owner", kind: "voice", title: "Faxton team" }));
      el.querySelectorAll("[data-do]").forEach((b) => (b.onclick = () => listingAct(ctx, l, b.dataset.do, api, b)));
    } };
}
async function listingAct(ctx, l, act, api, b) {
  try {
    if (act === "approve") { busy(b, true); await write("listings", l, { status: "active", archived: false }, { msg: "Listing approved.", after: api.refresh }); notify(l.ownerUid, { kind: "info", title: "Your listing is live", body: `${l.title} has been approved and is now on Faxton Rentals.` }); }
    else if (act === "restore") await write("listings", l, { status: "active", archived: false }, { msg: "Listing restored.", after: api.refresh });
    else if (act === "archive") await write("listings", l, { archived: true }, { msg: "Listing archived.", after: api.refresh });
    else if (act === "changes" || act === "reject") {
      const rej = act === "reject", why = await reason({ title: rej ? "Reject this listing" : "Request changes", body: `${esc(l.title)}`, presets: REJ_PRESETS, confirmLabel: rej ? "Reject listing" : "Send request", tone: rej ? "bad" : "", helper: "This message is shown to the owner." });
      if (!why) return;
      await write("listings", l, { status: rej ? "rejected" : "flagged", changeNote: why }, { msg: rej ? "Listing rejected." : "Changes requested. The owner has been told.", after: api.refresh });
      notify(l.ownerUid, { kind: rej ? "rejected" : "info", title: rej ? "Listing not approved" : "Changes requested on your listing", body: `${l.title}: ${why}` });
    }
  } catch (e) { bad(e); } finally { busy(b, false); }
}
export function listings(ctx) {
  return pageView(ctx, { title: "Listings", eyebrow: "Marketplace", sub: "Review, approve and manage every listing on Faxton Rentals.", cols: ["listings"], what: "listings", actions: btn("Add listing", { v: "primary", ic: "plus", attrs: "data-act=add" }),
    async render({ listings: ls }, { root, body }) {
      return { html: `<div id="lst"></div>`, mount(el) {
        const list = createList($("#lst", el), { noun: "listings", label: "Listings", rows: ls, placeholder: "Search listings, areas or agents…",
          tabs: [{ k: "all", label: "All" }, { k: "pending", label: "Pending", test: isPendingL, tone: "" }, { k: "active", label: "Active", test: (l) => listingState(l) === "active" }, { k: "archived", label: "Archived", test: (l) => ["archived", "rejected"].includes(listingState(l)) }],
          defaultTab: (rows) => (rows.some(isPendingL) ? "pending" : "all"),
          sort: null, compare: (a, b) => (isPendingL(b) - isPendingL(a)) || (AX.ms(b.createdAt) - AX.ms(a.createdAt)),
          facets: [{ k: "city", label: "City", options: (r) => [["", "All cities"], ...[...new Set(r.map((l) => l.city).filter(Boolean))].sort().map((c) => [c, c])], test: (l, v) => l.city === v }, { k: "type", label: "Type", options: (r) => [["", "All types"], ...[...new Set(r.map((l) => l.type).filter(Boolean))].sort().map((c) => [c, c])], test: (l, v) => l.type === v }, { k: "agent", label: "Agent", options: (r) => [["", "All agents"], ...[...new Set(r.map((l) => l.agent?.name).filter(Boolean))].sort().map((c) => [c, c])], test: (l, v) => l.agent?.name === v }],
          search: (l) => `${l.title} ${l.area} ${l.city} ${l.agent?.name || ""} ${l.id}`,
          cols: [
            { k: "prop", label: "Property", role: "title", sort: (l) => String(l.title).toLowerCase(), cell: (l) => `<div class="ax-id">${thumb(thumbOf(l), 32)}<div><b>${esc(l.title)}</b><small>${esc(where(l))}</small></div></div>` },
            { k: "agent", label: "Agent", pri: 2, cell: (l) => `<div class="ax-id">${avatar(l.agent?.name, l.agent?.id, 28, l.agent?.photo || l.agent?.avatar)}<div><b style="font-weight:500;color:var(--ax-text)">${esc(l.agent?.name || "—")}</b></div></div>` },
            { k: "price", label: "Price", align: "right", sort: (l) => +l.price || 0, cell: (l) => (l.price ? `<span class="ax-money">${naira(l.price)} <small>/yr</small></span>` : "—") },
            { k: "status", label: "Status", role: "status", cell: (l) => chipFor("listing", listingState(l)) },
            { k: "created", label: "Submitted", pri: 2, sort: (l) => AX.ms(l.createdAt), cell: (l) => `<span title="${esc(fmt.dateTime(l.createdAt))}">${fmt.rel(l.createdAt)}</span>` },
          ],
          bulk: [
            { label: "Approve", icon: "check", run: (rs, c) => bulkListings(rs, c, "approve", ctx) }, { label: "Request changes", run: (rs, c) => bulkListings(rs, c, "changes", ctx) },
            { label: "Archive", run: (rs, c) => bulkListings(rs, c, "archive", ctx) }, { label: "Restore", run: (rs, c) => bulkListings(rs, c, "restore", ctx) },
            { label: "Export CSV", icon: "download", free: true, run: (rs) => csv("faxton-listings-selected", ["Title", "Area", "City", "Rent", "Status", "Agent"], rs.map((l) => [l.title, l.area, l.city, l.price, listingState(l), l.agent?.name || ""])) }],
          csv: { name: "faxton-listings", head: ["Title", "Area", "City", "Type", "Rent", "Status", "Agent", "Submitted"], row: (l) => [l.title, l.area, l.city, l.type, l.price, listingState(l), l.agent?.name || "", fmt.date(l.createdAt)] },
          quick: (l) => (isPendingL(l) ? `${btn("Approve", { v: "soft", size: "xs", cls: "ax-qa", attrs: "data-qa=approve" })}${btn("Review", { v: "ghost", size: "xs", cls: "ax-qa", attrs: "data-qa=review" })}` : ""),
          onQuick: (k, l, b, api) => (k === "review" ? api.list.open(l.id) : listingAct(ctx, l, k, { refresh: api.refresh }, b)),
          menu: (l, api) => { const s = listingState(l); return [{ label: "Review", icon: "eye", act: api.open }, ...(s === "active" && l.status === "active" ? [{ label: "View live page", icon: "ext", act: () => ctx.go("#/home/" + encodeURIComponent(l.id)) }] : []), { label: "Edit photos and videos", icon: "img", act: () => mediaDialog(l, api.refresh) }, { sep: 1 },
            ...(isPendingL(l) ? [{ label: "Approve", icon: "check", act: () => listingAct(ctx, l, "approve", api) }, { label: "Request changes", icon: "msg", act: () => listingAct(ctx, l, "changes", api) }] : []), s === "archived" || s === "rejected" ? { label: "Restore", icon: "refresh", act: () => listingAct(ctx, l, "restore", api) } : { label: "Archive", icon: "folder", act: () => listingAct(ctx, l, "archive", api) }, { sep: 1 }, { label: "Copy link", icon: "copy", act: () => copy(location.origin + "/#/home/" + l.id, "Link copied.") }]; },
          drawer: (l, api) => listingDrawer(ctx, l, api),
          onQuery: (q) => { if (q.new) { setQ({ new: "" }); add(); } },
          empty: { icon: "clipList", title: "No listings yet", hint: "Add the first listing, or wait for agents to submit.", action: btn("Add listing", { v: "primary", ic: "plus", attrs: "data-act=add2" }) } });
        const add = () => addListingDialog(ctx, ls, list);
        root.querySelector("[data-act=add]")?.addEventListener("click", add); el.addEventListener("click", (e) => e.target.closest("[data-act=add2]") && add());
        if (hq().q.new) { setQ({ new: "" }); add(); }
      } };
    } });
}
async function bulkListings(rs, c, act, ctx) {
  let why = "";
  if (act === "changes") { why = await reason({ title: `Request changes on ${rs.length} listing${rs.length === 1 ? "" : "s"}`, presets: REJ_PRESETS, confirmLabel: "Send request", helper: "One message goes to every owner." }); if (!why) return; }
  const label = { approve: "Approving", changes: "Requesting changes on", archive: "Archiving", restore: "Restoring" }[act], prev = new Map(rs.map((l) => [l.id, { status: l.status, archived: !!l.archived, changeNote: l.changeNote || "" }]));
  const patch = act === "approve" || act === "restore" ? { status: "active", archived: false } : act === "archive" ? { archived: true } : { status: "flagged", changeNote: why };
  const r = await bulkRun(rs.map((l) => l.id), async (id) => { const l = rs.find((x) => x.id === id); await st.patch("listings", id, patch); Object.assign(l, patch); if (act === "changes") notify(l.ownerUid, { kind: "info", title: "Changes requested on your listing", body: `${l.title}: ${why}` }); if (act === "approve") notify(l.ownerUid, { kind: "info", title: "Your listing is live", body: `${l.title} has been approved.` }); }, { label });
  changed(); c.clear();
  toast(r.bad ? `${r.ok.length} done, ${r.bad} failed. Try the failed ones again.` : `${r.ok.length} listing${r.ok.length === 1 ? "" : "s"} updated.`, { tone: r.bad ? "bad" : "", action: r.ok.length ? "Undo" : "", onAction: async () => { await Promise.allSettled(r.ok.map(async (id) => { const l = rs.find((x) => x.id === id), p = prev.get(id); await st.patch("listings", id, p); Object.assign(l, p); })); changed(); c.list.repaint(); } });
}

// ---------- users ----------
export function openChat(ctx, u) {
  const me = meName(ctx), photo = ctx.S.profile?.photo || ctx.S.user.photoURL || "";
  const d = dialog({ title: `Message ${u.name || u.email || "this user"}`, size: "sm", icon: "msg", body: `<p class="ax-p">Who should this message come from?</p><div style="display:grid;gap:10px"><button type="button" class="ax-btn" data-v="outline" data-as="faxton" style="height:56px;justify-content:flex-start;padding:0 14px"><img src="assets/mark.svg" alt="" width="28" height="24"><span style="display:grid;text-align:left;gap:2px"><b>Faxton support</b><small style="font-weight:400;color:var(--ax-muted)">They see it from the Faxton team</small></span></button>
    <button type="button" class="ax-btn" data-v="outline" data-as="me" style="height:56px;justify-content:flex-start;padding:0 14px">${avatar(me, ctx.S.user.uid, 28, photo)}<span style="display:grid;text-align:left;gap:2px"><b>${esc(me)}</b><small style="font-weight:400;color:var(--ax-muted)">They see it from you, by name</small></span></button></div>` });
  $$("[data-as]", d.el).forEach((b) => (b.onclick = async () => {
    const faxton = b.dataset.as === "faxton"; b.disabled = true; let cid;
    try { cid = faxton ? await st.ensureDirectConversation(ctx.S.user, u) : await st.ensureStaffPersonalConversation(ctx.S.user, { name: me, photo: ctx.S.profile?.photo || "" }, u); } catch (e) { b.disabled = false; return bad(e); }
    try { sessionStorage.setItem("msgMode", faxton ? "faxton" : "personal"); } catch {}
    d.close(); ctx.go("#/messages/" + cid);
  }));
}
export function inviteDialog(role = "") {
  const link = location.origin + "/#/signup", agent = role === "agent";
  const d = dialog({ title: agent ? "Add an agent" : "Invite a user", size: "sm", icon: "users", body: `<p class="ax-p">${agent ? "Share this link and ask them to sign up as an agent. Once they have, they appear under Agents and you can verify them." : "Share this link. Once they sign up you can set their role from this page."}</p><input class="ax-input" readonly value="${esc(link)}" aria-label="Sign-up link">`, footer: `${btn("Close", { attrs: "data-x" })}${btn("Copy link", { v: "primary", ic: "copy", attrs: "data-ok" })}` });
  $("[data-ok]", d.el).onclick = () => copy(link, "Link copied.");
}
export const canBan = (ctx, u) => ctx.S.isAdmin && u.id !== ctx.S.user.uid && roleOf(ctx, u) !== "owner" && (ctx.S.isOwner || roleOf(ctx, u) !== "admin");
export async function banAct(ctx, u, api) {
  const on = !u.banned;
  if (on && !(await confirm({ title: `Suspend ${u.name || u.email}?`, body: "They will be signed out and can’t sign back in until you lift the suspension.", confirmLabel: "Suspend", tone: "danger", icon: "alert" }))) return;
  try { await st.setBanned(u.id, on); u.banned = on; changed(); api.refresh(); toast(on ? "User suspended." : "Suspension lifted.", { action: "Undo", onAction: async () => { try { await st.setBanned(u.id, !on); u.banned = !on; changed(); api.refresh(); } catch (e) { bad(e); } } }); } catch (e) { bad(e); }
}
export async function transferAct(ctx, u, api) {
  if (!(await typed({ title: "Transfer ownership", body: `${esc(u.name || u.email)} will become the owner of Faxton Rentals and you will become an admin. Only they will be able to change roles or transfer ownership again.`, expect: u.email, confirmLabel: "Transfer ownership" }))) return;
  try { await st.transferOwnership(ctx.S.user.uid, u.id); data.invalidate(); toast("Ownership transferred."); await ctx.refreshUser?.(); } catch (e) { bad(e); }
}
export function userStatus(ctx, u) {
  if (u.banned) return chipFor("user", "banned", "Suspended");
  if (emailPending(u)) return chip("warn", "Pending · email not verified");
  const r = roleOf(ctx, u);
  if (["agent", "agency"].includes(r)) { const v = u.verification?.status; return v === "verified" || u.verified ? chip("ok", "Verified") : v === "pending" ? chip("warn", "Pending verification") : v === "rejected" ? chip("bad", "Not verified") : chip("mute", "Unverified"); }
  return chipFor("user", "active");
}
export function userDrawer(ctx, u, api) {
  const r = roleOf(ctx, u), mine = u.id === ctx.S.user.uid, ag = u.agency, gi = u.agentInfo, ban = canBan(ctx, u);
  const ROLES = [["renter", "Renter"], ["agent", "Agent"], ["landlord", "Property owner"], ["agency", "Agency"], ["support", "Support"], ["admin", "Admin"]];
  const body = `<div style="display:flex;gap:14px;align-items:center;margin-bottom:14px">${avatar(u.name || u.email, u.id, 56, u.photo)}<div style="min-width:0"><div style="font:700 18px/22px var(--font-display);color:var(--ax-head)">${esc(u.name || "—")}${mine ? ' <span class="ax-muted" style="font:400 13px var(--font-body)">(you)</span>' : ""}</div><div style="font-size:13px;color:var(--ax-muted);overflow-wrap:anywhere">${esc(u.email || "")}</div><div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">${chipFor("user", r)}${userStatus(ctx, u)}</div></div></div>
    ${mine ? "" : `<div style="display:flex;gap:8px;margin-bottom:6px;flex-wrap:wrap">${btn("Text", { v: "primary", size: "sm", ic: "msg", attrs: "data-text" })}${btn("Call", { size: "sm", ic: "phone", attrs: "data-call=voice" })}${btn("Video", { size: "sm", ic: "video", attrs: "data-call=video" })}</div>`}
    ${section("Details", dl([["Phone", esc(u.phone || ag?.phone || gi?.phone || "")], ["Residence", esc(u.location || [u.city, u.country].filter(Boolean).join(", "))], ["Joined", fmt.date(u.createdAt) === "—" ? "" : fmt.date(u.createdAt)], ["Last active", u.lastActive ? fmt.rel(u.lastActive) : ""], ["Sign-in", u.provider === "google" || /googleusercontent\.com/.test(u.photo || "") ? "Google" : "Email"], ["Saved homes", fmt.num((u.saved || []).length)], ...(ag ? [["Business", esc(ag.business)], ["Registrar", esc([ag.registrar, ag.position].filter(Boolean).join(" · "))], ["CAC number", esc(ag.cac)], ["Opened", esc(ag.opened)], ["Support email", esc(ag.supportEmail)], ["Office address", esc(ag.address)], ["Website", ag.website ? esc(ag.website) : ""]] : []), ...(gi ? [["Agency", esc(gi.company)], ["Licence", esc(gi.licence)], ["Experience", esc(gi.experience)], ["Areas", esc(gi.areas)]] : [])]))}
    ${u.verification ? section("Verification", dl([["Status", chipFor("verification", u.verification.status)], ["Reason", esc(u.verification.reason || "")]])) : ""}
    ${section("Role", r === "owner" ? `<p class="ax-muted">The owner account can’t be changed here.</p>` : ctx.S.isOwner && !mine ? `<select class="ax-input" data-role aria-label="Role">${ROLES.map(([v, l]) => `<option value="${v}" ${r === v ? "selected" : ""}>${l}</option>`).join("")}</select><p class="ax-help">Takes effect straight away.</p>` : `<p class="ax-muted">${mine ? "You can’t change your own role." : "Only the owner can change roles."}</p>`)}
    ${ban || (ctx.S.isOwner && !mine && r !== "owner") ? section("Danger zone", `<div style="display:flex;gap:8px;flex-wrap:wrap">${ban ? btn(u.banned ? "Lift suspension" : "Suspend this user", { v: u.banned ? "outline" : "danger", attrs: "data-ban" }) : ""}${ctx.S.isOwner && !mine && r !== "owner" ? btn("Transfer ownership", { v: "outline", attrs: "data-xfer" }) : ""}</div>${u.banned ? `<p class="ax-help">Suspended people are signed out and can’t sign back in until you lift it.</p>` : ""}`) : ""}`;
  return { title: u.name || u.email || "User", sub: `<span>${esc(ROLE_LABEL[r] || r)}</span>`, body,
    mount(el) {
      $("[data-text]", el)?.addEventListener("click", () => openChat(ctx, u));
      $$("[data-call]", el).forEach((b) => (b.onclick = () => CALLS.startCall(ctx, { to: u.id, toName: u.name || u.email, kind: b.dataset.call, title: "Faxton team" })));
      $("[data-ban]", el)?.addEventListener("click", () => banAct(ctx, u, api)); $("[data-xfer]", el)?.addEventListener("click", () => transferAct(ctx, u, api));
      const rs = $("[data-role]", el); if (rs) rs.onchange = async () => { const prev = u.role; try { await st.setRole(u.id, rs.value); u.role = rs.value; changed(); api.refresh(); toast("Role updated.", { action: "Undo", onAction: async () => { try { await st.setRole(u.id, prev || "renter"); u.role = prev; changed(); api.refresh(); } catch (e) { bad(e); } } }); } catch (e) { rs.value = prev || "renter"; bad(e); } };
    } };
}
// ---------- verifications ----------
const VF_PRESETS = ["Documents unclear", "Details do not match", "Not eligible"];
const VF_CHECK = ["Name matches the account", "Registration or licence number provided", "Contact details look genuine"];
export function verifications(ctx) {
  return pageView(ctx, { title: "Verifications", eyebrow: "Marketplace", sub: "Agencies and agents waiting to be verified, plus account deletion requests.", cols: ["users"], what: "verifications",
    async render({ users: us }, { body }) {
      let tab = hq().q.tab || "waiting";
      const want = () => us.filter((u) => u.verification), by = (s) => want().filter((u) => u.verification.status === s).sort((a, b) => (b.verification.requestedAt || 0) - (a.verification.requestedAt || 0));
      const dels = () => us.filter((u) => u.deletion?.status === "pending");
      const dob = (d) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "");
      const ago = (t) => { const m = Math.max(1, Math.round((Date.now() - (t || Date.now())) / 60000)); return m < 60 ? `${m} min ago` : m < 1440 ? `${Math.floor(m / 60)} h ago` : (Math.floor(m / 1440) === 1 ? "1 day ago" : `${Math.floor(m / 1440)} days ago`); };
      const nameOf = (id) => us.find((x) => x.id === id)?.name || "";
      const card = (u) => { const a = u.agency, g = u.agentInfo, v = u.verification, isA = v.kind === "agency", pend = v.status === "pending";
        return `<article class="ax-card ax-vc" data-uid="${esc(u.id)}"><div class="ax-vc-h">${avatar((isA ? a?.business : u.name) || u.name, u.id, 40, u.photo)}<div><b>${esc((isA ? a?.business : u.name) || u.name || "Unnamed")}</b><small>${isA ? "Agency" : "Agent"} · requested ${ago(v.requestedAt)}</small></div>${chipFor("verification", v.status)}</div>
          ${dl(isA ? [["Full name", esc(u.name)], ["Business name", esc(a?.business)], ["Registrar", esc(a?.registrar)], ["Role", esc(a?.position)], ["Opened", esc(a?.opened)], ["Registrar’s DOB", esc(dob(a?.dob))], ["CAC number", esc(a?.cac)], ["Support email", esc(a?.supportEmail)], ["Business phone", esc(a?.phone)], ["Office address", esc(a?.address)], ["Website", esc(a?.website)], ["Account email", esc(u.email)]] : [["Full name", esc(u.name)], ["Phone", esc(g?.phone)], ["Experience", esc(g?.experience)], ["Agency", esc(g?.company)], ["ID or licence no.", esc(g?.licence)], ["Areas covered", esc(g?.areas)], ["Account email", esc(u.email)]])}
          ${pend ? `<div class="ax-checks" role="group" aria-label="Checklist"><span class="ax-eyebrow">Checklist</span>${VF_CHECK.map((c, i) => `<label class="ax-check"><input type="checkbox" data-ck="${i}"><span>${esc(c)}</span></label>`).join("")}</div><div class="ax-vc-f">${btn("Verify", { v: "primary", ic: "check", attrs: "data-v=verified" })}${btn("Reject", { v: "danger", attrs: "data-v=rejected" })}</div>` : `<p class="ax-sub">${v.status === "verified" ? "Verified" : "Rejected"}${v.decidedAt ? " " + ago(v.decidedAt) : ""}${v.decidedBy && nameOf(v.decidedBy) ? " by " + esc(nameOf(v.decidedBy)) : ""}${v.reason ? ` · ${esc(v.reason)}` : ""}</p>`}</article>`; };
      const html = () => {
        const w = by("pending"), dn = [...by("verified"), ...by("rejected")].sort((a, b) => (b.verification.decidedAt || 0) - (a.verification.decidedAt || 0)).slice(0, 12), dd = dels();
        const tb = tabs([{ k: "waiting", label: "Waiting", count: w.length }, { k: "decided", label: "Decided", count: dn.length }, { k: "deletions", label: "Deletion requests", count: dd.length }], tab, { label: "Verifications" });
        const main = tab === "waiting" ? (w.length ? `<div class="ax-vgrid">${w.map(card).join("")}</div>` : `<div class="ax-card">${empty({ icon: "shield", title: "No one is waiting for verification.", hint: "New agency and agent requests appear here." })}</div>`)
          : tab === "decided" ? (dn.length ? `<div class="ax-vgrid">${dn.map(card).join("")}</div>` : `<div class="ax-card">${empty({ icon: "shield", title: "No decisions yet", hint: "Verified and rejected accounts are listed here." })}</div>`)
          : `<div class="ax-card ax-tablecard">${dd.length ? `<div class="ax-scroll"><table class="ax-table" aria-label="Deletion requests"><thead><tr><th>Person</th><th>Role</th><th>Requested</th><th class="al-right">Decision</th></tr></thead><tbody>${dd.map((u) => `<tr><td data-label="Person" data-role="title"><div class="ax-id">${avatar(u.name || u.email, u.id, 32, u.photo)}<div><b>${esc(u.name || "—")}</b><small>${esc(u.email || "")}</small></div></div></td><td data-label="Role">${esc(ROLE_LABEL[roleOf(ctx, u)] || "Renter")}</td><td data-label="Requested">${ago(u.deletion.requestedAt)}</td><td data-role="actions" class="al-right"><div class="ax-ra" style="justify-content:flex-end">${btn("Approve deletion", { v: "danger", size: "sm", attrs: `data-del=approved data-id="${esc(u.id)}"` })}${btn("Keep account", { size: "sm", attrs: `data-del=denied data-id="${esc(u.id)}"` })}</div></td></tr>`).join("")}</tbody></table></div>` : empty({ icon: "trash", title: "No deletion requests.", hint: "Requests from people who want their account removed appear here." })}</div>`;
        return `${tb}<div style="margin-top:16px" id="vfMain">${main}</div>`;
      };
      return { html: `<div id="vfRoot">${html()}</div>`, mount(el) {
        const root = $("#vfRoot", el), paint = () => { root.innerHTML = html(); mountTabs(root, (k) => { tab = k; setQ({ tab: k === "waiting" ? "" : k }); paint(); }); };
        mountTabs(root, (k) => { tab = k; setQ({ tab: k === "waiting" ? "" : k }); paint(); });
        root.addEventListener("click", async (e) => {
          const bv = e.target.closest("[data-v]"), bd = e.target.closest("[data-del]");
          if (bv) {
            const c = bv.closest("[data-uid]"), u = us.find((x) => x.id === c.dataset.uid), ok = bv.dataset.v === "verified", label = u.verification.kind === "agency" ? "agency" : "agent account";
            let why = ""; if (!ok) { why = await reason({ title: `Reject ${u.agency?.business || u.name || "this request"}`, presets: VF_PRESETS, confirmLabel: "Reject", tone: "bad", helper: "This message is shown to the person." }); if (!why) return; }
            busy(bv, true); const checklist = Object.fromEntries($$("[data-ck]", c).map((x) => [VF_CHECK[+x.dataset.ck], x.checked]));
            try { const nv = { ...u.verification, status: ok ? "verified" : "rejected", decidedAt: Date.now(), decidedBy: ctx.S.user.uid, ...(why ? { reason: why } : {}), ...(ok ? { checklist } : {}) }; await st.verifyUser(u.id, nv); u.verification = nv; u.verified = ok; changed();
              await st.notify(u.id, ok ? { kind: "verified", title: "You’re verified!", body: `Your ${label} has been verified. You can now start listing properties.` } : { kind: "rejected", title: "Verification not approved", body: why || "Please contact support." }).catch(() => {});
              toast(ok ? "Verified. They’ve been told." : "Rejected. They’ve been told."); paint(); } catch (x) { busy(bv, false); bad(x); }
          } else if (bd) {
            const u = us.find((x) => x.id === bd.dataset.id), ok = bd.dataset.del === "approved";
            if (ok && !(await confirm({ title: `Approve deleting ${u.name || u.email}?`, body: "Their account will be removed the next time it’s opened after the one-day review.", confirmLabel: "Approve deletion", tone: "danger", icon: "trash" }))) return;
            busy(bd, true);
            try { const nd = { ...u.deletion, status: bd.dataset.del, decidedAt: Date.now() }; await st.decideDeletion(u.id, nd); u.deletion = nd; changed(); await st.notify(u.id, { kind: "info", title: ok ? "Deletion approved" : "Account kept", body: ok ? "Your account will be removed after the one-day review period." : "We’ve kept your account as it is." }).catch(() => {}); toast(ok ? "Deletion approved." : "Account kept."); paint(); } catch (x) { busy(bd, false); bad(x); }
          }
        });
      } };
    } });
}

// ---------- applications ----------
const APP_STATUS = ["Under review", "Awaiting documents", "Approved", "Rejected"];
const appMonth = (a) => String(a.moveIn || "").slice(0, 7);
const monthLabel = (m) => (m ? new Date(m + "-01T00:00:00").toLocaleDateString("en-GB", { month: "long", year: "numeric" }) : "");
async function setApp(a, status, api) { try { await write("applications", a, { status }, { msg: `Marked ${status.toLowerCase()}.`, after: api.refresh }); } catch (e) { bad(e); } }
function appDrawer(ctx, a, api) {
  const idx = APP_STATUS.indexOf(a.status), steps = ["Submitted", "Under review", "Awaiting documents", "Decision"], cur = a.status === "Under review" ? 1 : a.status === "Awaiting documents" ? 2 : 3;
  const body = `<div class="ax-id" style="margin-bottom:14px">${avatar(a.name, a.uid, 44)}<div><b style="font-size:15px">${esc(a.name || "Applicant")}</b><small>${esc(a.email || "")}</small></div></div>
    <ol class="ax-steps" aria-label="Progress">${steps.map((s, i) => `<li class="${i < cur ? "done" : ""} ${i === cur ? "cur" : ""} ${i === 3 && a.status === "Rejected" ? "bad" : ""}"><i>${i < cur ? "✓" : i + 1}</i>${s}</li>`).join("")}</ol>
    <div style="margin-top:16px">${section("Property", `<a class="ax-id" href="#/home/${esc(encodeURIComponent(a.listingId || ""))}" style="padding:8px;border:1px solid var(--ax-border);border-radius:10px">${thumb(a.image, 44)}<div><b>${esc(a.title || "Property")}</b><small>${esc(a.area || "")}</small></div>${I("chevR", 16)}</a>`)}
    ${section("Amounts", dl([["Yearly rent", naira(a.rent)], ["Move-in total", naira(a.amount)], ["Move-in date", a.moveIn ? esc(fmt.date(a.moveIn)) : ""], ["Phone", esc(a.details?.phone || a.phone || "")]]))}
    ${section("Activity", timeline([{ title: "Application submitted", meta: fmt.dateTime(a.createdAt) }, { title: `Now: ${a.status}`, meta: "Current status", tone: a.status === "Rejected" ? "bad" : "" }]))}</div>`;
  const footer = `${btn("Approve", { v: "primary", ic: "check", attrs: "data-st=Approved" })}${btn("Request documents", { attrs: "data-st=Awaiting\\ documents" })}${btn("Reject", { v: "danger", attrs: "data-st=Rejected" })}`;
  return { title: a.name || "Application", sub: chipFor("application", a.status), body, footer,
    mount(el, b, f) { $$("[data-st]", f).forEach((x) => (x.onclick = async () => { const s = x.dataset.st.replace("\\ ", " "); if (s === a.status) return toast("Already " + s.toLowerCase() + "."); if (s === "Rejected" && !(await confirm({ title: `Reject ${a.name || "this application"}?`, body: "The renter will see the application as rejected.", confirmLabel: "Reject", tone: "danger" }))) return; setApp(a, s, api); })); } };
}
export function applications(ctx) {
  return pageView(ctx, { title: "Applications", eyebrow: "Activity", sub: "Every rental application, from first look to decision.", cols: ["applications"], what: "applications",
    async render({ applications: ap }) {
      const stOf = (a) => a.status || "Under review";
      return { html: `<div id="app"></div>`, mount(el) {
        createList($("#app", el), { noun: "applications", label: "Applications", rows: ap, placeholder: "Search applicant, email or property…",
          tabs: [{ k: "all", label: "All" }, ...APP_STATUS.map((s) => ({ k: s, label: s, test: (a) => stOf(a) === s }))], defaultTab: (r) => (r.some((a) => stOf(a) === "Under review") ? "Under review" : "all"), sort: { k: "created", dir: "desc" },
          facets: [{ k: "prop", label: "Property", options: (r) => [["", "All properties"], ...[...new Set(r.map((a) => a.title).filter(Boolean))].sort().map((c) => [c, c])], test: (a, v) => a.title === v }, { k: "month", label: "Move-in", options: (r) => [["", "Any month"], ...[...new Set(r.map(appMonth).filter(Boolean))].sort().map((m) => [m, monthLabel(m)])], test: (a, v) => appMonth(a) === v }],
          search: (a) => `${a.name || ""} ${a.email || ""} ${a.title || ""} ${a.area || ""}`,
          cols: [
            { k: "who", label: "Applicant", role: "title", sort: (a) => String(a.name || "").toLowerCase(), cell: (a) => `<div class="ax-id">${avatar(a.name, a.uid, 32)}<div><b>${esc(a.name || "Applicant")}</b><small>${esc(a.email || "")}</small></div></div>` },
            { k: "prop", label: "Property", pri: 2, cell: (a) => `<div class="ax-id">${thumb(a.image, 32)}<div><b style="font-weight:500;color:var(--ax-text)">${esc(a.title || "—")}</b><small>${esc(a.area || "")}</small></div></div>` },
            { k: "move", label: "Move-in", pri: 2, sort: (a) => a.moveIn || "", cell: (a) => (a.moveIn ? esc(fmt.date(a.moveIn)) : "—") },
            { k: "amount", label: "Move-in total", align: "right", sort: (a) => +a.amount || 0, cell: (a) => `<span class="ax-money">${naira(a.amount)}</span>` },
            { k: "status", label: "Status", role: "status", cell: (a) => `<button type="button" class="ax-chipbtn" data-cell="status" aria-haspopup="menu" aria-label="Change status, now ${esc(stOf(a))}">${chipFor("application", stOf(a))}${I("chevD", 14)}</button>` },
            { k: "created", label: "Submitted", pri: 2, sort: (a) => AX.ms(a.createdAt), cell: (a) => fmt.rel(a.createdAt) },
          ],
          onCell: (k, a, b, api) => menu(b, APP_STATUS.map((s) => ({ label: s, checked: s === stOf(a), act: () => s !== stOf(a) && setApp(a, s, api) })), { label: "Application status", align: "left" }),
          bulk: [{ label: "Set status", icon: "refresh", run: (rs, c) => menu($("[data-bulk=0]"), APP_STATUS.map((s) => ({ label: s, act: async () => { const prev = new Map(rs.map((a) => [a.id, a.status])); const r = await bulkRun(rs.map((a) => a.id), async (id) => { const a = rs.find((x) => x.id === id); await st.patch("applications", id, { status: s }); a.status = s; }, { label: "Updating" }); changed(); c.clear(); toast(r.bad ? `${r.ok.length} updated, ${r.bad} failed.` : `${r.ok.length} marked ${s.toLowerCase()}.`, { tone: r.bad ? "bad" : "", action: "Undo", onAction: async () => { await Promise.allSettled(r.ok.map(async (id) => { const a = rs.find((x) => x.id === id); await st.patch("applications", id, { status: prev.get(id) }); a.status = prev.get(id); })); changed(); c.list.repaint(); } }); } })), { label: "Set status" }) },
            { label: "Export CSV", icon: "download", free: true, run: (rs) => csv("faxton-applications-selected", ["Applicant", "Email", "Property", "Move-in", "Status", "Amount"], rs.map((a) => [a.name, a.email, a.title, a.moveIn, a.status, a.amount])) }],
          csv: { name: "faxton-applications", head: ["Applicant", "Email", "Property", "Area", "Move-in", "Status", "Amount", "Submitted"], row: (a) => [a.name, a.email, a.title, a.area, a.moveIn, a.status, a.amount, fmt.date(a.createdAt)] },
          menu: (a, api) => [{ label: "Open", icon: "eye", act: api.open }, { sep: 1 }, ...APP_STATUS.map((s) => ({ label: `Mark ${s.toLowerCase()}`, icon: s === "Approved" ? "check" : s === "Rejected" ? "x" : "clock", checked: undefined, disabled: s === stOf(a), act: () => setApp(a, s, api) }))],
          drawer: (a, api) => appDrawer(ctx, a, api), empty: { icon: "doc", title: "No applications yet", hint: "Rental applications from renters appear here." } });
      } };
    } });
}

// ---------- viewings ----------
const VW_STATUS = ["Requested", "Confirmed", "Completed", "Cancelled"];
const sosOpen = (v) => !!(v.sos && !v.sos.resolved);
const whenOf = (v) => { try { return VS.startOf(v); } catch { return new Date(String(v.when).slice(0, 10) + "T00:00:00"); } };
async function setView(v, status, api) { try { await write("viewings", v, { status }, { msg: `Viewing ${status.toLowerCase()}.`, after: api.refresh }); } catch (e) { bad(e); } }
async function resolveSos(ctx, v, api) {
  try { v.sos = { ...v.sos, resolvedBy: meName(ctx), resolvedAt: Date.now() }; await VS.resolveSos(v); changed(); toast("Marked as resolved."); api.refresh(); } catch (e) { bad(e); }
}
function callTo(ctx, uid, name, title) { if (!uid) return toast("We don’t have an account to call for this person.", { tone: "bad" }); CALLS.startCall(ctx, { to: uid, toName: name || "User", kind: "voice", title: title || "Faxton team" }); }
function viewingDrawer(ctx, v, api) {
  const s = v.sos, open = sosOpen(v), t = v.trusted, when = whenOf(v), loc = s?.lat != null && s?.lng != null ? `https://www.google.com/maps?q=${s.lat},${s.lng}` : "";
  const body = `${s ? `<div class="ax-safety" ${open ? 'role="alert"' : 'style="background:var(--ax-surface-2);color:var(--ax-text);border:1px solid var(--ax-border)"'}><b>${I("alert", 18)} ${open ? "Safety alert raised" : "Safety alert resolved"}</b><p>Raised ${esc(fmt.dateTime(s.at))}${s.kind ? ` · ${esc(s.kind)}` : ""}${s.resolvedAt ? ` · Resolved by ${esc(s.resolvedBy || "the team")} on ${esc(fmt.dateTime(s.resolvedAt))}` : ""}</p>
      ${t ? `<p>Trusted contact: <b>${esc(t.name)}</b> ${esc(t.phone || "")}</p>` : ""}${loc ? `<p><a class="ax-ext" href="${esc(loc)}" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline">Open location on the map ${I("ext", 14)}</a></p>` : ""}
      ${open ? `<div class="ax-row">${btn("Call renter", { size: "sm", ic: "phone", attrs: "data-callr" })}${btn("Call agent", { size: "sm", ic: "phone", attrs: "data-calla" })}${btn("Mark resolved", { v: "primary", size: "sm", ic: "check", attrs: "data-resolve" })}</div><p style="font-size:12px">In an emergency call ${esc(VS.EMERGENCY_NUMBER)}, Nigeria’s emergency number.</p>` : ""}</div>` : ""}
    ${section("Viewing", dl([["Property", esc(v.title)], ["Area", esc(v.area)], ["When", `${esc(isNaN(when) ? String(v.when) : when.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }))}, ${esc(v.slot || "")}`], ["Tour", esc(v.tour || "In-person tour")], ["Status", `<button type="button" class="ax-chipbtn" data-status>${chipFor("viewing", v.status)}${I("chevD", 14)}</button>`]]))}
    ${section("People", `<div class="ax-id" style="margin-bottom:10px">${avatar(v.name, v.uid, 36)}<div><b>${esc(v.name || "Renter")}</b><small>Renter</small></div></div><div class="ax-id">${avatar(v.agentName, v.agentUid || v.ownerUid, 36, v.agentPhoto)}<div><b>${esc(v.agentName || "Faxton agent")} ${v.agentVerified ? chip("ok", "Verified") : ""}</b><small>Agent</small></div></div>`)}
    ${section("Timeline", timeline([{ title: "Viewing requested", meta: fmt.dateTime(v.createdAt) }, ...(v.sharedWith ? [{ title: `Details shared with ${v.sharedWith}`, tone: "mute" }] : []), ...(v.checkIn ? [{ title: "Checked in", meta: fmt.dateTime(v.checkIn.at) }] : []), ...(s ? [{ title: "Safety alert raised", meta: fmt.dateTime(s.at), tone: "bad" }] : []), ...(v.checkOut ? [{ title: "Checked out", meta: fmt.dateTime(v.checkOut.at) }] : [])]))}`;
  return { title: v.name || "Viewing", sub: `${open ? chipFor("sos", "open") : chipFor("viewing", v.status)}<span>${esc(v.title || "")}</span>`, body,
    mount(el) {
      $("[data-callr]", el)?.addEventListener("click", () => callTo(ctx, v.uid, v.name, v.title)); $("[data-calla]", el)?.addEventListener("click", () => callTo(ctx, v.agentUid || v.ownerUid, v.agentName, v.title));
      $("[data-resolve]", el)?.addEventListener("click", () => resolveSos(ctx, v, api));
      $("[data-status]", el)?.addEventListener("click", (e) => menu(e.currentTarget, VW_STATUS.map((x) => ({ label: x, checked: x === v.status, act: () => x !== v.status && setView(v, x, api) })), { align: "left" }));
    } };
}
export function viewings(ctx) {
  return pageView(ctx, { title: "Viewings", eyebrow: "Activity", sub: "Every viewing request, with safety alerts raised to the top.", cols: ["viewings"], what: "viewings",
    async render({ viewings: vw }) {
      return { html: `<div id="vw"></div>`, mount(el) {
        const day0 = new Date(); day0.setHours(0, 0, 0, 0);
        createList($("#vw", el), { noun: "viewings", label: "Viewings", rows: vw, placeholder: "Search renter, property or agent…",
          tabs: [{ k: "all", label: "All" }, { k: "safety", label: "Safety", test: sosOpen, tone: "alert" }, ...VW_STATUS.map((s) => ({ k: s, label: s, test: (v) => v.status === s }))], defaultTab: (r) => (r.some(sosOpen) ? "safety" : "all"), sort: null,
          compare: (a, b) => whenOf(b) - whenOf(a), pin: sosOpen, rowTone: (v) => (sosOpen(v) ? "alert" : ""),
          facets: [{ k: "when", label: "Date", options: [["", "Any date"], ["today", "Today"], ["week", "Next 7 days"], ["past", "Past"]], test: (v, f) => { const d = whenOf(v); return f === "today" ? d.toDateString() === new Date().toDateString() : f === "week" ? d >= day0 && d < new Date(day0.getTime() + 7 * 864e5) : d < day0; } }],
          search: (v) => `${v.name || ""} ${v.title || ""} ${v.agentName || ""} ${v.area || ""}`,
          cols: [
            { k: "who", label: "Renter", role: "title", sort: (v) => String(v.name || "").toLowerCase(), cell: (v) => `<div class="ax-id">${avatar(v.name, v.uid, 32)}<div><b>${esc(v.name || "Renter")}</b><small>${esc(v.tour || "In-person tour")}</small></div></div>` },
            { k: "prop", label: "Property", pri: 2, cell: (v) => `<div class="ax-id">${thumb(v.image, 32)}<div><b style="font-weight:500;color:var(--ax-text)">${esc(v.title || "—")}</b><small>${esc(v.area || "")}</small></div></div>` },
            { k: "when", label: "When", sort: (v) => +whenOf(v), cell: (v) => `${esc(fmt.day(v.when))}<small class="ax-muted" style="display:block">${esc(v.slot || "")}</small>` },
            { k: "agent", label: "Agent", pri: 2, cell: (v) => `${esc(v.agentName || "—")} ${v.agentVerified ? `<span title="Verified agent" style="color:var(--ax-accent)">${I("checkc", 14)}</span>` : ""}` },
            { k: "status", label: "Status", role: "status", cell: (v) => `<button type="button" class="ax-chipbtn" data-cell="status" aria-haspopup="menu" aria-label="Change status, now ${esc(v.status)}">${chipFor("viewing", v.status)}${I("chevD", 14)}</button>` },
            { k: "alert", label: "Alert", pri: 2, cell: (v) => (v.sos ? chipFor("sos", sosOpen(v) ? "open" : "resolved") : "") },
          ],
          onCell: (k, v, b, api) => menu(b, VW_STATUS.map((s) => ({ label: s, checked: s === v.status, act: () => s !== v.status && setView(v, s, api) })), { label: "Viewing status", align: "left" }),
          bulk: [{ label: "Set status", icon: "refresh", run: (rs, c) => { const ok = rs.filter((v) => !sosOpen(v)); if (!ok.length) return toast("Resolve safety alerts one by one.", { tone: "bad" }); menu($("[data-bulk=0]"), VW_STATUS.map((s) => ({ label: s, act: async () => { const prev = new Map(ok.map((v) => [v.id, v.status])); const r = await bulkRun(ok.map((v) => v.id), async (id) => { const v = ok.find((x) => x.id === id); await st.patch("viewings", id, { status: s }); v.status = s; }, { label: "Updating" }); changed(); c.clear(); toast(`${r.ok.length} marked ${s.toLowerCase()}.`, { action: "Undo", onAction: async () => { await Promise.allSettled(r.ok.map(async (id) => { const v = ok.find((x) => x.id === id); await st.patch("viewings", id, { status: prev.get(id) }); v.status = prev.get(id); })); changed(); c.list.repaint(); } }); } })), { label: "Set status" }); } }],
          csv: { name: "faxton-viewings", head: ["Renter", "Property", "Date", "Time", "Status", "Agent", "Safety alert"], row: (v) => [v.name, v.title, v.when, v.slot, v.status, v.agentName || "", v.sos ? (sosOpen(v) ? "open" : "resolved") : ""] },
          quick: (v) => (sosOpen(v) ? btn("Resolve", { v: "primary", size: "xs", cls: "ax-qa", attrs: "data-qa=resolve" }) : v.status === "Requested" ? btn("Confirm", { v: "soft", size: "xs", cls: "ax-qa", attrs: "data-qa=confirm" }) : ""),
          onQuick: (k, v, b, api) => (k === "resolve" ? resolveSos(ctx, v, api) : setView(v, "Confirmed", api)),
          menu: (v, api) => [{ label: "Open", icon: "eye", act: api.open }, { sep: 1 }, ...VW_STATUS.map((s) => ({ label: `Mark ${s.toLowerCase()}`, icon: "clock", disabled: s === v.status, act: () => setView(v, s, api) })), ...(sosOpen(v) ? [{ sep: 1 }, { label: "Mark safety alert resolved", icon: "check", act: () => resolveSos(ctx, v, api) }] : [])],
          drawer: (v, api) => viewingDrawer(ctx, v, api),
          empty: { icon: "calDots", title: "No viewings yet", hint: "Viewing requests from renters appear here. A safety alert shows up the moment someone raises one." } });
      } };
    } });
}

// ---------- review queue ----------
export function queue(ctx) {
  return pageView(ctx, { title: "Review queue", eyebrow: "Overview", sub: "Everything waiting on a person. Safety alerts always come first.", cols: ["listings", "users", "viewings"], what: "the review queue",
    async render({ listings: ls, users: us, viewings: vw }) {
      let tab = hq().q.tab || ""; const apiFor = (row, again) => ({ row, refresh: again, update: (p) => { Object.assign(row, p); changed(); again(); }, close: () => drawer.close(), list: null });
      const items = () => [
        ...vw.filter(sosOpen).map((v) => ({ type: "sos", id: v.id, t: AX.ms(v.sos.at) || AX.ms(v.createdAt), row: v })),
        ...ls.filter(isPendingL).map((l) => ({ type: "listing", id: l.id, t: AX.ms(l.createdAt), row: l })),
        ...us.filter((u) => u.verification?.status === "pending").map((u) => ({ type: "verif", id: u.id, t: u.verification.requestedAt || 0, row: u })),
        ...us.filter((u) => u.deletion?.status === "pending").map((u) => ({ type: "del", id: u.id, t: u.deletion.requestedAt || 0, row: u }))].sort((a, b) => (b.type === "sos") - (a.type === "sos") || a.t - b.t);
      const TYPES = { sos: ["alert", "Safety alert", "bad"], listing: ["clipList", "Listing", ""], verif: ["shield", "Verification", "info"], del: ["trash", "Deletion request", "warn"] };
      const card = (it) => { const [ic, lab, tone] = TYPES[it.type], r = it.row, h = (Date.now() - it.t) / 36e5, age = it.t ? `Waiting ${fmt.age(it.t)}` : ""; let title, sub, acts;
        if (it.type === "sos") { title = `${r.name || "A renter"} raised an alert`; sub = `${r.title || ""} · ${fmt.day(r.when)}, ${r.slot || ""}`; acts = btn("Call person", { size: "sm", ic: "phone", attrs: "data-q=call" }) + btn("Mark resolved", { v: "primary", size: "sm", ic: "check", attrs: "data-q=resolve" }) + btn("Details", { v: "ghost", size: "sm", href: "#/admin/viewings?id=" + encodeURIComponent(r.id) }); }
        else if (it.type === "listing") { title = r.title; sub = `${where(r)} · ${r.agent?.name || "Faxton"} · ${naira(r.price)}/yr`; acts = btn("Approve", { v: "primary", size: "sm", ic: "check", attrs: "data-q=approve" }) + btn("Review", { size: "sm", attrs: "data-q=review" }); }
        else if (it.type === "verif") { title = r.verification.kind === "agency" ? r.agency?.business || r.name : r.name || r.email; sub = `${r.verification.kind === "agency" ? "Agency" : "Agent"} · ${r.email || ""}`; acts = btn("Verify", { v: "primary", size: "sm", ic: "check", attrs: "data-q=verify" }) + btn("Reject", { v: "danger", size: "sm", attrs: "data-q=reject" }) + btn("Details", { v: "ghost", size: "sm", href: "#/admin/verifications" }); }
        else { title = r.name || r.email; sub = `Wants to delete their account · ${r.email || ""}`; acts = btn("Approve deletion", { v: "danger", size: "sm", attrs: "data-q=deldo" }) + btn("Keep account", { size: "sm", attrs: "data-q=delkeep" }); }
        return `<article class="ax-card ax-qc" data-k="${it.type}:${esc(it.id)}" ${it.type === "sos" ? 'data-t="alert"' : ""}><span class="ax-tile" data-t="${tone}">${I(ic, 20)}</span><div style="min-width:0"><h3>${esc(title || "Untitled")}</h3><div class="ax-sub">${esc(lab)} · ${esc(sub)}</div></div><span class="ax-qage" data-t="${h > 72 ? "bad" : h > 24 ? "warn" : ""}">${esc(age)}</span><div class="ax-qa-row">${acts}</div></article>`; };
      const html = () => { const all = items(), cnt = (t) => all.filter((i) => i.type === t).length, tabs0 = [{ k: "all", label: "All", count: all.length }, { k: "sos", label: "Safety alerts", count: cnt("sos"), tone: cnt("sos") ? "alert" : "" }, { k: "listing", label: "Listings", count: cnt("listing") }, { k: "verif", label: "Verifications", count: cnt("verif") }, { k: "del", label: "Deletions", count: cnt("del") }];
        if (!tab) tab = cnt("sos") ? "sos" : "all"; const shown = tab === "all" ? all : all.filter((i) => i.type === tab);
        return `${tabs(tabs0, tab, { label: "Queue" })}<div class="ax-queue" style="margin-top:16px">${shown.length ? shown.map(card).join("") : `<div class="ax-card">${empty({ icon: "checkc", title: "Nothing is waiting for you.", hint: "New submissions appear here.", action: btn("Go to Overview", { v: "primary", href: "#/admin" }) })}</div>`}</div>`; };
      return { html: `<div id="qRoot">${html()}</div>`, mount(el) {
        const root = $("#qRoot", el), paint = () => { root.innerHTML = html(); mountTabs(root, (k) => { tab = k; setQ({ tab: k }); paint(); }); }; mountTabs(root, (k) => { tab = k; setQ({ tab: k }); paint(); });
        const leave = (c) => { c.classList.add("out"); setTimeout(paint, 170); };
        root.addEventListener("click", async (e) => {
          const b = e.target.closest("[data-q]"); if (!b) return; const c = b.closest("[data-k]"), [type, id] = c.dataset.k.split(":"), q = b.dataset.q;
          try {
            if (type === "sos") { const v = vw.find((x) => x.id === id); if (q === "call") callTo(ctx, v.uid, v.name, v.title); else if (q === "resolve") { busy(b, true); await resolveSos(ctx, v, { refresh() {} }); leave(c); } }
            else if (type === "listing") { const l = ls.find((x) => x.id === id); if (q === "approve") { busy(b, true); await write("listings", l, { status: "active", archived: false }, { msg: "Listing approved.", after: () => {} }); notify(l.ownerUid, { kind: "info", title: "Your listing is live", body: `${l.title} has been approved.` }); leave(c); } else if (q === "review") { const api = apiFor(l, () => { drawer.set(listingDrawer(ctx, l, api)); paint(); }); drawer.open(listingDrawer(ctx, l, api)); } }
            else if (type === "verif") { const u = us.find((x) => x.id === id); if (q === "verify") { busy(b, true); const nv = { ...u.verification, status: "verified", decidedAt: Date.now(), decidedBy: ctx.S.user.uid }; await st.verifyUser(u.id, nv); u.verification = nv; u.verified = true; changed(); st.notify(u.id, { kind: "verified", title: "You’re verified!", body: `Your ${u.verification.kind === "agency" ? "agency" : "agent account"} has been verified. You can now start listing properties.` }).catch(() => {}); toast("Verified. They’ve been told."); leave(c); } else if (q === "reject") { const why = await reason({ title: `Reject ${u.agency?.business || u.name}`, presets: VF_PRESETS, confirmLabel: "Reject", tone: "bad" }); if (!why) return; const nv = { ...u.verification, status: "rejected", decidedAt: Date.now(), decidedBy: ctx.S.user.uid, reason: why }; await st.verifyUser(u.id, nv); u.verification = nv; u.verified = false; changed(); st.notify(u.id, { kind: "rejected", title: "Verification not approved", body: why }).catch(() => {}); toast("Rejected. They’ve been told."); leave(c); } }
            else if (type === "del") { const u = us.find((x) => x.id === id), ok = q === "deldo"; if (ok && !(await confirm({ title: `Approve deleting ${u.name || u.email}?`, body: "Their account will be removed the next time it’s opened after the one-day review.", confirmLabel: "Approve deletion", tone: "danger", icon: "trash" }))) return; busy(b, true); const nd = { ...u.deletion, status: ok ? "approved" : "denied", decidedAt: Date.now() }; await st.decideDeletion(u.id, nd); u.deletion = nd; changed(); st.notify(u.id, { kind: "info", title: ok ? "Deletion approved" : "Account kept", body: ok ? "Your account will be removed after the one-day review period." : "We’ve kept your account as it is." }).catch(() => {}); toast(ok ? "Deletion approved." : "Account kept."); leave(c); }
          } catch (x) { busy(b, false); bad(x); }
        });
      } };
    } });
}

// ---------- service requests (from the /services page) ----------
const SV_STATUS = ["New", "Contacted", "Scheduled", "Done", "Cancelled"];
export function serviceRequests(ctx) {
  const setSt = async (r, status, api) => { const prev = r.status; try { await SVC.updateRequest(r.id, { status }); r.status = status; data.invalidate("serviceRequests"); changed(); api?.refresh?.(); toast(`Marked ${status.toLowerCase()}.`, { action: "Undo", onAction: async () => { try { await SVC.updateRequest(r.id, { status: prev }); r.status = prev; data.invalidate("serviceRequests"); changed(); api?.refresh?.(); } catch (e) { bad(e); } } }); } catch (e) { bad(e); } };
  return pageView(ctx, { title: "Service requests", eyebrow: "Activity", sub: "Tiling, plumbing, painting and other home-service jobs that people asked for.", cols: ["serviceRequests"], what: "service requests",
    async render({ serviceRequests: rs }) {
      return { html: `<div id="sv"></div>`, mount(el) {
        createList($("#sv", el), { noun: "requests", label: "Service requests", rows: rs, placeholder: "Search name, phone, service or area…",
          tabs: [{ k: "all", label: "All" }, ...SV_STATUS.map((s) => ({ k: s, label: s, test: (r) => r.status === s }))], defaultTab: (r) => (r.some((x) => x.status === "New") ? "New" : "all"), sort: null,
          compare: (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0),
          facets: [{ k: "cat", label: "Service", options: (all) => [["", "Any service"], ...[...new Set(all.map((r) => r.category))].filter(Boolean).sort().map((c) => [c, c])], test: (r, f) => r.category === f }],
          search: (r) => `${r.name || ""} ${r.phone || ""} ${r.category || ""} ${r.area || ""} ${r.description || ""}`,
          cols: [
            { k: "who", label: "Requester", role: "title", sort: (r) => String(r.name || "").toLowerCase(), cell: (r) => `<div class="ax-id">${avatar(r.name, r.uid, 32)}<div><b>${esc(r.name || "User")}</b><small>${esc(r.phone || "")}</small></div></div>` },
            { k: "cat", label: "Service", cell: (r) => esc(r.category || "—") },
            { k: "area", label: "Area", pri: 2, cell: (r) => esc(r.area || "—") },
            { k: "when", label: "Wanted on", pri: 2, sort: (r) => r.preferredDate || "", cell: (r) => esc(r.preferredDate ? fmt.day(r.preferredDate) : "Any day") },
            { k: "sent", label: "Sent", pri: 2, sort: (r) => r.createdAt?.seconds || 0, cell: (r) => esc(fmt.date(r.createdAt)) },
            { k: "status", label: "Status", role: "status", cell: (r) => `<button type="button" class="ax-chipbtn" data-cell="status" aria-haspopup="menu" aria-label="Change status, now ${esc(r.status)}">${chipFor("service", r.status)}${I("chevD", 14)}</button>` },
          ],
          onCell: (k, r, b, api) => menu(b, SV_STATUS.map((s) => ({ label: s, checked: s === r.status, act: () => s !== r.status && setSt(r, s, api) })), { label: "Request status", align: "left" }),
          csv: { name: "faxton-service-requests", head: ["Name", "Phone", "Email", "Service", "Area", "Wanted on", "Status", "Description", "Sent"], row: (r) => [r.name, r.phone, r.email || "", r.category, r.area || "", r.preferredDate || "", r.status, r.description, fmt.date(r.createdAt)] },
          quick: (r) => (r.status === "New" ? btn("Mark contacted", { v: "soft", size: "xs", cls: "ax-qa", attrs: "data-qa=contact" }) : ""),
          onQuick: (k, r, b, api) => setSt(r, "Contacted", api),
          menu: (r, api) => [{ label: "Open", icon: "eye", act: api.open }, { sep: 1 }, ...SV_STATUS.map((s) => ({ label: `Mark ${s.toLowerCase()}`, icon: "clock", disabled: s === r.status, act: () => setSt(r, s, api) }))],
          drawer: (r, api) => ({ title: r.name || "Request", sub: `${chipFor("service", r.status)}<span>${esc(r.category || "")}</span>`,
            body: `${section("Job", dl([["Service", esc(r.category)], ["Area", esc(r.area || "—")], ["Wanted on", esc(r.preferredDate ? fmt.day(r.preferredDate) : "Any day")], ["Sent", esc(fmt.dateTime(r.createdAt))]]))}<p style="white-space:pre-wrap;margin:10px 0 16px">${esc(r.description)}</p>
              ${section("Contact", dl([["Name", esc(r.name)], ["Phone", `<a href="tel:${esc(r.phone)}">${esc(r.phone)}</a>`], ["Email", esc(r.email || "—")]]))}
              <label class="ax-field full"><span>Note for the requester (shown on their Home services page)</span><textarea class="ax-input" id="svNote" rows="3" maxlength="1000">${esc(r.note || "")}</textarea></label>
              <div class="ax-row" style="margin-top:10px;gap:8px;flex-wrap:wrap">${btn("Save note", { v: "primary", size: "sm", attrs: "data-note" })}${btn("Call", { size: "sm", ic: "phone", attrs: "data-call" })}${btn("Status", { size: "sm", attrs: "data-status" })}</div>`,
            mount(d) {
              $("[data-note]", d).onclick = async (e) => { busy(e.currentTarget, true); try { await SVC.updateRequest(r.id, { note: $("#svNote", d).value.trim() }); r.note = $("#svNote", d).value.trim(); data.invalidate("serviceRequests"); toast("Note saved."); } catch (x) { bad(x); } busy(e.currentTarget, false); };
              $("[data-call]", d).onclick = () => { location.href = "tel:" + r.phone; };
              $("[data-status]", d).onclick = (e) => menu(e.currentTarget, SV_STATUS.map((s) => ({ label: s, checked: s === r.status, act: () => s !== r.status && setSt(r, s, api) })), { align: "left" });
            } }),
          empty: { icon: "wrench", title: "No service requests yet", hint: "When someone asks for tiling, plumbing or another home service from the Home services page, it shows up here." } });
      } };
    } });
}
