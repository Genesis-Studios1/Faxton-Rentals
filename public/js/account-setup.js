// Required post-sign-up profile setup. Verification files are stored in private Firebase Storage paths;
// only paths and metadata are saved in Firestore. A submitted file never marks an account as verified.
import { $, $$, esc, icon, logoMark, toast, friendlyErr } from "./ui.js";
import { locFields, mountLoc, resFields, NIGERIA } from "./loc.js";
import { saveProfile } from "./store.js";
import { storage } from "./firebase.js";
import { ref, uploadBytes, deleteObject } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js";

const SOURCES = [
  ["instagram", "Instagram"], ["tiktok", "TikTok"], ["x", "X (Twitter)"],
  ["facebook", "Facebook"], ["google", "Google Search"], ["whatsapp", "WhatsApp"],
  ["friend", "Friends or family"], ["online", "Online article or advert"],
  ["event", "An event or community"], ["other", "Other"]
];
const BUSINESS_TYPES = [
  ["real-estate-company", "Real estate company"], ["electricals", "Electrical services"],
  ["home-automation", "Home automation"], ["plumbing", "Plumbing"], ["tiling", "Tiling"],
  ["painting", "Painting"], ["appliance-repair", "Home appliance fixing"],
  ["cleaning", "Cleaning services"], ["handyman", "Handyman / general repairs"], ["other", "Other home service"]
];
const BUSINESS_LABELS = Object.fromEntries(BUSINESS_TYPES);
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;
const MAX_FILE = 10 * 1024 * 1024;
const MIME = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
const qv = (root, id) => { const el = $("#" + id, root); return el ? String(el.value || "").trim() : ""; };
const adult = (value) => {
  if (!value) return false;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  let years = now.getFullYear() - d.getFullYear();
  if (now < new Date(now.getFullYear(), d.getMonth(), d.getDate())) years--;
  return years >= 18;
};
const safeName = (value) => String(value || "document").normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(-70) || "document";
const field = (id, label, type, placeholder, attrs) =>
  '<div class="asu-field"><label for="' + id + '">' + label + '</label><input id="' + id + '" name="' + id + '" type="' + type + '" placeholder="' + esc(placeholder || "") + '" ' + (attrs || "") + '><small class="asu-error" data-error="' + id + '" hidden></small></div>';
const select = (id, label, rows, required = true) =>
  '<div class="asu-field"><label for="' + id + '">' + label + '</label><select id="' + id + '" name="' + id + '" ' + (required ? "required" : "") + '><option value="">Choose an option</option>' +
  rows.map((r) => '<option value="' + esc(r[0]) + '">' + esc(r[1]) + "</option>").join("") +
  '</select><small class="asu-error" data-error="' + id + '" hidden></small></div>';
const fileField = (id, label, help, required) =>
  '<div class="asu-field asu-file"><label for="' + id + '">' + label + (required ? ' <span class="asu-required">Required</span>' : ' <span class="asu-optional">Optional</span>') +
  '</label><input id="' + id + '" name="' + id + '" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp">' +
  '<small>' + help + ' PDF, JPEG, PNG or WebP; maximum 10 MB.</small><span class="asu-file-name" data-file-name="' + id + '">No file selected</span><small class="asu-error" data-error="' + id + '" hidden></small></div>';
const sectionHead = (ic, title, description, id) =>
  '<div class="asu-section-head"><span class="asu-section-ic">' + icon(ic, 20) + '</span><div><h2 id="' + id + '">' + title + '</h2><p>' + description + '</p></div></div>';
const businessChecks = () => '<div class="asu-check-grid" role="group" aria-label="Business types">' +
  BUSINESS_TYPES.map((r) => '<label class="asu-check"><input type="checkbox" name="businessTypes" value="' + r[0] + '"><span>' + r[1] + '</span></label>').join("") +
  '</div><small class="asu-error" data-error="businessTypes" hidden></small>';

function roleFields(role, profile) {
  if (role === "agency") return '<section class="asu-section" aria-labelledby="asu-business-title">' +
    sectionHead("building", "Tell us about your business", "Choose every service you offer, then add your registration and contact details.", "asu-business-title") +
    '<div class="asu-wide"><span class="asu-label">What type of business are you running?</span>' + businessChecks() + '</div>' +
    '<div class="asu-grid">' +
    field("business", "Registered business name", "text", "e.g. Faxton Home Services", 'maxlength="120" autocomplete="organization" required') +
    field("cac", "CAC registration number", "text", "e.g. RC 1234567", 'maxlength="40" autocapitalize="characters" autocomplete="off" required') +
    field("registrar", "Registrar / registered representative", "text", profile.name || "Full legal name", 'maxlength="120" autocomplete="name" required') +
    field("position", "Your role in the company", "text", "e.g. Director, Operations Manager", 'maxlength="80" required') +
    field("address", "Office address", "text", "Street, area, city", 'maxlength="200" autocomplete="street-address" required') +
    field("supportEmail", "Support email", "email", "support@yourbusiness.com", 'maxlength="120" autocomplete="email" required') +
    field("phone", "Business phone number", "tel", "+234 …", 'maxlength="30" inputmode="tel" autocomplete="tel" required') +
    field("website", "Business website (optional)", "url", "https://yourbusiness.com", 'maxlength="160" inputmode="url" autocomplete="url") +
    '</div><div class="asu-grid">' + fileField("cacFile", "CAC certificate", "Optional supporting document for the business registration number.", false) + '</div></section>';
  if (role === "agent") return '<section class="asu-section" aria-labelledby="asu-agent-title">' +
    sectionHead("handshake", "Your agent profile", "Add contact details, experience and the areas you cover.", "asu-agent-title") +
    '<div class="asu-grid">' +
    field("phone", "Phone number", "tel", "+234 …", 'maxlength="30" inputmode="tel" autocomplete="tel" required') +
    field("experience", "Years of real estate experience", "number", "e.g. 2", 'min="0" max="60" step="1" inputmode="numeric" required') +
    field("company", "Agency you work for (optional)", "text", "Company or agency name", 'maxlength="120" autocomplete="organization"') +
    field("areas", "Areas you cover", "text", "e.g. Lekki, Ikoyi, Ajah", 'maxlength="200" required') +
    field("dob", "Date of birth", "date", "", 'autocomplete="bday" required') +
    select("professionalBody", "Professional registration (if applicable)", [["none", "Not applicable"], ["esvarbon", "ESVARBON"], ["niesv", "NIESV membership"], ["other", "Other professional body"]], false) +
    field("professionalNumber", "Professional registration number (optional)", "text", "Registration / licence number", 'maxlength="80"') +
    '</div><p class="asu-note">Where applicable, Faxton will check professional credentials during review. Entering a number does not automatically verify it. <a href="https://www.esvarbon.gov.ng/" target="_blank" rel="noopener noreferrer">Official ESVARBON website</a>.</p></section>';
  if (role === "landlord") return '<section class="asu-section" aria-labelledby="asu-owner-title">' +
    sectionHead("house", "Your home-owner profile", "We need a reliable way to contact you about ownership and listing checks.", "asu-owner-title") +
    '<div class="asu-grid">' + field("phone", "Phone number", "tel", "+234 …", 'maxlength="30" inputmode="tel" autocomplete="tel" required') + '</div></section>';
  return '<section class="asu-section" aria-labelledby="asu-renter-title">' +
    sectionHead("user-round", "About you", "Your location helps us personalise the homes and services you see.", "asu-renter-title") +
    '<div class="asu-grid">' + field("phone", "Phone number (optional)", "tel", "+234 …", 'maxlength="30" inputmode="tel" autocomplete="tel") + '</div></section>';
}
function identityFields(role) {
  if (role === "agent") return '<section class="asu-section" aria-labelledby="asu-identity-title">' +
    sectionHead("shield-check", "Identity and address verification", "Your documents stay in a private verification folder. A reviewer must check them before verification is approved.", "asu-identity-title") +
    '<div class="asu-grid">' + select("idType", "Government ID type", [["national-id", "National ID / NIN card"], ["passport", "International passport"], ["drivers-licence", "Driver’s licence"]]) +
    fileField("identityFile", "Government-issued ID", "Use a readable current document.", true) +
    fileField("addressFile", "Proof of address", "Recent utility bill or another accepted document showing your address.", true) + '</div>' +
    '<p class="asu-note">Do not upload passwords, bank PINs or payment-card details. Submitting documents does not automatically verify your account.</p></section>';
  if (role === "landlord") return '<section class="asu-section" aria-labelledby="asu-identity-title">' +
    sectionHead("shield-check", "Identity and property ownership", "Identity and address documents are reviewed before you can post a verified property listing.", "asu-identity-title") +
    '<div class="asu-grid">' + select("idType", "Government ID type", [["national-id", "National ID / NIN card"], ["passport", "International passport"], ["drivers-licence", "Driver’s licence"]]) +
    fileField("identityFile", "Government-issued ID", "Use a readable current document.", true) +
    fileField("addressFile", "Proof of address", "Recent utility bill or another accepted document showing your address.", true) +
    fileField("ownershipFile", "Proof of property ownership", "Title / deed, property tax receipt or another accepted ownership record.", true) + '</div>' +
    '<p class="asu-note">Ownership documents prove a claim for review; they do not alone guarantee that a specific property is verified.</p></section>';
  return '<section class="asu-section" aria-labelledby="asu-business-verify-title" id="asuBusinessVerify" hidden>' +
    sectionHead("shield-check", "Identity and address verification", "Required when your business offers real-estate services.", "asu-business-verify-title") +
    '<div class="asu-grid">' + select("idType", "Government ID type", [["national-id", "National ID / NIN card"], ["passport", "International passport"], ["drivers-licence", "Driver’s licence"]]) +
    fileField("identityFile", "Government-issued ID", "Upload a clear, current document.", true) +
    fileField("addressFile", "Proof of address", "Recent utility bill or another accepted document showing your address.", true) + '</div></section>';
}
function currentFile(root, id, required) {
  const input = $("#" + id, root);
  const file = input && input.files ? input.files[0] : null;
  if (!file) return required ? { error: "Choose a file to continue." } : { file: null };
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  const mime = file.type || ({ pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" })[ext] || "";
  if (!MIME.has(mime)) return { error: "Use a PDF, JPEG, PNG or WebP file." };
  if (file.size <= 0 || file.size > MAX_FILE) return { error: "Choose a file smaller than 10 MB." };
  return { file: file, mime: mime };
}
export function setupPage(ctx) {
  const profile = ctx.S.profile || {};
  const role = ["renter", "landlord", "agent", "agency"].includes(profile.role) ? profile.role : ctx.S.role || "renter";
  const business = role === "agency";
  const title = business ? "Set up your business profile" : role === "agent" ? "Set up your agent profile" : role === "landlord" ? "Set up your home-owner profile" : "Let’s personalise your experience";
  const subtitle = business ? "Tell us what your business does so people can find your services." : role === "agent" ? "Add your contact, service-area and professional details." : role === "landlord" ? "Tell us where you are based and submit the documents needed for a safe listing." : "A few quick answers help us tailor homes and services to you.";
  const location = locFields({ style: "field", flow: true, ids: { country: "setupCountry", state: "setupState", lga: "setupLga" }, country: profile.country || NIGERIA, state: profile.state || "", lga: profile.lga || "" });
  const html = '<div class="asu"><header class="asu-top"><a class="asu-logo" href="#/onboarding/setup" aria-label="Faxton Rentals">' + logoMark() + '<span><b>Faxton</b> Rentals</span></a><span class="asu-step">' + icon("shield-check", 16) + ' Secure setup</span></header>' +
    '<main class="asu-main" id="asuMain"><div class="asu-intro"><span class="asu-eyebrow">WELCOME TO FAXTON</span><h1>' + title + '</h1><p>' + subtitle + '</p><div class="asu-progress" aria-hidden="true"><i></i><i></i><i></i></div></div>' +
    '<form id="asuForm" novalidate><section class="asu-section">' + sectionHead("sparkles", "How did you hear about us?", "This helps us understand where people discover Faxton.", "asu-referral-title") +
    '<div class="asu-grid">' + select("referralSource", "Where did you hear about Faxton?", SOURCES) + field("referralOther", "Tell us where (required only for Other)", "text", "Type the source", 'maxlength="100"') + '</div></section>' +
    '<section class="asu-section">' + sectionHead("map-pin", "Where are you based?", "Choose your country, state and local area. Faxton does not need your live GPS location.", "asu-location-title") + location +
    '<small class="asu-error" data-error="location" hidden></small></section>' +
    roleFields(role, profile) + (business ? '<div class="asu-role-verification">' + identityFields(role) + '</div>' : identityFields(role)) +
    ((role === "agent" || role === "landlord" || business) ? '<div class="asu-consent"><label><input id="verificationConsent" type="checkbox"><span>I confirm these details and documents are accurate and consent to their review by authorised Faxton verification staff.</span></label><small class="asu-error" data-error="verificationConsent" hidden></small></div>' : '') +
    '<div class="asu-save-note">' + icon("lock", 16) + '<span>Government IDs, proof of address and ownership documents are private. Your account or listing is not marked verified until review is complete.</span></div>' +
    '<p class="asu-form-error" id="asuError" role="alert" aria-live="assertive"></p><button class="btn primary asu-submit" type="submit" id="asuSubmit"><span class="asu-submit-label">Save and continue</span>' + icon("arrow", 18, 1.8) + '</button></form></main></div>';
  return { full: true, title: "Finish account setup", html: html, mount(root) {
    const form = $("#asuForm", root), error = $("#asuError", root), submit = $("#asuSubmit", root);
    const loc = mountLoc(root, { ids: { country: "setupCountry", state: "setupState", lga: "setupLga" } });
    const oldAgency = profile.agency || {}, oldAgent = profile.agentInfo || {};
    const putError = (id, message) => { const el = $('[data-error="' + id + '"]', root); if (el) { el.textContent = message || ""; el.hidden = !message; } };
    const revealBusinessChecks = () => {
      if (!business) return;
      const selected = $$('input[name="businessTypes"]:checked', root).map((el) => el.value);
      const realEstate = selected.includes("real-estate-company");
      const verifyWrap = $(".asu-role-verification", root);
      if (verifyWrap) verifyWrap.hidden = !realEstate;
    };
    if (business) {
      const fills = { business: oldAgency.business, cac: oldAgency.cac, registrar: oldAgency.registrar, position: oldAgency.position,
        address: oldAgency.address, supportEmail: oldAgency.supportEmail, phone: oldAgency.phone, website: oldAgency.website };
      Object.entries(fills).forEach(([id, val]) => { const el = $("#" + id, root); if (el && val) el.value = val; });
      $$('input[name="businessTypes"]', root).forEach((el) => {
        el.checked = Array.isArray(oldAgency.types) && oldAgency.types.includes(el.value);
        el.addEventListener("change", revealBusinessChecks);
      });
      revealBusinessChecks();
    }
    if (role === "agent") {
      const fills = { phone: oldAgent.phone || profile.phone, experience: oldAgent.experience, company: oldAgent.company,
        areas: oldAgent.areas, dob: oldAgent.dob, professionalBody: oldAgent.professionalBody || "none", professionalNumber: oldAgent.professionalNumber };
      Object.entries(fills).forEach(([id, val]) => { const el = $("#" + id, root); if (el && val !== undefined && val !== null && val !== "") el.value = val; });
    }
    if (role === "landlord" && profile.phone) $("#phone", root).value = profile.phone;
    if (role === "renter" && profile.phone) $("#phone", root).value = profile.phone;
    ["identityFile", "addressFile", "ownershipFile", "cacFile"].forEach((id) => {
      const input = $("#" + id, root); if (!input) return;
      input.addEventListener("change", () => {
        const name = $('[data-file-name="' + id + '"]', root);
        if (name) name.textContent = input.files && input.files[0] ? input.files[0].name : "No file selected";
        putError(id, "");
      });
    });
    $("#referralSource", root).addEventListener("change", () => {
      const other = $("#referralOther", root); if (other) other.required = $("#referralSource", root).value === "other";
      putError("referralSource", ""); putError("referralOther", "");
    });
    form.addEventListener("input", (event) => { const el = event.target; if (el && el.id) putError(el.id, ""); });
    form.addEventListener("change", (event) => { const el = event.target; if (el && el.id) putError(el.id, ""); });
    const needed = () => {
      if (role === "agent") return ["identityFile", "addressFile"];
      if (role === "landlord") return ["identityFile", "addressFile", "ownershipFile"];
      if (business) {
        const isRealEstate = $$('input[name="businessTypes"]:checked', root).some((el) => el.value === "real-estate-company");
        return isRealEstate ? ["identityFile", "addressFile"] : [];
      }
      return [];
    };
    form.onsubmit = async (event) => {
      event.preventDefault(); if (submit.disabled) return;
      error.textContent = "";
      const errors = [];
      const source = qv(root, "referralSource"), other = qv(root, "referralOther");
      if (!source) { putError("referralSource", "Choose where you heard about Faxton."); errors.push("referralSource"); } else putError("referralSource", "");
      if (source === "other" && other.length < 2) { putError("referralOther", "Tell us where you heard about Faxton."); errors.push("referralOther"); } else putError("referralOther", "");
      const L = loc ? loc.commit() : { country: "", state: "", lga: "", city: "" };
      let locError = "";
      if (!L.country) locError = "Choose your country.";
      else if (L.country === NIGERIA && !L.state) locError = "Choose your state.";
      else if (L.country === NIGERIA && !L.lga) locError = "Choose your local government area (LGA).";
      else if (L.country !== NIGERIA && !L.state && !L.lga) locError = "Enter a state, city or district.";
      putError("location", locError); if (locError) errors.push("location");
      const data = {};
      if (business) {
        const types = $$('input[name="businessTypes"]:checked', root).map((el) => el.value);
        if (!types.length) { putError("businessTypes", "Choose at least one business type."); errors.push("businessTypes"); } else putError("businessTypes", "");
        const ag = { business: qv(root, "business"), cac: qv(root, "cac").toUpperCase(), registrar: qv(root, "registrar"),
          position: qv(root, "position"), address: qv(root, "address"), supportEmail: qv(root, "supportEmail"),
          phone: qv(root, "phone"), website: qv(root, "website"), types: types };
        const must = [["business", 2, "Enter the registered business name."], ["cac", 4, "Enter the CAC registration number."],
          ["registrar", 3, "Enter the registrar or registered representative’s full name."], ["position", 2, "Enter your role in the company."],
          ["address", 5, "Enter the office address."], ["supportEmail", 6, "Enter a valid support email."], ["phone", 8, "Enter a valid business phone number."]];
        must.forEach(([id, min, msg]) => {
          const v = ag[id], invalid = id === "supportEmail" ? !EMAIL_RE.test(v) : v.length < min;
          putError(id, invalid ? msg : ""); if (invalid) errors.push(id);
        });
        const siteInvalid = !!ag.website && !/^https:\/\//i.test(ag.website);
        putError("website", siteInvalid ? "Use an https:// website address." : ""); if (siteInvalid) errors.push("website");
        if (ag.cac && !/^(RC|BN|IT)?[\s-]?\d{4,9}$/i.test(ag.cac)) { putError("cac", "Check the CAC number format."); if (!errors.includes("cac")) errors.push("cac"); }
        data.agency = ag;
        data.phone = ag.phone;
      } else if (role === "agent") {
        const agent = { phone: qv(root, "phone"), experience: qv(root, "experience"), company: qv(root, "company"),
          areas: qv(root, "areas"), dob: qv(root, "dob"), professionalBody: qv(root, "professionalBody") || "none",
          professionalNumber: qv(root, "professionalNumber") };
        if (agent.phone.replace(/[^\d]/g, "").length < 8) { putError("phone", "Enter a valid phone number."); errors.push("phone"); } else putError("phone", "");
        const validExperience = agent.experience !== "" && Number.isInteger(Number(agent.experience)) && Number(agent.experience) >= 0 && Number(agent.experience) <= 60;
        putError("experience", validExperience ? "" : "Enter a number from 0 to 60."); if (!validExperience) errors.push("experience");
        putError("areas", agent.areas.length < 2 ? "Enter the areas you cover." : ""); if (agent.areas.length < 2) errors.push("areas");
        putError("dob", adult(agent.dob) ? "" : "Agents must be at least 18 years old."); if (!adult(agent.dob)) errors.push("dob");
        if (agent.professionalBody !== "none" && agent.professionalNumber.length < 3) { putError("professionalNumber", "Enter the registration number or select Not applicable."); errors.push("professionalNumber"); }
        else putError("professionalNumber", "");
        agent.experience = Number(agent.experience);
        data.agentInfo = agent; data.phone = agent.phone;
      } else if (role === "landlord") {
        const phone = qv(root, "phone");
        if (phone.replace(/[^\d]/g, "").length < 8) { putError("phone", "Enter a valid phone number."); errors.push("phone"); } else putError("phone", "");
        data.phone = phone;
      } else data.phone = qv(root, "phone");
      const isRe = business && (data.agency.types || []).includes("real-estate-company");
      const requiredFiles = needed();
      const hasVerification = requiredFiles.length > 0;
      const needsConsent = hasVerification || business;
      if (needsConsent) {
        const consent = $("#verificationConsent", root);
        if (!consent || !consent.checked) { putError("verificationConsent", "Please consent to document review."); errors.push("verificationConsent"); }
        else putError("verificationConsent", "");
        if (!qv(root, "idType")) { putError("idType", "Choose your government ID type."); errors.push("idType"); }
        else putError("idType", "");
      }
      if (isRe && !qv(root, "idType")) { putError("idType", "Choose your government ID type."); errors.push("idType"); }
      const uploadItems = {};
      const fileRequired = new Set(requiredFiles);
      if (role === "landlord") fileRequired.add("ownershipFile");
      const fileIds = ["identityFile", "addressFile", "ownershipFile", "cacFile"];
      fileIds.forEach((id) => {
        if (!$("#" + id, root)) return;
        if (id === "identityFile" || id === "addressFile") {
          if (!hasVerification) return;
        }
        if (id === "ownershipFile" && role !== "landlord") return;
        const result = currentFile(root, id, fileRequired.has(id) && (id !== "cacFile" || business));
        if (result.error) { putError(id, result.error); errors.push(id); }
        else { putError(id, ""); if (result.file) uploadItems[id] = result; }
      });
      if (errors.length) {
        error.textContent = "Please check the highlighted fields before continuing.";
        const first = $("#" + errors[0], root) || $('[data-error="' + errors[0] + '"]', root);
        first && first.focus && first.focus();
        first && first.scrollIntoView && first.scrollIntoView({ block: "center", behavior: "smooth" });
        return;
      }
      if (!ctx.S.user) { error.textContent = "Your sign-in session has ended. Sign in again to continue."; return; }
      const original = $(".asu-submit-label", submit).textContent, uploaded = [];
      submit.disabled = true; submit.classList.add("is-busy"); $(".asu-submit-label", submit).textContent = "Uploading securely…";
      try {
        const uid = ctx.S.user.uid;
        const upload = async (kind, item) => {
          if (!item) return "";
          const path = "verification/" + uid + "/" + kind + "/" + Date.now() + "-" + safeName(item.file.name);
          await uploadBytes(ref(storage, path), item.file, { contentType: item.mime, customMetadata: { ownerUid: uid, documentType: kind } });
          uploaded.push(path); return path;
        };
        const paths = await Promise.all([
          upload("identity", uploadItems.identityFile), upload("address", uploadItems.addressFile),
          upload("ownership", uploadItems.ownershipFile), upload("cac", uploadItems.cacFile)
        ]);
        const vf = { submittedAt: Date.now() };
        if (qv(root, "idType")) vf.idType = qv(root, "idType");
        if (paths[0]) vf.identityPath = paths[0];
        if (paths[1]) vf.addressPath = paths[1];
        if (paths[2]) vf.ownershipPath = paths[2];
        if (paths[3]) vf.cacPath = paths[3];
        if (data.agentInfo) { vf.professionalBody = data.agentInfo.professionalBody; vf.professionalNumber = data.agentInfo.professionalNumber; }
        const patch = Object.assign({}, resFields(L), data, {
          referralSource: source, referralOther: source === "other" ? other : "",
          onboarding: Object.assign({}, profile.onboarding || {}, { completed: true, completedAt: Date.now() })
        });
        if (Object.keys(vf).length > 1) patch.verificationFiles = vf;
        await saveProfile(uid, patch);
        ctx.S.profile = Object.assign({}, ctx.S.profile, patch);
        toast(hasVerification ? "Your details are saved. Verification is waiting for review." : "Your account setup is complete.");
        ctx.go("#" + (ctx.dashHome ? ctx.dashHome() : "/"));
      } catch (e) {
        await Promise.all(uploaded.map((path) => deleteObject(ref(storage, path)).catch(() => {})));
        error.textContent = friendlyErr(e) || "We couldn’t save your setup. Check your connection and try again.";
      } finally {
        submit.disabled = false; submit.classList.remove("is-busy"); $(".asu-submit-label", submit).textContent = original;
      }
    };
  } };
}
