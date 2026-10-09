// Emails for Faxton Rentals. Needs the Firebase Blaze plan (Cloud Functions) and an email API key.
//  1. When an agency or agent signs up, the owner is emailed straight away asking for verification.
//  2. When an admin verifies (or rejects) them, they are emailed too.
// The owner's address is read from the owner's profile on the server, so it never appears in the website's code.
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
admin.initializeApp();
const RESEND_KEY = defineSecret("RESEND_API_KEY"); // firebase functions:secrets:set RESEND_API_KEY
const FROM = process.env.MAIL_FROM || "Faxton Rentals <onboarding@resend.dev>"; // use your own verified sender in production
const SITE = "https://faxton-rentals.web.app";

async function send(to, subject, html) {
  const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_KEY.value()}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: FROM, to, subject, html }) });
  if (!r.ok) console.error("Email failed", r.status, await r.text());
}
const esc = (v) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

exports.onVerificationChange = onDocumentWritten({ document: "users/{uid}", secrets: [RESEND_KEY] }, async (event) => {
  const before = event.data.before.exists ? event.data.before.data() : null, after = event.data.after.exists ? event.data.after.data() : null;
  if (!after?.verification) return;
  const was = before?.verification?.status, now = after.verification.status;
  if (was === now) return;
  if (now === "pending") {
    const ownerSnap = await admin.firestore().doc("config/owner").get();
    const owner = ownerSnap.exists ? await admin.firestore().doc(`users/${ownerSnap.data().uid}`).get() : null;
    const to = owner?.data()?.email; if (!to) return console.warn("No owner email found");
    const a = after.agency, g = after.agentInfo, isAgency = after.verification.kind === "agency";
    const rows = isAgency
      ? [["Business name", a?.business], ["Name of registrar", a?.registrar], ["Role in company", a?.position], ["Year opened", a?.opened], ["Registrar date of birth", a?.dob], ["CAC number", a?.cac], ["Support email", a?.supportEmail], ["Phone", a?.phone]]
      : [["Name", after.name], ["Phone", g?.phone], ["Experience (years)", g?.experience], ["Agency", g?.company], ["Areas", g?.areas]];
    await send(to, `Verification needed: ${isAgency ? a?.business || "new agency" : after.name || "new agent"}`,
      `<h2>${isAgency ? "An agency" : "An agent"} is waiting to be verified</h2><table cellpadding="6">${[["Account name", after.name], ["Account email", after.email], ...rows].map(([k, v]) => `<tr><td><b>${esc(k)}</b></td><td>${esc(v)}</td></tr>`).join("")}</table><p><a href="${SITE}/#/admin/verifications">Open the verification page</a></p><p>Passwords are never stored or shown.</p>`);
  } else if (now === "verified" || now === "rejected") {
    const ok = now === "verified";
    await send(after.email, ok ? "You’re verified on Faxton Rentals" : "Your Faxton Rentals verification", ok
      ? `<h2>You’re verified</h2><p>Your account has been verified. You can now start listing properties.</p><p><a href="${SITE}">Open Faxton Rentals</a></p>`
      : `<h2>We couldn’t verify your account</h2><p>${esc(after.verification.reason || "Please contact support.")}</p>`);
  }
});
