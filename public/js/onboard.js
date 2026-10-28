// Sign-up extras for agencies and agents: the business details form and the "verification is on its way" pop-ups.
import { $, esc, icon, modal } from "./ui.js";
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
    const m = modal(`<div class="vf-pop"><span class="vf-ic">${icon("clock", 34)}</span><h2>Account created</h2><p>Your ${role === "agency" ? "business" : "agent"} account is being verified. This will take about <b>${mins}</b>.</p><p class="muted">We’ll notify you the moment you’re verified. After that you can start listing properties.</p><button class="btn primary block" id="vfok">Got it</button></div>`);
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
