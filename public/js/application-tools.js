import * as st from "./store.js";

export function createApplicationOfferDialog(application, api, ui) {
  const { dialog, btn, $, esc, toast, friendlyErr } = ui;
  const d = dialog({
    title: "Create rental offer",
    size: "md",
    icon: "tag",
    body:
      '<p class="ax-p">Send proposed terms to ' + esc(application.name || "the applicant") + '. They can accept, decline or counter. No payment is collected here.</p>' +
      '<label class="ax-lbl" for="ro-rent">Rent amount</label><input class="ax-input" id="ro-rent" inputmode="numeric" value="' + String(Math.round(Number(application.rent) || 0)) + '">' +
      '<label class="ax-lbl" for="ro-period" style="margin-top:10px">Rent period</label><select class="ax-input" id="ro-period"><option value="yearly">Yearly</option><option value="monthly">Monthly</option><option value="weekly">Weekly</option><option value="daily">Daily</option></select>' +
      '<label class="ax-lbl" for="ro-deposit" style="margin-top:10px">Deposit amount</label><input class="ax-input" id="ro-deposit" inputmode="numeric" value="0">' +
      '<label class="ax-lbl" for="ro-lease" style="margin-top:10px">Lease length in months (optional)</label><input class="ax-input" id="ro-lease" type="number" min="1" max="120" placeholder="12">' +
      '<label class="ax-lbl" for="ro-move" style="margin-top:10px">Proposed move-in date (optional)</label><input class="ax-input" id="ro-move" type="date" value="' + esc(application.moveIn || "") + '">' +
      '<label class="ax-lbl" for="ro-message" style="margin-top:10px">Message (optional)</label><textarea class="ax-input" id="ro-message" rows="3" maxlength="2000"></textarea>' +
      '<p class="ax-err" id="ro-error" role="alert"></p>',
    footer: btn("Cancel", { attrs: "data-x" }) + btn("Send offer", { v: "primary", attrs: "data-send" })
  });
  $("[data-send]", d.el).onclick = async (event) => {
    const rentAmount = Number(String($("#ro-rent", d.el).value).replace(/[^0-9.]/g, ""));
    const depositAmount = Number(String($("#ro-deposit", d.el).value).replace(/[^0-9.]/g, "")) || 0;
    const leaseText = $("#ro-lease", d.el).value.trim();
    const leaseMonths = leaseText ? Number(leaseText) : null;
    const error = $("#ro-error", d.el);
    if (!Number.isFinite(rentAmount) || rentAmount <= 0) { error.textContent = "Enter a valid rent amount."; return; }
    if (!Number.isFinite(depositAmount) || depositAmount < 0) { error.textContent = "Enter a valid deposit amount."; return; }
    if (leaseMonths !== null && (!Number.isInteger(leaseMonths) || leaseMonths < 1 || leaseMonths > 120)) { error.textContent = "Lease length must be between 1 and 120 months."; return; }
    event.currentTarget.disabled = true;
    try {
      await st.createRentalOffer(application.id, {
        rentAmount, currency: String(application.currency || "NGN").toUpperCase(),
        rentPeriod: $("#ro-period", d.el).value, depositAmount, leaseMonths,
        proposedMoveInDate: $("#ro-move", d.el).value || null,
        message: $("#ro-message", d.el).value.trim() || null, expiresInHours: 72
      });
      d.close(); toast("Rental offer sent."); api.refresh();
    } catch (error2) { error.textContent = friendlyErr(error2); event.currentTarget.disabled = false; }
  };
}

export async function loadApplicationDocuments(application, root, ui) {
  const { $, esc, friendlyErr, toast } = ui;
  const host = $("#app-private-documents", root);
  if (!host) return;
  host.textContent = "Loading private documents…";
  try {
    const docs = await st.getApplicationDocuments(application.id);
    host.innerHTML = docs.length ? docs.map((doc) =>
      '<div class="ax-row" style="justify-content:space-between"><div><b>' + esc(doc.displayName) +
      '</b><small>' + esc(String(doc.documentType).replaceAll("_", " ")) +
      '</small></div><button type="button" class="ax-btn sm" data-appdoc="' + esc(doc.id) + '">Open</button></div>'
    ).join("") : '<span class="ax-muted">No documents were attached.</span>';
    Array.from(host.querySelectorAll("[data-appdoc]")).forEach((button) => (button.onclick = async () => {
      button.disabled = true;
      try {
        const url = await st.getApplicationDocumentUrl(application.id, button.dataset.appdoc);
        window.open(url, "_blank", "noopener,noreferrer");
      } catch (error) { toast(friendlyErr(error)); }
      finally { button.disabled = false; }
    }));
  } catch (error) { host.textContent = friendlyErr(error); }
}
