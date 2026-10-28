// Required post-signup setup. Sensitive verification documents are stored privately in Firebase Storage;
// only the account owner and authorised Faxton reviewers can read those objects.
import { $, $$, esc, icon } from "./ui.js";
import { fieldHtml, fieldError } from "./authkit.js";
import { locFields, mountLoc, resFields, NIGERIA } from "./loc.js";
import { saveProfile } from "./store.js";
import { storage } from "./firebase.js";
import { ref as storageRef, uploadBytes } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js";

const SOURCES = [
  ["instagram", "Instagram"], ["tiktok", "TikTok"], ["x", "X"], ["facebook", "Facebook"],
  ["google", "Google Search"], ["youtube", "YouTube"], ["friend", "Friend or family"],
  ["event", "An event or community"], ["other", "Other"]
];
const BUSINESS_TYPES = [
  ["real-estate", "Real estate company"], ["electrical", "Electrical services"],
  ["home-automation", "Home automation"], ["plumbing", "Plumbing"],
  ["tiling", "Tiling"], ["painting", "Painting"],
  ["appliance-repair", "Home appliance repair"], ["other", "Other home services"]
];
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PHONE = (v) => String(v || "").replace(/[^\d]/g, "").length >= 8;
const ageYears = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 0;
  const n = new Date();
  let years = n.getFullYear() - d.getFullYear();
  if (n < new Date(n.getFullYear(), d.getMonth(), d.getDate())) years--;
  return years;
};
const idTypes = [["national-id", "National identity card"], ["passport", "International passport"], ["drivers-license", "Driver’s licence"]];
const addressTypes = [["utility-bill", "Utility bill"], ["bank-statement", "Bank statement"], ["tenancy-agreement", "Tenancy agreement"], ["other", "Other official proof of address"]];
const ownershipTypes = [["title", "Land title / deed"], ["utility-bill", "Utility bill showing the property address"], ["tax-receipt", "Property tax receipt"], ["other", "Other ownership document"]];
const options = (items, first = "Select an option") => `<option value="">${first}</option>` + items.map(([v, t]) => `<option value="${v}">${t}</option>`).join("");
const selectField = (id, label, items, first, req = true) => `<div class="au-f" data-f="${id}"><label for="${id}">${label}${req ? "" : ' <span class="au-opt">(optional)</span>'}</label><div class="au-in has-ic">${icon("chev", 18, 1.8)}<select id="${id}" name="${id}" ${req ? "required" : ""}>${options(items, first)}</select></div><p class="au-fe" id="${id}-e" hidden></p></div>`;
const fileField = (id, title, help, required = true) => `<div class="setup-doc" data-file-card="${id}"><div class="setup-doc-ic">${icon("file", 22, 1.7)}</div><div class="setup-doc-copy"><label for="${id}">${title}${required ? ' <span class="setup-required">Required</span>' : ' <span class="au-opt">(optional)</span>'}</label><p>${help}</p><small id="${id}-name">PDF, JPG or PNG · up to 10 MB</small></div><label class="setup-file-btn" for="${id}">Choose file</label><input class="setup-file-input" id="${id}" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" ${required ? "required" : ""}></div>`;
const fieldVal = (root, id) => (root.querySelector("#" + id)?.value || "").trim();
const setFieldError = (root, id, message) => fieldError(root, id, message);

export function onboardingSetup(ctx) {
  const profile = ctx.S.profile || {};
  const role = ["renter", "landlord", "agency", "agent"].includes(profile.role) ? profile.role : "renter";
  const isBusiness = role === "agency";
  const isAgent = role === "agent";
  const isLandlord = role === "landlord";
  const hasKyc = isAgent || isLandlord;
  const roleLabel = isBusiness ? "Business" : isLandlord ? "Home owner" : isAgent ? "Real estate agent" : "Renter";
  const oldAgency = profile.agency || {};
  const oldAgent = profile.agentInfo || {};
  const oldLoc = { country: profile.country || NIGERIA, state: profile.state || "", lga: profile.lga || "" };

  const businessBlock = isBusiness ? `
    <section class="setup-section" aria-labelledby="setup-business-heading">
      <div class="setup-section-head"><span class="setup-section-number">02</span><div><h2 id="setup-business-heading">Tell us about your business</h2><p>Choose every service your business provides.</p></div></div>
      ${fieldHtml("business", "Business name", { ic: "building", ph: "e.g. Faxton Properties Ltd", attrs: 'maxlength="120" autocomplete="organization" required' })}
      <div class="setup-field-label" id="business-types-label">What type of business do you run? <span class="setup-required">Select at least one</span></div>
      <div class="setup-business-types" role="group" aria-labelledby="business-types-label">
        ${BUSINESS_TYPES.map(([value, label]) => `<label class="setup-type"><input type="checkbox" name="businessTypes" value="${value}"><span class="setup-type-check">${icon("check", 15, 2.2)}</span><span>${label}</span></label>`).join("")}
      </div>
      <p class="au-fe" id="business-types-e" hidden></p>
      <div class="setup-two">
        ${fieldHtml("cac", "CAC registration number", { ic: "file", ph: "e.g. RC 1234567", attrs: 'maxlength="30" autocapitalize="characters" autocomplete="off" required', hint: "Enter the number shown on your CAC certificate." })}
        ${fieldHtml("registrar", "Name of registrar", { ic: "user", ph: "Full name of the registrar", attrs: 'maxlength="120" autocomplete="name" required' })}
      </div>
      <div class="setup-two">
        ${fieldHtml("supportEmail", "Business support email", { ic: "mail", type: "email", ph: "support@yourbusiness.com", attrs: 'maxlength="120" autocomplete="email" inputmode="email" autocapitalize="none" required' })}
        ${fieldHtml("position", "Your role in the company", { ic: "briefcase", ph: "e.g. Founder or Operations Manager", attrs: 'maxlength="100" required' })}
      </div>
      ${fieldHtml("address", "Office address", { ic: "pin", ph: "Street, area and city", attrs: 'maxlength="200" autocomplete="street-address" required' })}
      ${fieldHtml("website", "Website", { ic: "globe", type: "url", ph: "https://yourbusiness.com", req: false, attrs: 'maxlength="180" inputmode="url" autocapitalize="none" autocomplete="url"' })}
      ${fieldHtml("businessOther", "Other business service", { ph: "Describe your service", req: false, attrs: 'maxlength="100"' })}
    </section>` : "";

  const agentBlock = isAgent ? `
    <section class="setup-section" aria-labelledby="setup-agent-heading">
      <div class="setup-section-head"><span class="setup-section-number">02</span><div><h2 id="setup-agent-heading">Your agent profile</h2><p>Help owners and renters understand your experience and the areas you cover.</p></div></div>
      <div class="setup-two">
        ${fieldHtml("agentPhone", "Phone number", { ic: "phone", type: "tel", ph: "+234 …", attrs: 'maxlength="30" inputmode="tel" autocomplete="tel" required' })}
        ${fieldHtml("experience", "Years of experience", { ic: "clock", type: "number", ph: "e.g. 3", attrs: 'min="0" max="60" step="1" inputmode="numeric" required' })}
      </div>
      ${fieldHtml("company", "Agency you work for", { ic: "building", ph: "Agency or company name", req: false, attrs: 'maxlength="120" autocomplete="organization"' })}
      ${fieldHtml("licence", "Professional registration / licence number", { ic: "badge", ph: "If applicable", req: false, attrs: 'maxlength="80" autocomplete="off"', hint: "Optional. Any applicable professional registration will be checked during manual review." })}
      ${fieldHtml("areas", "Areas you cover", { ic: "pin", ph: "e.g. Lekki, Ikoyi, Victoria Island", attrs: 'maxlength="180" required' })}
      ${fieldHtml("dob", "Date of birth", { ic: "calendar", type: "date", attrs: 'autocomplete="bday" required' })}
    </section>` : "";

  const kycBlock = hasKyc ? `
    <section class="setup-section" aria-labelledby="setup-kyc-heading">
      <div class="setup-section-head"><span class="setup-section-number">${isBusiness ? "03" : "03"}</span><div><h2 id="setup-kyc-heading">${isLandlord ? "Verify your home-owner account" : "Verify your agent account"}</h2><p>These documents are private and are only available to you and authorised Faxton reviewers.</p></div></div>
      ${selectField("idType", "Government-issued ID", idTypes, "Choose your ID type")}
      ${fileField("identityFile", "Upload your ID", "National identity card, passport or driver’s licence. Do not upload a password or unrelated document.")}
      ${selectField("addressProofType", "Proof of address", addressTypes, "Choose proof of address")}
      ${fileField("addressFile", "Upload proof of address", "Use a recent utility bill, bank statement or another official address document.")}
      ${isLandlord ? `
        <div class="setup-ownership-divider"></div>
        <h3 class="setup-subheading">Property ownership evidence</h3>
        <p class="setup-help">Upload a document that supports your claim to the property. Listings remain subject to Faxton’s review before being marked verified.</p>
        ${selectField("ownershipProofType", "Ownership document type", ownershipTypes, "Choose a document type")}
        ${fileField("ownershipFile", "Upload ownership evidence", "Land title/deed, utility bill matching the property address, property tax receipt or another relevant document.")}
      ` : ""}
      <p class="setup-privacy-note">${icon("shield", 18, 1.8)} Your documents are stored in private storage, not as public image links. A Faxton reviewer must approve the verification; uploading documents does not automatically verify the account.</p>
    </section>` : "";

  const form = `
    <div class="setup-intro-row"><span class="setup-role-pill">${icon(isBusiness ? "building" : isLandlord ? "home" : isAgent ? "handshake" : "search", 16, 1.8)} ${roleLabel} account</span><span class="setup-step-note">Account setup · 1 of 1</span></div>
    <h1 id="setup-title">Let’s get your account ready.</h1>
    <p class="au-sub">A few details help us personalise Faxton Rentals for you. You can review these answers in your profile.</p>
    <form id="setupForm" novalidate>
      <section class="setup-section" aria-labelledby="setup-about-heading">
        <div class="setup-section-head"><span class="setup-section-number">01</span><div><h2 id="setup-about-heading">A little about you</h2><p>First, tell us how you found Faxton and where you’re based.</p></div></div>
        ${selectField("referralSource", "How did you hear about Faxton Rentals?", SOURCES, "Choose where you heard about us")}
        <div id="setup-referral-other" hidden>${fieldHtml("referralOther", "Tell us where you heard about us", { ph: "Website, community, event or other source", attrs: 'maxlength="120"' })}</div>
        <div class="setup-location-head"><span class="setup-loc-icon">${icon("pin", 20, 1.8)}</span><div><h3>Where are you based?</h3><p>Choose your country and location manually. We won’t request your device’s GPS location.</p></div></div>
        ${locFields({ style: "au", flow: true, ids: { country: "country", state: "state", lga: "city" }, country: oldLoc.country, state: oldLoc.state, lga: oldLoc.lga })}
      </section>
      ${businessBlock}${agentBlock}${kycBlock}
      <div class="au-alert" id="setupError" role="alert" aria-live="assertive"></div>
      <div class="setup-submit-row"><button class="au-btn primary" id="setupSubmit" type="submit"><span class="au-bl">Save and continue</span>${icon("arrow", 20, 1.9)}</button><p>By continuing, you confirm that the details you provide are accurate.</p></div>
    </form>`;

  const html = `<div class="au au-setup"><aside class="au-photo"><img src="img/signup-hero.webp" alt="" decoding="async"><a class="au-logo" href="#/"><span class="logo-word"><b>Faxton</b> Rentals</span></a><p class="au-cap">Your next chapter<br>starts with trust.</p></aside><main class="au-panel"><div class="au-col setup-col">${form}</div></main></div>`;
  return { full: true, title: "Set up your account", html, mount(root) {
    const formEl = $("#setupForm", root), error = $("#setupError", root), submit = $("#setupSubmit", root);
    let busy = false;
    const say = (message, note = false) => {
      error.className = "au-alert" + (message ? (note ? " note" : " bad") : "");
      error.textContent = message || "";
    };
    const locationPicker = mountLoc(root, { ids: { country: "country", state: "state", lga: "city" } });
    const referral = $("#referralSource", root), otherWrap = $("#setup-referral-other", root);
    referral.addEventListener("change", () => {
      otherWrap.hidden = referral.value !== "other";
      if (referral.value !== "other") fieldError(root, "referralOther", "");
    });
    const fileIds = ["identityFile", "addressFile", "ownershipFile"];
    fileIds.forEach((id) => {
      const input = $("#" + id, root);
      if (!input) return;
      input.addEventListener("change", () => {
        const file = input.files?.[0];
        const label = $("#" + id + "-name", root);
        if (label) label.textContent = file ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB` : "PDF, JPG or PNG · up to 10 MB";
      });
    });
    const selectedTypes = () => $$('input[name="businessTypes"]:checked', root).map((input) => input.value);
    const clearErrors = () => {
      error.textContent = "";
      ["business","cac","registrar","supportEmail","position","address","website","agentPhone","experience","company","licence","areas","dob","referralOther","referralSource","idType","addressProofType","ownershipProofType"].forEach((id) => fieldError(root, id, ""));
      const typeError = $("#business-types-e", root); if (typeError) { typeError.hidden = true; typeError.textContent = ""; }
    };
    const validate = (locationData) => {
      clearErrors();
      let first = null;
      const fail = (id, message) => { fieldError(root, id, message); if (!first) first = $("#" + id, root); };
      if (!fieldVal(root, "referralSource")) fail("referralSource", "Choose how you heard about Faxton Rentals.");
      if (fieldVal(root, "referralSource") === "other" && fieldVal(root, "referralOther").length < 2) fail("referralOther", "Tell us where you heard about us.");
      if (!locationData.country) { say("Choose your country of residence."); return false; }
      if (locationData.country === NIGERIA && !locationData.state) { say("Choose your state."); $("#state", root)?.focus(); return false; }
      if (locationData.country === NIGERIA && !locationData.lga) { say("Choose your local government area (LGA)."); $("#city", root)?.focus(); return false; }
      if (locationData.country !== NIGERIA && !locationData.lga && !locationData.state) { say("Enter your city or district."); $("#city", root)?.focus(); return false; }
      if (isBusiness) {
        if (fieldVal(root, "business").length < 2) fail("business", "Enter your business name.");
        const types = selectedTypes();
        if (!types.length) { const e = $("#business-types-e", root); e.textContent = "Choose at least one business type."; e.hidden = false; if (!first) first = $("#business-types-label", root); }
        if (types.includes("other") && fieldVal(root, "businessOther").length < 2) fail("businessOther", "Describe your other service.");
        if (!/^(RC|BN|IT)?[\s-]?\d{4,9}$/i.test(fieldVal(root, "cac"))) fail("cac", "Enter a valid CAC number, for example RC 1234567.");
        if (fieldVal(root, "registrar").length < 3) fail("registrar", "Enter the registrar’s full name.");
        if (!EMAIL.test(fieldVal(root, "supportEmail"))) fail("supportEmail", "Enter a valid business support email.");
        if (fieldVal(root, "position").length < 2) fail("position", "Enter your role in the company.");
        if (fieldVal(root, "address").length < 5) fail("address", "Enter the business office address.");
        if (fieldVal(root, "website") && !/^https?:\/\/\S+/i.test(fieldVal(root, "website"))) fail("website", "Enter a full website URL beginning with https://.");
      }
      if (isAgent) {
        if (!PHONE(fieldVal(root, "agentPhone"))) fail("agentPhone", "Enter a valid phone number.");
        if (!/^\d+$/.test(fieldVal(root, "experience")) || +fieldVal(root, "experience") > 60) fail("experience", "Enter years of experience from 0 to 60.");
        if (fieldVal(root, "areas").length < 3) fail("areas", "Tell us which areas you cover.");
        if (!fieldVal(root, "dob") || ageYears(fieldVal(root, "dob")) < 18) fail("dob", "Agents must be at least 18 years old.");
      }
      if (hasKyc) {
        if (!fieldVal(root, "idType")) fail("idType", "Choose your government-issued ID type.");
        if (!fieldVal(root, "addressProofType")) fail("addressProofType", "Choose the proof-of-address type.");
        ["identityFile", "addressFile", ...(isLandlord ? ["ownershipFile"] : [])].forEach((id) => {
          const input = $("#" + id, root), file = input?.files?.[0];
          if (!file) { say("Upload every required verification document before continuing."); if (!first) first = input; }
          else if (!["application/pdf","image/jpeg","image/png"].includes(file.type)) { say("Use a PDF, JPG or PNG file for verification documents."); if (!first) first = input; }
          else if (file.size > 10 * 1024 * 1024) { say("Each verification document must be 10 MB or smaller."); if (!first) first = input; }
        });
        if (isLandlord && !fieldVal(root, "ownershipProofType")) fail("ownershipProofType", "Choose the ownership document type.");
      }
      if (first) { if (!error.textContent) say("A few details need your attention. Please review the fields marked below."); first.focus?.(); first.scrollIntoView?.({ behavior: "smooth", block: "center" }); return false; }
      return true;
    };
    const uploadPrivate = async (slot, file) => {
      const path = `verification/${ctx.S.user.uid}/${slot}`;
      await uploadBytes(storageRef(storage, path), file, {
        contentType: file.type,
        customMetadata: { ownerUid: ctx.S.user.uid, purpose: slot }
      });
      return path;
    };
    formEl.onsubmit = async (event) => {
      event.preventDefault();
      if (busy) return;
      if (navigator.onLine === false) { say("You are offline. Connect to the internet and try again."); return; }
      locationPicker?.commit();
      const chosenLocation = locationPicker?.get() || {};
      const loc = resFields(chosenLocation);
      if (!validate(chosenLocation)) return;
      busy = true; submit.disabled = true; submit.setAttribute("aria-busy", "true");
      const buttonText = $(".au-bl", submit); const originalLabel = buttonText.textContent;
      buttonText.textContent = hasKyc ? "Uploading secure documents…" : "Saving your details…";
      try {
        const source = fieldVal(root, "referralSource");
        const onboarding = { completed: true, referralSource: source, referralOther: source === "other" ? fieldVal(root, "referralOther") : "", completedAt: Date.now() };
        const payload = { ...loc, onboarding };
        if (isBusiness) {
          const types = selectedTypes();
          payload.agency = {
            business: fieldVal(root, "business"), businessTypes: types,
            cac: fieldVal(root, "cac").replace(/\s+/g, "").toUpperCase(),
            registrar: fieldVal(root, "registrar"), address: fieldVal(root, "address"),
            supportEmail: fieldVal(root, "supportEmail"), position: fieldVal(root, "position"),
            website: fieldVal(root, "website"), otherService: types.includes("other") ? fieldVal(root, "businessOther") : ""
          };
        }
        if (isAgent) {
          payload.phone = fieldVal(root, "agentPhone");
          payload.agentInfo = {
            phone: fieldVal(root, "agentPhone"), experience: +fieldVal(root, "experience"),
            company: fieldVal(root, "company"), licence: fieldVal(root, "licence"),
            areas: fieldVal(root, "areas"), dob: fieldVal(root, "dob")
          };
        }
        if (hasKyc) {
          const idFile = $("#identityFile", root).files[0];
          const addressFile = $("#addressFile", root).files[0];
          const identityPath = await uploadPrivate("identity", idFile);
          const addressPath = await uploadPrivate("address-proof", addressFile);
          const kyc = {
            status: "submitted", idType: fieldVal(root, "idType"),
            identityPath, addressProofType: fieldVal(root, "addressProofType"),
            addressPath, submittedAt: Date.now()
          };
          if (isLandlord) {
            kyc.ownershipProofType = fieldVal(root, "ownershipProofType");
            kyc.ownershipPath = await uploadPrivate("ownership-proof", $("#ownershipFile", root).files[0]);
          }
          payload.kyc = kyc;
        }
        await saveProfile(ctx.S.user.uid, payload);
        ctx.S.profile = { ...(ctx.S.profile || {}), ...payload };
        await ctx.refreshProfile?.();
        try { sessionStorage.removeItem("faxtonOnboardingDraft"); } catch {}
        say("Your details were saved. Taking you to your account…", true);
        buttonText.textContent = "Saved";
        const destination = ctx.dashHome?.() || "/";
        setTimeout(() => ctx.go("#" + destination), 220);
      } catch (error) {
        console.error("Onboarding save failed", error);
        const code = error?.code || "";
        say(code.includes("storage/") ? "We couldn’t upload your verification files. Check your connection and try again. If this keeps happening, contact Faxton support." :
          code.includes("permission-denied") ? "Your details could not be saved because the account permissions rejected the update. Please retry or contact Faxton support." :
          "We couldn’t save your setup. Your account is still signed in; please try again.");
      } finally {
        busy = false; submit.disabled = false; submit.removeAttribute("aria-busy");
        if (buttonText.textContent !== "Saved") buttonText.textContent = originalLabel;
      }
    };
  }};
}
