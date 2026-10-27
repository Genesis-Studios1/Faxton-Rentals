// Identity and listing verification for property owners, agents and agencies.
import { $, $$, esc, icon, toast, friendlyErr } from "./ui.js";
import * as st from "./store.js";
import { shrinkImage } from "./fx.js";

const APPLICABLE = ["landlord", "agent", "agency"];
const LABEL = { landlord: "Property owner", agent: "Real estate agent", agency: "Agency" };
const AUTHORITY = [
  ["", "Choose a regulator (if applicable)"],
  ["LASRERA", "LASRERA — Lagos State"],
  ["ESVARBON", "ESVARBON — Estate Surveyors & Valuers"],
  ["Other", "Other / not listed"],
  ["Not applicable", "Not applicable"]
];

export function verificationPage(ctx) {
  const uid = ctx.S.user.uid, profile = ctx.S.profile || {}, role = profile.role || ctx.S.role || "renter";
  if (!APPLICABLE.includes(role)) return {
    title: "Verification",
    html: `<div class="rf rf-in"><div class="rf-card"><span class="rf-eyebrow">Account verification</span><h1 class="rf-h1">For property owners and professionals</h1><p class="rf-sub">Identity verification is required before landlords, agents and agencies can publish listings. Renter accounts do not need this step.</p><a class="btn primary" href="#/search">Explore homes ${icon("arrow", 18)}</a></div></div>`
  };

  const v = profile.verification || {};
  const hasKycDocs = v.documents?.identity === true && v.documents?.address === true;
  const status = profile.verified === true && v.status === "verified" && hasKycDocs ? "verified"
    : v.status === "pending" ? "pending"
    : v.status === "rejected" ? "rejected"
    : profile.verified === true ? "needs-documents" : (v.status || "not-submitted");
  const statusText = status === "verified" ? "Verified" : status === "pending" ? "Under review" : status === "rejected" ? "Changes requested" : status === "needs-documents" ? "Documents required" : "Not submitted";
  const statusTone = status === "verified" ? "ok" : status === "pending" || status === "needs-documents" ? "warn" : status === "rejected" ? "bad" : "mute";
  const showProfessional = role !== "landlord";
  const fields = [
    ["identity", "Government-issued ID", "National ID, passport or driver’s licence", true],
    ["address", "Proof of residential address", "A recent utility bill, bank statement or official correspondence showing your address", true],
    ...(showProfessional ? [["professional", role === "agency" ? "Agency / business evidence" : "Professional registration document", role === "agency" ? "CAC certificate or other business registration evidence" : "Upload a relevant registration credential if you hold one; a team member will check the applicable register", false]] : [])
  ];
  const cards = fields.map(([id, title, desc, required]) => `<section class="rf-card kyc-doc" data-doc-card="${id}">
    <div class="kyc-doc-head"><span class="kyc-doc-ic">${icon(id === "identity" ? "user" : id === "address" ? "map" : "doc", 22, 1.7)}</span><div class="grow"><h3>${title} ${required ? '<span class="kyc-required">Required</span>' : '<span class="kyc-optional">Optional</span>'}</h3><p class="rf-sub">${desc}</p><p class="kyc-file" data-file-label="${id}">No document selected yet.</p></div></div>
    ${id === "identity" ? `<div class="rf-fl kyc-id-kind"><label for="kycIdentityType">Type of identification</label><select id="kycIdentityType" class="rf-input"><option value="National ID" ${(v.idKind || "National ID") === "National ID" ? "selected" : ""}>National ID / NIN slip or card</option><option value="Passport" ${v.idKind === "Passport" ? "selected" : ""}>International passport</option><option value="Driver’s licence" ${v.idKind === "Driver’s licence" ? "selected" : ""}>Driver’s licence</option></select></div>` : ""}
    <label class="kyc-pick"><span>Choose image</span><input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" data-file="${id}" aria-label="Upload ${title}"></label>
    <p class="kyc-hint">Upload a clear JPG, PNG or WebP image. PDFs are not supported in this uploader yet.</p>
    <div class="kyc-preview" data-preview="${id}" hidden></div>
  </section>`).join("");

  const html = `<div class="rf rf-in kyc-page">
    <header class="rf-ph"><div><span class="rf-eyebrow">Trust & safety</span><h1 class="rf-h1">Identity verification</h1><p class="rf-sub">Verify your account before publishing rental listings. Your documents are kept private from renters and other users.</p></div><div class="rf-ph-a"><span class="chip ${statusTone}">${statusText}</span></div></header>
    ${status === "verified" ? `<div class="rf-card kyc-status-good">${icon("checkc", 22)}<div><b>Your account is verified</b><p>Your identity and address have been reviewed. Each property still needs its own ownership or letting-authority document before that listing can be approved.</p></div></div>` : `<div class="rf-card kyc-status-note">${icon("shieldCheck", 22)}<div><b>${status === "rejected" ? "Update the requested documents" : status === "pending" ? "Your request is waiting for review" : status === "needs-documents" ? "Please renew your verification" : "What you’ll need"}</b><p>${status === "rejected" ? esc(v.reason || "Please check the documents below and resubmit the required evidence.") : status === "pending" ? "You can replace a document while the team reviews your request. Only the Faxton review team can approve or reject it." : status === "needs-documents" ? "Your previous verification predates the new document checks. Upload your ID and address evidence so the team can renew your verification." : "Provide a government-issued ID and proof of address. Agents and agencies may also add their professional or business registration details where applicable."}</p></div></div>`}
    <form class="kyc-form" id="kycForm" novalidate>
      <div class="kyc-doc-grid">${cards}</div>
      ${showProfessional ? `<section class="rf-card kyc-reg">
        <span class="rf-eyebrow">Professional checks</span><h2 class="rf-h2">${role === "agency" ? "Business registration" : "Registration details"}</h2>
        <p class="rf-sub">Enter a registration reference where applicable. Faxton reviewers must check the relevant public registry manually; an entered number alone is not proof of a licence.</p>
        <div class="rf-fl"><label for="kycAuthority">Regulator / registry</label><select id="kycAuthority" class="rf-input">${AUTHORITY.map(([value, label]) => `<option value="${esc(value)}" ${(v.regulatoryBody || "") === value ? "selected" : ""}>${label}</option>`).join("")}</select></div>
        <div class="rf-fl"><label for="kycProfessionalNumber">Registration number <span class="kyc-optional">(optional where not applicable)</span></label><input class="rf-input" id="kycProfessionalNumber" maxlength="80" autocomplete="off" placeholder="Registration / licence number" value="${esc(v.professionalNumber || "")}"></div>
        <div class="kyc-reg-links"><a href="https://www.lasrera.com/" target="_blank" rel="noopener noreferrer">LASRERA public register ${icon("ext", 14)}</a><a href="https://www.esvarbon.gov.ng/" target="_blank" rel="noopener noreferrer">ESVARBON ${icon("ext", 14)}</a></div>
      </section>` : ""}
      <p class="kyc-private-note">${icon("lock", 16)} Identity and address images are stored in a private collection. Only you and authorised Faxton reviewers can read them. Do not upload unrelated documents.</p>
      <p class="rf-err" id="kycError" role="alert"></p>
      <div class="rf-act"><button class="btn primary" id="kycSubmit" type="submit">${status === "rejected" ? "Resubmit for review" : status === "pending" ? "Update submission" : "Submit for verification"} ${icon("arrow", 18)}</button></div>
    </form>
    <div class="rf-card kyc-listing-note"><h3>Every property needs its own proof</h3><p>When you add a property, upload a land title/deed, a bill matching the property address, a tax receipt or a letting/management mandate. This evidence is reviewed separately from your identity documents.</p></div>
  </div>`;

  return { title: "Identity verification", html, mount(root) {
    const form = $("#kycForm", root), error = $("#kycError", root), submit = $("#kycSubmit", root);
    const selected = { identity: null, address: null, professional: null };
    const existing = { identity: null, address: null, professional: null };
    const say = (s) => { error.textContent = s || ""; };
    let busy = false;
    const hideExistingState = (key) => {
      const label = $("[data-file-label=\"" + key + "\"]", root);
      if (label && existing[key] && !selected[key]) label.textContent = "Saved document: " + existing[key].fileName;
      const preview = $("[data-preview=\"" + key + "\"]", root);
      if (preview && existing[key]?.dataUrl && !selected[key]) {
        preview.innerHTML = '<img src="' + esc(existing[key].dataUrl) + '" alt="Saved ' + esc(key) + ' document preview"><span>Saved privately</span>';
        preview.hidden = false;
      }
    };
    Promise.all(fields.map(async ([id]) => {
      try { existing[id] = await st.getVerificationDocument(uid, id); }
      catch { existing[id] = null; }
      hideExistingState(id);
    }));
    $$("[data-file]", form).forEach((input) => {
      input.addEventListener("change", () => {
        const key = input.dataset.file, file = input.files?.[0];
        selected[key] = file || null;
        const label = $("[data-file-label=\"" + key + "\"]", form);
        const preview = $("[data-preview=\"" + key + "\"]", form);
        if (label) label.textContent = file ? file.name : existing[key] ? "Saved document: " + existing[key].fileName : "No document selected yet.";
        if (preview) { preview.hidden = true; preview.innerHTML = ""; }
        say("");
        if (file && preview) {
          const url = URL.createObjectURL(file);
          preview.innerHTML = `<img src="${url}" alt="Selected document preview"><span>${esc(file.name)}</span>`;
          preview.hidden = false;
        }
      });
    });
    form.onsubmit = async (event) => {
      event.preventDefault(); if (busy) return;
      say("");
      const needed = ["identity", "address"];
      const missing = needed.filter((k) => !selected[k] && !existing[k]);
      if (missing.length) return say("Choose a government-issued ID and proof of address before submitting.");
      const chosen = Object.entries(selected).filter(([, file]) => file);
      if (chosen.some(([, file]) => !/^image\//.test(file.type || ""))) return say("Please choose image files, not PDFs or other file types.");
      busy = true; submit.disabled = true; submit.classList.add("is-busy");
      try {
        for (const [key, file] of chosen) {
          const dataUrl = await shrinkImage(file, { max: 1800, bytes: 520000 });
          const label = key === "identity"
            ? ($("#kycIdentityType", root)?.value || "National ID")
            : key === "address" ? "Proof of residential address"
            : role === "agency" ? "Business registration evidence" : "Professional registration document";
          await st.saveVerificationDocument(uid, key, { dataUrl, fileName: file.name, label });
          existing[key] = { fileName: file.name, type: key };
          const fileLabel = $("[data-file-label=\"" + key + "\"]", root); if (fileLabel) fileLabel.textContent = "Saved document: " + file.name;
        }
        const idKind = $("#kycIdentityType", root)?.value || "Government-issued ID";
        const professionalNumber = $("#kycProfessionalNumber", root)?.value.trim().slice(0, 80) || "";
        const regulatoryBody = $("#kycAuthority", root)?.value || "";
        await st.submitVerification(uid, {
          status: "pending", kind: role, requestedAt: Date.now(),
          documents: { identity: true, address: true, professional: !!existing.professional },
          idKind, professionalNumber, regulatoryBody
        });
        ctx.S.profile = { ...ctx.S.profile, verification: { status: "pending", kind: role, requestedAt: Date.now(), documents: { identity: true, address: true, professional: !!existing.professional }, idKind, professionalNumber, regulatoryBody }, verified: false };
        toast("Verification documents submitted. The Faxton team will review them.");
        ctx.go("#" + ctx.path);
      } catch (e) {
        say(e?.userMessage || friendlyErr(e) || "We couldn't submit your documents. Please try again.");
      } finally {
        busy = false; submit.disabled = false; submit.classList.remove("is-busy");
      }
    };
  } };
}
