import * as profileStore from "./store.js";
// Sign-up extras for agencies and agents: the business details form and the "verification is on its way" pop-ups.
import { $, esc, icon, modal, logoMark } from "./ui.js";
import { locFields, mountLoc, NIGERIA } from "./loc.js";
import { fieldHtml } from "./authkit.js";

const thisYear = new Date().getFullYear();
const emailOk = (v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);
const phoneOk = (v) => String(v).replace(/[^\d]/g, "").length >= 8;
const age = (iso) => { const d = new Date(iso); if (isNaN(d)) return 0; const n = new Date(); let a = n.getFullYear() - d.getFullYear(); if (n < new Date(n.getFullYear(), d.getMonth(), d.getDate())) a--; return a; };
const f = (id, label, ph = "", extra = "", hint = "") => `<div class="field"><label for="${id}">${label}</label><input id="${id}" name="${id}" placeholder="${esc(ph)}" ${extra}>${hint ? `<small class="muted">${hint}</small>` : ""}</div>`;

const AGENCY = (name) => `<h2>Tell us about your agency</h2><p class="muted" style="margin-bottom:12px">We use these details to verify your agency. Only the Faxton team can see them.</p>
  <form id="ob" class="a2-form ob-form" novalidate>
    ${f("business", "Agency / business name", "e.g. Faxton Properties Ltd", 'required maxlength="120" autocomplete="organization"')}
    <div class="f2">${f("registrar", "Full name of registrar", "", `required maxlength="120" value="${esc(name)}" autocomplete="name"`)}${f("position", "Your role in the company", "e.g. Managing Director", 'required maxlength="80"')}</div>
    <div class="f2">${f("supportEmail", "Support email", "support@youragency.com", 'type="email" required maxlength="120"')}${f("phone", "Business phone number", "+234 …", 'type="tel" required maxlength="30"')}</div>
    <div class="f2">${f("cac", "CAC registration number", "RC 1234567", 'required maxlength="30"', "As shown on your CAC certificate.")}${f("opened", "Year the agency opened", String(thisYear - 5), `type="number" required min="1900" max="${thisYear}"`)}</div>
    <div class="f2">${f("dob", "Registrar’s date of birth", "", 'type="date" required')}${f("address", "Office address", "Street, area, city", 'required maxlength="200"')}</div>
    ${locFields({ style: "field", flow: true, ids: { country: "country", state: "state", lga: "city" } })}
    ${f("website", "Website (optional)", "https://", 'type="url" maxlength="160"')}
    <p class="err" id="obe" role="alert"></p><div class="a2-act"><button class="btn primary" type="submit">Create my agency account</button></div></form>`;
const AGENT = () => `<h2>A few details about you</h2><p class="muted" style="margin-bottom:12px">We use these to verify you as an agent. Only the Faxton team can see them.</p>
  <form id="ob" class="a2-form ob-form" novalidate>
    <div class="f2">${f("phone", "Phone number", "+234 …", 'type="tel" required maxlength="30"')}${f("experience", "Years of experience", "2", 'type="number" required min="0" max="60"')}</div>
    <div class="f2">${f("company", "Agency you work for (optional)", "", 'maxlength="120"')}${f("licence", "ID or licence number", "NIN, driver’s licence or ESVARBON no.", 'required maxlength="40"')}</div>
    ${locFields({ style: "field", flow: true, ids: { country: "country", state: "state", lga: "city" } })}
    ${f("areas", "Areas you cover", "e.g. Lekki, Ikoyi, Victoria Island", 'required maxlength="160"')}
    <p class="err" id="obe" role="alert"></p><div class="a2-act"><button class="btn primary" type="submit">Create my agent account</button></div></form>`;

// ---- shared by the pop-up below and by the inline section on the sign-up page ----
// Checks the raw values for an agency or agent. Returns { details } when fine, or { id, msg, all } where id/msg is the first
// thing to fix and all maps every field that needs fixing to its message (so a form can mark them all at once).
export function checkDetails(role, raw) {
  const v = {}; Object.keys(raw).forEach((k) => (v[k] = String(raw[k] ?? "").trim()));
  const L = role === "agency" ? [
    ["business", v.business.length < 2, "Enter the agency’s name."],
    ["cac", !/^(RC|BN|IT)?[\s-]?\d{4,9}$/i.test(v.cac), "Enter your CAC number, for example RC 1234567."],
    ["supportEmail", !emailOk(v.supportEmail), "Enter a valid support email."],
    ["phone", !phoneOk(v.phone), "Enter a valid business phone number."],
    ["address", v.address.length < 5, "Enter the office address."],
    ["registrar", v.registrar.length < 3, "Enter the registrar’s full name."],
    ["position", !v.position, "Enter your role in the company."],
    ["opened", !(+v.opened >= 1900 && +v.opened <= thisYear), `Year opened must be between 1900 and ${thisYear}.`],
    ["dob", !v.dob || age(v.dob) < 18, v.dob ? "The registrar must be at least 18 years old." : "Enter the registrar’s date of birth."],
    ["website", v.website && !/^https?:\/\//i.test(v.website), "The website must start with https://"],
    ["country", !v.country, "Choose your country of residence."],
    ["state", v.country === NIGERIA && !v.state, "Choose your state."],
    ["city", v.city.length < 2, v.country === NIGERIA ? "Choose your local government area (LGA)." : "Enter your city or district."],
  ] : [
    ["phone", !phoneOk(v.phone), "Enter a valid phone number."],
    ["experience", !(v.experience !== "" && +v.experience >= 0), "Enter your years of experience."],
    ["licence", v.licence.length < 4, "Enter an ID or licence number."],
    ["areas", v.areas.length < 3, "Tell us the areas you cover."],
    ["country", !v.country, "Choose your country of residence."],
    ["state", v.country === NIGERIA && !v.state, "Choose your state."],
    ["city", v.city.length < 2, v.country === NIGERIA ? "Choose your local government area (LGA)." : "Enter your city or district."],
  ];
  const all = {}; L.forEach(([id, bad, msg]) => { if (bad) all[id] = msg; });
  const first = L.find(([id]) => all[id]);
  if (first) return { id: first[0], msg: all[first[0]], all };
  return { details: role === "agency"
    ? { business: v.business, registrar: v.registrar, position: v.position, supportEmail: v.supportEmail, phone: v.phone, cac: v.cac.toUpperCase(), opened: +v.opened, dob: v.dob, address: v.address, website: v.website, country: v.country, state: v.state || "", lga: v.country === NIGERIA ? v.city : "", city: v.city }
    : { phone: v.phone, experience: +v.experience, company: v.company, licence: v.licence, areas: v.areas, country: v.country, state: v.state || "", lga: v.country === NIGERIA ? v.city : "", city: v.city } };
}
// What each account type is, and exactly what extra information it needs (shown before anyone presses Create account).
export const ROLE_INFO = {
  renter: { name: "Renter", blurb: "Browse homes, book viewings and apply to rent.", ask: [] },
  landlord: { name: "Home owner", blurb: "List your own homes. Our team reviews each listing before it goes live.", ask: [] },
  agency: { name: "Business", blurb: "Register your real-estate or home-services business and tell us what you offer.", ask: ["Business type", "CAC registration number", "Office address"], more: "plus your contact and company details" },
  agent: { name: "Agent", blurb: "List and manage homes as an individual agent.", ask: ["ID or licence number", "Agency you work for", "Areas you cover"], more: "plus your phone number and experience" },
};
// The inline detail fields for the sign-up page (country and city are asked once, in the residence row).
export function detailsFields(role, name = "") {
  const f = (id, label, o = {}) => fieldHtml(id, label, o);
  if (role === "agency") return `<div class="au-2">${f("business", "Agency or business name", { ph: "e.g. Faxton Properties Ltd", attrs: 'maxlength="120" autocomplete="organization"' })}${f("cac", "CAC registration number", { ph: "RC 1234567", attrs: 'maxlength="30" autocapitalize="characters" autocomplete="off"', hint: "As shown on your CAC certificate." })}</div>
    <div class="au-2">${f("supportEmail", "Support email", { type: "email", ph: "support@youragency.com", attrs: 'maxlength="120" inputmode="email" autocapitalize="none" spellcheck="false"' })}${f("phone", "Business phone number", { type: "tel", ph: "+234 …", attrs: 'maxlength="30" inputmode="tel" autocomplete="tel"' })}</div>
    ${f("address", "Office address", { ph: "Street, area, city", attrs: 'maxlength="200" autocomplete="street-address"' })}
    <div class="au-2">${f("registrar", "Registrar’s full name", { attrs: `maxlength="120" value="${esc(name)}" autocomplete="name"` })}${f("position", "Your role in the company", { ph: "e.g. Managing Director", attrs: 'maxlength="80"' })}</div>
    <div class="au-2">${f("opened", "Year the agency opened", { type: "number", ph: String(thisYear - 5), attrs: `min="1900" max="${thisYear}" inputmode="numeric"` })}${f("dob", "Registrar’s date of birth", { type: "date", attrs: 'autocomplete="bday"' })}</div>
    ${f("website", "Website", { type: "url", ph: "https://", req: false, attrs: 'maxlength="160" inputmode="url" autocapitalize="none"' })}`;
  return `<div class="au-2">${f("phone", "Phone number", { type: "tel", ph: "+234 …", attrs: 'maxlength="30" inputmode="tel" autocomplete="tel"' })}${f("experience", "Years of experience", { type: "number", ph: "2", attrs: 'min="0" max="60" inputmode="numeric"' })}</div>
    <div class="au-2">${f("licence", "ID or licence number", { ph: "NIN, driver’s licence or ESVARBON no.", attrs: 'maxlength="40" autocomplete="off"' })}${f("company", "Agency you work for", { req: false, attrs: 'maxlength="120" autocomplete="organization"' })}</div>
    ${f("areas", "Areas you cover", { ph: "e.g. Lekki, Ikoyi, Victoria Island", attrs: 'maxlength="160"' })}`;
}
// Country, state and local government (LGA) of residence, asked inline for everyone. The LGA field keeps the id "city" (outside Nigeria it is the city or district).
export function residenceFields(country = "Nigeria", city = "", state = "") {
  return `<div class="au-res">${locFields({ style: "au", ids: { country: "country", state: "state", lga: "city" }, country, state, lga: city })}</div>`;
}
export const mountResidence = (root, onChange) => mountLoc(root, { ids: { country: "country", state: "state", lga: "city" }, onChange });

// Resolves with the details, or null when the person closes the form.
export function collectDetails(role, fullName = "") {
  return new Promise((resolve) => {
    const m = modal(role === "agency" ? AGENCY(fullName) : AGENT()); m.el.classList.add("ob-modal");
    const loc = mountLoc(m.el, { ids: { country: "country", state: "state", lga: "city" } });
    let sent = false; m.el.addEventListener("close", () => { if (!sent) resolve(null); });
    $("#ob", m.el).onsubmit = (e) => {
      e.preventDefault(); loc?.commit(); const r = checkDetails(role, Object.fromEntries(new FormData(e.target)));
      if (r.msg) { $("#obe", m.el).textContent = r.msg; $("#" + r.id, m.el)?.focus(); return; }
      sent = true; m.close(); resolve(r.details);
    };
  });
}

// Shown right after an agency or agent account is created.
export function verifyPopup(role) {
  return new Promise((resolve) => {
    const mins = role === "agency" ? "3 to 5 minutes" : "10 minutes";
    const m = modal(`<div class="vf-pop"><span class="vf-ic">${icon("clock", 34)}</span><h2>Account created</h2><p>Your ${role === "agency" ? "agency" : "agent"} account is being verified. This will take about <b>${mins}</b>.</p><p class="muted">We’ll notify you the moment you’re verified. After that you can start listing properties.</p><button class="btn primary block" id="vfok">Got it</button></div>`);
    m.el.addEventListener("close", () => resolve()); $("#vfok", m.el).onclick = () => m.close();
  });
}
export function verifiedPopup(title, body, ctaText, onCta) {
  const m = modal(`<div class="vf-pop"><span class="vf-ic ok">${icon("check", 34, 2.2)}</span><h2>${esc(title)}</h2><p>${esc(body)}</p>${ctaText ? `<button class="btn primary block" id="vfgo">${esc(ctaText)}</button>` : ""}<button class="btn block" id="vfok" style="margin-top:8px">Close</button></div>`);
  $("#vfok", m.el).onclick = () => m.close(); const g = $("#vfgo", m.el); if (g) g.onclick = () => { m.close(); onCta?.(); };
}

// Crops a chosen picture to a small round-ready square so it fits in the profile. Phones often save sideways photos
// with a rotation flag; createImageBitmap applies it so the preview matches what the person saw.
export const resizePhoto = async (file) => {
  if (!file || !/^image\//.test(file.type || "") && !/\.(jpe?g|png|webp|gif|avif)$/i.test(file.name || "")) throw new Error("Choose a picture (JPG or PNG).");
  if (file.size > 25e6) throw new Error("That picture is very large. Choose one under 25 MB.");
  let src, w, h, url = "";
  try { if (window.createImageBitmap) { src = await createImageBitmap(file, { imageOrientation: "from-image" }); w = src.width; h = src.height; } } catch { src = null; }
  if (!src) {
    src = await new Promise((res, rej) => { const img = new Image(); url = URL.createObjectURL(file); img.onload = () => res(img); img.onerror = () => rej(new Error("That picture couldn’t be opened. Try a JPG or PNG.")); img.src = url; });
    w = src.naturalWidth || src.width; h = src.naturalHeight || src.height;
  }
  const S = 256, c = document.createElement("canvas"); c.width = c.height = S; const m = Math.min(w, h), g = c.getContext("2d");
  g.fillStyle = "#fff"; g.fillRect(0, 0, S, S); g.imageSmoothingQuality = "high"; g.drawImage(src, (w - m) / 2, (h - m) / 2, m, m, 0, 0, S, S);
  if (url) URL.revokeObjectURL(url); if (src.close) src.close();
  return c.toDataURL("image/jpeg", 0.84);
};

// Everyone gives the country and city they live in. The window only closes once it's filled in and submitted
// (during sign-up there's also a Cancel button).
export function askResidence({ required = false, country = "Nigeria", state = "", city = "" } = {}) {
  return new Promise((resolve) => {
    const m = modal(`<h2>Area of residence</h2><p class="muted" style="margin:4px 0 12px">Choose the country, state and local government area where you live. We use it to show you the right homes and keep your account secure.</p><form id="rs" class="a2-form" novalidate>${locFields({ style: "field", flow: true, ids: { country: "rc", state: "rs2", lga: "rt" }, country, state, lga: city })}<p class="err" id="rse" role="alert"></p><div class="a2-act">${required ? "" : `<button type="button" class="btn" id="rsNo">Cancel</button>`}<button class="btn primary" type="submit">Save</button></div></form>`, { sticky: true });
    const loc = mountLoc(m.el, { ids: { country: "rc", state: "rs2", lga: "rt" } });
    let sent = false; m.el.addEventListener("close", () => { if (!sent) resolve(null); });
    const no = $("#rsNo", m.el); if (no) no.onclick = () => m.close();
    $("#rs", m.el).onsubmit = (e) => {
      e.preventDefault(); const r = loc.commit(), err = $("#rse", m.el), ng = r.country === NIGERIA;
      if (!r.country) return (err.textContent = "Choose your country.");
      if (ng && !r.state) return (err.textContent = "Choose your state.");
      if (r.lga.length < 2) return (err.textContent = ng ? "Choose your local government area (LGA)." : "Enter your city or district.");
      sent = true; m.close(); resolve({ country: r.country, state: r.state, lga: ng ? r.lga : "", city: r.lga });
    };
  });
}


// Authenticated post-signup setup. The route is required until this form saves successfully.
const DISCOVERY_SOURCES = ["Instagram", "TikTok", "X", "Facebook", "Google search", "YouTube", "Friend or family", "Referral", "Event or advert", "Other"];
const BUSINESS_TYPES = ["Real estate company", "Electrical services", "Home automation", "Plumbing", "Tiling", "Painting", "Home appliance repair", "Cleaning", "Handyman / carpentry", "AC repair", "Other"];
const setupField = (id, label, value, attrs, hint) =>
  '<label class="onb3-field" for="' + id + '"><span>' + label + '</span><input id="' + id + '" name="' + id + '" value="' + esc(value || "") + '" ' + (attrs || "") + '>' + (hint ? '<small>' + hint + '</small>' : '') + '</label>';
const setupSelect = (id, label, opts, value, attrs) =>
  '<label class="onb3-field" for="' + id + '"><span>' + label + '</span><select id="' + id + '" name="' + id + '" ' + (attrs || "") + '><option value="">Choose an option</option>' +
  opts.map((x) => '<option value="' + esc(x) + '"' + (x === value ? ' selected' : '') + '>' + esc(x) + '</option>').join("") + '</select></label>';
const setupUpload = (id, label, hint) =>
  '<label class="onb3-upload" for="' + id + '"><span class="onb3-upload-icon">' + icon("upload", 20, 1.8) + '</span><span class="onb3-upload-copy"><b>' + label + '</b><small>' + hint + '</small><em id="' + id + '-name">No file selected</em></span><input id="' + id + '" name="' + id + '" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" required></label>';
const fileAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error("That file could not be read. Try selecting it again."));
  reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("That file could not be read."));
  reader.readAsDataURL(file);
});
const onboardingRoleName = (role) => role === "agency" ? "Business" : role === "landlord" ? "Home owner" : role === "agent" ? "Real estate agent" : "Renter";

export function setupOnboarding(ctx) {
  const profile = ctx.S.profile || {};
  const role = ["agency", "agent", "landlord", "renter"].includes(profile.role) ? profile.role : "renter";
  const roleDestination = () => ctx.q?.next || ({ agency: "/agency", agent: "/agent-dashboard", landlord: "/portfolio" }[role] || "/");
  if (profile.onboarding?.completed === true) {
    ctx.go("#" + roleDestination());
    return { title: "Account setup complete", full: true, html: '<div class="onb3"><main class="onb3-main"><h1>Your account is ready.</h1></main></div>' };
  }
  const business = role === "agency", agent = role === "agent", owner = role === "landlord";
  const detail = business ? (profile.agency || {}) : agent ? (profile.agentInfo || {}) : {};
  const locationHtml = residenceFields(profile.country || NIGERIA, profile.lga || profile.city || "", profile.state || "");
  const businessFields = business ? (
    '<section class="onb3-section" aria-labelledby="onb3-business-title"><div class="onb3-section-head"><span class="onb3-step">02</span><div><h2 id="onb3-business-title">Tell us about your business</h2><p>These details help us review your business profile.</p></div></div><div class="onb3-grid">' +
    setupSelect("businessType", "Business type", BUSINESS_TYPES, detail.businessType || "", "required") +
    setupField("business", "Registered business name", detail.business || profile.name || "", 'required maxlength="120" autocomplete="organization"') +
    setupField("cac", "CAC registration number", detail.cac || "", 'required maxlength="40" autocapitalize="characters"', "Enter the number as shown on your CAC record.") +
    setupField("registrar", "Authorised representative", detail.registrar || profile.name || "", 'required maxlength="120" autocomplete="name"') +
    setupField("position", "Your role in the company", detail.position || "", 'required maxlength="80"') +
    setupField("supportEmail", "Support email", detail.supportEmail || profile.email || ctx.S.user?.email || "", 'type="email" required maxlength="120" autocomplete="email"') +
    setupField("phone", "Business phone number", detail.phone || profile.phone || "", 'type="tel" required maxlength="30" autocomplete="tel"') +
    setupField("address", "Office address", detail.address || "", 'required maxlength="200" autocomplete="street-address"') +
    setupField("website", "Business website (optional)", detail.website || "", 'type="url" maxlength="160" placeholder="https://yourbusiness.com"') +
    '<div id="businessTypeOtherWrap" hidden></div></div></section>'
  ) : "";
  const agentFields = agent ? (
    '<section class="onb3-section" aria-labelledby="onb3-agent-title"><div class="onb3-section-head"><span class="onb3-step">02</span><div><h2 id="onb3-agent-title">Your agent profile</h2><p>Help landlords and renters understand your experience and coverage.</p></div></div><div class="onb3-grid">' +
    setupField("agentPhone", "Phone number", detail.phone || profile.phone || "", 'type="tel" required maxlength="30" autocomplete="tel"') +
    setupField("experience", "Years of experience", detail.experience == null ? "" : String(detail.experience), 'type="number" required min="0" max="60" inputmode="numeric"') +
    setupField("company", "Agency you work for (optional)", detail.company || "", 'maxlength="120" autocomplete="organization"') +
    setupField("areas", "Areas you cover", detail.areas || "", 'required maxlength="240" placeholder="Lekki, Ajah, Ikoyi, Victoria Island"') +
    setupField("agentDob", "Date of birth", detail.dob || "", 'type="date" required autocomplete="bday"') +
    setupSelect("licenceType", "Professional registration (where applicable)", ["ESVARBON", "NIESV", "Other professional body", "Not registered / not applicable"], detail.licenceType || "", "") +
    setupField("licence", "Registration / licence number (if applicable)", detail.licence || "", 'maxlength="50"') +
    '</div><p class="onb3-note">A registration number is not proof of a licence by itself. Faxton may check the relevant professional body where an official verification service is available.</p></section>'
  ) : "";
  const ownerFields = owner ? (
    '<section class="onb3-section" aria-labelledby="onb3-owner-title"><div class="onb3-section-head"><span class="onb3-step">02</span><div><h2 id="onb3-owner-title">Home owner details</h2><p>We review your identity before allowing property listings.</p></div></div><div class="onb3-grid">' +
    setupField("ownerPhone", "Phone number", profile.phone || "", 'type="tel" required maxlength="30" autocomplete="tel"') +
    '</div><p class="onb3-note">Proof of ownership is collected separately for each property you submit, because ownership documents must match that specific property.</p></section>'
  ) : "";
  const docTitle = business ? "Business verification documents" : "Identity verification documents";
  const docLead = business
    ? "Upload the authorised representative’s ID, proof of address and CAC certificate."
    : "Upload a government-issued ID and proof of address. These files are private and visible only to you and authorised reviewers.";
  const docSection = (business || agent || owner) ? (
'<section class="onb3-section" aria-labelledby="onb3-docs-title"><div class="onb3-section-head"><span class="onb3-step">' + ((business || agent || owner) ? "03" : "02") + '</span><div><h2 id="onb3-docs-title">' + docTitle + '</h2><p>' + docLead + '</p></div></div><div class="onb3-upload-grid">' +
    setupUpload("doc-id", "Government-issued ID", "Passport, national ID or driver’s licence · PDF/image · up to 550 KB") +
    setupUpload("doc-address", "Proof of address", "A recent utility bill or other accepted address document · up to 550 KB") +
    (business ? setupUpload("doc-cac", "CAC certificate / business registration", "Certificate or registration record · up to 550 KB") : "") +
    '</div><p class="onb3-note">Upload genuine documents only. Submitting a document does not automatically verify an account; authorised reviewers must check it first.</p></section>'
  ) : "";
  const html = '<div class="onb3"><header class="onb3-head"><a class="onb3-brand" href="#/" aria-label="Faxton Rentals">' + logoMark() + '<span>Faxton Rentals</span></a><span class="onb3-secure">' + icon("shield", 16, 1.8) + ' Secure account setup</span></header>' +
    '<main class="onb3-main"><div class="onb3-progress"><span>ACCOUNT SETUP</span><b>Step 1 of 1</b><div><i></i></div></div>' +
    '<section class="onb3-intro"><p class="onb3-eyebrow">Welcome to Faxton Rentals</p><h1>Let’s personalise your account.</h1><p>These details help us show relevant homes and keep the marketplace safer. You can review your profile later in Settings.</p><div class="onb3-role">' + icon(role === "agency" ? "building" : role === "agent" ? "handshake" : role === "landlord" ? "home" : "search", 18, 1.8) + ' Setting up as <b>' + onboardingRoleName(role) + '</b></div></section>' +
    '<form id="onb3-form" novalidate><section class="onb3-section" aria-labelledby="onb3-about-title"><div class="onb3-section-head"><span class="onb3-step">01</span><div><h2 id="onb3-about-title">A little about you</h2><p>Choose how you found Faxton and set your area.</p></div></div><div class="onb3-grid">' +
    setupSelect("heardFrom", "How did you hear about Faxton?", DISCOVERY_SOURCES, profile.discoverySource || "", "required") +
    setupField("heardOther", "Tell us where you heard about us", profile.discoveryOther || "", 'maxlength="120" placeholder="For example, a community group"') +
    '</div><div class="onb3-subhead"><span>' + icon("pin", 18, 1.8) + '</span><div><b>Where are you based?</b><small>Choose your location manually. We do not need your device’s GPS location.</small></div></div>' +
    locationHtml + '</section>' + businessFields + agentFields + ownerFields +
    docSection +
    '<div class="onb3-error" id="onb3-error" role="alert" aria-live="assertive"></div><div class="onb3-actions"><p>By continuing, you confirm that the information you entered is accurate and that you are allowed to submit these documents.</p><button class="btn primary" type="submit" id="onb3-submit">Save and continue ' + icon("arrow", 18, 1.9) + '</button></div></form>' +
    '<footer class="onb3-foot">Your information is used for account setup and verification. Identity documents are stored privately, not shown on your public profile.</footer></main></div>';
  return { full: true, title: "Finish setting up your account", html, mount(root) {
    const form = $("#onb3-form", root), error = $("#onb3-error", root), submit = $("#onb3-submit", root);
    const locationPicker = mountLoc(root, { ids: { country: "country", state: "state", lga: "city" } });
    const heardFrom = $("#heardFrom", root), heardOther = $("#heardOther", root), bizType = $("#businessType", root);
    const paintOther = () => {
      if (heardOther) heardOther.closest(".onb3-field").hidden = heardFrom?.value !== "Other";
      const wrap = $("#businessTypeOtherWrap", root);
      if (!wrap || !bizType) return;
      wrap.hidden = bizType.value !== "Other";
      if (bizType.value === "Other" && !$("#businessTypeOther", root)) wrap.innerHTML = setupField("businessTypeOther", "Describe your business type", detail.businessTypeOther || "", 'required maxlength="80"');
      if (bizType.value !== "Other") wrap.innerHTML = "";
    };
    heardFrom?.addEventListener("change", paintOther);
    bizType?.addEventListener("change", paintOther);
    paintOther();
    ["doc-id", "doc-address", "doc-cac"].forEach((id) => {
      const input = $("#" + id, root);
      if (!input) return;
      input.addEventListener("change", () => {
        const file = input.files?.[0], label = $("#" + id + "-name", root);
        if (label) label.textContent = file ? file.name + " · " + (file.size < 1024 ? file.size + " B" : Math.round(file.size / 1024) + " KB") : "No file selected";
      });
    });
    const setBusy = (on) => {
      submit.disabled = on;
      submit.classList.toggle("is-busy", on);
      submit.innerHTML = on ? icon("loader", 18, 1.8) + " Saving securely…" : "Save and continue " + icon("arrow", 18, 1.9);
      form.setAttribute("aria-busy", String(on));
    };
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (submit.disabled) return;
      error.textContent = "";
      const loc = locationPicker.commit();
      const val = (id) => ($("#" + id, root)?.value || "").trim();
      const bad = (message, id) => { error.textContent = message; $("#" + id, root)?.focus(); };
      if (!val("heardFrom")) return bad("Choose how you heard about Faxton.", "heardFrom");
      if (!loc.country) return bad("Choose your country.", "country");
      if (loc.country === NIGERIA && !loc.state) return bad("Choose your state.", "state");
      if (String(loc.lga || "").trim().length < 2) return bad(loc.country === NIGERIA ? "Choose your local government area (LGA)." : "Enter your city or district.", "city");
      if (business) {
        if (!val("businessType")) return bad("Choose your business type.", "businessType");
        if (val("businessType") === "Other" && !val("businessTypeOther")) return bad("Describe your business type.", "businessTypeOther");
        if (!val("business")) return bad("Enter your registered business name.", "business");
        if (!/^(RC|BN|IT)?[\s-]?\d{4,12}$/i.test(val("cac"))) return bad("Enter a valid CAC registration number.", "cac");
        if (val("registrar").length < 3) return bad("Enter the authorised representative’s full name.", "registrar");
        if (!val("position")) return bad("Enter your role in the company.", "position");
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(val("supportEmail"))) return bad("Enter a valid support email.", "supportEmail");
        if (val("phone").replace(/\D/g, "").length < 8) return bad("Enter a valid business phone number.", "phone");
        if (val("address").length < 5) return bad("Enter the office address.", "address");
        if (val("website") && !/^https?:\/\//i.test(val("website"))) return bad("The website must start with https://.", "website");
      } else if (agent) {
        if (val("agentPhone").replace(/\D/g, "").length < 8) return bad("Enter a valid phone number.", "agentPhone");
        if (val("experience") === "" || +val("experience") < 0 || +val("experience") > 60) return bad("Enter your years of experience.", "experience");
        if (!val("areas")) return bad("Enter the areas you cover.", "areas");
        if (!val("agentDob") || age(val("agentDob")) < 18) return bad("You must be at least 18 to register as a professional agent.", "agentDob");
        if (val("licenceType") && val("licenceType") !== "Not registered / not applicable" && !val("licence")) return bad("Enter your professional registration number, or choose not applicable.", "licence");
      } else if (owner && val("ownerPhone").replace(/\D/g, "").length < 8) return bad("Enter a valid phone number.", "ownerPhone");
      const requiredDocs = (business || agent || owner) ? (business ? [["doc-id", "kyc-id"], ["doc-address", "kyc-address"], ["doc-cac", "kyc-cac"]] : [["doc-id", "kyc-id"], ["doc-address", "kyc-address"]]) : [];
      for (const [id] of requiredDocs) {
        const file = $("#" + id, root)?.files?.[0];
        if (!file) return bad("Select every required verification document before continuing.", id);
        if (file.size > 550 * 1024) return bad(file.name + " is larger than 550 KB. Choose a smaller PDF or image.", id);
        if (!/^(application\/pdf|image\/jpeg|image\/png|image\/webp)$/i.test(file.type || "")) return bad("Use a PDF, JPG, PNG or WebP file.", id);
      }
      setBusy(true);
      try {
        const uploaded = [];
        for (const [id, category] of requiredDocs) {
          const file = $("#" + id, root).files[0];
          const data = await fileAsDataUrl(file);
          const docRef = await profileStore.addDocument(ctx.S.user, {
            name: file.name.slice(0, 160), size: file.size, data, category,
            title: category + " submitted during account setup",
            originalName: file.name.slice(0, 160)
          });
          uploaded.push({ category, id: docRef.id, name: file.name });
        }
        const res = {
          country: loc.country, state: loc.state || "",
          lga: loc.country === NIGERIA ? loc.lga : "",
          city: loc.lga,
          location: [loc.lga, loc.state === "Federal Capital Territory" ? "FCT" : loc.state, loc.country].filter(Boolean).join(", ").slice(0, 80)
        };
        const patch = {
          ...res,
          discoverySource: val("heardFrom"),
          discoveryOther: val("heardFrom") === "Other" ? val("heardOther").slice(0, 120) : "",
          onboarding: { completed: true, completedAt: Date.now(), documentTypes: uploaded.map((x) => x.category) }
        };
        if (business) {
          const d = { business: val("business"), businessType: val("businessType"), businessTypeOther: val("businessType") === "Other" ? val("businessTypeOther") : "", cac: val("cac").toUpperCase(), registrar: val("registrar"), position: val("position"), supportEmail: val("supportEmail"), phone: val("phone"), address: val("address"), website: val("website"), country: loc.country, state: loc.state || "", lga: loc.country === NIGERIA ? loc.lga : "", city: loc.lga };
          patch.agency = d; patch.phone = d.phone; patch.name = d.business;
        } else if (agent) {
          const d = { phone: val("agentPhone"), experience: +val("experience"), company: val("company"), areas: val("areas"), dob: val("agentDob"), licenceType: val("licenceType"), licence: val("licence"), country: loc.country, state: loc.state || "", lga: loc.country === NIGERIA ? loc.lga : "", city: loc.lga };
          patch.agentInfo = d; patch.phone = d.phone;
        } else if (owner) patch.phone = val("ownerPhone");
        await profileStore.saveProfile(ctx.S.user.uid, patch);
        ctx.S.profile = { ...ctx.S.profile, ...patch };
        ctx.go("#" + (ctx.q.next || ctx.dashHome?.() || "/"));
      } catch (e) {
        error.textContent = e?.code === "permission-denied"
          ? "Faxton could not save these details because your profile permissions need updating. Please try again later or contact support."
          : e?.message || "We couldn’t save your onboarding details. Please try again.";
      } finally { setBusy(false); }
    });
  } };
}
