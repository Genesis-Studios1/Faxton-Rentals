// After-rent experience: once an application is approved the app grows a My Home dashboard
// with rent reminders, maintenance, landlord chat, documents, lease renewal, records, notices and move-out tools.
import { db } from "./firebase.js";
import { collection, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, onSnapshot, query, where, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { $, $$, esc, naira, icon, toast, modal } from "./ui.js";
import { fxErr as friendlyErr, statusPill as fxPill, empty as fxEmpty, ask } from "./fx.js";
import * as st from "./store.js";
import { moveIn } from "./area.js";

const ACTIVE = (s) => /approved|active/i.test(s || "");
const DAY = 864e5;
export const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parse = (s) => { const d = new Date(String(s || "").slice(0, 10) + "T00:00:00"); return isNaN(d) ? null : d; };
const dlong = (d) => (d ? d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "—");
const dshort = (d) => (d ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");
const daysTo = (d) => Math.round((d - new Date(new Date().toDateString())) / DAY);
const ago = (t) => { const s = typeof t === "number" ? t / 1000 : t?.seconds; if (!s) return "Just now"; const d = Math.max(0, Date.now() / 1000 - s); return d < 60 ? "Just now" : d < 3600 ? Math.floor(d / 60) + " min ago" : d < 86400 ? Math.floor(d / 3600) + " h ago" : new Date(s * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short" }); };
const rel = (n) => (n < 0 ? `${-n} day${n === -1 ? "" : "s"} overdue` : n === 0 ? "today" : n === 1 ? "tomorrow" : `in ${n} days`);

// ---- who is a tenant? ----
export async function detectTenant(user) {
  const apps = await st.myApplications(user), app = apps.find((a) => ACTIVE(a.status));
  if (!app) return null;
  const l = (await st.getListing(app.listingId).catch(() => null)) || { id: app.listingId, title: app.title, area: app.area, city: "", images: [app.image], thumb: app.image, price: app.rent || 0, service: 0, deposit: 0, agent: { name: "Your landlord" } };
  const start = parse(app.moveIn) || new Date(new Date().toDateString()), end = new Date(start); end.setFullYear(end.getFullYear() + 1); end.setDate(end.getDate() - 1);
  return { app, l, id: app.id, start, end, rent: app.rent || l.price, ownerUid: app.ownerUid || l.ownerUid || null };
}
async function ensureTenancy(user, t) {
  const ref = doc(db, "tenancies", t.id), s = await getDoc(ref);
  if (s.exists()) return { ...s.data(), id: s.id };
  const d = { uid: user.uid, name: user.displayName || user.email || "Tenant", ownerUid: t.ownerUid, listingId: t.l.id, title: t.l.title, area: t.l.area, image: t.l.thumb || t.l.images?.[0] || "", rent: t.rent, service: +t.l.service || 0, deposit: +t.l.deposit || 0, startDate: iso(t.start), endDate: iso(t.end), createdAt: serverTimestamp() };
  await setDoc(ref, d); return { ...d, id: t.id };
}
const watch = (col, field, op, val, cb) => onSnapshot(query(collection(db, col), where(field, op, val)), (s) => cb(s.docs.map((d) => ({ ...d.data(), id: d.id })).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))), () => cb([]));

// ---- small card for the home page ----
export function homeCard(S) {
  const t = S.tenant; if (!t) return "";
  const n = daysTo(t.end) + 1;
  return `<a class="mh-banner" href="#/myhome"><span class="mh-bi">${icon("home", 26)}</span><span class="mh-bt"><b>My Home · ${esc(t.l.title)}</b><small>${n > 0 ? `Your lease ends ${rel(n)}` : "Your lease has ended"}. Maintenance, rent reminders and your landlord are all here.</small></span><span class="mh-bg">Open ${icon("arrow", 16)}</span></a>`;
}

// ---- calendar reminder ----
const icsHref = (title, date, note) => { const d = iso(date).replace(/-/g, ""), n = iso(new Date(date.getTime() + DAY)).replace(/-/g, ""); return "data:text/calendar;charset=utf-8," + encodeURIComponent(`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Faxton Rentals//EN\r\nBEGIN:VEVENT\r\nUID:${d}-${Math.random().toString(36).slice(2)}@faxton\r\nDTSTAMP:${d}T000000Z\r\nDTSTART;VALUE=DATE:${d}\r\nDTEND;VALUE=DATE:${n}\r\nSUMMARY:${title}\r\nDESCRIPTION:${note}\r\nBEGIN:VALARM\r\nTRIGGER:-P14D\r\nACTION:DISPLAY\r\nDESCRIPTION:${title}\r\nEND:VALARM\r\nEND:VEVENT\r\nEND:VCALENDAR`); };

const TABS = [["", "Overview", "home"], ["payments", "Payments", "wallet"], ["maintenance", "Maintenance", "wrench"], ["documents", "Documents", "doc"], ["renewal", "Renewal", "refresh"], ["notices", "Notices", "bell"], ["moveout", "Move out", "logout"]];
const KINDS = ["Rent", "Service charge", "Electricity", "Water", "Waste", "Internet", "Other"];
const CATS = [["Plumbing", "drop"], ["Electrical", "bolt"], ["Appliance", "chip"], ["Structure", "building"], ["Security", "shield"], ["Pests", "info"], ["Other", "wrench"]];
const MOVE_STEPS = [["notice", "Tell your landlord", "Send your notice below with your move-out date."], ["pay", "Settle rent and service charge", "Make sure nothing is outstanding."], ["meters", "Take final meter readings", "Electricity and water, with photos."], ["photos", "Photograph every room", "Shows the condition you are leaving it in."], ["keys", "Return keys and gate access", "Cards, fobs, remotes and keys."], ["refund", "Ask for your caution deposit back", "Use the button below once the inspection is done."], ["address", "Update your address", "Cancel utilities and set mail forwarding."]];

// ---- the page ----
export async function myHomePage(ctx, tab = "") {
  const user = ctx.S.user;
  let T = ctx.S.tenant || (await detectTenant(user).catch(() => null));
  if (!T) return { title: "My Home", html: `<div class="rf"><div class="rf-card">${fxEmpty({ ic: "home", title: "You don’t have an active tenancy yet", hint: "When an application is approved, My Home opens here with rent reminders, maintenance requests and more.", action: `<div class="rf-btns"><a class="btn primary" href="#/search">Find a home</a><a class="btn" href="#/applications">My applications</a></div>` })}</div></div>` };
  ctx.S.tenant = T;
  let TN; try { TN = await ensureTenancy(user, T); } catch (e) { TN = { id: T.id, uid: user.uid, ownerUid: T.ownerUid, title: T.l.title, area: T.l.area, rent: T.rent, service: +T.l.service || 0, deposit: +T.l.deposit || 0, startDate: iso(T.start), endDate: iso(T.end), offline: true }; }
  const tabOk = TABS.some((x) => x[0] === tab) ? tab : "";
  return { title: "My Home", html: `<div class="rf mh"><div class="mh-head"><img src="${esc(T.l.thumb || T.l.images?.[0])}" alt=""><div><span class="rf-pill ok"><i></i>Active tenancy</span><h1 class="rf-h1">${esc(T.l.title)}</h1><p class="loc">${icon("pin", 16)} ${esc(T.l.area)}${T.l.city && !String(T.l.area).includes(T.l.city) ? ", " + esc(T.l.city) : ""}</p></div><div class="mh-hact"><button class="btn primary" id="mhChat">${icon("msg", 18)} Message landlord</button></div></div>
    <div class="rf-tabs rn-tabs mh-tabs" role="tablist">${TABS.map(([k, t, ic]) => `<a role="tab" class="${k === tabOk ? "on" : ""}" ${k === tabOk ? 'aria-current="page"' : ""} href="#/myhome${k ? "/" + k : ""}">${t}<b class="mh-dot" data-dot="${k}" hidden></b></a>`).join("")}</div><div id="mhBody"></div></div>`,
  mount(root) {
    const D = { maint: [], recs: [], notes: [], docs: [] }, body = $("#mhBody", root);
    const start = parse(TN.startDate) || T.start, end = parse(TN.endDate) || T.end, left = daysTo(end) + 1, total = Math.round((end - start) / DAY) + 1, spent = Math.min(total, Math.max(0, Math.round((new Date() - start) / DAY)));
    const unpaid = () => D.recs.filter((r) => r.status === "Due").sort((a, b) => String(a.due).localeCompare(String(b.due)));
    const nextUp = () => {
      const u = unpaid()[0], renew = new Date(end.getTime() + DAY);
      if (u && (!parse(u.due) || parse(u.due) <= renew)) return { t: u.label, amt: u.amount, date: parse(u.due), rec: u };
      return { t: "Rent renewal", amt: moveIn({ price: TN.rent, service: TN.service, deposit: 0, agencyFee: 0, legalFee: 0 }, TN.rent).total, date: renew, renew: true };
    };
    const statusPill = (s) => `<span class="rf-pill ${/open|due|progress/i.test(s) ? "warn" : /overdue/i.test(s) ? "bad" : "ok"}"><i></i>${esc(s)}</span>`;
    // ---------- tabs ----------
    const overview = () => {
      const nx = nextUp(), dn = nx.date ? daysTo(nx.date) : null, openM = D.maint.filter((m) => m.status !== "Resolved"), newN = D.notes.slice(0, 2);
      return `<div class="mh-grid"><section class="rf-card mh-lease"><div class="sec-row"><h2>Your lease</h2><small>${dshort(start)} – ${dshort(end)}</small></div>
          <div class="mh-bar"><i style="width:${Math.round((spent / total) * 100)}%"></i></div><div class="mh-lt"><span>Day ${Math.min(total, spent + 1)} of ${total}</span><b>${left > 0 ? `${left} day${left === 1 ? "" : "s"} left` : "Lease ended"}</b></div>
          <div class="rh-3"><div><small>Annual rent</small><b>${naira(TN.rent)}</b></div><div><small>Service charge</small><b>${naira(TN.service)}</b></div><div><small>Caution held</small><b>${naira(TN.deposit)}</b></div></div></section>
        <section class="rf-card mh-next ${dn != null && dn < 0 ? "late" : dn != null && dn <= 14 ? "soon" : ""}"><span class="mh-ni">${icon(dn != null && dn < 0 ? "bell" : "cal", 26)}</span><div><small>Next payment</small><b>${esc(nx.t)}</b><p>${naira(nx.amt)}${nx.date ? ` · due ${dlong(nx.date)} (${rel(dn)})` : ""}</p></div>${nx.rec ? `<button class="btn primary" data-pay="${esc(nx.rec.id)}">Mark as paid</button>` : `<a class="btn" href="${icsHref("Faxton: rent renewal", nx.date, "Your lease at " + T.l.title + " is up for renewal.")}" download="faxton-rent-reminder.ics">${icon("cal", 16)} Add reminder</a>`}</section></div>
        <div class="rf-stats mh-stats"><div class="rf-stat"><span class="si">${icon("wrench", 28)}</span><div><small>Open requests</small><b>${openM.length}</b><p>${openM.length ? "Being handled" : "Nothing needs fixing"}</p></div></div><div class="rf-stat"><span class="si">${icon("wallet", 28)}</span><div><small>Unpaid items</small><b>${unpaid().length}</b><p>${unpaid().length ? naira(unpaid().reduce((s, r) => s + r.amount, 0)) + " to pay" : "All up to date"}</p></div></div><div class="rf-stat"><span class="si">${icon("bell", 28)}</span><div><small>Notices</small><b>${D.notes.length}</b><p>${D.notes.length ? "From your landlord" : "None right now"}</p></div></div></div>
        <div class="mh-qa">${[["#/myhome/maintenance", "wrench", "Report a problem", "Tell your landlord what needs fixing"], ["#/messages", "msg", "Chat with landlord", "Messages about this home"], ["#/documents", "doc", "My documents", "Lease, receipts and ID"], ["#/myhome/renewal", "refresh", "Renew my lease", `Ends ${dshort(end)}`]].map(([h, ic, t, d]) => `<a class="qa" href="${h}"><span>${icon(ic, 24)}</span><div><b>${t}</b><small>${d}</small></div></a>`).join("")}</div>
        <div class="mh-two"><section class="rf-card"><div class="sec-row"><h2>Latest notices</h2><a class="link" href="#/myhome/notices">View all</a></div>${newN.length ? newN.map((n) => noticeRow(n)).join("") : `<p class="muted">No notices from your landlord.</p>`}</section><section class="rf-card"><div class="sec-row"><h2>Recent requests</h2><a class="link" href="#/myhome/maintenance">View all</a></div>${D.maint.slice(0, 3).map((m) => `<div class="mh-mrow"><span class="si">${icon("wrench", 18)}</span><div><b>${esc(m.title)}</b><small>${ago(m.createdAt)}</small></div>${statusPill(m.status)}</div>`).join("") || `<p class="muted">You haven’t reported anything.</p>`}</section></div>`;
    };
    const noticeRow = (n) => `<div class="mh-note ${esc((n.kind || "Notice").toLowerCase())}"><span class="si">${icon(n.kind === "Visitors" ? "users" : n.kind === "Maintenance" ? "wrench" : n.kind === "Rules" ? "shield" : "bell", 20)}</span><div><b>${esc(n.title)}</b><p>${esc(n.text)}</p><small>${esc(n.kind || "Notice")} · ${ago(n.createdAt)}</small></div></div>`;
    const payments = () => {
      const all = [...D.recs].sort((a, b) => String(b.due || "").localeCompare(String(a.due || "")));
      const paidSum = D.recs.filter((r) => r.status === "Paid").reduce((s, r) => s + r.amount, 0);
      return `<div class="mh-two big"><section class="rf-card"><div class="sec-row"><h2>Payments and records</h2><button class="btn sm primary" id="addRec">${icon("plus", 16)} Add a record</button></div><p class="muted" style="margin-bottom:12px">Keep rent, service charge and utility payments in one place. Your landlord can confirm each one.</p>
        ${all.length ? `<div class="rf-tbl-wrap"><table class="rf-tbl mh-tbl"><thead><tr><th>Item</th><th>Due</th><th>Amount</th><th>Status</th><th></th></tr></thead><tbody>${all.map((r) => `<tr><td><b>${esc(r.label)}</b><small class="muted"> ${esc(r.kind || "")}${r.by === "owner" ? " · from landlord" : ""}</small></td><td>${r.due ? dshort(parse(r.due)) : "—"}</td><td>${naira(r.amount)}</td><td>${r.status === "Paid" ? `<span class="rf-pill ok"><i></i>${r.confirmed ? "Confirmed" : "Paid"}</span>` : r.due && daysTo(parse(r.due)) < 0 ? `<span class="rf-pill bad"><i></i>Overdue</span>` : `<span class="rf-pill warn"><i></i>Due</span>`}</td><td class="mh-ra">${r.status === "Due" ? `<button class="btn sm" data-pay="${esc(r.id)}">Mark paid</button>` : ""}${r.by === "tenant" && !r.confirmed ? `<button class="icon-btn sm" data-delrec="${esc(r.id)}" aria-label="Delete record">${icon("trash", 16)}</button>` : ""}</td></tr>`).join("")}</tbody></table></div>` : `<div class="rf-empty small">${icon("wallet", 30, 1.3)}<p>No records yet. Add your service charge or electricity bills to keep track.</p></div>`}</section>
        <section class="rf-card"><h2>Summary</h2><div class="kvs"><div><span>Annual rent</span><b>${naira(TN.rent)}</b></div><div><span>Service charge</span><b>${naira(TN.service)}</b></div><div><span>Caution held (refundable)</span><b>${naira(TN.deposit)}</b></div><div><span>Recorded as paid</span><b>${naira(paidSum)}</b></div></div>
        <h3 style="margin-top:18px">Rent reminder</h3><p class="muted">Your rent renews on <b>${dlong(new Date(end.getTime() + DAY))}</b>. Your lease countdown stays on your home page.</p><a class="btn block" style="margin-top:10px" href="${icsHref("Faxton: rent renewal", new Date(end.getTime() + DAY), "Your lease at " + T.l.title + " is up for renewal.")}" download="faxton-rent-reminder.ics">${icon("cal", 18)} Add to my calendar</a></section></div>`;
    };
    const maintenance = () => `<div class="sec-row mh-sr"><div><h2>Maintenance requests</h2><p class="muted">Report a problem and follow it until it is fixed.</p></div><button class="btn primary" id="newReq">${icon("plus", 18)} New request</button></div>
      <div class="mh-mlist">${D.maint.map((m) => `<article class="rf-card mh-m" data-id="${esc(m.id)}"><header><span class="si">${icon((CATS.find((c) => c[0] === m.category) || CATS[6])[1], 20)}</span><div><h3>${esc(m.title)}</h3><small>${esc(m.category)} · ${esc(m.priority)} priority · ${ago(m.createdAt)}</small></div>${statusPill(m.status)}</header><p>${esc(m.desc)}</p>${m.photo ? `<img class="mh-ph" src="${m.photo}" alt="Photo of the problem" data-ph>` : ""}
        <ol class="rf-tl mh-tl"><li class="ok"><i>${icon("check", 12, 3.2)}</i><div><b>You reported it</b></div><span>${ago(m.createdAt)}</span></li>${(m.updates || []).map((u) => `<li class="ok"><i>${icon("check", 12, 3.2)}</i><div><b>${u.by === "owner" ? esc(T.l.agent?.name || "Landlord") : "You"}${u.status && u.status !== "same" ? ` · ${esc(u.status)}` : ""}</b>${u.text ? `<p>${esc(u.text)}</p>` : ""}</div><span>${ago(u.at)}</span></li>`).join("")}</ol>
        <div class="mh-mact">${m.status !== "Resolved" ? `<input class="mh-in" placeholder="Add a comment" maxlength="400" aria-label="Add a comment"><button class="btn sm" data-cm>Send</button><button class="btn sm primary" data-res>It’s fixed</button>` : `<button class="btn sm" data-reopen>Not fixed, reopen</button>`}</div></article>`).join("") || `<div class="rf-empty">${icon("wrench", 36, 1.3)}<h3>Nothing reported</h3><p class="muted">If something breaks, tell your landlord here and track the repair.</p></div>`}</div>`;
    const documents = () => `<div class="mh-two big"><section class="rf-card"><div class="sec-row"><h2>Your documents</h2><a class="btn sm primary" href="#/documents">${icon("upload", 16)} Upload or manage</a></div>${D.docs.length ? D.docs.map((d) => `<div class="mh-doc"><span class="si">${icon("pdf", 20)}</span><div><b>${esc(d.name)}</b><small>${esc(d.type || "Document")} · ${ago(d.createdAt)}</small></div>${d.data ? `<a class="btn sm" href="${d.data}" download="${esc(d.name)}">Download</a>` : ""}</div>`).join("") : `<div class="rf-empty small">${icon("doc", 30, 1.3)}<p>No documents yet. Upload your signed lease and receipts so they’re always to hand.</p></div>`}</section>
      <section class="rf-card"><h2>Worth keeping</h2><ul class="mh-ul"><li>${icon("check", 16, 2.4)} Signed tenancy agreement</li><li>${icon("check", 16, 2.4)} Rent and service charge receipts</li><li>${icon("check", 16, 2.4)} Move-in inspection photos</li><li>${icon("check", 16, 2.4)} Meter readings when you arrived</li></ul></section></div>`;
    const renewal = () => {
      const r = TN.renewal, rep = TN.reply?.renewal;
      return `<div class="mh-two big"><section class="rf-card"><h2>Lease renewal</h2><div class="mh-count"><b>${left > 0 ? left : 0}</b><span>day${left === 1 ? "" : "s"} left</span><small>Your lease ends ${dlong(end)}</small></div>
        ${r ? `<div class="mh-status"><span class="si">${icon(r.choice === "renew" ? "refresh" : "logout", 20)}</span><div><b>${r.choice === "renew" ? "You asked to renew" : "You told us you’re leaving"}</b><small>${ago(r.at)}${r.note ? " · “" + esc(r.note) + "”" : ""}</small></div></div>` : ""}
        ${rep ? `<div class="mh-reply">${icon("msg", 18)}<div><b>Landlord’s reply</b><p>${esc(rep.text)}</p>${rep.rent ? `<p>Proposed rent: <b>${naira(rep.rent)}</b> a year</p>` : ""}<small>${ago(rep.at)}</small></div></div>` : ""}
        <label class="rf-fl" style="margin-top:14px">Note for your landlord (optional)<textarea id="rnNote" rows="2" maxlength="400" placeholder="For example: I’d like to keep the same rent."></textarea></label>
        <div class="of-act"><button class="btn primary" id="rnYes">${icon("refresh", 16)} I want to renew</button><button class="btn" id="rnNo">I plan to leave</button></div></section>
        <section class="rf-card"><h2>How it works</h2><ul class="mh-ul"><li>${icon("check", 16, 2.4)} Tell your landlord early, ideally 3 months before.</li><li>${icon("check", 16, 2.4)} They reply here with the new rent if it changes.</li><li>${icon("check", 16, 2.4)} If you’d like a better rent, you can negotiate on the home’s page.</li></ul></section></div>`;
    };
    const notices = () => `<div class="sec-row mh-sr"><div><h2>Property notices</h2><p class="muted">Messages from your landlord or agent about the building.</p></div></div><section class="rf-card">${D.notes.length ? D.notes.map(noticeRow).join("") : `<div class="rf-empty small">${icon("bell", 30, 1.3)}<p>No notices. Announcements about maintenance, visitors and house rules appear here.</p></div>`}</section>`;
    const moveout = () => {
      const mo = TN.moveOut || {}, ck = mo.checklist || {}, rep = TN.reply?.moveOut, done = MOVE_STEPS.filter((s) => ck[s[0]]).length;
      return `<div class="mh-two big"><section class="rf-card"><div class="sec-row"><h2>Moving out checklist</h2><small>${done} of ${MOVE_STEPS.length} done</small></div><ol class="rf-tl mh-ck">${MOVE_STEPS.map(([k, t, d]) => `<li class="${ck[k] ? "ok" : ""}" data-ck="${k}" role="checkbox" aria-checked="${!!ck[k]}" tabindex="0"><i>${ck[k] ? icon("check", 12, 3.2) : ""}</i><div><b>${t}</b><p>${d}</p></div><span></span></li>`).join("")}</ol></section>
        <section class="rf-card"><h2>Give notice</h2>${mo.notice ? `<div class="mh-status"><span class="si">${icon("logout", 20)}</span><div><b>Notice sent for ${dlong(parse(mo.notice.date))}</b><small>${esc(mo.notice.reason)} · ${ago(mo.notice.at)}</small></div></div>` : ""}
        ${rep ? `<div class="mh-reply">${icon("msg", 18)}<div><b>Landlord’s reply</b><p>${esc(rep.text)}</p><small>${ago(rep.at)}</small></div></div>` : ""}
        <label class="rf-fl">Move-out date<input type="date" id="moDate" value="${esc(mo.notice?.date || iso(new Date(end.getTime())))}" min="${iso(new Date())}"></label>
        <label class="rf-fl">Reason<select id="moWhy">${["End of tenancy", "Moving city", "Bought a home", "Rent too high", "Home needs repairs", "Other"].map((x) => `<option ${mo.notice?.reason === x ? "selected" : ""}>${x}</option>`).join("")}</select></label>
        <button class="btn primary block" id="moSend">${mo.notice ? "Update my notice" : "Send notice to landlord"}</button>
        <h3 style="margin-top:18px">Caution deposit</h3><p class="muted">${TN.deposit ? `${naira(TN.deposit)} is held, refundable if the home is left in good order.` : "No caution deposit is on record."}</p>${mo.refund ? `<div class="mh-status"><span class="si">${icon("checkc", 20)}</span><div><b>Refund requested</b><small>${ago(mo.refund.at)}</small></div></div>` : `<button class="btn block" id="moRefund" ${TN.deposit ? "" : "disabled"}>${icon("coins", 16)} Request my caution back</button>`}</section></div>`;
    };
    // ---------- actions ----------
    const draw = () => {
      const f = { "": overview, payments, maintenance, documents, renewal, notices, moveout }[tabOk]; body.innerHTML = f(); wire();
      const dots = { maintenance: D.maint.filter((m) => m.status !== "Resolved").length, payments: unpaid().length, notices: D.notes.length };
      $$("[data-dot]", root).forEach((b) => { const n = dots[b.dataset.dot] || 0; b.hidden = !n; b.textContent = n || ""; });
    };
    const saveT = async (patch) => { try { await updateDoc(doc(db, "tenancies", TN.id), { ...patch, updatedAt: serverTimestamp() }); Object.assign(TN, patch); draw(); return true; } catch (e) { toast(friendlyErr(e)); return false; } };
    const wire = () => {
      $$("[data-pay]", body).forEach((b) => (b.onclick = async () => { try { await updateDoc(doc(db, "records", b.dataset.pay), { status: "Paid", paidOn: iso(new Date()), updatedAt: serverTimestamp() }); toast("Marked as paid. Your landlord can confirm it."); } catch (e) { toast(friendlyErr(e)); } }));
      $$("[data-delrec]", body).forEach((b) => (b.onclick = async () => { try { await deleteDoc(doc(db, "records", b.dataset.delrec)); } catch (e) { toast(friendlyErr(e)); } }));
      const add = $("#addRec", body); if (add) add.onclick = recordDialog;
      const nr = $("#newReq", body); if (nr) nr.onclick = requestDialog;
      $$(".mh-m", body).forEach((c) => {
        const m = D.maint.find((x) => x.id === c.dataset.id), push = async (status, text) => { try { await updateDoc(doc(db, "maintenance", m.id), { status, updates: [...(m.updates || []), { uid: user.uid, by: "tenant", text, status: status === m.status ? "same" : status, at: Date.now() }], updatedAt: serverTimestamp() }); } catch (e) { toast(friendlyErr(e)); } };
        const cm = $("[data-cm]", c); if (cm) cm.onclick = () => { const i = $(".mh-in", c), v = i.value.trim(); if (v) { i.value = ""; push(m.status, v); } };
        const rs = $("[data-res]", c); if (rs) rs.onclick = () => push("Resolved", "Marked as fixed.");
        const ro = $("[data-reopen]", c); if (ro) ro.onclick = () => push("Open", "Reopened: still not fixed.");
        const ph = $("[data-ph]", c); if (ph) ph.onclick = () => { const mm = modal(`<img src="${m.photo}" alt="" style="max-width:min(80vw,640px);border-radius:12px">`); };
      });
      const rnY = $("#rnYes", body), rnN = $("#rnNo", body);
      if (rnY) { rnY.onclick = () => saveT({ renewal: { choice: "renew", note: $("#rnNote", body).value.trim(), at: Date.now() } }).then((ok) => ok && toast("Your landlord has been told you’d like to renew.")); rnN.onclick = () => saveT({ renewal: { choice: "leave", note: $("#rnNote", body).value.trim(), at: Date.now() } }).then((ok) => ok && toast("Noted. See the Move out tab when you’re ready.")); }
      $$("[data-ck]", body).forEach((b) => (b.onkeydown = (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); b.click(); } }, b.onclick = () => { const mo = TN.moveOut || {}; saveT({ moveOut: { ...mo, checklist: { ...(mo.checklist || {}), [b.dataset.ck]: !(mo.checklist || {})[b.dataset.ck] } } }); }));
      const ms = $("#moSend", body); if (ms) ms.onclick = () => { const d = $("#moDate", body).value; if (!d) return toast("Choose your move-out date."); saveT({ moveOut: { ...(TN.moveOut || {}), notice: { date: d, reason: $("#moWhy", body).value, at: Date.now() }, checklist: { ...((TN.moveOut || {}).checklist || {}), notice: true } } }).then((ok) => ok && toast("Notice sent to your landlord.")); };
      const mr = $("#moRefund", body); if (mr) mr.onclick = () => saveT({ moveOut: { ...(TN.moveOut || {}), refund: { at: Date.now() }, checklist: { ...((TN.moveOut || {}).checklist || {}), refund: true } } }).then((ok) => ok && toast("Refund requested. Your landlord will arrange the inspection."));
    };
    function recordDialog() {
      const m = modal(`<div class="of-dlg"><h2>Add a record</h2><p class="muted">Track something you pay for this home.</p><label class="rf-fl">What is it for?<select id="rcK">${KINDS.map((k) => `<option>${k}</option>`).join("")}</select></label><label class="rf-fl">Label<input id="rcL" maxlength="80" placeholder="e.g. NEPA bill, October"></label><div class="f2"><label class="rf-fl">Amount (₦)<input id="rcA" inputmode="numeric" placeholder="0"></label><label class="rf-fl">Due date<input id="rcD" type="date" value="${iso(new Date())}"></label></div><label class="mh-chk"><input type="checkbox" id="rcP"> Already paid</label><p class="err" id="rcE" role="alert"></p><div class="a2-act"><button class="btn" id="rcNo">Cancel</button><button class="btn primary" id="rcGo">Save</button></div></div>`);
      $("#rcNo", m.el).onclick = m.close;
      $("#rcGo", m.el).onclick = async () => {
        const amt = +String($("#rcA", m.el).value).replace(/\D/g, ""), lab = $("#rcL", m.el).value.trim() || $("#rcK", m.el).value, err = $("#rcE", m.el);
        if (!amt) return (err.textContent = "Enter the amount.");
        try { await addDoc(collection(db, "records"), { uid: user.uid, ownerUid: TN.ownerUid || null, tenancyId: TN.id, listingId: T.l.id, kind: $("#rcK", m.el).value, label: lab, amount: amt, due: $("#rcD", m.el).value, status: $("#rcP", m.el).checked ? "Paid" : "Due", ...($("#rcP", m.el).checked ? { paidOn: iso(new Date()) } : {}), by: "tenant", createdAt: serverTimestamp() }); m.close(); toast("Record saved."); } catch (e) { err.textContent = friendlyErr(e); }
      };
    }
    function requestDialog() {
      let photo = "", cat = "Plumbing";
      const m = modal(`<div class="of-dlg"><h2>${icon("wrench", 22)} Report a problem</h2><p class="muted">Your landlord is told straight away.</p><div class="mm-chips" id="rqC">${CATS.map(([c], i) => `<button type="button" class="mm-c ${i ? "" : "on"}" data-c="${c}">${c}</button>`).join("")}</div>
        <label class="rf-fl" style="margin-top:12px">What’s wrong?<input id="rqT" maxlength="100" placeholder="e.g. Kitchen tap is leaking"></label><label class="rf-fl">Details<textarea id="rqD" rows="3" maxlength="800" placeholder="Where is it, and since when?"></textarea></label>
        <div class="f2"><label class="rf-fl">Priority<select id="rqP"><option>Normal</option><option>Urgent</option><option>Low</option></select></label><label class="rf-fl">Photo (optional)<input type="file" id="rqF" accept="image/*"></label></div><p class="err" id="rqE" role="alert"></p><div class="a2-act"><button class="btn" id="rqNo">Cancel</button><button class="btn primary" id="rqGo">Send request</button></div></div>`);
      $$("[data-c]", m.el).forEach((b) => (b.onclick = () => { cat = b.dataset.c; $$("[data-c]", m.el).forEach((x) => x.classList.toggle("on", x === b)); }));
      $("#rqF", m.el).onchange = async (e) => { const f = e.target.files[0]; if (!f) return; try { photo = await shrink(f); } catch (x) { $("#rqE", m.el).textContent = x.message; } };
      $("#rqNo", m.el).onclick = m.close;
      $("#rqGo", m.el).onclick = async () => {
        const t = $("#rqT", m.el).value.trim(), d = $("#rqD", m.el).value.trim(), err = $("#rqE", m.el); if (t.length < 4) return (err.textContent = "Say what’s wrong in a few words."); if (!d) return (err.textContent = "Add a few details.");
        const b = $("#rqGo", m.el); b.disabled = true;
        try { await addDoc(collection(db, "maintenance"), { uid: user.uid, name: user.displayName || user.email, ownerUid: TN.ownerUid || null, tenancyId: TN.id, listingId: T.l.id, title: t, desc: d, category: cat, priority: $("#rqP", m.el).value, ...(photo ? { photo } : {}), status: "Open", updates: [], createdAt: serverTimestamp(), updatedAt: serverTimestamp() }); m.close(); toast("Request sent to your landlord."); }
        catch (e) { err.textContent = friendlyErr(e); b.disabled = false; }
      };
    }
    $("#mhChat", root).onclick = async () => { try { const cid = await st.ensureConversation(user, T.l); ctx.go("#/messages/" + cid); } catch (e) { toast(friendlyErr(e)); } };
    const un = [
      watch("maintenance", "uid", "==", user.uid, (l) => { D.maint = l; draw(); }),
      watch("records", "uid", "==", user.uid, (l) => { D.recs = l.filter((r) => r.tenancyId === TN.id); draw(); }),
      watch("notices", "tenants", "array-contains", user.uid, (l) => { D.notes = l.filter((n) => n.listingId === T.l.id); draw(); }),
      onSnapshot(doc(db, "tenancies", TN.id), (s) => { if (s.exists()) { Object.assign(TN, s.data()); draw(); } }, () => {}),
    ];
    st.myDocs(user).then((d) => { D.docs = d; if (tabOk === "documents") draw(); });
    ctx.S.cleanups.push(() => un.forEach((f) => f && f()));
    draw();
  } };
}

// A photo is shrunk so it fits comfortably inside a Firestore document.
const shrink = (file) => new Promise((res, rej) => {
  if (!/^image\//.test(file.type)) return rej(new Error("Choose an image file."));
  const img = new Image(), url = URL.createObjectURL(file);
  img.onload = () => { const max = 900, k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); let q = 0.72, out = c.toDataURL("image/jpeg", q); while (out.length > 330000 && q > 0.3) { q -= 0.1; out = c.toDataURL("image/jpeg", q); } res(out); };
  img.onerror = () => rej(new Error("That picture couldn’t be read.")); img.src = url;
});
