// Onboarding, sign up / log in and forgot password. One responsive layout for phones and desktops.
// Styling lives in css/auth.css (classes au-*, ob2-*). Behaviour that other code relies on is kept:
// ids #f #err #email #password #name #terms #remember #forgot #google #avBtn #avFile, [data-role] tabs, the signupDraft in sessionStorage.
import { $, $$, esc, icon, logoMark } from "./ui.js";
import { GOOGLE, EMAIL_RE, authErr, strength, fieldHtml, fieldError } from "./authkit.js";
import { ROLE_INFO, detailsFields, residenceFields, checkDetails, verifyPopup, resizePhoto, askResidence, mountResidence } from "./onboard.js";

const ROLES = ["renter", "landlord", "agency", "agent"];
const ROLE_ICON = { renter: "search", landlord: "home", agency: "building", agent: "handshake" };
const SIGNIN_BLURB = { renter: "Find homes, book viewings and manage your rentals.", landlord: "Manage your listings, viewings and tenants.", agency: "Run your agency’s listings, agents and clients.", agent: "Follow up leads, clients and your listings." };
const safeGet = (k, s = sessionStorage) => { try { return s.getItem(k); } catch { return null; } };
const safeSet = (k, v, s = sessionStorage) => { try { s.setItem(k, v); } catch {} };
const logoLink = (cls = "", href = "#/") => `<a class="${cls}" href="${href}" aria-label="Faxton Rentals">${logoMark()}<span class="logo-word"><b>Faxton</b> Rentals</span></a>`;

// ---------- onboarding (3 screens) ----------
const OB = [
  { eyebrow: "Find your space", h1: "A home that fits<br>your life.", lead: "Explore rental homes across Nigeria. Find the space that feels right for you.", img: "ob-1", alt: "A modern white and timber duplex surrounded by palms", cta: "Continue", next: "#/onboarding/2",
    chip: `<span class="ob2-chip-ic">${icon("pin", 18, 1.8)}</span><span><b>Lekki, Lagos</b></span>`,
    feats: [["search", "Search by neighbourhood", "Find homes in your preferred locations"], ["sliders3", "Filter by budget and bedrooms", "Narrow down to what suits you"], ["heart", "Save your favourite homes", "Keep track of places you love"]] },
  { eyebrow: "See it for yourself", h1: "Find a time.<br>Take a tour.", lead: "Speak with an agent and book a viewing from their available times.", img: "ob-2", alt: "A bright living room with a view over the Lagos skyline", cta: "Continue", next: "#/onboarding/3",
    chip: `<span class="ob2-chip-ic ok">${icon("check", 18, 2.4)}</span><span><b>Viewing confirmed</b><small>Saturday, 10:00 AM</small></span>`,
    feats: [["cal", "Choose an available slot", "Pick a time that works for you"], ["msg", "Chat before your visit", "Ask questions and confirm details"], ["list", "Keep track of your viewings", "All your visits in one place"]] },
  { eyebrow: "Make yourself at home", h1: "Your rental life,<br>all in one place.", lead: "Keep your applications, documents and conversations together.", img: "ob-3", alt: "A dining room with a city view", cta: "Get started", next: "#/signup",
    chip: `<span class="ob2-chip-ic">${icon("doc", 18, 1.8)}</span><span><b>My rental</b><small>Application approved</small></span>`,
    feats: [["doc", "Track your rental application", "See every step of your progress"], ["folder", "Access your tenancy documents", "Agreements and receipts, safely stored"], ["chatdots", "Stay connected with your agent", "Messages and updates in one place"]] },
];
export function onboarding(ctx, n) {
  const s = OB[n - 1], back = n > 1 ? `#/onboarding/${n - 1}` : null;
  const html = `<div class="ob2" data-step="${n}">
    <header class="ob2-head"><div class="ob2-in">${logoLink("ob2-logo", "#/onboarding/1")}<a class="ob2-skip" href="#/login">Skip ${icon("arrow", 18, 1.8)}</a></div></header>
    <main class="ob2-main ob2-in" id="obMain" aria-labelledby="obH">
      <section class="ob2-text">
        <p class="ob2-eyebrow">${s.eyebrow}</p><h1 id="obH">${s.h1}</h1><p class="ob2-lead">${s.lead}</p>
        <ul class="ob2-feats">${s.feats.map(([ic, t, d]) => `<li><span class="ob2-fi">${icon(ic, 22, 1.7)}</span><span class="ob2-ft"><b>${t}</b><small>${d}</small></span><span class="ob2-ch" aria-hidden="true">${icon("chevR", 18, 1.8)}</span></li>`).join("")}</ul>
        ${n === 3 ? `<p class="ob2-have">Already have an account? <a href="#/login">Sign in</a></p>` : ""}
      </section>
      <figure class="ob2-img"><img src="img/${s.img}.webp" alt="${esc(s.alt)}" ${n === 1 ? "" : 'loading="eager"'} decoding="async"><figcaption class="ob2-chip">${s.chip}</figcaption></figure>
    </main>
    <footer class="ob2-foot"><div class="ob2-in ob2-foot-in">
      ${back ? `<a class="ob2-btn back" href="${back}">${icon("left", 18, 1.8)} Back</a>` : `<span class="ob2-btn back off" aria-disabled="true">${icon("left", 18, 1.8)} Back</span>`}
      <div class="ob2-prog" role="img" aria-label="Step ${n} of 3"><div class="ob2-bars">${[1, 2, 3].map((i) => `<i class="${i === n ? "on" : i < n ? "done" : ""}"></i>`).join("")}</div><span class="num">0${n} / 03</span></div>
      <a class="ob2-btn cta" href="${s.next}">${s.cta} ${icon("arrow", 18, 1.9)}</a></div></footer></div>`;
  return { full: true, title: "Welcome", html, mount(root) {
    // Swipe left or right to move between the three screens on a phone.
    const m = $("#obMain", root); let x0 = 0, y0 = 0;
    m.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    m.addEventListener("touchend", (e) => { const t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0; if (Math.abs(dx) < 70 || Math.abs(dy) > 50) return; if (dx < 0) ctx.go(s.next); else if (back) ctx.go(back); }, { passive: true });
  } };
}

// ---------- sign up / log in ----------
export function authPage(ctx, mode) {
  const login = mode === "login", next = ctx.q.next || "/";
  const draft = (() => { try { return JSON.parse(safeGet("signupDraft") || "null") || {}; } catch { return {}; } })();
  let role = ROLES.includes(ctx.q.role) ? ctx.q.role : ROLES.includes(login ? safeGet("loginRole") : draft.role) ? (login ? safeGet("loginRole") : draft.role) : "renter";
  const remembered = safeGet("rememberMe", localStorage) !== "0";
  const tabs = ROLES.map((r) => `<button type="button" role="tab" id="rt-${r}" class="au-tab" data-role="${r}" aria-selected="${r === role}" aria-controls="roleInfo" tabindex="${r === role ? 0 : -1}">${ROLE_INFO[r].name}</button>`).join("");
  const photoRow = `<div class="au-photo-row" id="avRow"><button type="button" id="avBtn" class="au-av" aria-label="Add a profile photo">${icon("camera", 24, 1.5)}</button>
      <input type="file" id="avFile" accept="image/*" hidden><input type="file" id="avCam" accept="image/*" capture="user" hidden>
      <div class="au-av-txt"><b>Profile photo <span class="au-opt">(optional)</span></b><small id="avHint">A clear face helps agents and owners trust you.</small>
        <span class="au-av-act"><button type="button" class="au-link" id="avPick">Choose photo</button><button type="button" class="au-link au-selfie" id="avSelfie">Take a selfie</button><button type="button" class="au-link au-danger" id="avRm" hidden>Remove</button></span>
        <small class="au-fe" id="avErr" role="alert" hidden></small></div></div>`;
  const pwField = login ? fieldHtml("password", "Password", { ic: "lock", type: "password", ph: "Enter your password", eye: true, attrs: 'autocomplete="current-password" enterkeyhint="go" autocapitalize="none" spellcheck="false"' })
    : fieldHtml("password", "Password", { ic: "lock", type: "password", ph: "Create a password", eye: true, attrs: 'autocomplete="new-password" minlength="8" enterkeyhint="next" autocapitalize="none" spellcheck="false"', hint: "Use at least 8 characters." });
  const strengthUi = login ? "" : `<div class="au-meter" id="meter"><div class="au-mbars" aria-hidden="true"><i></i><i></i><i></i><i></i></div><span class="au-mlabel" id="mlabel" role="status"></span></div>
      <ul class="au-req" id="req" aria-label="Password tips"><li data-k="len">8 or more characters</li><li data-k="num">A number or symbol</li><li data-k="mix">Upper and lower case</li></ul>`;
  const body = login
    ? `${fieldHtml("email", "Email address", { ic: "mail", type: "email", ph: "Enter your email address", attrs: 'autocomplete="username" inputmode="email" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="next"' })}
      <div class="au-pw">${pwField}<p class="au-caps" id="caps" hidden>${icon("info", 16, 1.8)} Caps Lock is on</p></div>
      <div class="au-row"><label class="au-chk"><input type="checkbox" id="remember" ${remembered ? "checked" : ""}><span>Remember me</span></label><a href="#" id="forgot" class="au-link">Forgot password?</a></div>`
    : `${photoRow}
      ${fieldHtml("name", "Full name", { ic: "user", ph: "Your full name", attrs: 'autocomplete="name" autocapitalize="words" enterkeyhint="next" maxlength="80"' })}
      ${fieldHtml("email", "Email address", { ic: "mail", type: "email", ph: "you@example.com", attrs: 'autocomplete="email" inputmode="email" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="next"' })}
      <div class="au-pw">${pwField}<p class="au-caps" id="caps" hidden>${icon("info", 16, 1.8)} Caps Lock is on</p>${strengthUi}</div>
      <div class="au-f au-terms data-f="terms"><label class="au-chk"><input type="checkbox" id="terms" aria-describedby="terms-e"><span>I agree to the <a class="au-link" href="#/terms">Terms</a> and <a class="au-link" href="#/privacy">Privacy Policy</a></span></label><p class="au-fe" id="terms-e" hidden></p></div>`;
  const html = `<div class="au au-${mode}">
    <aside class="au-photo"><img src="img/${login ? "login-hero" : "signup-hero"}.webp" alt="" decoding="async">${logoLink("au-logo")}
      <p class="au-cap">${login ? "A fresh start<br>begins here." : "Make room for<br>what comes next."}</p></aside>
    <main class="au-panel"><div class="au-col">
      <h1>${login ? "Welcome back" : "Find your place with Faxton"}</h1><p class="au-sub">${login ? "Sign in to find your next home." : "Create an account to get started."}</p>
      <form id="f" novalidate aria-busy="false">
        <p class="au-as" id="roleLbl">${login ? "Sign in as" : "I am a…"}</p>
        <div class="au-roles" role="tablist" aria-labelledby="roleLbl" id="roles">${tabs}</div>
        <div class="au-rolebox" id="roleInfo" role="tabpanel" aria-live="polite" aria-labelledby="rt-${role}"></div>
        <div class="au-fields">${body}</div>
        <div class="au-alert" id="err" role="alert" aria-live="assertive" data-default=""></div>
        <button class="au-btn primary" type="submit" id="submit"><span class="au-bl">${login ? "Sign in" : "Create account"}</span>${icon("arrow", 20, 1.9)}</button>
        <div class="au-or"><span>or</span></div>
        <button type="button" id="google" class="au-btn ghost">${GOOGLE}<span class="au-bl">Continue with Google</span></button>
        ${login ? "" : `<p class="au-fine">By continuing with Google you agree to our <a class="au-link" href="#/terms">Terms</a> and <a class="au-link" href="#/privacy">Privacy Policy</a>.</p>`}
      </form>
      <p class="au-foot">${login ? `New to Faxton Rentals? <a class="au-link" href="#/signup">Create an account ${icon("arrow", 16, 1.9)}</a>` : `Already have an account? <a class="au-link" href="#/login">Sign in</a>`}</p>
    </div></main></div>`;

  return { full: true, title: login ? "Sign in" : "Create account", html, mount(root) {
    const form = $("#f", root), err = $("#err", root), submit = $("#submit", root), google = $("#google", root);
    let photo = null, busy = false, fails = 0, lockTimer = 0, pendingLock = false;
    const store = {}; // typed agency / agent details, kept per account type so switching tabs never loses them
    // ----- the message line -----
    const say = (m, o = {}) => {
      err.className = "au-alert" + (m ? " bad" : "");
      if (m) { err.innerHTML = `<span class="au-ai">${icon("info", 18, 1.8)}</span><span class="au-am"><span>${esc(m)}</span>${o.act ? ` <a class="au-link" href="${esc(o.act.href)}">${esc(o.act.label)}</a>` : ""}${o.tech ? `<details class="au-tech"><summary>Details for support</summary><code>${esc(o.tech)}</code></details>` : ""}</span>`; }
      else if (err.dataset.default) { err.className = "au-alert note"; err.innerHTML = `<span class="au-ai">${icon("info", 18, 1.8)}</span><span class="au-am">${esc(err.dataset.default)}</span>`; }
      else err.innerHTML = "";
    };
    const sayErr = (e) => { const r = authErr(e); say(r.msg, r); };
    if (ctx.S.deleteNote) err.dataset.default = "For your security, sign in again to finish deleting your account.";
    else if (login && ctx.q.next) err.dataset.default = "Please sign in to continue.";
    if (ctx.S.bannedNote) sayErr({ code: "app/banned" }); else say("");

    // ----- account type tabs -----
    const info = $("#roleInfo", root), xtra = $("#xtra", root);
    const gatherDetails = () => { const o = {}; $$("#xtraBody input, #xtraBody select", root).forEach((i) => (o[i.id] = i.value)); return o; };
    const paintRole = (restore) => {
      const R = ROLE_INFO[role], asks = !login && R.ask.length;
      info.innerHTML = `<span class="au-ri">${icon(ROLE_ICON[role], 22, 1.6)}</span><div><b>${R.name}</b><p>${login ? SIGNIN_BLURB[role] : R.blurb}</p>${!login ? (asks ? `<p class="au-ask"><span>We’ll ask for:</span> ${R.ask.map((a) => `<em>${a}</em>`).join("")}<em class="more">${R.more}</em></p>` : `<p class="au-ask none">${icon("check", 14, 2.4)} Nothing extra to fill in.</p>`) : ""}</div>`;
      if (login) return;
      if (xtra) { xtra.hidden = true; xtra.open = false; const xb = $("#xtraBody", root); if (xb) xb.innerHTML = ""; }
    };
    const setRole = (r, { focus = false, silent = false } = {}) => {
      if (!login && xtra && !xtra.hidden) store[role] = gatherDetails();
      role = r;
      $$("[data-role]", root).forEach((b) => { const on = b.dataset.role === r; b.setAttribute("aria-selected", on); b.tabIndex = on ? 0 : -1; if (on && focus) b.focus(); });
      info.setAttribute("aria-labelledby", "rt-" + r);
      paintRole(store[r]); if (!silent) { if (login) safeSet("loginRole", r); else keep(); }
      if (!login) $$("#xtraBody input", root).forEach(bindField);
    };
    $$("[data-role]", root).forEach((b) => (b.onclick = () => setRole(b.dataset.role)));
    $("#roles", root).addEventListener("keydown", (e) => {
      const i = ROLES.indexOf(role), k = e.key; let j = -1;
      if (k === "ArrowRight" || k === "ArrowDown") j = (i + 1) % ROLES.length; else if (k === "ArrowLeft" || k === "ArrowUp") j = (i + ROLES.length - 1) % ROLES.length; else if (k === "Home") j = 0; else if (k === "End") j = ROLES.length - 1;
      if (j < 0) return; e.preventDefault(); setRole(ROLES[j], { focus: true });
    });

    // ----- remembering what was typed (never the password) -----
    const LOC = null;
    const resNow = () => { const country = $("#country", root).value, state = $("#state", root).value, city = $("#city", root).value.trim(); return { country, state, city, lga: country === "Nigeria" ? city : "" }; };
    const pickRes = (d) => ({ country: d.country, state: d.state || "", city: d.city, lga: d.lga || "" });
    const keep = () => { if (login) return; const v = (id) => $("#" + id, root)?.value || ""; if (xtra && !xtra.hidden) store[role] = gatherDetails(); safeSet("signupDraft", JSON.stringify({ name: v("name"), email: v("email"), role, terms: !!$("#terms", root)?.checked, country: v("country"), state: v("state"), city: v("city"), photo: photo || undefined, d: store })); };
    let keepT = 0; const keepSoon = () => { clearTimeout(keepT); keepT = setTimeout(keep, 120); };

    // ----- inline validation -----
    const rules = {
      name: (v) => (v.trim().length < 2 ? "Enter your full name." : ""),
      email: (v) => (!v.trim() ? "Enter your email address." : !EMAIL_RE.test(v.trim()) ? "That email address doesn’t look right. Check it for typos." : ""),
      password: (v) => (login ? (v ? "" : "Enter your password.") : v.length < 8 ? "Use at least 8 characters." : strength(v, { email: $("#email", root)?.value }).weak ? "That password is too easy to guess. Try mixing words and numbers." : ""),
      state: (v) => (!v && $("#country", root)?.value === "Nigeria" ? "Choose your state." : ""),
      city: (v) => (v.trim().length < 2 ? ($("#country", root)?.value === "Nigeria" ? "Choose your local government area (LGA)." : "Enter your city or district.") : ""),
      country: (v) => (v ? "" : "Choose your country."),
    };
    const one = (id) => { const i = $("#" + id, root); if (!i) return ""; const m = rules[id] ? rules[id](i.value) : ""; fieldError(root, id, m); return m; };
    const bindField = (i) => { i.addEventListener("blur", () => { if (i.value || i.dataset.touched) { i.dataset.touched = "1"; if (rules[i.id]) one(i.id); else if (!login && $("#xtraBody", root)?.contains(i)) detailOne(i.id); } }); i.addEventListener("input", () => { if (i.closest(".au-f")?.classList.contains("bad")) { if (rules[i.id]) one(i.id); else fieldError(root, i.id, ""); } say(""); }); };
    const DK = ["business", "cac", "supportEmail", "phone", "address", "registrar", "position", "opened", "dob", "website", "experience", "licence", "company", "areas"];
    const rawDetails = () => { const raw = {}; DK.forEach((k) => (raw[k] = $("#" + k, root)?.value ?? "")); raw.country = $("#country", root)?.value || ""; raw.state = $("#state", root)?.value || (raw.country === "Nigeria" ? "ok" : ""); raw.city = $("#city", root)?.value.trim().length >= 2 ? $("#city", root).value : "ok"; return raw; };
    const detailOne = (id) => { const r = checkDetails(role, rawDetails()); fieldError(root, id, r.all?.[id] || ""); };
    $$(".au-fields input, .au-fields select", root).forEach(bindField);
    form.addEventListener("input", keepSoon); form.addEventListener("change", keepSoon); addEventListener("pagehide", keep);
    $$("a.au-link[href='#/terms'], a.au-link[href='#/privacy']", root).forEach((a) => a.addEventListener("click", keep));

    // ----- password: show/hide, caps lock, strength -----
    $$("[data-eye]", root).forEach((b) => (b.onclick = () => { const i = $("#" + b.dataset.eye, root), show = i.type === "password"; i.type = show ? "text" : "password"; b.setAttribute("aria-pressed", show); b.setAttribute("aria-label", show ? "Hide password" : "Show password"); b.innerHTML = icon(show ? "eyeo" : "eye", 20, 1.6); }));
    const pw = $("#password", root), caps = $("#caps", root);
    const capsCheck = (e) => { if (e.getModifierState) caps.hidden = !e.getModifierState("CapsLock"); };
    pw.addEventListener("keydown", capsCheck); pw.addEventListener("keyup", capsCheck); pw.addEventListener("blur", () => (caps.hidden = true));
    if (!login) {
      const meter = $("#meter", root), label = $("#mlabel", root), req = $("#req", root), hint = $("#password-h", root);
      const paintStrength = () => { const s = strength(pw.value, { email: $("#email", root).value }); meter.dataset.s = s.score; label.textContent = s.label ? `Password strength: ${s.label}` : ""; $$("li", req).forEach((li) => li.classList.toggle("ok", !!s.checks[li.dataset.k])); req.classList.toggle("on", !!pw.value); hint.hidden = !!pw.value; };
      pw.addEventListener("input", paintStrength); $("#email", root).addEventListener("input", () => pw.value && paintStrength()); paintStrength();
    }

    // ----- profile photo (sign up only) -----
    const av = $("#avBtn", root);
    if (av) {
      const file = $("#avFile", root), cam = $("#avCam", root), rm = $("#avRm", root), hint = $("#avHint", root), aerr = $("#avErr", root);
      const paintPhoto = () => {
        av.innerHTML = photo ? `<img src="${photo}" alt="Your profile photo">` : icon("camera", 24, 1.5);
        av.classList.toggle("has", !!photo); av.setAttribute("aria-label", photo ? "Change your profile photo" : "Add a profile photo");
        rm.hidden = !photo; $("#avPick", root).textContent = photo ? "Change photo" : "Choose photo"; hint.textContent = photo ? "Looking good. This is how others will see you." : "A clear face helps agents and owners trust you.";
      };
      const take = async (f) => { aerr.hidden = true; if (!f) return; hint.textContent = "Getting your photo ready…"; try { photo = await resizePhoto(f); keep(); } catch (x) { aerr.textContent = x?.message || "That picture couldn’t be used. Try another."; aerr.hidden = false; } paintPhoto(); };
      av.onclick = () => file.click(); $("#avPick", root).onclick = () => file.click(); $("#avSelfie", root).onclick = () => cam.click();
      file.onchange = () => { take(file.files[0]); file.value = ""; }; cam.onchange = () => { take(cam.files[0]); cam.value = ""; };
      rm.onclick = () => { photo = null; aerr.hidden = true; paintPhoto(); keep(); av.focus(); };
      const row = $("#avRow", root); ["dragenter", "dragover"].forEach((t) => row.addEventListener(t, (e) => { e.preventDefault(); row.classList.add("drop"); })); ["dragleave", "drop"].forEach((t) => row.addEventListener(t, (e) => { e.preventDefault(); row.classList.remove("drop"); }));
      row.addEventListener("drop", (e) => take(e.dataTransfer?.files?.[0]));
      if (draft.photo) { photo = draft.photo; paintPhoto(); }
    }

    // ----- restore a draft after a reload or after reading the Terms -----
    if (!login) {
      Object.assign(store, draft.d || {});
      ["name", "email"].forEach((k) => { if (draft[k] && $("#" + k, root)) $("#" + k, root).value = draft[k]; });
      if (draft.terms) $("#terms", root).checked = true;
    }
    setRole(role, { silent: true });
    if (!login && draft.country && $("#country", root)) $("#country", root).value = draft.country;
    if (!login && draft.city && $("#city", root)) $("#city", root).value = draft.city;
    $$("#xtraBody input", root).forEach(bindField);

    // ----- sending -----
    const setBusy = (on, which) => {
      busy = on; form.setAttribute("aria-busy", on); $$("button", form).forEach((b) => { if (b.id === "submit" || b.id === "google" || b.classList.contains("au-tab")) b.disabled = on; });
      const btn = which === "google" ? google : submit, lbl = $(".au-bl", btn);
      btn.classList.toggle("loading", on); if (on) { lbl.dataset.t = lbl.textContent; lbl.textContent = which === "google" ? "Connecting to Google…" : login ? "Signing in…" : "Creating your account…"; } else if (lbl.dataset.t) lbl.textContent = lbl.dataset.t;
    };
    const STAFF = ["admin", "owner", "support"], WHO = { landlord: "a home owner", agency: "an agency", agent: "an agent" };
    const run = async (fn, which) => {
      if (busy) return;
      if (navigator.onLine === false) return say("You’re offline. Connect to the internet and try again.");
      say(""); setBusy(true, which);
      try {
        const got = await fn();
        // "Sign in as" a home owner or agency only works for accounts registered that way (staff can always sign in).
        if (login && WHO[role] && got && got !== role && !STAFF.includes(got)) { await ctx.logout(); fails = 0; return say(`This account isn’t registered as ${WHO[role]}. Choose “Renter”, or create ${WHO[role]} account.`); }
        try { sessionStorage.removeItem("signupDraft"); } catch {}
        fails = 0;
        const made = ctx.S.justCreated; ctx.S.justCreated = null;
        if (made) { ctx.go("#/onboarding/setup"); return; }
        ctx.go("#" + next);
      } catch (e) {
        sayErr(e);
        if (login && which !== "google" && /invalid|wrong|user-not-found|no-account/.test(e?.code || "") && ++fails >= 5) pendingLock = true;
      } finally { setBusy(false, which); if (pendingLock) { pendingLock = false; lockFor(30); } }
    };
    // After five wrong passwords in a row, pause for 30 seconds (Firebase rate-limits too, this just keeps people from hammering).
    const lockFor = (sec) => {
      fails = 0; submit.disabled = true; const lbl = $(".au-bl", submit); lbl.dataset.t = lbl.dataset.t || lbl.textContent; let n = sec;
      say("Too many attempts. For your security, please wait a moment, or reset your password.");
      lockTimer = setInterval(() => { n--; lbl.textContent = n > 0 ? `Try again in ${n}s` : lbl.dataset.t; if (n <= 0) { clearInterval(lockTimer); lockTimer = 0; submit.disabled = false; } }, 1000); lbl.textContent = `Try again in ${n}s`;
    };
    ctx.S.cleanups.push(() => { clearInterval(lockTimer); clearTimeout(keepT); });

    // Returns the details + residence when everything is fine; otherwise marks every problem and moves to the first one.
    const validateSignup = ({ google: g = false } = {}) => {
      const bad = [], chk = (id) => { if (one(id)) bad.push(id); };
      if (!g) ["name", "email", "password"].forEach(chk);
      if (!g) {
        const terms = $("#terms", root), termsError = $("#terms-e", root);
        termsError.textContent = terms.checked ? "" : "Please accept the Terms and Privacy Policy to continue.";
        termsError.hidden = terms.checked;
        if (!terms.checked) bad.push("terms");
      }
      if (bad.length) {
        say(bad.length > 1 ? "A few things need another look. We’ve marked them below." : "One thing needs another look. We’ve marked it below.");
        const id = ["name", "email", "password", "terms"].find((x) => bad.includes(x)), input = $("#" + id, root);
        input?.focus(); input?.scrollIntoView?.({ block: "center", behavior: "smooth" });
        return false;
      }
      return true;
    };

    form.onsubmit = (e) => {
      e.preventDefault(); if (busy || submit.disabled) return;
      const v = Object.fromEntries(new FormData(form));
      if (login) {
        const em = one("email"), pwm = one("password"); if (em || pwm) { say(""); $("#" + (em ? "email" : "password"), root).focus(); return; }
        try { safeSet("rememberMe", $("#remember", root).checked ? "1" : "0", localStorage); } catch {}
        return run(() => ctx.signIn(v.email.trim(), v.password, $("#remember", root).checked));
      }
      if (!validateSignup()) return;
      run(() => ctx.signUp(v.name.trim(), v.email.trim(), v.password, role, null, photo, null));
    };
    google.onclick = async () => {
      if (busy) return;
      // On the sign-up page the chosen account type, its details and where the person lives all travel with the Google account.
      if (!login && !validateSignup({ google: true })) return;
      run(() => ctx.signInGoogle(login ? (role === "landlord" ? "landlord" : "renter") : role, null, null, photo || undefined), "google");
    };
    const f = $("#forgot", root); if (f) f.onclick = (e) => { e.preventDefault(); const em = ($("#email", root)?.value || "").trim(); ctx.go("#/forgot" + (em ? "?email=" + encodeURIComponent(em) : "")); };
  } };
}

// ---------- forgot password ----------
export function forgotPage(ctx) {
  const pre = ctx.q.email || "", sent = ctx.q.sent === "1";
  const panel = sent
    ? `<span class="au-bigic">${icon("mail", 30, 1.5)}</span><h1>Check your email</h1><p class="au-sub">If there’s an account for <b class="au-em">${esc(pre)}</b>, we’ve sent a link to choose a new password.</p>
       <p class="au-sub">It can take a minute to arrive. Check your spam or promotions folder too.</p>
       <div class="au-alert" id="err" role="alert" aria-live="assertive"></div>
       <div class="au-stack"><a class="au-btn primary" href="#/login"><span class="au-bl">Back to sign in</span>${icon("arrow", 20, 1.9)}</a><button type="button" class="au-btn ghost" id="resend"><span class="au-bl">Resend email</span></button></div>
       <p class="au-foot"><a class="au-link" href="#/forgot?email=${encodeURIComponent(pre)}">Use a different email</a></p>`
    : `<span class="au-bigic">${icon("lock", 30, 1.5)}</span><h1>Forgot your password?</h1><p class="au-sub">No worries. Enter the email linked to your account and we’ll send you a link to reset it.</p>
       <form id="fg" novalidate>${fieldHtml("fge", "Email address", { ic: "mail", type: "email", ph: "Enter your email address", attrs: `autocomplete="email" inputmode="email" autocapitalize="none" spellcheck="false" enterkeyhint="send" value="${esc(pre)}"` })}
       <div class="au-alert" id="err" role="alert" aria-live="assertive"></div>
       <button class="au-btn primary" type="submit" id="submit"><span class="au-bl">Send reset link</span>${icon("arrow", 20, 1.9)}</button></form>
       <p class="au-foot"><a class="au-link" href="#/login">${icon("left", 16, 1.9)} Back to sign in</a></p>`;
  const html = `<div class="au au-forgot"><aside class="au-photo"><img src="img/login-hero.webp" alt="" decoding="async">${logoLink("au-logo")}<p class="au-cap">We’ll get you<br>back in.</p></aside><main class="au-panel"><div class="au-col">${panel}</div></main></div>`;
  return { title: "Reset password", full: true, html, mount(root) {
    const err = $("#err", root);
    const say = (m) => { err.className = "au-alert" + (m ? " bad" : ""); err.innerHTML = m ? `<span class="au-ai">${icon("info", 18, 1.8)}</span><span class="au-am">${esc(m)}</span>` : ""; };
    const send = async (em, btn) => {
      if (navigator.onLine === false) { say("You’re offline. Connect to the internet and try again."); return false; }
      say(""); btn.disabled = true; btn.classList.add("loading"); const l = $(".au-bl", btn), t = l.textContent; l.textContent = "Sending…";
      try { await ctx.resetPassword(em); return true; } catch (e) { say(authErr(e).msg); return false; } finally { btn.classList.remove("loading"); l.textContent = t; btn.disabled = false; }
    };
    const f = $("#fg", root);
    if (f) { const i = $("#fge", root); i.addEventListener("input", () => { fieldError(root, "fge", ""); say(""); });
      f.onsubmit = async (e) => { e.preventDefault(); const em = i.value.trim(); if (!EMAIL_RE.test(em)) { fieldError(root, "fge", em ? "That email address doesn’t look right. Check it for typos." : "Enter your email address."); i.focus(); return; } if (await send(em, $("#submit", root))) ctx.go("#/forgot?sent=1&email=" + encodeURIComponent(em)); }; if (!pre) i.focus(); }
    const r = $("#resend", root);
    if (r) { let n = 0, tm = 0; const l = $(".au-bl", r);
      r.onclick = async () => { if (n) return; if (await send(pre, r)) { say(""); err.className = "au-alert note"; err.innerHTML = `<span class="au-ai">${icon("check", 18, 2)}</span><span class="au-am">Sent again. Check your inbox.</span>`; n = 30; r.disabled = true; l.textContent = `Resend in ${n}s`; tm = setInterval(() => { n--; l.textContent = n > 0 ? `Resend in ${n}s` : "Resend email"; if (n <= 0) { clearInterval(tm); r.disabled = false; } }, 1000); } };
      ctx.S.cleanups.push(() => clearInterval(tm)); }
  } };
}
