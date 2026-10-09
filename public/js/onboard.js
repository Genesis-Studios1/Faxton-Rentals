// Sign-up extras for agencies and agents: the business details form and the "verification is on its way" pop-ups.
import { $, esc, icon, modal } from "./ui.js";
import { countryOptions } from "./countries.js";

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
    <div class="f2"><div class="field"><label for="country">Country of residence</label><select id="country" name="country" required>${countryOptions("Nigeria")}</select></div>${f("city", "City", "e.g. Lagos", 'required maxlength="60" autocomplete="address-level2"')}</div>
    ${f("website", "Website (optional)", "https://", 'type="url" maxlength="160"')}
    <p class="err" id="obe" role="alert"></p><div class="a2-act"><button class="btn primary" type="submit">Create my agency account</button></div></form>`;
const AGENT = () => `<h2>A few details about you</h2><p class="muted" style="margin-bottom:12px">We use these to verify you as an agent. Only the Faxton team can see them.</p>
  <form id="ob" class="a2-form ob-form" novalidate>
    <div class="f2">${f("phone", "Phone number", "+234 …", 'type="tel" required maxlength="30"')}${f("experience", "Years of experience", "2", 'type="number" required min="0" max="60"')}</div>
    <div class="f2">${f("company", "Agency you work for (optional)", "", 'maxlength="120"')}${f("licence", "ID or licence number", "NIN, driver’s licence or ESVARBON no.", 'required maxlength="40"')}</div>
    <div class="f2"><div class="field"><label for="country">Country of residence</label><select id="country" name="country" required>${countryOptions("Nigeria")}</select></div>${f("city", "City", "e.g. Lagos", 'required maxlength="60" autocomplete="address-level2"')}</div>
    ${f("areas", "Areas you cover", "e.g. Lekki, Ikoyi, Victoria Island", 'required maxlength="160"')}
    <p class="err" id="obe" role="alert"></p><div class="a2-act"><button class="btn primary" type="submit">Create my agent account</button></div></form>`;

// Resolves with the details, or null when the person closes the form.
export function collectDetails(role, fullName = "") {
  return new Promise((resolve) => {
    const m = modal(role === "agency" ? AGENCY(fullName) : AGENT()); m.el.classList.add("ob-modal");
    let sent = false; m.el.addEventListener("close", () => { if (!sent) resolve(null); });
    $("#ob", m.el).onsubmit = (e) => {
      e.preventDefault(); const v = Object.fromEntries(new FormData(e.target)); Object.keys(v).forEach((k) => (v[k] = String(v[k]).trim()));
      const bad = (msg, id) => { $("#obe", m.el).textContent = msg; $("#" + id, m.el)?.focus(); };
      if (role === "agency") {
        if (v.business.length < 2) return bad("Enter the agency’s name.", "business");
        if (v.registrar.length < 3) return bad("Enter the registrar’s full name.", "registrar");
        if (!v.position) return bad("Enter your role in the company.", "position");
        if (!emailOk(v.supportEmail)) return bad("Enter a valid support email.", "supportEmail");
        if (!phoneOk(v.phone)) return bad("Enter a valid business phone number.", "phone");
        if (!/^(RC|BN|IT)?[\s-]?\d{4,9}$/i.test(v.cac)) return bad("Enter your CAC number, for example RC 1234567.", "cac");
        if (!(+v.opened >= 1900 && +v.opened <= thisYear)) return bad(`Year opened must be between 1900 and ${thisYear}.`, "opened");
        if (age(v.dob) < 18) return bad("The registrar must be at least 18 years old.", "dob");
        if (v.address.length < 5) return bad("Enter the office address.", "address");
        if (!v.country) return bad("Choose your country of residence.", "country");
        if (v.city.length < 2) return bad("Enter your city.", "city");
        if (v.website && !/^https?:\/\//i.test(v.website)) return bad("The website must start with https://", "website");
        sent = true; m.close(); resolve({ business: v.business, registrar: v.registrar, position: v.position, supportEmail: v.supportEmail, phone: v.phone, cac: v.cac.toUpperCase(), opened: +v.opened, dob: v.dob, address: v.address, website: v.website, country: v.country, city: v.city });
      } else {
        if (!phoneOk(v.phone)) return bad("Enter a valid phone number.", "phone");
        if (!(+v.experience >= 0)) return bad("Enter your years of experience.", "experience");
        if (v.licence.length < 4) return bad("Enter an ID or licence number.", "licence");
        if (!v.country) return bad("Choose your country of residence.", "country");
        if (v.city.length < 2) return bad("Enter your city.", "city");
        if (v.areas.length < 3) return bad("Tell us the areas you cover.", "areas");
        sent = true; m.close(); resolve({ phone: v.phone, experience: +v.experience, company: v.company, licence: v.licence, areas: v.areas, country: v.country, city: v.city });
      }
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

// Crops a chosen picture to a small square so it fits in the profile.
export const resizePhoto = (file) => new Promise((res, rej) => {
  if (!/^image\//.test(file.type)) return rej(new Error("Choose an image file."));
  const img = new Image(), url = URL.createObjectURL(file);
  img.onload = () => { const S = 192, c = document.createElement("canvas"); c.width = c.height = S; const m = Math.min(img.width, img.height); c.getContext("2d").drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, S, S); URL.revokeObjectURL(url); res(c.toDataURL("image/jpeg", 0.82)); };
  img.onerror = () => rej(new Error("That picture couldn’t be read.")); img.src = url;
});

// Everyone gives the country and city they live in. `required` stops the window being dismissed.
export function askResidence({ required = false, country = "Nigeria", city = "" } = {}) {
  return new Promise((resolve) => {
    const m = modal(`<h2>Where do you live?</h2><p class="muted" style="margin:4px 0 12px">Tell us your country and city so we can show you the right homes and keep your account secure.</p><form id="rs" class="a2-form" novalidate><div class="field"><label for="rc">Country of residence</label><select id="rc" required>${countryOptions(country)}</select></div><div class="field"><label for="rt">City</label><input id="rt" required maxlength="60" placeholder="e.g. Lagos" value="${esc(city)}" autocomplete="address-level2"></div><p class="err" id="rse" role="alert"></p><div class="a2-act"><button class="btn primary" type="submit">Continue</button></div></form>`);
    let sent = false; if (required) { m.el.classList.add("nodismiss"); m.el.addEventListener("cancel", (e) => e.preventDefault()); }
    m.el.addEventListener("close", () => { if (!sent) resolve(null); });
    $("#rs", m.el).onsubmit = (e) => { e.preventDefault(); const c = $("#rc", m.el).value, t = $("#rt", m.el).value.trim(); if (!c) return ($("#rse", m.el).textContent = "Choose your country."); if (t.length < 2) return ($("#rse", m.el).textContent = "Enter your city."); sent = true; m.close(); resolve({ country: c, city: t }); };
  });
}
