// Make an offer: renters propose a yearly rent, owners accept, counter or decline, and the whole negotiation is kept.
import { db } from "./firebase.js";
import { collection, doc, getDoc, addDoc, updateDoc, onSnapshot, query, where, getDocs, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { $, $$, esc, naira, icon, toast, modal, friendlyErr } from "./ui.js";
import { moveIn } from "./area.js";

const FINAL = ["Accepted", "Declined", "Withdrawn"];
export const isOpen = (o) => !FINAL.includes(o.status);
const pctOff = (ask, v) => Math.round(((ask - v) / ask) * 100);
const round10k = (n) => Math.round(n / 1e4) * 1e4;
const ago = (t) => { const s = t ? (typeof t === "number" ? t / 1000 : t.seconds) : 0; if (!s) return "Just now"; const d = Math.max(0, Date.now() / 1000 - s); return d < 60 ? "Just now" : d < 3600 ? Math.floor(d / 60) + " min ago" : d < 86400 ? Math.floor(d / 3600) + " h ago" : new Date(s * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); };
const digits = (v) => +String(v).replace(/\D/g, "") || 0;

// ---- data ----
const list = (s) => s.docs.map((d) => ({ ...d.data(), id: d.id })).sort((a, b) => (b.updatedAt?.seconds || b.createdAt?.seconds || 0) - (a.updatedAt?.seconds || a.createdAt?.seconds || 0));
export const watchSent = (uid, cb) => onSnapshot(query(collection(db, "offers"), where("uid", "==", uid)), (s) => cb(list(s)), () => cb([]));
export const watchReceived = (uid, cb) => onSnapshot(query(collection(db, "offers"), where("ownerUid", "==", uid)), (s) => cb(list(s)), () => cb([]));
export const watchAll = (cb) => onSnapshot(collection(db, "offers"), (s) => cb(list(s)), () => cb([]));
export async function getOffer(id) { try { const s = await getDoc(doc(db, "offers", id)); return s.exists() ? { ...s.data(), id: s.id } : null; } catch { return null; } }
export async function myOpenOffer(uid, listingId) {
  try { return list(await getDocs(query(collection(db, "offers"), where("uid", "==", uid)))).find((o) => o.listingId === listingId && (isOpen(o) || o.status === "Accepted")) || null; } catch { return null; }
}
const ping = (to, title, body, ref) => { if (!to) return; addDoc(collection(db, "notifications"), { uid: to, read: false, kind: "offer", title, body, href: "/offers", ref, createdAt: serverTimestamp() }).catch(() => {}); };

export async function sendOffer(user, l, amount, note) {
  const entry = { by: "renter", uid: user.uid, type: "offer", amount, note: note || "", at: Date.now() };
  const ref = await addDoc(collection(db, "offers"), { uid: user.uid, name: user.displayName || user.email, ownerUid: l.ownerUid || null, ownerName: l.agent?.name || "Owner", listingId: l.id, title: l.title, area: l.area, image: l.thumb || l.images[0], listPrice: l.price, service: +l.service || 0, deposit: +l.deposit || 0, ...(l.agencyFee != null && l.agencyFee !== "" ? { agencyFee: +l.agencyFee } : {}), ...(l.legalFee != null && l.legalFee !== "" ? { legalFee: +l.legalFee } : {}), amount, status: "Pending", turn: "owner", history: [entry], createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  ping(l.ownerUid, "New rent offer", `${user.displayName || "A renter"} offered ${naira(amount)} a year for ${l.title}.`, ref.id);
  return ref.id;
}
// side: "renter" | "owner"; action: accept | counter | decline | withdraw
export async function respond(o, user, side, action, amount, note = "") {
  const type = action, amt = action === "counter" ? amount : o.amount;
  const status = action === "accept" ? "Accepted" : action === "counter" ? (side === "owner" ? "Countered" : "Pending") : side === "owner" ? "Declined" : "Withdrawn";
  const turn = action === "counter" ? (side === "owner" ? "renter" : "owner") : "";
  await updateDoc(doc(db, "offers", o.id), { status, amount: amt, turn, history: [...o.history, { by: side, uid: user.uid, type, amount: amt, note, at: Date.now() }], updatedAt: serverTimestamp() });
  const to = side === "owner" ? o.uid : o.ownerUid, who = side === "owner" ? o.ownerName || "The owner" : o.name || "The renter";
  ping(to, { accept: "Offer accepted", counter: "New counter-offer", decline: "Offer declined", withdraw: "Offer withdrawn" }[action], `${who} ${{ accept: "accepted", counter: "countered with", decline: "declined", withdraw: "withdrew" }[action]} ${action === "counter" || action === "accept" ? naira(amt) + " a year" : "the offer"} for ${o.title}.`, o.id);
}

// ---- the offer dialog on a listing ----
export function offerDialog(ctx, l, done) {
  const ask = l.price, min = Math.round(ask * 0.5);
  const m = modal(`<div class="of-dlg"><h2>${icon("tag", 22)} Make an offer</h2><p class="muted">Offer a yearly rent. The owner can accept, counter or decline, and everything stays on record.</p>
    <div class="of-ask"><span>Asking rent</span><b>${naira(ask)} / year</b></div>
    <label class="field">Your offer (per year)<div class="of-in"><span>₦</span><input id="ofAmt" inputmode="numeric" autocomplete="off" placeholder="${Math.round(ask * 0.92).toLocaleString("en-NG")}" aria-label="Your offer per year"></div></label>
    <div class="of-chips">${[5, 8, 10, 15].map((p) => `<button type="button" data-p="${p}">${p}% off<small>${naira(round10k(ask * (1 - p / 100)))}</small></button>`).join("")}</div>
    <div class="of-sum" id="ofSum" aria-live="polite"></div>
    <label class="field">Message to the owner (optional)<textarea id="ofNote" rows="2" maxlength="300" placeholder="For example: I can pay the full year upfront."></textarea></label>
    <p class="err" id="ofErr" role="alert"></p><div class="a2-act"><button class="btn" type="button" id="ofNo">Cancel</button><button class="btn primary" type="button" id="ofGo">Send offer ${icon("arrow", 18)}</button></div></div>`);
  const amt = $("#ofAmt", m.el);
  const sum = () => {
    const v = digits(amt.value), box = $("#ofSum", m.el);
    if (!v) { box.innerHTML = ""; return; }
    const off = pctOff(ask, v), mi = moveIn(l, v), full = moveIn(l).total;
    box.innerHTML = v >= ask ? `<p class="of-warn">That’s not below the asking rent. You can simply apply at ${naira(ask)}.</p>` : `<div><span>You save</span><b>${naira(ask - v)} a year (${off}%)</b></div><div><span>Move-in cost at this rent</span><b>${naira(mi.total)}</b><small>instead of ${naira(full)}</small></div>${v < ask * 0.7 ? `<p class="of-warn">Offers more than 30% below the asking rent are rarely accepted.</p>` : ""}`;
  };
  amt.oninput = () => { const v = digits(amt.value); amt.value = v ? v.toLocaleString("en-NG") : ""; sum(); };
  $$("[data-p]", m.el).forEach((b) => (b.onclick = () => { amt.value = round10k(ask * (1 - +b.dataset.p / 100)).toLocaleString("en-NG"); sum(); }));
  $("#ofNo", m.el).onclick = m.close;
  $("#ofGo", m.el).onclick = async () => {
    const v = digits(amt.value), err = $("#ofErr", m.el); err.textContent = "";
    if (!v) return (err.textContent = "Enter the yearly rent you would like to offer.");
    if (v >= ask) return (err.textContent = "Your offer must be below the asking rent.");
    if (v < min) return (err.textContent = `Offers must be at least ${naira(min)} (half the asking rent).`);
    const b = $("#ofGo", m.el); b.disabled = true;
    try { const ex = await myOpenOffer(ctx.S.user.uid, l.id); if (ex && isOpen(ex)) { m.close(); toast("You already have an offer on this home."); return ctx.go("#/offers"); }
      await sendOffer(ctx.S.user, l, v, $("#ofNote", m.el).value.trim()); m.close(); toast("Offer sent. You’ll be notified when the owner replies."); done?.(); ctx.go("#/offers"); }
    catch (e) { err.textContent = friendlyErr(e); b.disabled = false; }
  };
  setTimeout(() => amt.focus(), 60);
}

// ---- counter dialog (either side) ----
function counterDialog(o, ctx, side) {
  const ask = o.listPrice, mid = round10k((o.amount + (side === "owner" ? ask : o.amount)) / 2);
  const m = modal(`<div class="of-dlg"><h2>${icon("refresh", 22)} Counter-offer</h2><p class="muted">Current offer ${naira(o.amount)} · asking ${naira(ask)}.</p>
    <label class="field">Your counter (per year)<div class="of-in"><span>₦</span><input id="coAmt" inputmode="numeric" autocomplete="off" value="${mid.toLocaleString("en-NG")}"></div></label>
    <label class="field">Message (optional)<textarea id="coNote" rows="2" maxlength="300"></textarea></label><p class="err" id="coErr" role="alert"></p>
    <div class="a2-act"><button class="btn" type="button" id="coNo">Cancel</button><button class="btn primary" type="button" id="coGo">Send counter</button></div></div>`);
  const amt = $("#coAmt", m.el); amt.oninput = () => { const v = digits(amt.value); amt.value = v ? v.toLocaleString("en-NG") : ""; };
  $("#coNo", m.el).onclick = m.close;
  $("#coGo", m.el).onclick = async () => {
    const v = digits(amt.value), err = $("#coErr", m.el); if (!v || v < ask * 0.5 || v > ask) return (err.textContent = `Enter an amount between ${naira(Math.round(ask * 0.5))} and ${naira(ask)}.`);
    if (v === o.amount) return (err.textContent = "That’s the same as the current offer. Choose Accept instead.");
    const b = $("#coGo", m.el); b.disabled = true;
    try { await respond(o, ctx.S.user, side, "counter", v, $("#coNote", m.el).value.trim()); m.close(); toast("Counter-offer sent."); } catch (e) { err.textContent = friendlyErr(e); b.disabled = false; }
  };
}

// ---- the Offers page ----
const STATUS_TONE = { Pending: "warn", Countered: "warn", Accepted: "", Declined: "bad", Withdrawn: "bad" };
const label = (e, o, me) => {
  const who = e.uid === me ? "You" : e.by === "owner" ? o.ownerName || "The owner" : o.name || "The renter";
  return { offer: `${who} offered`, counter: `${who} countered at`, accept: `${who} accepted`, decline: `${who} declined`, withdraw: `${who} withdrew the offer` }[e.type] || who;
};
function card(o, me, isAdmin) {
  const iRenter = o.uid === me, iOwner = !iRenter && (o.ownerUid === me || (!o.ownerUid && isAdmin));
  const myTurn = (iOwner && o.turn === "owner") || (iRenter && o.turn === "renter");
  const off = pctOff(o.listPrice, o.amount);
  const state = o.status === "Accepted" ? `Agreed at ${naira(o.amount)} a year.` : o.status === "Declined" ? "The owner declined this offer." : o.status === "Withdrawn" ? "The renter withdrew this offer." : myTurn ? "It’s your turn to respond." : o.turn === "owner" ? "Waiting for the owner to reply." : "Waiting for the renter to reply.";
  const acts = [];
  if (isOpen(o)) {
    if (iOwner && o.turn === "owner") acts.push(`<button class="btn primary" data-a="accept">Accept ${naira(o.amount)}</button><button class="btn" data-a="counter">Counter</button><button class="btn red" data-a="decline">Decline</button>`);
    if (iRenter && o.turn === "renter") acts.push(`<button class="btn primary" data-a="accept">Accept ${naira(o.amount)}</button><button class="btn" data-a="counter">Counter again</button><button class="btn red" data-a="withdraw">Withdraw</button>`);
    if (iRenter && o.turn === "owner") acts.push(`<button class="btn red" data-a="withdraw">Withdraw offer</button>`);
  }
  if (iRenter && o.status === "Accepted") acts.push(`<a class="btn primary" href="#/apply/${esc(o.listingId)}?offer=${esc(o.id)}">Apply at ${naira(o.amount)} ${icon("arrow", 18)}</a>`);
  if ((iRenter || iOwner) && o.status === "Declined" && iRenter) acts.push(`<a class="btn" href="#/home/${esc(o.listingId)}">View the home</a>`);
  return `<article class="of-card" data-id="${esc(o.id)}"><header><a href="#/home/${esc(o.listingId)}"><img src="${esc(o.image || "img/palm-court.webp")}" alt=""></a><div><h3><a href="#/home/${esc(o.listingId)}">${esc(o.title)}</a></h3><p class="muted">${icon("pin", 14)} ${esc(o.area)}${iRenter ? "" : " · from " + esc(o.name || "a renter")}</p></div><span class="pill ${STATUS_TONE[o.status] === "bad" ? "bad" : STATUS_TONE[o.status] === "warn" ? "warn" : ""}">${esc(o.status)}</span></header>
    <div class="of-nums"><div><small>Asking rent</small><b>${naira(o.listPrice)}</b></div><div><small>${o.status === "Accepted" ? "Agreed rent" : "Latest offer"}</small><b>${naira(o.amount)}</b><em>${off > 0 ? "−" + off + "%" : ""}</em></div><div><small>Move-in cost</small><b>${naira(moveIn({ price: o.listPrice, service: o.service, deposit: o.deposit, agencyFee: o.agencyFee, legalFee: o.legalFee }, o.amount).total)}</b></div></div>
    <p class="of-state ${myTurn ? "me" : ""}">${icon(myTurn ? "bell" : o.status === "Accepted" ? "checkc" : "clock", 16)} ${state}</p>
    <ol class="of-tl">${o.history.map((e) => `<li class="${e.type}"><i></i><div><b>${esc(label(e, o, me))}${e.type === "offer" || e.type === "counter" || e.type === "accept" ? " " + naira(e.amount) : ""}</b>${e.note ? `<p>“${esc(e.note)}”</p>` : ""}<small>${ago(e.at)}</small></div></li>`).join("")}</ol>
    ${acts.length ? `<div class="of-act">${acts.join("")}</div>` : ""}</article>`;
}

export function offersPage(ctx, rentalsNav) {
  const me = ctx.S.user.uid, isAdmin = ctx.S.isAdmin, ownerRole = ["landlord", "agency", "agent"].includes(ctx.S.role);
  const staff = isAdmin ? { admin: true, pending: 0 } : ownerRole ? { role: ctx.S.role } : {};
  const html = `<div class="wrap pg of-pg">${staff.admin || staff.role ? "" : rentalsNav("/offers")}<div class="page-head"><div><h1>Rent offers</h1><p>${isAdmin ? "Every negotiation on the platform." : "Offers and counter-offers, with the full history of each."}</p></div></div>
    <div class="pill-tabs" id="ofTabs" role="tablist"></div><div id="ofList" class="of-list"></div></div>`;
  return { title: "Rent offers", ...staff, html, mount(root) {
    let sent = [], recv = [], all = [], tab = (isAdmin || ownerRole) ? "recv" : "sent";
    const draw = () => {
      const recvList = isAdmin ? all : recv, mine = isAdmin ? [] : sent;
      const tabs = [["recv", isAdmin ? "All offers" : "Received", recvList], ...(isAdmin ? [] : [["sent", "My offers", mine]])].filter(([k]) => k === "sent" || isAdmin || ownerRole || recv.length);
      if (!tabs.some(([k]) => k === tab)) tab = tabs[0][0];
      $("#ofTabs", root).innerHTML = tabs.length > 1 ? tabs.map(([k, t, l]) => `<button type="button" role="tab" class="${k === tab ? "on" : ""}" data-t="${k}">${t} <b>${l.length}</b></button>`).join("") : "";
      const cur = (tabs.find(([k]) => k === tab) || tabs[0])[2];
      $("#ofList", root).innerHTML = cur.length ? cur.map((o) => card(o, me, isAdmin)).join("") : `<div class="empty">${icon("tag", 36, 1.3)}<h3>No offers yet</h3><p>${tab === "sent" ? "Open a home and tap “Make an offer” to propose a rent." : "When a renter makes an offer on one of your homes, it appears here."}</p>${tab === "sent" ? `<p style="margin-top:14px"><a class="btn primary" href="#/search">Find a home</a></p>` : ""}</div>`;
      $$("[data-t]", root).forEach((b) => (b.onclick = () => { tab = b.dataset.t; draw(); }));
      $$(".of-card [data-a]", root).forEach((b) => (b.onclick = async () => {
        const o = [...sent, ...recv, ...all].find((x) => x.id === b.closest(".of-card").dataset.id); if (!o) return;
        const side = o.uid === me ? "renter" : "owner", a = b.dataset.a;
        if (a === "counter") return counterDialog(o, ctx, side);
        if (a === "decline" || a === "withdraw") { const m = modal(`<div class="of-dlg"><h2>${a === "decline" ? "Decline this offer?" : "Withdraw your offer?"}</h2><p class="muted">${a === "decline" ? "The renter will be told you declined." : "The owner will be told you withdrew it."}</p><div class="a2-act"><button class="btn" id="cfNo">Keep it</button><button class="btn red" id="cfYes">${a === "decline" ? "Decline" : "Withdraw"}</button></div></div>`); $("#cfNo", m.el).onclick = m.close; $("#cfYes", m.el).onclick = () => { m.close(); run(o, side, a, b); }; return; }
        run(o, side, a, b);
      }));
    };
    const run = async (o, side, a, b) => {
        b.disabled = true;
        try { await respond(o, ctx.S.user, side, a, o.amount); toast({ accept: "Offer accepted.", decline: "Offer declined.", withdraw: "Offer withdrawn." }[a]); } catch (e) { toast(friendlyErr(e)); b.disabled = false; }
    };
    const un = [];
    if (isAdmin) un.push(watchAll((l) => { all = l; draw(); }));
    else { un.push(watchSent(me, (l) => { sent = l; draw(); })); un.push(watchReceived(me, (l) => { recv = l; draw(); })); }
    ctx.S.cleanups.push(() => un.forEach((f) => f && f()));
    draw();
  } };
}
