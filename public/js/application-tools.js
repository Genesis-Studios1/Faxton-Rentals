import * as st from "./store.js";

export function createApplicationOfferDialog(application, api, ui) {
  const { dialog, btn, $, esc, toast, friendlyErr } = ui;
  const defaultPeriod = application.l?.listingMode === "shortlet" ? "daily" : "yearly";
  const d = dialog({
    title: "Create rental offer",
    size: "md",
    icon: "tag",
    body:
      '<p class="ax-p">Send proposed terms to ' + esc(application.name || "the applicant") + '. They can accept, decline or counter. No payment is collected here.</p>' +
      '<label class="ax-lbl" for="ro-rent">Rent amount</label><input class="ax-input" id="ro-rent" inputmode="numeric" value="' + String(Math.round(Number(application.rent) || 0)) + '">' +
      '<label class="ax-lbl" for="ro-period" style="margin-top:10px">Rent period</label><select class="ax-input" id="ro-period"><option value="yearly" ' + (defaultPeriod === "yearly" ? "selected" : "") + '>Yearly</option><option value="monthly">Monthly</option><option value="weekly">Weekly</option><option value="daily" ' + (defaultPeriod === "daily" ? "selected" : "") + '>Daily</option></select>' +
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
      if (button.dataset.url) { window.open(button.dataset.url, "_blank", "noopener,noreferrer"); return; }
      const tab = window.open("about:blank", "_blank");
      if (tab) tab.opener = null;
      button.disabled = true;
      try {
        const url = await st.getApplicationDocumentUrl(application.id, button.dataset.appdoc);
        if (tab) tab.location.replace(url);
        else { button.dataset.url = url; button.textContent = "Open secure document"; toast("Tap Open secure document again to view it."); }
      } catch (error) { tab?.close(); toast(friendlyErr(error)); }
      finally { button.disabled = false; }
    }));
  } catch (error) { host.textContent = friendlyErr(error); }
}

export async function loadApplicationHistory(application, root, ui) {
  const { $, esc, friendlyErr } = ui;
  const host = $("#app-private-history", root);
  if (!host) return;
  host.textContent = "Loading application history…";
  try {
    const events = await st.getApplicationEvents(application.id);
    if (!events.length) { host.textContent = "No application history is available yet."; return; }
    const labels = {
      submitted: "Application submitted", shortlisted: "Application shortlisted",
      approved: "Application approved", rejected: "Application rejected",
      withdrawn: "Application withdrawn"
    };
    const date = (value) => {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? "Date unavailable" :
        new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(parsed);
    };
    host.innerHTML = '<ol class="ax-timeline">' + events.map((event) => {
      const title = labels[event.type] || String(event.type || "Application updated").replaceAll("_", " ");
      const status = event.toStatus ? "Status: " + String(event.toStatus).replaceAll("_", " ") : "";
      return '<li><b>' + esc(title) + '</b><small>' + esc(date(event.createdAt)) + '</small>' +
        (status ? '<span>' + esc(status) + '</span>' : '') + '</li>';
    }).join("") + '</ol>';
  } catch (error) { host.textContent = friendlyErr(error); }
}
