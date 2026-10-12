// The renter's Payments page: pay by bank transfer, say "I've paid", follow the confirmation, print receipts.
// (Card payments are not live yet; the page says so plainly.)
import { $, $$, esc, naira, icon, toast, modal } from "./ui.js";
import * as st from "./store.js";
import * as AREA from "./area.js";
import * as PAY from "./paymentinfo.js";
import { fxErr, xicon, statusPill, empty, fmtDay, fmtStamp, tsMs, isoDay, longDay, shrinkImage, readSmallFile, moneyInput, digits } from "./fx.js";

const FOR = ["First payment (move-in total)", "Annual rent", "Service charge", "Caution deposit", "Agency and legal fees", "Something else"];
const COST_ROWS = (l, rent) => { const m = AREA.moveIn(l, rent); return { m, html: `<div class="rf-kv">${m.items.map(([t, v, , note]) => `<div><span>${esc(t)}${note === "Refundable" ? " (refundable)" : ""}</span><b>${naira(v)}</b></div>`).join("")}<div class="total"><span>Total due on move-in</span><b>${naira(m.total)}</b></div></div>` }; };

export async function paymentsPage(ctx, rentalsNav) {
  const u = ctx.S.user;
  const [apps, listings, info] = await Promise.all([st.myApplications(u), st.getListings(), PAY.getPaymentInfo()]);
  const live = apps.filter((a) => !/withdr|reject|declin/i.test(a.status)).map((a) => ({ ...a, l: listings.find((x) => x.id === a.listingId) || { id: a.listingId, title: a.title, area: a.area, city: "", images: [a.image], thumb: a.image, price: a.rent || 0, service: 0, deposit: 0, beds: 0, baths: 0, agent: { name: "Your agent" }, gone: true } }));
  live.sort((a, b) => (/approved|active/i.test(b.status) ? 1 : 0) - (/approved|active/i.test(a.status) ? 1 : 0));
  let sel = (ctx.q.app && live.find((a) => a.id === ctx.q.app)?.id) || live[0]?.id || "", proofs = [];
  const cur = () => live.find((a) => a.id === sel) || null;
  const sumFor = (listingId, status) => proofs.filter((p) => p.listingId === listingId && (!status || p.status === status)).reduce((s, p) => s + (+p.amount || 0), 0);

  return { title: "Payments", html: `<div class="rf">${rentalsNav("/payments")}<header class="rf-ph"><div><span class="rf-eyebrow">My rentals</span><h1 class="rf-h1">Payments</h1><p class="rf-sub">Pay by bank transfer, tell us once it’s done, and get a receipt when it’s confirmed.</p></div><div class="rf-ph-a"><button type="button" class="btn primary" id="paidTop">${icon("check", 18)} I’ve paid</button></div></header><div id="payBody"><div class="rf-skel"><i></i><i></i></div></div></div>`,
    mount(root) {
      const body = $("#payBody", root);
      const draw = () => {
        const a = cur(), l = a?.l, rent = a ? a.rent || l.price : 0, { m, html: costHtml } = l ? COST_ROWS(l, rent) : { m: null, html: "" };
        const total = m ? (l.gone ? a.amount || 0 : m.total) : 0;
        const confirmed = l ? sumFor(l.id, "Confirmed") : 0, waiting = l ? sumFor(l.id, "Submitted") : 0, left = m ? Math.max(0, total - confirmed) : 0;
        const pct = m ? Math.min(100, Math.round((confirmed / Math.max(1, total)) * 100)) : 0;
        const homeCard = a ? `<section class="rf-card"><div class="rf-pay-home"><img src="${esc(l.thumb || l.images?.[0] || "")}" alt=""><div><h2>${esc(l.title)}</h2><p class="rf-loc">${icon("pin", 15)} ${esc(l.area)}${l.city && !String(l.area).includes(l.city) ? ", " + esc(l.city) : ""}</p><div class="rf-pay-meta">${statusPill(a.status)}${live.length > 1 ? `<label class="rf-pay-sw"><span class="sr">Choose a home</span><select id="payHome" aria-label="Choose a home">${live.map((x) => `<option value="${esc(x.id)}" ${x.id === sel ? "selected" : ""}>${esc(x.l.title)}</option>`).join("")}</select></label>` : ""}</div></div></div>
          <div class="rf-pay-prog" role="img" aria-label="${pct}% of the move-in cost is confirmed"><i style="width:${pct}%"></i></div><p class="rf-meta">${naira(confirmed)} confirmed of ${naira(total)}</p></section>`
          : `<section class="rf-card">${empty({ ic: "wallet", title: "Nothing to pay yet", hint: "When you apply for a home and your agent approves it, the amount due and your payment details appear here.", action: `<div class="rf-btns"><a class="btn primary" href="#/search">Find a home</a><a class="btn" href="#/applications">My applications</a></div>` })}</section>`;
        const stats = a ? `<div class="rf-stats"><div class="rf-stat"><span>${xicon("checkc", 20)}</span><div><small>Confirmed paid</small><b>${naira(confirmed)}</b><p>${confirmed ? "Receipts are ready below." : "Nothing confirmed yet."}</p></div></div>
          <div class="rf-stat"><span>${xicon("clock", 20)}</span><div><small>Waiting to be confirmed</small><b>${naira(waiting)}</b><p>${waiting ? "We’re matching it to the bank account." : "Nothing waiting."}</p></div></div>
          <div class="rf-stat"><span>${xicon("wallet", 20)}</span><div><small>Still to pay</small><b>${naira(left)}</b><p>${left ? "Due when you move in." : "You’re all paid up."}</p></div></div></div>` : "";
        const mine = proofs;
        const hist = `<section class="rf-card"><div class="rf-card-h"><div><h2>Payment history</h2><p>Every transfer you’ve told us about, with its status.</p></div></div>
          ${mine.length ? `<div class="rf-tbl-wrap fold"><table class="rf-tbl fold"><thead><tr><th>What for</th><th class="r">Amount</th><th>Reference</th><th>Sent</th><th>Status</th><th></th></tr></thead><tbody>${mine.map((p) => `<tr data-id="${esc(p.id)}">
            <td class="main" data-l="What for"><b>${esc(p.forLabel || "Rental payment")}</b><small>${esc(p.title || "")}</small></td><td class="r num" data-l="Amount"><b>${naira(p.amount)}</b></td><td class="num ref" data-l="Reference">${esc(p.reference || "—")}</td><td class="sent" data-l="Sent">${esc(fmtDay(p.createdAt))}</td><td class="end" data-l="Status">${statusPill(p.status)}</td>
            <td class="rf-row-act"><div class="rf-act">${p.status === "Confirmed" ? `<button type="button" class="btn sm primary" data-rc>${xicon("receipt", 15)} Receipt</button>` : ""}${p.status === "Rejected" ? `<button type="button" class="btn sm" data-again>Send again</button>` : ""}<button type="button" class="btn sm" data-tl>Track</button>${p.proof ? `<button type="button" class="rf-iconbtn" data-pf aria-label="View your proof">${xicon("image", 18)}</button>` : ""}</div></td></tr>`).join("")}</tbody></table></div>`
            : empty({ ic: "receipt", title: "No payments yet", hint: "After you pay, tap “I’ve paid” and add your bank reference. It shows up here.", action: a ? `<button type="button" class="btn primary" data-paid>${icon("check", 18)} I’ve paid</button>` : "" })}</section>`;
        const costs = a && !l.gone ? `<section class="rf-card"><div class="rf-card-h"><div><h2>What you pay to move in</h2><p>The agent confirms the final figures in your agreement.</p></div></div>${costHtml}</section>` : "";
        const side = `<div class="rf-col rf-pay-side"><section class="rf-card"><div class="rf-card-h"><div><h2>Pay by bank transfer</h2><p>No card needed. Send the money from your bank app.</p></div></div>${PAY.bankCardHtml(info)}
          <ol class="rf-steps-mini" style="margin-top:14px"><li><span><b>Transfer the amount</b> to the account above and keep your bank’s receipt.</span></li><li><span><b>Tap “I’ve paid”</b> and add the reference, plus a screenshot if you can.</span></li><li><span><b>We confirm it</b> against the account, usually within one working day. You’ll get a receipt.</span></li></ol>
          <button type="button" class="btn primary block" id="paidSide" style="margin-top:14px" ${a ? "" : "disabled"}>${icon("check", 18)} I’ve paid</button>
          ${a ? "" : `<p class="rf-meta" style="margin-top:8px">Apply for a home first, then you can send a payment.</p>`}</section>
          <div class="rf-soon">${xicon("card", 18)}<div><b>Card payments are coming.</b> We’re setting up secure online payments. Until then, bank transfer is the way to pay, and your money only goes to the account shown here. Never pay into any other account.</div></div></div>`;
        body.innerHTML = `${stats}<div class="rf-grid"><div class="rf-col">${homeCard}${hist}${costs}</div>${side}</div>`;
        wire();
      };
      const wire = () => {
        PAY.wireCopy(body);
        const hs = $("#payHome", body); if (hs) hs.onchange = () => { sel = hs.value; draw(); };
        $$("[data-paid]", body).forEach((b) => (b.onclick = () => paidDialog()));
        const side = $("#paidSide", body); if (side) side.onclick = () => paidDialog();
        $$("tr[data-id]", body).forEach((tr) => {
          const p = proofs.find((x) => x.id === tr.dataset.id); if (!p) return;
          const rc = $("[data-rc]", tr), tl = $("[data-tl]", tr), pf = $("[data-pf]", tr), ag = $("[data-again]", tr);
          if (rc) rc.onclick = () => PAY.openReceipt(p, info);
          if (tl) tl.onclick = () => trackDialog(p);
          if (pf) pf.onclick = () => PAY.openProofImage(p);
          if (ag) ag.onclick = () => paidDialog(p);
        });
      };
      $("#paidTop", root).onclick = () => paidDialog();

      function trackDialog(p) {
        const ok = p.status === "Confirmed", bad = p.status === "Rejected", sub = p.status === "Submitted";
        const m = modal(`<div class="rf-dlg"><h2>Payment status</h2><div class="rf-due"><div><small>${esc(p.forLabel || "Rental payment")}</small><br><small>${esc(p.title || "")}</small></div><b>${naira(p.amount)}</b></div>
          <ol class="rf-tl"><li class="ok"><i>${icon("check", 12, 3.2)}</i><div><b>You sent it</b><p>Reference <span class="num">${esc(p.reference || "—")}</span>${p.paidOn ? `, paid on ${esc(longDay(p.paidOn))}` : ""}.</p></div><span>${esc(fmtStamp(p.createdAt))}</span></li>
          <li class="${sub ? "cur" : "ok"}"><i>${sub ? "" : icon("check", 12, 3.2)}</i><div><b>Being checked</b><p>The home owner or Faxton matches it to the bank account.</p></div><span></span></li>
          <li class="${ok ? "ok" : bad ? "bad" : ""}"><i>${ok ? icon("check", 12, 3.2) : bad ? icon("x", 12, 3.2) : ""}</i><div><b>${bad ? "Not matched" : "Confirmed"}</b><p>${ok ? "Your receipt is ready." : bad ? esc(p.reviewNote || "We couldn’t find this transfer. Check the reference and send it again.") : "You’ll see it here as soon as it’s confirmed."}</p></div><span>${(p.reviewedAt || p.decidedAt) ? esc(fmtStamp(p.reviewedAt || p.decidedAt)) : ""}</span></li></ol>
          <div class="rf-dlg-act">${ok ? `<button class="btn primary" data-rc>${xicon("receipt", 16)} View receipt</button>` : bad ? `<button class="btn primary" data-again>Send again</button>` : `<button class="btn" data-x>Close</button>`}</div></div>`);
        const rc = $("[data-rc]", m.el), ag = $("[data-again]", m.el), x = $("[data-x]", m.el);
        if (rc) rc.onclick = () => { m.close(); PAY.openReceipt(p, info); };
        if (ag) ag.onclick = () => { m.close(); paidDialog(p); };
        if (x) x.onclick = m.close;
      }

      function paidDialog(prev) {
        if (!live.length) return toast("Apply for a home first. Then you can send a payment.");
        const a0 = (prev && live.find((x) => x.listingId === prev.listingId)) || cur();
        const outstanding = (a) => { const r = a.l.gone ? a.amount || 0 : AREA.moveIn(a.l, a.rent || a.l.price).total; return Math.max(0, r - sumFor(a.l.id, "Confirmed") - sumFor(a.l.id, "Submitted")); };
        let proof = prev?.proof || "", proofName = prev?.proofName || "";
        const m = modal(`<div class="rf-dlg wide"><h2>Tell us you’ve paid</h2><p class="rf-dlg-p">Add the details from your bank’s transfer receipt. We’ll confirm it against the account.</p><form class="rf-form" id="pdF" novalidate>
          ${live.length > 1 ? `<label class="rf-fl">Which home is this for?<select id="pdHome">${live.map((x) => `<option value="${esc(x.id)}" ${x.id === a0.id ? "selected" : ""}>${esc(x.l.title)}</option>`).join("")}</select></label>` : `<div class="rf-note">${xicon("home", 20)}<div><b>${esc(a0.l.title)}</b><p>${esc(a0.l.area)}</p></div></div>`}
          <div class="rf-grid2"><label class="rf-fl">What is it for?<select id="pdFor">${FOR.map((f) => `<option ${f === (prev?.forLabel || FOR[0]) ? "selected" : ""}>${f}</option>`).join("")}</select></label>
          <label class="rf-fl">Amount you sent<span class="rf-money"><span>₦</span><input id="pdAmt" inputmode="numeric" autocomplete="off" placeholder="0" value="${(prev?.amount || outstanding(a0) || "").toLocaleString?.("en-NG") || ""}"></span></label></div>
          <div class="rf-grid2"><label class="rf-fl">Date you paid<input id="pdDate" type="date" max="${isoDay()}" value="${esc(prev?.paidOn || isoDay())}"></label>
          <label class="rf-fl">Bank reference<input id="pdRef" maxlength="80" autocomplete="off" placeholder="Narration or transaction ID" value="${esc(prev?.reference || "")}"></label></div>
          <label class="rf-fl"><span>Note <span class="rf-optl">(optional)</span></span><textarea id="pdNote" rows="2" maxlength="500" placeholder="Anything that helps us find it, like the name on your account.">${esc(prev?.note || "")}</textarea></label>
          <div class="rf-fl"><span>Proof of payment <span class="rf-optl">(optional, but it speeds things up)</span></span><div class="rf-up" id="pdUp"><span class="rf-up-ic">${xicon("upload", 20)}</span><div><b id="pdUpT">Add a screenshot or receipt</b><small id="pdUpS">A photo or a small PDF</small></div><label class="btn sm" id="pdPick">Choose<input type="file" id="pdFile" accept="image/*,application/pdf" hidden></label></div><div id="pdThumb"></div></div>
          <p class="rf-err" id="pdErr" role="alert"></p><div class="rf-dlg-act"><button type="button" class="btn" data-x>Cancel</button><button type="submit" class="btn primary">Send for confirmation</button></div></form></div>`);
        moneyInput($("#pdAmt", m.el)); $("[data-x]", m.el).onclick = m.close;
        const sh = () => { const up = $("#pdUp", m.el); up.classList.toggle("has", !!proof); $("#pdUpT", m.el).textContent = proof ? proofName || "Proof added" : "Add a screenshot or receipt"; $("#pdUpS", m.el).textContent = proof ? "Attached. You can replace it." : "A photo or a small PDF"; $("#pdPick", m.el).firstChild.textContent = proof ? "Replace" : "Choose";
          $("#pdThumb", m.el).innerHTML = /^data:image\//.test(proof) ? `<span class="rf-thumb"><img src="${esc(proof)}" alt="Your proof"><button type="button" aria-label="Remove proof" id="pdRm">${icon("x", 14, 2.4)}</button></span>` : ""; const rm = $("#pdRm", m.el); if (rm) rm.onclick = () => { proof = ""; proofName = ""; sh(); }; };
        sh();
        const hs = $("#pdHome", m.el); if (hs) hs.onchange = () => { const a = live.find((x) => x.id === hs.value); $("#pdAmt", m.el).value = (outstanding(a) || "").toLocaleString("en-NG"); };
        $("#pdFile", m.el).onchange = async (e) => {
          const f = e.target.files[0]; if (!f) return; const err = $("#pdErr", m.el); err.textContent = "";
          try { proof = /^image\//.test(f.type) ? await shrinkImage(f, { max: 1400, bytes: 280000 }) : f.type === "application/pdf" ? await readSmallFile(f, 280000) : (() => { throw Object.assign(new Error("t"), { userMessage: "Please choose a photo, screenshot or PDF." }); })(); proofName = f.name; sh(); }
          catch (x) { err.textContent = x.userMessage || fxErr(x); } finally { e.target.value = ""; }
        };
        $("#pdF", m.el).onsubmit = async (e) => {
          e.preventDefault(); const err = $("#pdErr", m.el), a = live.find((x) => x.id === ($("#pdHome", m.el)?.value || a0.id)) || a0, amt = digits($("#pdAmt", m.el).value), ref = $("#pdRef", m.el).value.trim(), when = $("#pdDate", m.el).value; err.textContent = "";
          if (!amt) return (err.textContent = "Enter the amount you sent.");
          if (ref.length < 3) return (err.textContent = "Add the reference from your bank so we can find the transfer.");
          if (!when) return (err.textContent = "Choose the date you paid.");
          const b = e.target.querySelector("button[type=submit]"); b.disabled = true;
          try { await PAY.submitProof(u, { ownerUid: a.l.ownerUid || a.ownerUid || null, listingId: a.l.id, title: a.l.title, applicationId: a.id, forLabel: $("#pdFor", m.el).value, amount: amt, reference: ref, paidOn: when, note: $("#pdNote", m.el).value, proof, proofName });
            m.close(); toast("Sent. We’ll confirm it once it shows in the account."); }
          catch (x) { err.textContent = x.userMessage || fxErr(x); b.disabled = false; }
        };
        setTimeout(() => $("#pdAmt", m.el)?.focus(), 80);
      }

      const un = PAY.watchMyProofs(u.uid, (l) => { proofs = l; draw(); });
      ctx.S.cleanups.push(() => un && un());
      draw();
    } };
}
