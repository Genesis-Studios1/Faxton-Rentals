// Manual bank-transfer payments (no payment gateway).
//  - config/payments : the account renters pay into. Set by an admin (mountPaymentSettings), readable by any signed-in user.
//  - paymentProofs   : a renter says "I've paid" with a reference and an optional receipt image. The home's owner or an admin confirms or rejects it.
// Exports used by other pages:
//   getPaymentInfo(), savePaymentInfo(obj), mountPaymentSettings(rootEl, ctx)   admin settings card
//   mountProofReview(rootEl, ctx)                                               list for admins and home owners to confirm or reject proofs
//   submitProof, watchMyProofs, reviewProof, receiptHtml, openReceipt, bankCardHtml   used by the renter Payments page
import { db } from "./firebase.js";
import { collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, onSnapshot, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { $, $$, esc, naira, icon, toast, modal } from "./ui.js";
import { fxErr, xicon, statusPill, empty, copyText, fmtStamp, fmtDay, tsMs, printDialog, openStored, SUPPORT_EMAIL, supportLine, moneyInput, digits } from "./fx.js";

// ============================ the account renters pay into ============================
let cached = null, cachedAt = 0;
export async function getPaymentInfo(force = false) {
  if (cached && !force && Date.now() - cachedAt < 60000) return cached;
  let out = { configured: false, enabled: false, bankName: "", accountNumber: "", accountName: "", instructions: "" };
  try {
    const s = await getDoc(doc(db, "config", "payments"));
    if (s.exists()) { const d = s.data(); out = { configured: !!(d.bankName && d.accountNumber && d.accountName), enabled: d.enabled !== false, bankName: d.bankName || "", accountNumber: d.accountNumber || "", accountName: d.accountName || "", instructions: d.instructions || "", updatedAt: d.updatedAt || null }; }
  } catch {}
  cached = out; cachedAt = Date.now(); return out;
}
export async function savePaymentInfo(obj, user) {
  const d = { bankName: String(obj.bankName || "").trim(), accountNumber: String(obj.accountNumber || "").replace(/\s/g, ""), accountName: String(obj.accountName || "").trim(), instructions: String(obj.instructions || "").trim(), enabled: obj.enabled !== false };
  if (!d.bankName) throw Object.assign(new Error("bank"), { userMessage: "Enter the bank name." });
  if (!/^\d{10}$/.test(d.accountNumber)) throw Object.assign(new Error("acct"), { userMessage: "A Nigerian account number has 10 digits." });
  if (!d.accountName) throw Object.assign(new Error("name"), { userMessage: "Enter the account name exactly as the bank shows it." });
  if (d.instructions.length > 1200) throw Object.assign(new Error("long"), { userMessage: "Keep the instructions under 1,200 characters." });
  await setDoc(doc(db, "config", "payments"), { ...d, updatedAt: serverTimestamp(), ...(user?.uid ? { updatedBy: user.uid } : {}) });
  cached = null; return d;
}

// What renters see: the bank card with copy buttons.
export const bankCardHtml = (info) => {
  if (!info?.configured || info.enabled === false) return `<div class="rf-bank rf-bank-off"><span class="rf-bank-ic">${xicon("bank", 24, 1.5)}</span><div><b>Bank details are not set up yet</b><p>Your agent will share where to pay in Messages. Once the details are added here, you’ll be able to pay and confirm in a few taps.</p></div></div>`;
  const row = (k, v, copy) => `<div class="rf-bank-row"><span>${k}</span><b class="${copy ? "num" : ""}">${esc(v)}</b>${copy ? `<button type="button" class="rf-copy" data-copy="${esc(copy)}" aria-label="Copy ${k.toLowerCase()}">${xicon("copy", 16)}<span>Copy</span></button>` : ""}</div>`;
  return `<div class="rf-bank"><div class="rf-bank-head"><span class="rf-bank-ic">${xicon("bank", 24, 1.5)}</span><div><small>Pay by bank transfer</small><b>${esc(info.bankName)}</b></div></div>
    ${row("Account number", info.accountNumber.replace(/(\d{3})(\d{3})(\d{4})/, "$1 $2 $3"), info.accountNumber)}${row("Account name", info.accountName, info.accountName)}
    ${info.instructions ? `<p class="rf-bank-note">${esc(info.instructions).replace(/\n/g, "<br>")}</p>` : ""}</div>`;
};
export function wireCopy(root) { $$("[data-copy]", root).forEach((b) => (b.onclick = async () => toast(await copyText(b.dataset.copy, "Copied."))));  }

// ---- admin settings card (the admin engineer mounts this on the Payments page) ----
export async function mountPaymentSettings(rootEl, ctx) {
  rootEl.innerHTML = `<section class="rf-card rf-paycfg"><header class="rf-card-h"><div><h3>Bank transfer details</h3><p>Renters see this card on their Payments page and on every “I’ve paid” form. Card payments are not live yet.</p></div></header><div class="rf-load">Loading…</div></section>`;
  const info = await getPaymentInfo(true), card = $(".rf-paycfg", rootEl);
  const upd = info.updatedAt ? `Last updated ${fmtDay(info.updatedAt)}` : "Not saved yet";
  card.querySelector(".rf-load").outerHTML = `<form class="rf-form" novalidate>
      <div class="rf-grid2"><label class="rf-fl">Bank name<input id="pcBank" maxlength="80" value="${esc(info.bankName)}" placeholder="e.g. GTBank" autocomplete="off"></label>
        <label class="rf-fl">Account number<input id="pcNum" inputmode="numeric" maxlength="12" value="${esc(info.accountNumber)}" placeholder="10 digits" autocomplete="off"></label></div>
      <label class="rf-fl">Account name<input id="pcName" maxlength="120" value="${esc(info.accountName)}" placeholder="Exactly as the bank shows it" autocomplete="off"></label>
      <label class="rf-fl"><span>Instructions for renters <span class="rf-optl">(optional)</span></span><textarea id="pcNote" rows="3" maxlength="1200" placeholder="e.g. Use your full name as the transfer narration. Payments are confirmed within one working day.">${esc(info.instructions)}</textarea></label>
      <label class="rf-switch-row"><span><b>Show this on the renter Payments page</b><small>Turn off to hide the card while you change accounts.</small></span><button type="button" class="switch ${info.enabled ? "on" : ""}" role="switch" aria-checked="${info.enabled}" id="pcOn" aria-label="Show bank details to renters"><i></i></button></label>
      <p class="rf-err" id="pcErr" role="alert"></p>
      <div class="rf-actions"><button class="btn primary" type="submit">Save bank details</button><span class="rf-meta">${upd}</span></div>
    </form><div class="rf-preview"><small class="rf-eyebrow">What renters see</small><div id="pcPrev"></div></div>`;
  const prev = () => { const cur = { configured: true, enabled: true, bankName: $("#pcBank", card).value.trim() || "Bank name", accountNumber: ($("#pcNum", card).value.replace(/\D/g, "") + "0000000000").slice(0, 10), accountName: $("#pcName", card).value.trim() || "Account name", instructions: $("#pcNote", card).value.trim() }; $("#pcPrev", card).innerHTML = bankCardHtml(cur); wireCopy(card); };
  ["pcBank", "pcNum", "pcName", "pcNote"].forEach((id) => ($("#" + id, card).oninput = prev)); prev();
  const sw = $("#pcOn", card); sw.onclick = () => { const on = !sw.classList.contains("on"); sw.classList.toggle("on", on); sw.setAttribute("aria-checked", on); };
  $("form", card).onsubmit = async (e) => {
    e.preventDefault(); const err = $("#pcErr", card), b = e.target.querySelector("button[type=submit]"); err.textContent = ""; b.disabled = true;
    try { await savePaymentInfo({ bankName: $("#pcBank", card).value, accountNumber: $("#pcNum", card).value, accountName: $("#pcName", card).value, instructions: $("#pcNote", card).value, enabled: sw.classList.contains("on") }, ctx?.S?.user); toast("Bank details saved."); $(".rf-meta", card).textContent = "Last updated just now"; }
    catch (x) { err.textContent = x.userMessage || fxErr(x); } finally { b.disabled = false; }
  };
}

// ============================ proofs of payment ============================
const col = () => collection(db, "paymentProofs");
const byNew = (a, b) => tsMs(b.createdAt) - tsMs(a.createdAt);
const rows = (s) => s.docs.map((d) => ({ ...d.data(), id: d.id })).sort(byNew);
export const watchMyProofs = (uid, cb) => onSnapshot(query(col(), where("uid", "==", uid)), (s) => cb(rows(s)), () => cb([]));
export async function myProofs(uid) { try { return rows(await getDocs(query(col(), where("uid", "==", uid)))); } catch { return []; } }
export async function submitProof(user, d) {
  const data = { uid: user.uid, name: user.displayName || user.email || "Renter", ownerUid: d.ownerUid || null, listingId: d.listingId, title: String(d.title || "").slice(0, 200), ...(d.applicationId ? { applicationId: d.applicationId } : {}), forLabel: String(d.forLabel || "").slice(0, 120), amount: Math.round(+d.amount), reference: String(d.reference || "").trim().slice(0, 80), paidOn: d.paidOn || "", note: String(d.note || "").trim().slice(0, 500), ...(d.proof ? { proof: d.proof, proofName: String(d.proofName || "receipt").slice(0, 160) } : {}), status: "Submitted", createdAt: serverTimestamp() };
  return addDoc(col(), data);
}
export async function reviewProof(ctx, p, status, note = "") {
  await updateDoc(doc(db, "paymentProofs", p.id), { status, reviewNote: String(note || "").slice(0, 400), reviewedAt: serverTimestamp(), reviewedBy: ctx.S.user.uid });
  // Only admins may create notifications under the rules; for owners the renter sees the new status on their Payments page.
  if (ctx.S.isAdmin) addDoc(collection(db, "notifications"), { uid: p.uid, read: false, kind: "payment", title: status === "Confirmed" ? "Payment confirmed" : "Payment needs attention", body: status === "Confirmed" ? `Your payment of ${naira(p.amount)} for ${p.title} was confirmed. Your receipt is ready.` : `We couldn’t match your payment of ${naira(p.amount)} for ${p.title}.${note ? " " + note : ""}`, href: "/payments", createdAt: serverTimestamp() }).catch(() => {});
}
export const receiptNo = (p) => "FR-" + String(p.id || "").slice(0, 6).toUpperCase();

// ---- the printable receipt ----
export const receiptHtml = (p, info) => `<article class="rf-receipt">
  <header><div class="rf-rc-brand"><b>Faxton</b> Rentals</div><div class="rf-rc-no"><small>Receipt</small><b>${esc(receiptNo(p))}</b></div></header>
  <div class="rf-rc-amt"><small>Amount received</small><b class="num">${naira(p.amount)}</b>${statusPill("Confirmed")}</div>
  <dl class="rf-rc-kv"><div><dt>Paid by</dt><dd>${esc(p.name || "Renter")}</dd></div><div><dt>For</dt><dd>${esc(p.forLabel || "Rental payment")}</dd></div><div><dt>Property</dt><dd>${esc(p.title || "")}</dd></div>
  <div><dt>Date paid</dt><dd>${esc(p.paidOn ? new Date(p.paidOn + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : fmtDay(p.createdAt))}</dd></div><div><dt>Bank reference</dt><dd class="num">${esc(p.reference || "—")}</dd></div>
  <div><dt>Confirmed on</dt><dd>${esc((p.reviewedAt || p.decidedAt) ? fmtDay(p.reviewedAt || p.decidedAt) : "—")}</dd></div>${info?.configured ? `<div><dt>Paid into</dt><dd>${esc(info.bankName)} · ${esc(info.accountName)}</dd></div>` : ""}</dl>
  <footer><p>This receipt was issued by Faxton Rentals after your payment was matched to the bank transfer. Keep it with your tenancy documents.</p><p class="rf-rc-small">${esc(supportLine())}</p></footer></article>`;
export async function openReceipt(p, info) {
  info = info || (await getPaymentInfo());
  const m = modal(`<div class="rf-dlg rf-rcpt">${receiptHtml(p, info)}<div class="rf-dlg-act rf-noprint"><button type="button" class="btn" data-copyref>${xicon("copy", 16)} Copy receipt number</button><button type="button" class="btn primary" data-print>${xicon("print", 18)} Print or save as PDF</button></div></div>`);
  m.el.classList.add("rf-rcpt-dlg");
  $("[data-print]", m.el).onclick = () => printDialog(m.el);
  $("[data-copyref]", m.el).onclick = async () => toast(await copyText(receiptNo(p), "Receipt number copied."));
}
export function openProofImage(p) {
  if (!p.proof) return;
  if (/^data:image\//.test(p.proof)) { const m = modal(`<div class="rf-dlg rf-img"><h2>Proof of payment</h2><img src="${esc(p.proof)}" alt="Proof of payment"><div class="rf-dlg-act"><button type="button" class="btn" data-dl>Download</button></div></div>`); $("[data-dl]", m.el).onclick = () => openStored(p.proof, p.proofName || "proof.jpg", true); }
  else openStored(p.proof, p.proofName || "proof.pdf");
}

// ============================ review list for admins and home owners ============================
export function mountProofReview(rootEl, ctx) {
  const me = ctx.S.user.uid, isAdmin = !!ctx.S.isAdmin;
  rootEl.innerHTML = `<section class="rf-card rf-review"><header class="rf-card-h"><div><h3>Payment proofs</h3><p>Renters who say they’ve paid by bank transfer. Check your bank statement, then confirm or reject.</p></div><div class="rf-seg" role="tablist" id="prTabs"></div></header><div id="prList"><div class="rf-load">Loading…</div></div></section>`;
  let list = [], tab = "Submitted";
  const draw = () => {
    const cnt = (s) => list.filter((p) => s === "all" || p.status === s).length;
    $("#prTabs", rootEl).innerHTML = [["Submitted", "To review"], ["Confirmed", "Confirmed"], ["Rejected", "Rejected"], ["all", "All"]].map(([k, l]) => `<button type="button" role="tab" class="${tab === k ? "on" : ""}" data-t="${k}">${l} <b>${cnt(k)}</b></button>`).join("");
    const L = list.filter((p) => tab === "all" || p.status === tab);
    $("#prList", rootEl).innerHTML = L.length ? `<div class="rf-tbl-wrap"><table class="rf-tbl"><thead><tr><th>Renter</th><th>Property</th><th class="r">Amount</th><th>Reference</th><th>Sent</th><th>Status</th><th></th></tr></thead><tbody>${L.map((p) => `<tr data-id="${esc(p.id)}"><td><b>${esc(p.name || "Renter")}</b></td><td>${esc(p.title)}<small>${esc(p.forLabel || "")}</small></td><td class="r num"><b>${naira(p.amount)}</b></td><td class="num">${esc(p.reference || "—")}</td><td>${esc(fmtStamp(p.createdAt))}</td><td>${statusPill(p.status)}</td>
      <td class="rf-row-act"><div class="rf-act">${p.proof ? `<button type="button" class="btn sm" data-proof>${xicon("image", 15)} Receipt</button>` : ""}${p.status === "Submitted" ? `<button type="button" class="btn sm primary" data-ok>Confirm</button><button type="button" class="btn sm" data-no>Reject</button>` : ""}</div></td></tr>`).join("")}</tbody></table></div>`
      : empty({ ic: "wallet", title: tab === "Submitted" ? "Nothing to review" : "Nothing here yet", hint: "When a renter sends proof of a bank transfer, it appears here." });
    $$("[data-t]", rootEl).forEach((b) => (b.onclick = () => { tab = b.dataset.t; draw(); }));
    $$("tr[data-id]", rootEl).forEach((tr) => {
      const p = list.find((x) => x.id === tr.dataset.id), run = async (status, note) => { try { await reviewProof(ctx, p, status, note); toast(status === "Confirmed" ? "Payment confirmed. The renter can print a receipt." : "Payment rejected. The renter has been told."); } catch (e) { toast(fxErr(e)); } };
      const ok = $("[data-ok]", tr), no = $("[data-no]", tr), pf = $("[data-proof]", tr);
      if (pf) pf.onclick = () => openProofImage(p);
      if (ok) ok.onclick = () => run("Confirmed", "");
      if (no) no.onclick = () => { const m = modal(`<div class="rf-dlg"><h2>Reject this payment?</h2><p class="rf-dlg-p">Tell ${esc(p.name || "the renter")} why, so they can fix it.</p><label class="rf-fl">Reason<textarea id="rjN" rows="3" maxlength="400" placeholder="e.g. We could not find ${naira(p.amount)} on the statement yet."></textarea></label><div class="rf-dlg-act"><button class="btn" data-x>Cancel</button><button class="btn red" data-go>Reject</button></div></div>`); $("[data-x]", m.el).onclick = m.close; $("[data-go]", m.el).onclick = () => { const n = $("#rjN", m.el).value.trim(); m.close(); run("Rejected", n); }; };
    });
  };
  const un = onSnapshot(isAdmin ? col() : query(col(), where("ownerUid", "==", me)), (s) => { list = rows(s); draw(); }, () => { list = []; draw(); });
  ctx.S.cleanups?.push(() => un());
  return () => un();
}
export { SUPPORT_EMAIL, moneyInput, digits };
