import { $, esc, icon, toast } from "./ui.js";
import { apiConfigured } from "./api-client.js";
import * as st from "./store.js";
import { toTenancyAgreementViewModel, toRentalPaymentViewModel } from "./api-tenancy-mapper.js";

const money = (amount, currency = "NGN") => {
  const value = Number(amount);
  if (!Number.isFinite(value)) return "—";
  try { return new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: 2 }).format(value); }
  catch { return `${currency} ${value.toLocaleString("en-NG")}`; }
};
const date = (value) => {
  if (!value) return "Not set";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "Not set" : d.toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" });
};
const period = (value) => ({ daily: "day", weekly: "week", monthly: "month", yearly: "year" })[value] || value || "period";
const stateLabel = (value) => ({ draft: "Draft", awaiting_signatures: "Awaiting signatures", executed: "Executed", cancelled: "Cancelled", expired: "Expired", pending: "Pending", processing: "Processing", paid: "Paid", failed: "Failed", refunded: "Refunded", reversed: "Reversed" })[value] || value;
const statusClass = (value) => value === "executed" || value === "paid" ? "ok" : ["cancelled", "expired", "failed", "reversed"].includes(value) ? "bad" : "warn";
const key = () => globalThis.crypto?.randomUUID?.() || `faxton-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function tenancyPage(ctx) {
  const enabled = apiConfigured();
  return {
    title: "Tenancy & agreements",
    html: `<div class="rf" style="max-width:1040px;margin:0 auto;padding:24px 16px">
      <header style="margin-bottom:20px"><span class="rf-eyebrow">Rental management</span><h1 class="rf-h1">Tenancy & agreements</h1><p class="rf-sub">Review tenancy terms, complete agreement acknowledgements and track rent or deposit requests.</p></header>
      ${enabled ? "" : '<div class="rf-card" style="padding:18px">Backend tenancy services are not enabled in this build. Your existing account data remains unchanged.</div>'}
      <div id="tenancyAgreementList"></div><div id="tenancyPaymentList" style="margin-top:22px"></div>
      <p class="rf-muted" style="font-size:12px;margin-top:20px">In-app typed-name acknowledgements record agreement workflow activity. They are not a guarantee of legal enforceability or a substitute for a locally reviewed tenancy agreement. Payment requests do not collect money or confirm that a transfer has been made.</p>
    </div>`,
    async mount(root) {
      if (!enabled) return;
      const agreementHost = $("#tenancyAgreementList", root);
      const paymentHost = $("#tenancyPaymentList", root);
      let agreements = [], payments = [];
      const actorId = ctx.S.profile?.id || null;
      const isManager = ["landlord", "agent", "agency", "admin", "owner"].includes(ctx.S.role) || ctx.S.isAdmin;
      const reload = async () => {
        agreementHost.textContent = "Loading agreements…";
        paymentHost.textContent = "Loading payment requests…";
        try {
          const result = await Promise.all([st.myTenancyAgreements(), st.myRentalPaymentRequests()]);
          agreements = result[0].map(toTenancyAgreementViewModel).filter(Boolean);
          payments = result[1].map(toRentalPaymentViewModel).filter(Boolean);
          draw();
        } catch (error) {
          agreementHost.textContent = "Agreements could not be loaded. Please try again.";
          paymentHost.textContent = "";
          toast(error?.message || "Tenancy information could not be loaded.");
        }
      };
      const draw = () => {
        agreementHost.innerHTML = '<section><h2 class="rf-h2">Agreements</h2>' +
          (agreements.length ? agreements.map((a) => {
            const canSign = a.status === "awaiting_signatures" && actorId &&
              ((actorId === a.landlordUserId && !a.landlordSignature) || (actorId === a.tenantUserId && !a.tenantSignature));
            const canSend = isManager && a.status === "draft";
            const canRequest = isManager && a.status === "executed";
            return `<article class="rf-card" style="padding:18px;margin:12px 0">
              <div style="display:flex;gap:12px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap">
                <div><h3 style="margin:0 0 6px">${esc(a.propertyTitle)}</h3><p class="rf-muted" style="margin:0">${esc(a.landlordName)} · ${esc(a.tenantName)}</p></div>
                <span class="rf-pill ${statusClass(a.status)}"><i></i>${esc(stateLabel(a.status))}</span>
              </div>
              <div class="rf-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin:16px 0">
                <div><small>Rent</small><b style="display:block">${money(a.rentAmount,a.currency)} / ${esc(period(a.rentPeriod))}</b></div>
                <div><small>Deposit</small><b style="display:block">${money(a.depositAmount,a.currency)}</b></div>
                <div><small>Move-in</small><b style="display:block">${esc(date(a.moveInDate))}</b></div>
                <div><small>Lease</small><b style="display:block">${a.leaseMonths ? `${a.leaseMonths} months` : "As stated in terms"}</b></div>
              </div>
              <div class="rf-muted" style="font-size:13px;margin-bottom:12px">
                Landlord: ${a.landlordSignature ? "Acknowledged" : "Awaiting acknowledgement"} · Tenant: ${a.tenantSignature ? "Acknowledged" : "Awaiting acknowledgement"}
              </div>
              ${canSend ? '<button class="btn primary" data-send="' + esc(a.id) + '">Send for signatures</button>' : ""}
              ${canSign ? '<div style="display:grid;gap:8px;max-width:440px"><label>Your full name<input class="ax-input" maxlength="160" data-sign-name="' + esc(a.id) + '" autocomplete="name"></label><label style="display:flex;gap:8px;align-items:flex-start"><input type="checkbox" data-sign-consent="' + esc(a.id) + '"><span>I have reviewed these terms and agree to record my acknowledgement against this agreement version.</span></label><button class="btn primary" data-sign="' + esc(a.id) + '">Acknowledge agreement</button></div>' : ""}
              ${a.status === "awaiting_signatures" && !canSign ? '<p class="rf-muted">The other party must complete their acknowledgement. Sign in with the landlord or renter account named in this agreement.</p>' : ""}
              ${canRequest ? '<button class="btn" data-request="' + esc(a.id) + '">Create rent or deposit request</button>' : ""}
              <details style="margin-top:14px"><summary>View recorded terms</summary><pre style="white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px">${esc(JSON.stringify(a.terms || {}, null, 2))}</pre><small>Terms fingerprint: ${esc(a.termsSha256)}</small></details>
            </article>`;
          }).join("") : '<div class="rf-card" style="padding:18px">No tenancy agreements are available yet. A listing manager can prepare one after a rental offer is accepted.</div>') +
          '</section>';
        paymentHost.innerHTML = '<section><h2 class="rf-h2">Rent and deposit requests</h2>' +
          (payments.length ? payments.map((p) => `<article class="rf-card" style="padding:16px;margin:10px 0;display:flex;justify-content:space-between;gap:14px;align-items:center;flex-wrap:wrap">
            <div><b>${esc(p.paymentType || "Rental payment")} · ${money(p.amount,p.currency)}</b><div class="rf-muted" style="font-size:13px">Due: ${esc(date(p.dueAt))}</div></div>
            <span class="rf-pill ${statusClass(p.status)}"><i></i>${esc(stateLabel(p.status))}</span>
          </article>`).join("") : '<div class="rf-card" style="padding:18px">No payment requests yet.</div>') +
          '<p class="rf-muted" style="font-size:12px">These are records of requests only. Do not treat a pending request as a completed payment.</p></section>';
        root.querySelectorAll("[data-send]").forEach((button) => button.addEventListener("click", async () => {
          button.disabled = true;
          try { await st.sendTenancyAgreement(button.dataset.send); toast("Agreement sent for signature."); await reload(); }
          catch (error) { toast(error?.message || "Could not send agreement."); button.disabled = false; }
        }));
        root.querySelectorAll("[data-sign]").forEach((button) => button.addEventListener("click", async () => {
          const id = button.dataset.sign, name = root.querySelector("[data-sign-name='" + id + "']")?.value?.trim();
          const consent = root.querySelector("[data-sign-consent='" + id + "']")?.checked === true;
          if (!name || name.length < 2 || !consent) return toast("Enter your full name and confirm that you agree to the terms.");
          button.disabled = true;
          try { await st.signTenancyAgreement(id, name, true); toast("Your acknowledgement has been recorded."); await reload(); }
          catch (error) { toast(error?.message || "Could not record your acknowledgement."); button.disabled = false; }
        }));
        root.querySelectorAll("[data-request]").forEach((button) => button.addEventListener("click", () => {
          const id = button.dataset.request;
          const form = document.createElement("form");
          form.innerHTML = '<label>Request type<select class="ax-input" name="type"><option value="rent">Rent</option><option value="deposit">Deposit</option><option value="other">Other</option></select></label><label>Amount in naira<input class="ax-input" name="amount" type="number" min="1" step="0.01" required></label><label>Due date<input class="ax-input" name="due" type="date"></label><button class="btn primary" type="submit">Create request</button>';
          const card = button.closest("article");
          card.querySelector("[data-request-form]")?.remove();
          form.dataset.requestForm = "";
          form.dataset.idempotencyKey = key();
          form.style.cssText = "display:grid;gap:10px;margin-top:12px;max-width:420px";
          card.append(form);
          form.addEventListener("submit", async (event) => {
            event.preventDefault();
            const data = new FormData(form), amount = Number(data.get("amount"));
            const amountMinorUnits = Math.round(amount * 100);
            if (!Number.isFinite(amount) || amount <= 0 || !Number.isSafeInteger(amountMinorUnits)) return toast("Enter a valid amount in naira.");
            const due = String(data.get("due") || "");
            const dueAt = due ? new Date(due + "T12:00:00.000Z").toISOString() : null;
            const submit = form.querySelector("button[type=submit]");
            submit.disabled = true;
            form.querySelectorAll("input, select").forEach((field) => { field.disabled = true; });
            try {
              await st.createRentalPaymentRequest(id, { paymentType: data.get("type"), amountMinorUnits, dueAt, idempotencyKey: form.dataset.idempotencyKey });
              toast("Payment request created. No money has been collected.");
              await reload();
            } catch (error) { toast(error?.message || "Could not create payment request."); submit.disabled = false; }
          });
        }));
      };
      await reload();
    }
  };
}
