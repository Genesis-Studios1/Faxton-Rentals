import { auth } from "./firebase.js";
import { updateProfile } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { $, $$, esc, naira, short, icon, logo, logoMark, initials, toast, modal, friendlyErr, BUILD } from "./ui.js";
import * as st from "./store.js";
import * as PG from "./pages.js";
import * as A2 from "./admin2.js";
import * as DASH from "./dash.js";
import { loadLeaflet, ctrlZoom, tiles } from "./maps.js";
import * as CALLS from "./calls.js";
import { collectDetails, verifyPopup, resizePhoto, askResidence } from "./onboard.js";
import { countryOptions } from "./countries.js";
import * as APPS from "./apps.js";

const GOOGLE = `<svg class="gicon" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.500c3.500 0 6.600 1.200 9.100 3.600l6.800-6.800C35.800 2.400 30.300 0 24 0 14.600 0 6.500 5.400 2.600 13.200l7.900 6.100C12.400 13.600 17.700 9.500 24 9.500z"/><path fill="#4285F4" d="M46.500 24.500c0-1.600-.1-3.100-.4-4.500H24v9h12.700c-.6 3-2.300 5.500-4.800 7.200l7.500 5.800c4.400-4.100 7.100-10.100 7.100-17.500z"/><path fill="#FBBC05" d="M10.500 28.700A14.500 14.500 0 019.500 24c0-1.600.3-3.200.8-4.700l-7.900-6.100A24 24 0 000 24c0 3.900.9 7.500 2.600 10.800l7.900-6.100z"/><path fill="#34A853" d="M24 48c6.500 0 11.900-2.100 15.900-5.800l-7.500-5.800c-2.100 1.400-4.800 2.300-8.400 2.300-6.300 0-11.600-4.100-13.500-9.800l-7.900 6.100C6.500 42.600 14.600 48 24 48z"/></svg>`;
const AREAS = [["lekki", "Lekki, Lagos"], ["ajah", "Ajah, Lagos"], ["yaba", "Yaba, Lagos"], ["victoria", "Victoria Island, Lagos"], ["ikate", "Ikate, Lagos"], ["", "All of Lagos"]];
const BUDGETS = [[0, "Any price"], [1500000, "Up to ₦1.5m"], [2500000, "Up to ₦2.5m"], [3600000, "Up to ₦3.6m"], [5000000, "Up to ₦5m"]];
const TYPES = ["Apartment", "House", "Studio"];
// What kind of home a listing is: by bedrooms for apartments, plus shortlets, houses and studios.
const CATS = [["1bed", "1 Bedroom Apartment"], ["2bed", "2 Bedroom Apartment"], ["3bed", "3 Bedroom Apartment"], ["shortlet", "Shortlet"], ["house", "House or Duplex"], ["studio", "Studio"]];
const catOf = (l) => { const t = String(l.type || ""); return l.shortlet || /short/i.test(t) ? "shortlet" : /studio/i.test(t) || l.beds === 0 ? "studio" : /house|duplex|detached|terrace|mansion|villa|bungalow/i.test(t) ? "house" : l.beds === 1 ? "1bed" : l.beds === 2 ? "2bed" : l.beds === 3 ? "3bed" : "house"; };
const catName = (l) => CATS.find((c) => c[0] === catOf(l))[1];
const matchType = (l, t) => !t || catOf(l) === t || l.type === t;
const typeOptions = (sel) => CATS.map(([k, n]) => `<option value="${k}" ${k === sel ? "selected" : ""}>${n}</option>`).join("");
const opts = (list, sel) => list.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(sel) ? "selected" : ""}>${esc(l)}</option>`).join("");
const fmtDate = (s) => { const d = new Date(s); return isNaN(d) ? s : d.toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long" }); };
const fmtTime = (t) => (t?.toDate ? t.toDate() : new Date()).toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" });
const bedsLabel = (n) => (n === 0 ? "Studio" : `${n} bed${n > 1 ? "s" : ""}`);
const rel = (t) => { const s = t?.seconds; if (!s) return "Just now"; const h = (Date.now() / 1000 - s) / 3600; return h < 1 ? "Just now" : h < 24 ? `${Math.floor(h)} hours ago` : `${Math.floor(h / 24)} day${h >= 48 ? "s" : ""} ago`; };
const statusPill = (s) => `<span class="pill ${/pending|review|requested|awaiting/i.test(s) ? "warn" : /flag|reject|cancel/i.test(s) ? "bad" : ""}">${esc(s)}</span>`;

// ---------- cards ----------
const card = (l, saved, rc, i = 0) => `<article class="card ${rc ? "rcard" : ""}" style="--i:${Math.min(i, 9)}" data-open="${esc(l.id)}" tabindex="0" aria-label="${esc(l.title)}">
  <div class="card-img"><img src="${esc(l.thumb || l.images[0])}" alt="${esc(l.title)}" loading="lazy"><span class="tag ${l.available === false ? "off" : ""}">${l.available === false ? "Rented" : "Available"}</span><span class="peek">View home ${icon("arrow", 16)}</span>
    <button class="heart ${saved.has(l.id) ? "on" : ""}" data-fav="${esc(l.id)}" aria-label="Save ${esc(l.title)}" aria-pressed="${saved.has(l.id)}">${icon("heart", 20)}</button></div>
  <div class="card-body">${rc ? `<div class="rc-top"><h3>${esc(l.title)}</h3><div class="price">${naira(l.price)}<small>per year</small></div></div><div class="loc">${icon("pin", 16)}${esc(l.area)}${l.area.includes(",") ? "" : ", " + esc(l.city)}</div>
      <div class="facts"><span>${icon("bed", 18)}${bedsLabel(l.beds)}</span><span>${icon("bath", 18)}${l.baths} bath${l.baths > 1 ? "s" : ""}</span></div>`
    : `<h3>${esc(l.title)}</h3><div class="loc">${icon("pin", 16)}${esc(l.area)}, ${esc(l.city)}</div>
      <div class="card-foot"><div class="price">${naira(l.price)} <small>/ year</small></div><div class="facts"><span>${icon("bed", 18)}${bedsLabel(l.beds)}</span><i>·</i><span>${icon("bath", 18)}${l.baths} bath${l.baths > 1 ? "s" : ""}</span></div></div>`}</div></article>`;

const homeCard = (l, saved, i = 0) => `<article class="card hcard" style="--i:${Math.min(i, 9)}" data-open="${esc(l.id)}" tabindex="0" aria-label="${esc(l.title)}">
  <div class="card-img wide"><img src="${esc(l.thumb || l.images[0])}" alt="${esc(l.title)}" loading="lazy"><span class="peek">View home ${icon("arrow", 16)}</span>
    <button class="heart ${saved.has(l.id) ? "on" : ""}" data-fav="${esc(l.id)}" aria-label="Save ${esc(l.title)}" aria-pressed="${saved.has(l.id)}">${icon("heart", 20)}</button></div>
  <div class="card-body"><div class="hc-top"><div><h3>${esc(l.title)}</h3><div class="loc">${icon("pin", 16)}${esc(l.area)}, ${esc(l.city)}</div></div><span class="avail ${l.available === false ? "off" : ""}">${l.available === false ? "Rented" : "Available"}</span></div>
    <div class="hc-price">${naira(l.price)} / year</div><div class="facts"><span>${icon("bed", 18)}${bedsLabel(l.beds)}</span><i>·</i><span>${icon("bath", 18)}${l.baths} bath${l.baths > 1 ? "s" : ""}</span></div></div></article>`;

function bindCards(root, ctx) {
  $$("[data-fav]", root).forEach((b) => (b.onclick = async (e) => {
    e.stopPropagation(); const id = b.dataset.fav, on = !ctx.S.saved.has(id);
    b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); if (on) { b.classList.remove("pop"); void b.offsetWidth; b.classList.add("pop"); } await ctx.setSaved(id, on);
    if (ctx.path === "/saved" && !on) ctx.render();
  }));
  $$("[data-open]", root).forEach((c) => {
    const open = () => ctx.go("#/home/" + c.dataset.open);
    c.onclick = open; c.onkeydown = (e) => { if (e.key === "Enter" && e.target === c) open(); };
  });
}

// ---------- router ----------
export async function route(ctx) {
  const { path } = ctx; let m;
  if ((m = path.match(/^\/onboarding\/([123])$/))) return onboarding(ctx, +m[1]);
  if (path === "/login") return authPage(ctx, "login");
  if (path === "/signup") return authPage(ctx, "signup");
  if (path === "/forgot") return PG.forgotPage(ctx);
  if (path === "/download") return APPS.downloadPage(ctx);
  if (path === "/") return discover(ctx);
  if (path === "/search") return search(ctx);
  if ((m = path.match(/^\/home\/([^/]+)$/))) return detail(ctx, decodeURIComponent(m[1]));
  if (path === "/saved") return PG.savedPage(ctx);
  if (path === "/help") return PG.helpPage(ctx);
  if (path === "/messages" || path.startsWith("/messages/")) return messages(ctx, decodeURIComponent(path.split("/")[2] || ""));
  if (path === "/bookings") return bookings(ctx);
  if (path === "/payments") return PG.paymentsPage(ctx);
  if (path === "/applications") return PG.applicationsPage(ctx);
  if (path === "/rentals") return PG.rentalPage(ctx);
  if (path === "/documents") return PG.documentsPage(ctx);
  if ((m = path.match(/^\/agent\/([^/]+)$/))) return PG.agentPage(ctx, decodeURIComponent(m[1]));
  if ((m = path.match(/^\/book\/([^/]+)$/))) return PG.bookPage(ctx, decodeURIComponent(m[1]));
  if ((m = path.match(/^\/apply\/([^/]+)$/))) return PG.applyPage(ctx, decodeURIComponent(m[1]));
  if ((m = path.match(/^\/accept-call\/([^/]+)$/))) { const id = decodeURIComponent(m[1]); setTimeout(() => { ctx.go("#/"); CALLS.answerById(ctx, id, true); }); return { title: "Call", html: `<div class="empty"><h2>Connecting your call…</h2></div>` }; }
  if ((m = path.match(/^\/call\/([^/]+)$/))) { const cid = decodeURIComponent(m[1]); setTimeout(() => ctx.go("#/messages/" + cid)); return { title: "Calls", html: `<div class="empty"><h2>Opening your conversation…</h2></div>` }; }
  if (path === "/settings" || path.startsWith("/settings/")) return settings(ctx, path.split("/")[2] || "profile");
  if (path === "/support" || path === "/support/tickets" || path === "/support/suggestions") return DASH.supportPage(ctx, path.split("/")[2] || "");
  if (path === "/portfolio") return DASH.ownerPage(ctx, "landlord");
  if (path === "/agency") return DASH.ownerPage(ctx, "agency");
  if (path === "/agent-dashboard") return DASH.ownerPage(ctx, "agent");
  if (path === "/admin" || path.startsWith("/admin/")) return admin(ctx, path.split("/")[2] || "");
  return null;
}

// ---------- onboarding + sign up + log in (placed at the design's exact coordinates) ----------
const P = (x, y, w, h, extra = "") => `style="left:calc(${x} * var(--u));top:calc(${y} * var(--u));${w != null ? `width:calc(${w} * var(--u));` : ""}${h != null ? `height:calc(${h} * var(--u));` : ""}${extra}"`;
const FS = (n, lh) => `font-size:calc(${n} * var(--u));${lh ? `line-height:calc(${lh} * var(--u));` : ""}`;
const D = (d) => `--d:${d}s;`;
const dzLogo = (x, y, mh, fs, extra = "") => `<a class="at dz-logo edge-tl rise" href="#/" aria-label="Faxton Rentals" ${P(x, y, null, null, `--mh:${mh};${FS(fs)}${extra}`)}>${logoMark()}<span class="logo-word"><b>Faxton</b> Rentals</span></a>`;
const markSeen = () => { try { localStorage.setItem("seen", "1"); } catch {} };
const feat = (x, top, box, ic, tx, tw, fs, text, desc, fsd, lhd, d) => `<div class="at dz-feat rise" ${P(x, top, null, null, `--box:${box};--gap:${tx - x - box};${D(d)}`)}><span class="dz-fi ${box === 78 ? "g" : "k"}">${icon(ic, 30, box === 78 ? 1.9 : 1.9)}</span><div class="dz-ft" style="width:calc(${tw} * var(--u))"><b class="${desc ? "" : "plain"}" style="${FS(fs, desc ? fs * 1.15 : fs * 1.3)}">${text}</b>${desc ? `<span style="${FS(fsd, lhd)}">${desc}</span>` : ""}</div></div>`;
const bars = (x, y, n, bw, gap, bh) => `<div class="at dz-bars fade" ${P(x, y, null, null, `--bw:${bw};--bg:${gap};--bh:${bh};${D(.5)}`)}>${[1, 2, 3].map((i) => `<i class="${i === n ? "on" : ""}"></i>`).join("")}</div>`;
const arrowBtn = (cls, href, x, y, w, h, fs, inner, d = 0.6, extra = "") => `<a class="at dz-btn ${cls} rise" href="${href}" ${P(x, y, w, h, `${FS(fs)}--rad:14;${D(d)}${extra}`)}>${inner}</a>`;

// Onboarding: logo, text and Back share the left margin line; Skip, the photo and Continue share the right one.
const OB = [
  { eyebrow: "Find your space.", h1: "A home that fits<br>your life.", lead: "Explore rental homes across Nigeria. Find the space that feels right for you.", kind: "soft", img: "ob-1", alt: "Modern home with a landscaped entrance", cta: "Continue", next: "#/onboarding/2",
    feats: [["search", "Search by neighbourhood", "Find homes in your preferred locations"], ["sliders3", "Filter by budget and bedrooms", "Narrow down to what suits you"], ["heart", "Save your favourite homes", "Keep track of places you love"]] },
  { eyebrow: "Take a closer look", h1: "Find a time.<br>Take a tour.", lead: "Connect with an agent and choose a viewing time that works for you.", kind: "box", img: "ob-2", alt: "Bright living room with a city view", cta: "Continue", next: "#/onboarding/3",
    feats: [["msg", "Chat with the listing agent", "Ask questions before you visit"], ["cal", "Choose an available viewing slot", "Pick a time that suits you"], ["home", "Keep track of your visits", "See every viewing in one place"]] },
  { eyebrow: "Make yourself at home.", h1: "Your rental life,<br>all in one place.", lead: "Keep your applications, documents and conversations together.", kind: "round", img: "ob-3", alt: "Dining room with a city view", cta: "Get started", next: "#/signup",
    feats: [["doc", "Track your rental application", "See every step of your progress"], ["folder", "Access your tenancy documents", "Agreements and receipts, safely stored"], ["chatdots", "Stay connected with your agent", "Messages and updates in one place"]] },
];
function onboarding(ctx, n) {
  const s = OB[n - 1], back = n > 1 ? `#/onboarding/${n - 1}` : null;
  const html = `<div class="ob">
    <header class="ob-head"><div class="ob-in"><a class="ob-logo fade" href="#/onboarding/1" aria-label="Faxton Rentals">${logoMark()}<span><b>Faxton</b> Rentals</span></a><a class="ob-skip fade" href="#/login" style="--d:.3s">Skip</a></div></header>
    <main class="ob-in ob-main">
      <section class="ob-text"><div class="ob-eyebrow rise" style="--d:.1s">${s.eyebrow}</div><h1 class="rise" style="--d:.2s">${s.h1}</h1><p class="ob-lead rise" style="--d:.32s">${s.lead}</p>
        <ul class="ob-feats ${s.kind}">${s.feats.map(([ic, t, d], i) => `<li class="rise" style="--d:${0.42 + i * 0.1}s"><span class="ob-fi">${icon(ic, 28, 1.8)}</span><span class="ob-ft"><b>${t}</b><small>${d || ""}</small></span><span class="ob-ch">${icon("arrow", 20)}</span></li>`).join("")}</ul></section>
      <div class="ob-img reveal"><img src="img/${s.img}.webp" alt="${s.alt}"></div>
    </main>
    <footer class="ob-foot"><div class="ob-in ob-foot-in">
      ${back ? `<a class="ob-btn back rise" href="${back}">Back</a>` : `<span class="ob-btn back off rise" aria-disabled="true">${icon("left", 20)} Back</span>`}
      <div class="ob-prog fade" style="--d:.5s"><div class="ob-bars">${[1, 2, 3].map((i) => `<i class="${i === n ? "on" : ""}"></i>`).join("")}</div><span>0${n} / 03</span></div>
      <a class="ob-btn cta rise" href="${s.next}" style="--d:.7s">${s.cta} ${icon("arrow", 22)}</a></div></footer></div>`;
  return { full: true, title: "Welcome", html };
}

// ---------- sign up / log in ----------
function authPage(ctx, mode) {
  const login = mode === "login", next = ctx.q.next || "/";
  const field = (id, x, y, w, h, fs, ic, ph, type = "text", extra = "", d = 0.3) => `<label class="at dz-input rise" for="${id}" ${P(x, y, w, h, `${FS(fs)}--ic:${fs + 3};${D(d)}`)}>${icon(ic, 22)}<input id="${id}" name="${id}" type="${type}" placeholder="${ph}" ${extra}>${type === "password" ? `<button type="button" class="eye" aria-label="Show password">${icon("eye", 22)}</button>` : ""}</label>`;
  const google = (x, y, w, h, fs, d) => `<button type="button" id="google" class="at dz-btn rise" ${P(x, y, w, h, `${FS(fs)}font-weight:500;border:1px solid #cfd8d3;border-radius:calc(8 * var(--u));${D(d)}`)}>${GOOGLE.replace('class="gicon"', `style="width:calc(${fs + 6} * var(--u));height:calc(${fs + 6} * var(--u))"`)} Continue with Google</button>`;
  let html;
  const mobile = matchMedia("(max-width: 860px)").matches;
  const mf = (id, label, ic, ph, type = "text", extra = "") => `<div class="mf"><label for="${id}">${label}</label><div class="mi">${icon(ic, 22)}<input id="${id}" name="${id}" type="${type}" placeholder="${ph}" ${extra}>${type === "password" ? `<button type="button" class="eye" aria-label="Show password">${icon("eye", 22)}</button>` : ""}</div></div>`;
  const mGoogle = `<button type="button" id="google" class="m-btn ghost">${GOOGLE.replace('class="gicon"', 'class="gicon" style="width:22px;height:22px"')} Continue with Google</button>`;
  if (mobile) html = `<div class="m-auth"><header class="m-hero" style="background-image:linear-gradient(180deg,rgba(0,0,0,.35),rgba(0,0,0,0) 45%,rgba(0,0,0,.55)),url(img/${login ? "login-hero" : "signup-hero"}.webp)"><a class="m-logo" href="#/" aria-label="Faxton Rentals">${logoMark()}<span><b>Faxton</b> Rentals</span></a><p>${login ? "A fresh start begins here." : "Make room for what comes next."}</p></header>
    <main class="m-card"><h1>${login ? "Welcome back" : "Create your account"}</h1><p class="m-sub">${login ? "Sign in to find your next home." : "Find your place with Faxton."}</p>
    <p class="m-as">${login ? "Sign in as" : "I am…"}</p><div class="dz-role four m-role" role="tablist" aria-label="Account type">${login ? `<button type="button" class="on" data-role="renter">Renter</button><button type="button" data-role="landlord">Home owner</button><button type="button" data-role="agency">Agency</button><button type="button" data-role="agent">Agent</button>` : `<button type="button" class="on" data-role="renter">Renter</button><button type="button" data-role="landlord">Home owner</button><button type="button" data-role="agency">Agency</button><button type="button" data-role="agent">Agent</button>`}</div>
    <form id="f" novalidate>${login ? mf("email", "Email address", "mail", "Enter your email address", "email", 'autocomplete="email" inputmode="email"') + mf("password", "Password", "lock", "Enter your password", "password", 'autocomplete="current-password"') + `<div class="m-row"><label class="m-chk"><input type="checkbox" id="remember"> Remember me</label><a href="#" id="forgot" class="dz-link">Forgot password?</a></div>`
      : `<div class="m-avrow"><button type="button" id="avBtn" class="av-pick" aria-label="Add a profile photo">${icon("camera", 22)}</button><input type="file" id="avFile" accept="image/*" hidden><span><b>Profile photo</b><small>Optional. You can change it later in Settings.</small></span></div>` + mf("name", "Full name", "user", "Your full name", "text", 'autocomplete="name"') + mf("email", "Email address", "mail", "you@example.com", "email", 'autocomplete="email" inputmode="email"') + mf("password", "Password", "lock", "Create a password", "password", 'autocomplete="new-password"') + `<label class="m-chk terms"><input type="checkbox" id="terms"> <span>I agree to the <a class="dz-link" href="#/signup">Terms</a> and <a class="dz-link" href="#/signup">Privacy Policy</a></span></label>`}
      <div class="m-hint dz-hint" id="err" role="alert" data-default="${login ? "" : "At least 8 characters"}">${login ? "" : "At least 8 characters"}</div>
      <button class="m-btn primary" type="submit">${login ? "Sign in" : "Create account"} ${icon("arrow", 22)}</button>
      <div class="m-or"><span>or</span></div>${mGoogle}</form>
    <p class="m-foot">${login ? `New to Faxton Rentals? <a class="dz-link" href="#/signup">Create an account →</a>` : `Already have an account? <a class="dz-link" href="#/login">Sign in</a>`}</p></main></div>`;
  else if (!login) html = `<div class="dz-page"><div class="frame">
    <div class="at dz-bgimg edge-l reveal" ${P(0, 0, 916, 941, `background-image:url(img/signup-hero.webp);--W:916;`)}></div>
    ${dzLogo(108, 31, 45, 29.5)}
    <div class="at dz-overlay-title rise" ${P(87, 765, 600, null, `${FS(52, 52)}font-weight:400;letter-spacing:-.02em;${D(.6)}`)}>Make room for<br>what comes next.</div>
    <div class="at fade m-hide" ${P(88, 888, 57, 3, `background:#34d399;${D(.9)}`)}></div>
    <div class="at dz-card edge-r fade" ${P(916, 0, 756, 941, `border-radius:0;--W:756;${D(.1)}`)}></div>
    <form id="f" class="at" novalidate ${P(0, -38, 1672, 941)}>
    <h1 class="at rise" ${P(916, 134, 756, null, `text-align:center;${FS(41, 56)}letter-spacing:-.036em;${D(.25)}`)}>Find your place with Faxton</h1>
    <p class="at rise" ${P(916, 193, 756, null, `text-align:center;${FS(22)}color:#68746f;${D(.3)}`)}>Create an account to get started.</p>
    <div class="at dz-role four rise" role="tablist" aria-label="Account type" ${P(1021, 257, 546, 49, D(.35))}><button type="button" class="on" data-role="renter">Renter</button><button type="button" data-role="landlord">Home owner</button><button type="button" data-role="agency">Agency</button><button type="button" data-role="agent">Agent</button></div>
    <div class="at dz-label rise" ${P(1021, 328, null, null, `${FS(16)}${D(.4)}`)}>Full name</div><button type="button" id="avBtn" class="at av-pick rise" aria-label="Add a profile photo (optional)" title="Add a profile photo (optional)" ${P(1021, 358, 49, 49, D(.4))}>${icon("camera", 22)}</button><input type="file" id="avFile" accept="image/*" hidden>${field("name", 1080, 358, 487, 49, 17, "user", "Your full name", "text", 'autocomplete="name"', .4)}
    <div class="at dz-label rise" ${P(1021, 426, null, null, `${FS(16)}${D(.45)}`)}>Email address</div>${field("email", 1021, 456, 546, 49, 17, "mail", "you@example.com", "email", 'autocomplete="email"', .45)}
    <div class="at dz-label rise" ${P(1021, 524, null, null, `${FS(16)}${D(.5)}`)}>Password</div>${field("password", 1021, 554, 546, 49, 17, "lock", "Create a password", "password", 'autocomplete="new-password"', .5)}
    <div class="at dz-hint" id="err" role="alert" data-default="At least 8 characters" ${P(1021, 608, 546, null, FS(15))}>At least 8 characters</div>
    <div class="at dz-check rise" ${P(1021, 650, null, null, `${FS(16)}${D(.55)}`)}><input type="checkbox" id="terms" aria-label="I agree to the Terms and Privacy Policy"><label for="terms">I agree to the <a class="dz-link" style="font-weight:400" href="#/signup">Terms</a> and <a class="dz-link" style="font-weight:400" href="#/signup">Privacy Policy</a></label></div>
    <button class="at dz-btn primary rise" type="submit" ${P(1021, 698, 546, 50, `${FS(19)}--rad:8;${D(.6)}`)}>Create account ${icon("arrow", 22)}</button>
    <div class="at dz-sep fade" ${P(1021, 760, 546, 24, `${FS(17)}${D(.65)}`)}>or</div>
    ${google(1021, 796, 546, 50, 19, .65)}
    <p class="at fade" ${P(1021, 871, 546, null, `text-align:center;${FS(16)}color:#5f6b66;${D(.7)}`)}>Already have an account? <a class="dz-link" href="#/login">Sign in</a></p>
    </form>
  </div></div>`;
  else if (login) html = `<div class="dz-page"><div class="frame">
    <div class="at dz-bgimg edge-l reveal" ${P(0, 0, 883, 941, `background-image:url(img/login-hero.webp);--W:883;`)}></div>
    ${dzLogo(108, 31, 45, 29.5)}
    <div class="at dz-overlay-title rise" ${P(87, 815, 700, null, `${FS(42, 50)}font-weight:600;letter-spacing:-.02em;${D(.6)}`)}>A fresh start begins here.</div>
    <div class="at fade m-hide" ${P(87, 884, 57, 3, `background:#34d399;${D(.9)}`)}></div>
    <div class="at dz-card edge-r fade" ${P(883, 0, 789, 941, `border-radius:0;--W:789;${D(.1)}`)}></div>
    <form id="f" class="at" novalidate ${P(0, 0, 1672, 941)}>
    <h1 class="at rise" ${P(960, 134, 700, null, `${FS(60.5, 76)}letter-spacing:-.058em;${D(.25)}`)}>Welcome back</h1>
    <p class="at rise" ${P(962, 207, 700, null, `${FS(34.4, 44)}color:#68746f;letter-spacing:-.02em;${D(.3)}`)}>Sign in to find your next home.</p>
    <div class="at dz-role four rise" role="tablist" aria-label="Sign in as" ${P(963, 257, 637, 36, D(.35))}><button type="button" class="on" data-role="renter">Renter</button><button type="button" data-role="landlord">Home owner</button><button type="button" data-role="agency">Agency</button><button type="button" data-role="agent">Agent</button></div>
    <div class="at dz-label rise" ${P(963, 297, null, null, `${FS(20)}${D(.4)}`)}>Email address</div>${field("email", 963, 335, 637, 66, 20, "mail", "Enter your email address", "email", 'autocomplete="email"', .4)}
    <div class="at dz-label rise" ${P(963, 428, null, null, `${FS(20)}${D(.45)}`)}>Password</div>${field("password", 963, 466, 637, 66, 20, "lock", "Enter your password", "password", 'autocomplete="current-password"', .45)}
    <div class="at dz-check rise" ${P(963, 561, null, null, `${FS(19)}--cb:27;${D(.5)}`)}><input type="checkbox" id="remember" aria-label="Remember me"><label for="remember">Remember me</label></div>
    <a class="at dz-link rise" id="forgot" href="#" ${P(1443, 561, null, null, `${FS(19)}text-decoration:underline;text-underline-offset:calc(4 * var(--u));${D(.5)}`)}>Forgot password?</a>
    <div class="at dz-hint" id="err" role="alert" data-default="" ${P(963, 592, 637, null, FS(16))}></div>
    <button class="at dz-btn primary rise" type="submit" ${P(963, 617, 637, 68, `${FS(24)}--rad:8;${D(.55)}`)}>Sign in ${icon("arrow", 26)}</button>
    <div class="at dz-sep fade" ${P(963, 705, 637, 26, `${FS(18)}${D(.6)}`)}>or</div>
    ${google(963, 749, 637, 69, 21, .6)}
    <p class="at fade" ${P(963, 860, 637, null, `text-align:center;${FS(19)}color:#5f6b66;${D(.7)}`)}>New to Faxton Rentals? <a class="dz-link" href="#/signup">Create an account <span aria-hidden="true">→</span></a></p>
    </form>
  </div></div>`;
  return { full: true, title: login ? "Sign in" : "Create account", html,
    mount() {
      const err = $("#err"), form = $("#f"); let role = ["agent", "landlord", "agency"].includes(ctx.q.role) ? ctx.q.role : "renter";
      const say = (m) => { err.textContent = m || err.dataset.default; err.classList.toggle("bad", !!m); };
      if (ctx.S.deleteNote) { err.dataset.default = "For your security, sign in again to finish deleting your account."; err.textContent = err.dataset.default; }
      else if (ctx.S.bannedNote) say(friendlyErr({ code: "app/banned" }));
      else if (login && ctx.q.next) { err.dataset.default = "Please log in to access this feature."; err.textContent = err.dataset.default; }
      $$("[data-role]").forEach((b) => { b.classList.toggle("on", b.dataset.role === role); b.onclick = () => { role = b.dataset.role; $$("[data-role]").forEach((x) => x.classList.toggle("on", x === b)); }; });
      let photo = null; const av = $("#avBtn");
      if (av) { av.onclick = () => $("#avFile").click(); $("#avFile").onchange = async (e) => { const f = e.target.files[0]; if (!f) return; try { photo = await resizePhoto(f); av.innerHTML = `<img src="${photo}" alt="">`; av.classList.add("has"); } catch (x) { say(friendlyErr(x)); } }; }
      $$(".eye").forEach((b) => (b.onclick = () => { const i = b.parentElement.querySelector("input"); i.type = i.type === "password" ? "text" : "password"; }));
      $$("input", form).forEach((i) => i.addEventListener("input", () => say("")));
      const STAFF = ["admin", "owner", "support"], WHO = { landlord: "a home owner", agency: "an agency", agent: "an agent" };
      const run = async (fn, btn) => {
        say(""); if (btn) btn.disabled = true;
        try {
          const got = await fn();
          // "Sign in as" a home owner or agency only works for accounts registered that way (staff can always sign in).
          if (login && WHO[role] && got && got !== role && !STAFF.includes(got)) { await ctx.logout(); return say(`This account isn’t registered as ${WHO[role]}. Choose “Renter”, or create ${WHO[role]} account.`); }
          const made = ctx.S.justCreated; ctx.S.justCreated = null;
          if (made === "agency" || made === "agent") { ctx.go("#" + next); await verifyPopup(made); return; }
          ctx.go("#" + next);
        } catch (e) { say(friendlyErr(e)); } finally { if (btn) btn.disabled = false; }
      };
      form.onsubmit = (e) => {
        e.preventDefault(); const v = Object.fromEntries(new FormData(form)); const btn = form.querySelector("button[type=submit]");
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email || "")) return say("Enter a valid email address.");
        if (login) { if (!v.password) return say("Enter your password."); return run(() => ctx.signIn(v.email, v.password, $("#remember").checked), btn); }
        if (!v.name?.trim()) return say("Enter your full name.");
        if ((v.password || "").length < 8) return say("Password must be at least 8 characters.");
        if (!$("#terms").checked) return say("Please accept the Terms and Privacy Policy.");
        (async () => {
          const details = role === "agency" || role === "agent" ? await collectDetails(role, v.name.trim()) : undefined;
          if (details === null) return;
          const residence = details ? { country: details.country, city: details.city } : await askResidence();
          if (!residence) return;
          run(() => ctx.signUp(v.name.trim(), v.email, v.password, role, details, photo, residence), btn);
        })();
      };
      $("#google").onclick = async (e) => {
        const btn = e.currentTarget;
        // New agencies and agents give their business details first. On the sign-in page a brand-new Google account starts as a renter.
        let details, residence; if (!login) { if (role === "agency" || role === "agent") { details = await collectDetails(role, ""); if (details === null) return; residence = { country: details.country, city: details.city }; } else { residence = await askResidence(); if (!residence) return; } }
        run(() => ctx.signInGoogle(login ? (role === "landlord" ? "landlord" : "renter") : role, details, residence), btn);
      };
      const f = $("#forgot"); if (f) f.onclick = (e) => { e.preventDefault(); const em = ($("#email")?.value || "").trim(); ctx.go("#/forgot" + (em ? "?email=" + encodeURIComponent(em) : "")); };
    } };
}

// ---------- discover ----------
const inRange = (price, r) => { if (!r) return true; const [lo, hi] = r.split("-").map(Number); return price >= lo && (!hi || price <= hi); };
async function discover(ctx) {
  const all = await st.getListings(), pr = ctx.S.profile?.prefs || {};
  // "Homes you might love": listings that match the saved rental preferences come first
  const score = (l) => (pr.area && (l.area + " " + l.city).toLowerCase().includes(pr.area) ? 2 : 0) + (pr.type && matchType(l, pr.type) ? 1 : 0) + (pr.budget && inRange(l.price, pr.budget) ? 1 : 0);
  const list = [...all].map((l, i) => [l, i]).sort((x, y) => score(y[0]) - score(x[0]) || x[1] - y[1]).map((x) => x[0]);
  const TABS = [["", "All homes"], ["Apartment", "Apartments"], ["House", "Houses"], ["Studio", "Studios"]];
  const cardsFor = (t) => { const rows = list.filter((l) => !t || l.type === t).slice(0, 3); return rows.length ? rows.map((l, i) => homeCard(l, ctx.S.saved, i)).join("") : `<p class="muted hm-none">No ${t.toLowerCase()} listings yet.</p>`; };
  const hmCard = (l) => `<article class="hmc" data-open="${esc(l.id)}" tabindex="0" aria-label="${esc(l.title)}"><div class="hmc-img"><img src="${esc(l.thumb || l.images[0])}" alt="${esc(l.title)}" loading="lazy"><button class="heart ${ctx.S.saved.has(l.id) ? "on" : ""}" data-fav="${esc(l.id)}" aria-label="Save ${esc(l.title)}" aria-pressed="${ctx.S.saved.has(l.id)}">${icon("heart", 20)}</button><span class="hmc-tag">${icon("building", 16)} ${esc(l.type || "Home")}</span></div><b class="hmc-p">${naira(l.price)} <small>/ year</small></b><div class="hmc-f"><span>${icon("bed", 16)} ${bedsLabel(l.beds)}</span><span>${icon("bath", 16)} ${l.baths} bath${l.baths > 1 ? "s" : ""}</span><span>${icon("pin", 16)} ${esc(l.area)}</span></div></article>`;
  const os = (img, name, sub) => `<div class="hm-os"><img src="img/${img}" alt="" width="36" height="36"><span><b>${name}</b><small>${sub}</small></span></div>`;
  const macTile = `<div class="hm-os"><span class="hm-mac">${icon("download", 20)}</span><span><b>macOS</b><small>Use on MacBook</small></span></div>`;
  const tuxTile = `<div class="hm-os"><span class="hm-mac tux"><svg viewBox="0 0 32 32" width="22" height="22" aria-hidden="true"><ellipse cx="16" cy="19" rx="9" ry="10" fill="#1b1b1f"/><ellipse cx="16" cy="21.5" rx="5.5" ry="6.5" fill="#f4f1ea"/><circle cx="12.6" cy="12.5" r="1.5" fill="#fff"/><circle cx="19.4" cy="12.5" r="1.5" fill="#fff"/><path d="M14 15.2h4l-2 2.2z" fill="#f2b233"/></svg></span><span><b>Linux</b><small>Use on desktop</small></span></div>`;
  const dlNow = `<button type="button" class="hm-dlnow" data-dlnow>${icon("download", 18)} Download now</button>`;
  const mobile = `<div class="hm-m"><section class="hmm-hero"><div class="hmm-text"><div class="hmm-eye rise">Find your space.</div><h1 class="rise" style="--d:.08s">A home that fits your life.</h1><p class="rise" style="--d:.16s">Explore rental homes across Nigeria. Find the space that feels right for you.</p></div></section>
    <form class="hmm-search rise" id="hmmS" role="search" style="--d:.24s"><span class="hmm-si">${icon("search", 22)}</span><input name="area" type="search" placeholder="Search by neighbourhood, city or property type" aria-label="Search homes" autocomplete="off"><button aria-label="Search">${icon("search", 22)}</button></form>
    <div class="hmm-chips rise" style="--d:.3s"><a href="#/search">${icon("home", 26)}<span>Browse neighbourhoods</span></a><a href="#/search">${icon("sliders3", 26)}<span>Filter by budget and bedrooms</span></a><a href="#/saved">${icon("heart", 26)}<span>Save your favourite homes</span></a></div>
    <section class="hmm-app rise" style="--d:.36s"><div class="hmm-app-top"><div><div class="hmm-eye light">Get Faxton Rentals everywhere</div><h2>Start exploring on your device.</h2><p>Download the Faxton Rentals app or continue on web.</p>${dlNow}</div><img src="img/app-devices.webp" alt="Faxton Rentals on phone and laptop" loading="lazy"></div>
      <div class="hm-os-row">${os("os-android.webp", "Android", "Get the app")}${os("os-apple.webp", "iOS", "Get the app")}${os("os-windows.webp", "Windows", "Use on desktop")}${macTile}</div></section>
    <div class="hmm-sec"><div><h2>Featured Homes</h2><p>Handpicked rental homes for you.</p></div><a class="hmm-all" href="#/search">View all ${icon("arrow", 18)}</a></div>
    <div class="hmm-grid">${list.slice(0, 6).map(hmCard).join("")}</div></div>`;
  return { title: "Home", html: `<div class="wrap hm">${mobile}
    <section class="hm-hero"><div class="hm-text"><div class="eyebrow-s rise">Find your next chapter</div><h1 class="rise" style="--d:.08s">A place to live.<br>A place to<br>call home.</h1><p class="rise" style="--d:.18s">Find a rental that fits your life, in a neighbourhood you love.</p></div><div class="hm-img reveal" style="background-image:url(img/hero.webp)" role="img" aria-label="Modern home in Lagos"></div></section>
    <form class="searchbar hm-search rise" style="--d:.3s" id="sb" role="search">
      <div class="sb-cell">${icon("pin", 26)}<label>Location<select name="area">${opts(AREAS, pr.area || "lekki")}</select></label></div>
      <div class="sb-cell">${icon("home", 26)}<label>Property type<select name="type"><option value="">Any type</option>${typeOptions(pr.type)}</select></label></div>
      <div class="sb-cell">${icon("coins", 26)}<label>Yearly budget<select name="max">${opts(BUDGETS, 0)}</select></label></div>
      <button class="btn primary">${icon("search", 22)} Search homes</button></form>
    <div class="hm-pop rise" style="--d:.35s"><span>Popular locations:</span>${[["lekki", "Lekki"], ["ajah", "Ajah"], ["yaba", "Yaba"], ["ikeja", "Ikeja"]].map(([v, l], i) => `<a class="chip-l" href="#/search?area=${v}">${i === 0 ? icon("pin", 16) : ""}${l}</a>`).join("")}</div>
    <div class="hm-sec rise" style="--d:.4s"><div><h2>Find your kind of home</h2><p>Explore rentals selected for your next move.</p></div><div class="hm-tabs" role="tablist">${TABS.map(([v, l], i) => `<button role="tab" class="${i ? "" : "on"}" data-t="${v}">${l}</button>`).join("")}</div><a class="link" href="#/search">View all homes ${icon("arrow", 18)}</a></div>
    <div class="cards" id="hmcards">${cardsFor("")}</div>
    <section class="hm-app hmd-app rise" style="--d:.55s"><div class="hmd-top"><div><div class="hmm-eye light">Get Faxton Rentals everywhere</div><h2>Start exploring on your device.</h2><p>Download the Faxton Rentals app or continue on web.</p>${dlNow}</div><img src="img/app-devices.webp" alt="Faxton Rentals on phone and laptop" loading="lazy"></div>
      <div class="hmd-os">${os("os-android.webp", "Android", "Get the app")}${os("os-apple.webp", "iOS", "Get the app")}${os("os-windows.webp", "Windows", "Use on desktop")}${macTile}${tuxTile}</div></section>
    <div class="hm-feats rise" style="--d:.5s"><div><span class="hm-fi">${icon("pin", 24)}</span><b>Find your neighbourhood</b><p>Discover great areas, with everything you need nearby.</p></div><div><span class="hm-fi">${icon("cal", 24)}</span><b>Book a viewing</b><p>Schedule and tour your shortlisted homes with ease.</p></div><div><span class="hm-fi">${icon("user", 24)}</span><b>Manage your rental</b><p>Keep track of your enquiries, viewings and tenancy all in one place.</p></div></div></div>`,
    mount(root) { bindCards(root, ctx); $$("[data-dlnow]", root).forEach((b) => (b.onclick = () => APPS.openDownloadModal())); $("#sb").onsubmit = (e) => { e.preventDefault(); const p = new URLSearchParams(); new FormData(e.target).forEach((v, k) => v && v !== "0" && p.set(k, v)); ctx.go("#/search?" + p); };
      const ms = $("#hmmS"); if (ms) ms.onsubmit = (e) => { e.preventDefault(); const t = ms.area.value.trim().toLowerCase(); ctx.go("#/search" + (t ? "?area=" + encodeURIComponent(t) : "")); };
      $$(".hm-tabs [data-t]", root).forEach((b) => (b.onclick = () => { $$(".hm-tabs [data-t]", root).forEach((x) => x.classList.toggle("on", x === b)); $("#hmcards").innerHTML = cardsFor(b.dataset.t); bindCards(root, ctx); })); } };
}

// ---------- search ----------
async function search(ctx) {
  const q = ctx.q, all = await st.getListings(), view = q.view === "grid" ? "grid" : "map";
  const area = q.area || "", max = +q.max || 0, beds = +q.beds || 0, type = q.type || "", sort = q.sort || "recommended";
  const am = (q.am || "").split(",").filter(Boolean), avail = q.avail !== "0";
  let list = all.filter((l) => (!area || (l.area + " " + l.city).toLowerCase().includes(area)) && (!max || l.price <= max) && l.beds >= beds && matchType(l, type) && (!avail || l.available !== false) && am.every((x) => l.amenities.includes(x)));
  if (sort === "low") list = [...list].sort((a, b) => a.price - b.price); if (sort === "high") list = [...list].sort((a, b) => b.price - a.price);
  const areaName = area ? AREAS.find((a) => a[0] === area)?.[1].replace(/, Lagos/, "") || "Lagos" : "Lagos";
  const chip = (k, label) => `<span class="chip static">${esc(label)}</span>`;
  const chips = [chip("area", area ? areaName : "Lagos"), avail && chip("avail", "Available now"), max && chip("max", BUDGETS.find((b) => b[0] === max)?.[1] || naira(max)), beds && chip("beds", beds + "+ beds"), type && chip("type", CATS.find((c) => c[0] === type)?.[1] || type), ...am.map((x) => chip("am:" + x, x))].filter(Boolean).join("");
  const AMEN = ["Parking", "Water supply", "Security", "Generator", "Balcony", "Garden", "Pool", "Gym", "Wi-Fi"];
  return { title: "Search", html: `<div class="wrap"><div class="page-head rise"><div><h1 style="font-size:clamp(1.9rem,3.4vw,2.9rem)">Homes for rent in ${esc(areaName === "Lagos" ? "Lagos" : areaName)}</h1><p>${list.length} home${list.length === 1 ? "" : "s"} match your search</p></div>
      <div class="seg" role="group" aria-label="View"><button data-view="map" class="${view === "map" ? "on" : ""}">${icon("map", 18)} Map</button><button data-view="grid" class="${view === "grid" ? "on" : ""}">${icon("grid", 18)} Grid</button></div></div>
    <form class="filters" id="ff"><label class="fsel">${icon("pin", 18)}<select name="area" aria-label="Location">${opts(AREAS, area)}</select></label>
      <label class="fsel">${icon("wallet", 18)}<select name="max" aria-label="Budget">${opts(BUDGETS, max)}</select></label>
      <label class="fsel">${icon("bed", 18)}<select name="beds" aria-label="Bedrooms">${opts([[0, "Bedrooms"], [1, "1+"], [2, "2+"], [3, "3+"], [4, "4+"], [5, "5+"]], beds)}</select></label>
      <label class="fsel">${icon("home", 18)}<select name="type" aria-label="Property type"><option value="">Property type</option>${typeOptions(type)}</select></label>
      <div class="fsel more" style="padding:0;position:relative"><button type="button" id="moreBtn" aria-haspopup="true" aria-expanded="false" style="display:flex;align-items:center;gap:8px;border:0;background:none;padding:12px;font-weight:500">${icon("sliders", 18)} More filters${am.length ? ` (${am.length})` : ""} ${icon("chev", 16)}</button>
        <div class="pop-menu" id="morePanel" hidden><b>Amenities</b>${AMEN.map((x) => `<label class="chk"><input type="checkbox" value="${esc(x)}" ${am.includes(x) ? "checked" : ""}> ${esc(x)}</label>`).join("")}<button type="button" class="btn primary sm" id="applyMore">Apply</button></div></div>
      <label class="fsel sort"><span class="muted">Sort by</span><select name="sort" aria-label="Sort">${opts([["recommended", "Recommended"], ["low", "Price: low to high"], ["high", "Price: high to low"]], sort)}</select></label></form>
    <div class="chips">${chips}</div>
    ${list.length ? `<div class="results ${view === "grid" ? "grid-only" : ""}"><div class="cards">${list.map((l, i) => card(l, ctx.S.saved, true, i)).join("")}</div>${view === "map" ? '<div id="map" role="region" aria-label="Map of results"></div>' : ""}</div>` : `<div class="empty"><h3>No homes match your search</h3><p>Try widening your filters.</p><p style="margin-top:14px"><a class="btn" href="#/search">Reset filters</a></p></div>`}</div>`,
    async mount(root) {
      bindCards(root, ctx);
      const nav = (patch) => { const p = new URLSearchParams(q); Object.entries(patch).forEach(([k, v]) => (v && v !== "0" ? p.set(k, v) : p.delete(k))); ctx.go("#/search?" + p); };
      $$("select", $("#ff")).forEach((s) => (s.onchange = () => nav({ [s.name]: s.value })));
      $$("[data-view]").forEach((b) => (b.onclick = () => nav({ view: b.dataset.view })));
      const mb = $("#moreBtn"), mp = $("#morePanel");
      mb.onclick = (e) => { e.stopPropagation(); mp.hidden = !mp.hidden; mb.setAttribute("aria-expanded", String(!mp.hidden)); };
      mp.onclick = (e) => e.stopPropagation(); document.addEventListener("click", () => { mp.hidden = true; }, { once: true });
      $("#applyMore").onclick = () => nav({ am: $$("input:checked", mp).map((i) => i.value).join(",") });
      if (view === "map" && list.length) try {
        await loadLeaflet(); if (!$("#map")) return; const map = L.map("map", { scrollWheelZoom: false }).setView([list[0].lat, list[0].lng], 12); ctrlZoom(map);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap contributors", maxZoom: 18 }).addTo(map);
        const pts = list.map((l) => { const m = L.marker([l.lat, l.lng], { icon: L.divIcon({ className: "", html: `<div class="pin"><b>${short(l.price)}</b><i></i></div>`, iconSize: [0, 0] }), title: l.title }).addTo(map); m.on("click", () => ctx.go("#/home/" + l.id)); return [l.lat, l.lng]; });
        if (pts.length > 1) map.fitBounds(pts, { padding: [40, 40] }); ctx.S.cleanups.push(() => map.remove());
      } catch { const m = $("#map"); if (m) m.innerHTML = '<div class="empty">Map unavailable right now.</div>'; }
    } };
}

// ---------- photo & video viewer ----------
const videoEmbed = (u) => {
  let m;
  if ((m = /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/))([\w-]{11})/.exec(u))) return { kind: "frame", src: `https://www.youtube-nocookie.com/embed/${m[1]}?rel=0`, thumb: `https://i.ytimg.com/vi/${m[1]}/hqdefault.jpg` };
  if ((m = /vimeo\.com\/(?:video\/)?(\d+)/.exec(u))) return { kind: "frame", src: `https://player.vimeo.com/video/${m[1]}` };
  return { kind: "file", src: u };
};
function openViewer(items, start = 0) {
  if (!items.length || document.querySelector(".vw-ov")) return;
  let i = start;
  const ov = document.createElement("div"); ov.className = "vw-ov"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true"); ov.setAttribute("aria-label", "Photos and videos");
  const stage = () => { const it = items[i];
    return it.type === "video" ? (it.kind === "frame" ? `<iframe src="${esc(it.src)}" title="Video tour" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>` : `<video src="${esc(it.src)}" controls playsinline preload="metadata" autoplay></video>`) : `<img src="${esc(it.src)}" alt="">`; };
  const paint = () => {
    $(".vw-stage", ov).innerHTML = stage();
    $(".vw-count", ov).textContent = `${i + 1} / ${items.length}`;
    $$(".vw-th", ov).forEach((b, k) => b.classList.toggle("on", k === i));
    $(".vw-th.on", ov)?.scrollIntoView?.({ block: "nearest", inline: "center" });
  };
  ov.innerHTML = `<button type="button" class="vw-x" aria-label="Close">${icon("x", 22)}</button><button type="button" class="vw-nav vw-prev" aria-label="Previous">${icon("left", 24)}</button><div class="vw-stage"></div><button type="button" class="vw-nav vw-next" aria-label="Next"><span style="display:grid;transform:rotate(180deg)">${icon("left", 24)}</span></button>
    <div class="vw-bar"><span class="vw-count"></span><div class="vw-strip">${items.map((it, k) => `<button type="button" class="vw-th" data-k="${k}" aria-label="${it.type === "video" ? "Video" : "Photo"} ${k + 1}">${it.type === "video" ? `<span class="vw-play">${icon("video", 18)}</span>` : `<img src="${esc(it.src)}" alt="" loading="lazy">`}</button>`).join("")}</div></div>`;
  document.body.append(ov); document.documentElement.classList.add("dlx-lock");
  const shut = () => { document.removeEventListener("keydown", key); document.documentElement.classList.remove("dlx-lock"); ov.remove(); };
  const go = (d) => { i = (i + d + items.length) % items.length; paint(); };
  const key = (e) => { if (e.key === "Escape") shut(); else if (e.key === "ArrowLeft") go(-1); else if (e.key === "ArrowRight") go(1); };
  document.addEventListener("keydown", key);
  $(".vw-x", ov).onclick = shut; $(".vw-prev", ov).onclick = () => go(-1); $(".vw-next", ov).onclick = () => go(1);
  ov.addEventListener("click", (e) => { if (e.target === ov || e.target.classList.contains("vw-stage")) shut(); });
  $$(".vw-th", ov).forEach((b) => (b.onclick = () => { i = +b.dataset.k; paint(); }));
  let x0 = null; ov.addEventListener("touchstart", (e) => (x0 = e.touches[0].clientX), { passive: true }); ov.addEventListener("touchend", (e) => { if (x0 !== null && Math.abs(e.changedTouches[0].clientX - x0) > 50) go(e.changedTouches[0].clientX < x0 ? 1 : -1); x0 = null; }, { passive: true });
  paint(); $(".vw-x", ov).focus();
}

// ---------- detail ----------
async function detail(ctx, id) {
  const l = await st.getListing(id);
  if (!l) return { title: "Not found", html: `<div class="empty"><h2>This home isn’t available</h2><p><a class="link" href="#/search">Browse homes</a></p></div>` };
  const total = l.price + l.service + l.deposit, on = ctx.S.saved.has(l.id), A = { Parking: "car", "Water supply": "drop", Security: "shield", Balcony: "building" };
  const im = l.images, vids = (l.videos || []).map((u) => ({ type: "video", ...videoEmbed(u) })), media = [...im.map((src) => ({ type: "img", src })), ...vids];
  const gal = im.length > 1 ? `<div class="gallery"><div><img src="${esc(im[0])}" alt="${esc(l.title)}"></div><div><img src="${esc(im[1])}" alt=""></div><div>${im[2] ? `<img src="${esc(im[2])}" alt="">` : ""}<button class="show-all" id="all">${icon("img", 18)} Show all photos</button></div></div>` : `<div class="gallery one"><div><img src="${esc(im[0])}" alt="${esc(l.title)}"></div></div>`;
  const all = (await st.getListings().catch(() => [])).filter((x) => x.id !== l.id && x.city === l.city), cat = catOf(l);
  const similar = [...all.filter((x) => catOf(x) === cat), ...all.filter((x) => catOf(x) !== cat)].slice(0, 6);
  const hasPin = l.lat != null && l.lng != null && l.hasPin !== false, lid = "FR-" + String([...l.id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 9000, 7) + 1000);
  const parking = l.parking != null && l.parking !== "" ? `${l.parking} space${+l.parking === 1 ? "" : "s"}` : l.amenities.includes("Parking") ? "Available" : "None listed";
  const info = [["home", "Property type", catName(l)], ["area", "Size", l.sqm ? `${l.sqm} m²` : "Not listed"], ["cal", "Year built", l.yearBuilt || "Not listed"], ["car", "Parking", parking], ["building", "Furnishing", l.furnished || "Not listed"], ["list", "Listing ID", lid]];
  const PLANS = [["Yearly", 1], ["Every 6 months", 2], ["Quarterly", 4], ["Monthly", 12]];
  const desc = String(l.desc || "").split(/\n+/).filter(Boolean);
  const simCard = (x) => `<article class="sim" data-open="${esc(x.id)}" tabindex="0" aria-label="${esc(x.title)}"><div class="sim-img"><img src="${esc(x.thumb || x.images[0])}" alt="${esc(x.title)}" loading="lazy"><span class="sim-tag ${x.available === false ? "off" : ""}">${x.available === false ? "Rented" : "For rent"}</span><span class="sim-ph">${icon("camera", 14)} ${x.images.length}</span><button class="heart ${ctx.S.saved.has(x.id) ? "on" : ""}" data-fav="${esc(x.id)}" aria-label="Save ${esc(x.title)}" aria-pressed="${ctx.S.saved.has(x.id)}">${icon("heart", 20)}</button></div>
    <div class="sim-b"><b class="sim-p">${naira(x.price)}<small> / year</small></b><h3>${esc(x.title)}</h3><p class="loc">${icon("pin", 15)} ${esc(x.area)}${x.area.includes(",") ? "" : ", " + esc(x.city)}</p><div class="sim-f"><span>${icon("bed", 17)}${x.beds || "Studio"}</span><span>${icon("bath", 17)}${x.baths}</span>${x.parking ? `<span>${icon("car", 17)}${x.parking}</span>` : ""}${x.sqm ? `<span>${icon("area", 17)}${x.sqm} m²</span>` : ""}</div></div></article>`;
  return { title: l.title, html: `<div class="wrap pdp"><nav class="crumbs" aria-label="Breadcrumb"><a href="#/">Home</a><span>/</span><a href="#/search">Rent</a><span>/</span><b>${esc(l.area.split(",")[0])}</b></nav>
    <div class="d-head"><div><h1>${esc(l.title)}</h1><div class="loc dt-loc"><span>${icon("pin", 20)}</span>${esc(l.area)}${l.area.includes(",") ? "" : ", " + esc(l.city)}</div></div>
      <div class="dt-acts"><button class="btn" id="save">${icon("heart", 18)} <span>${on ? "Saved" : "Save"}</span></button><button class="btn" id="share">${icon("share", 18)} Share</button></div></div>
    ${gal}${vids.length ? `<div class="vid-row"><button type="button" class="vid-btn" data-vid="${im.length}"><span class="vid-ic">${icon("video", 20)}</span><span><b>Watch ${vids.length > 1 ? vids.length + " videos" : "the video tour"}</b><small>${im.length} photo${im.length === 1 ? "" : "s"} · ${vids.length} video${vids.length === 1 ? "" : "s"}</small></span></button></div>` : ""}
    <div class="detail"><div class="dt-main">
      <div class="facts-row"><div class="fact">${icon("bed", 22)}${l.beds === 0 ? "Studio" : l.beds + " bedroom" + (l.beds > 1 ? "s" : "")}</div><div class="fact">${icon("bath", 22)}${l.baths} bathroom${l.baths > 1 ? "s" : ""}</div>${l.sqm ? `<div class="fact">${icon("area", 22)}${l.sqm} m²</div>` : ""}<div class="fact">${icon("car", 22)}${parking}</div></div>
      <div class="dt-tabs" role="tablist">${[["overview", "Overview"], ["features", "Features"], ["location", "Location"], ["plan", "Floor plan"]].map(([k, t], i) => `<button type="button" role="tab" class="${i ? "" : "on"}" data-pane="${k}">${t}</button>`).join("")}</div>
      <section class="dt-pane" id="p-overview">${(desc.length ? desc : ["The agent hasn’t added a description yet."]).map((x) => `<p class="dt-desc">${esc(x)}</p>`).join("")}<p class="dt-desc">Listed by ${esc(l.agent.name)}. Rent is paid per year. Documents are available for inspection after your viewing.</p>
        <div class="dt-info">${info.map(([ic, k, v]) => `<div><span>${icon(ic, 18)} ${k}</span><b>${esc(v)}</b></div>`).join("")}</div>
        <div class="dt-pay"><h2>Payment estimate</h2><div class="dt-pay-in"><div><h4>Payment plan</h4><div class="dt-plans" role="radiogroup" aria-label="Payment plan">${PLANS.map(([t, n], i) => `<button type="button" role="radio" aria-checked="${i === 0}" class="${i === 0 ? "on" : ""}" data-n="${n}">${t}</button>`).join("")}</div><p class="muted">Estimate only. Your agent confirms the final plan.</p></div>
          <div class="dt-est"><span>Est. payment each time</span><b id="estP">${naira(l.price)}</b><small id="estN">Paid once a year</small><hr><div class="dt-rows"><div><span>Service charge</span><b>${naira(l.service)}</b></div><div><span>Refundable deposit</span><b>${naira(l.deposit)}</b></div><div><span>Move-in total</span><b id="estT">${naira(total)}</b></div></div></div></div></div></section>
      <section class="dt-pane" id="p-features" hidden><div class="amen dt-amen">${l.amenities.length ? l.amenities.map((a) => `<span>${icon(A[a] || "check", 22)}${esc(a)}</span>`).join("") : `<p class="muted">No features have been listed yet.</p>`}</div></section>
      <section class="dt-pane" id="p-location" hidden><p class="muted" style="margin:0 0 10px">${icon("pin", 16)} ${esc(l.area)}${l.area.includes(",") ? "" : ", " + esc(l.city)}</p>${hasPin ? `<div id="dmap" class="dmap"></div>` : `<p class="muted">The exact location hasn’t been shared yet. Message the agent to ask.</p>`}</section>
      <section class="dt-pane" id="p-plan" hidden>${l.floorPlan ? `<img class="dt-fp" src="${esc(l.floorPlan)}" alt="Floor plan of ${esc(l.title)}">` : `<p class="muted">No floor plan has been added for this home yet.</p>`}</section>
    </div>
    <aside class="side-card"><div class="big-price">${naira(l.price)} <small>/ year</small></div><p class="muted">Annual payment</p>
      <div class="rows"><div><span>Rent</span><span>${naira(l.price)}</span></div><div><span>Service charge</span><span>${naira(l.service)}</span></div><div><span>Refundable deposit</span><span>${naira(l.deposit)}</span></div><div class="total"><span>Move-in total</span><span>${naira(total)}</span></div></div>
      <button class="btn primary block" id="apply" style="padding:15px">Apply to rent ${icon("arrow", 20)}</button><button class="btn block" id="view" style="padding:15px">${icon("cal", 20)} Book a viewing</button>
      <p class="muted" style="font-size:.9rem;display:flex;gap:8px">${icon("info", 18)}<span>Review the <a class="link" href="#/search" style="text-decoration:underline">terms</a> before making a payment.</span></p>
      <div class="agent"><img class="avatar" src="${esc(l.agent.avatar)}" alt=""><div><a href="#/agent/${esc(l.agent.id)}" style="color:var(--head);font-size:1.1rem;font-weight:700">${esc(l.agent.name)}</a><p class="muted" style="margin-bottom:10px">Listing agent</p><button class="btn sm" id="msg">${icon("msg", 18)} Message agent</button></div></div></aside></div>
    ${similar.length ? `<section class="dt-sim"><h2><i></i>Similar homes</h2><p class="muted">More like this in ${esc(l.city)}</p><div class="sim-grid">${similar.map(simCard).join("")}</div></section>` : ""}</div>`,
    mount(root) {
      const authed = (fn) => () => (ctx.S.user ? fn() : (toast("Please sign in first."), ctx.go("#/login?next=" + encodeURIComponent("/home/" + l.id))));
      bindCards(root, ctx);
      $("#save").onclick = async () => { const n = !ctx.S.saved.has(l.id); await ctx.setSaved(l.id, n); $("#save span").textContent = n ? "Saved" : "Save"; };
      $("#share").onclick = async () => { const url = location.href; try { navigator.share ? await navigator.share({ title: l.title, url }) : (await navigator.clipboard.writeText(url), toast("Link copied.")); } catch {} };
      const allB = $("#all"); if (allB) allB.onclick = () => openViewer(media, 0);
      $$(".gallery img").forEach((g, k) => { g.style.cursor = "zoom-in"; g.onclick = () => openViewer(media, k); });
      $$("[data-vid]").forEach((b) => (b.onclick = () => openViewer(media, +b.dataset.vid)));
      let mapDone = false;
      $$(".dt-tabs [data-pane]").forEach((b) => (b.onclick = () => {
        $$(".dt-tabs [data-pane]").forEach((x) => x.classList.toggle("on", x === b)); $$(".dt-pane").forEach((p) => (p.hidden = p.id !== "p-" + b.dataset.pane));
        if (b.dataset.pane === "location" && hasPin && !mapDone) { mapDone = true; loadLeaflet().then(() => { const el = $("#dmap"); if (!el) return; const map = L.map(el, { scrollWheelZoom: false }).setView([l.lat, l.lng], 15); tiles().addTo(map); L.marker([l.lat, l.lng]).addTo(map); ctrlZoom(map); setTimeout(() => map.invalidateSize(), 100); ctx.S.cleanups.push(() => map.remove()); }).catch(() => { mapDone = false; }); }
      }));
      $$(".dt-plans [data-n]").forEach((b) => (b.onclick = () => { const n = +b.dataset.n; $$(".dt-plans button").forEach((x) => { x.classList.toggle("on", x === b); x.setAttribute("aria-checked", x === b); }); $("#estP").textContent = naira(Math.round(l.price / n)); $("#estN").textContent = n === 1 ? "Paid once a year" : `Paid ${n} times a year`; $("#estT").textContent = naira(Math.round(l.price / n) + l.service + l.deposit); }));
      $("#msg").onclick = authed(async () => { try { const cid = await st.ensureConversation(ctx.S.user, l); ctx.go("#/messages/" + cid); } catch (e) { toast(friendlyErr(e)); } });
      $("#view").onclick = authed(() => ctx.go("#/book/" + l.id));
      $("#apply").onclick = authed(() => ctx.go("#/apply/" + l.id));
    } };
}

// ---------- saved / bookings / payments ----------
async function saved(ctx) {
  const list = (await st.getListings()).filter((l) => ctx.S.saved.has(l.id));
  return { title: "Saved homes", html: `<div class="page-head"><div><h1>Saved homes</h1><p>${list.length} home${list.length === 1 ? "" : "s"} you love</p></div></div>${list.length ? `<div class="cards">${list.map((l) => card(l, ctx.S.saved)).join("")}</div>` : `<div class="empty"><h3>Nothing saved yet</h3><p>Tap the heart on any home to keep it here.</p><p style="margin-top:14px"><a class="btn primary" href="#/search">Browse homes</a></p></div>`}`, mount: (r) => bindCards(r, ctx) };
}
async function bookings(ctx) {
  const v = await st.myViewings(ctx.S.user);
  return { title: "Viewings", html: `${PG.rentalsNav("/bookings")}<div class="page-head"><div><h1>Viewings</h1><p>Your scheduled and past viewings</p></div><a class="btn primary" href="#/search">Find a home</a></div><div class="panel">${v.length ? v.map((x) => `<div class="list-row"><img src="${esc(x.image)}" alt=""><div class="grow"><h3>${esc(x.title)}</h3><div class="loc">${icon("pin", 16)}${esc(x.area)}</div><p style="margin-top:6px;color:var(--head);font-weight:600">${icon("cal", 16)} ${esc(fmtDate(x.when))}, ${esc(x.slot)}</p></div>${statusPill(x.status)}</div>`).join("") : `<div class="empty">No viewings yet. Open a home and choose “Book a viewing”.</div>`}</div>` };
}
async function payments(ctx) {
  const a = await st.myApplications(ctx.S.user);
  return { title: "Payments", html: `<div class="page-head"><div><h1>Payments</h1><p>Rental applications and amounts due on move-in</p></div></div><div class="panel">${a.length ? a.map((x) => `<div class="list-row"><img src="${esc(x.image)}" alt=""><div class="grow"><h3>${esc(x.title)}</h3><div class="loc">${icon("pin", 16)}${esc(x.area)}</div><p class="muted" style="margin-top:6px">Move-in ${esc(fmtDate(x.moveIn))}</p></div><div style="text-align:right"><div class="price">${naira(x.amount)}</div>${statusPill(x.status)}</div></div>`).join("") : `<div class="empty">No applications yet.</div>`}</div><p class="muted">Online payments will be available once your application is approved.</p>` };
}

// ---------- messages ----------
const EMOJI = ["😀", "😊", "😍", "👍", "🙏", "🎉", "🏠", "🔑", "📅", "📍", "💬", "✅", "❤️", "😅", "🤝", "👋"];
async function messages(ctx, cid) {
  const html = `<div class="msg-shell ${cid ? "has-chat" : ""}"><section class="msg-list"><div class="msg-list-head"><h1>Messages</h1><a class="btn primary" href="#/search" aria-label="New conversation" style="width:48px;height:48px;padding:0">${icon("edit", 22)}</a></div>
    <label class="input msg-search">${icon("search", 20)}<input id="cs" type="search" placeholder="Search conversations…" aria-label="Search conversations"></label>
    <div class="tabs" role="tablist"><button class="on" data-tab="all" role="tab">All (<span id="cnt">0</span>)</button><button data-tab="unread" role="tab">Unread (<span id="ucnt">0</span>)</button><button data-tab="calls" role="tab">${icon("phone", 15)} Calls (<span id="ccnt">0</span>)</button></div><div id="convs"></div></section><section class="chat" id="chat"></section></div>`;
  return { title: "Messages", bare: true, html,
    mount() {
      let convs = [], calls = [], unsubM = null, tab = "all", term = "";
      const me = ctx.S.user.uid;
      const beginCall = async (c, kind) => { const l = await st.getListing(c.listingId).catch(() => null); const to = l?.ownerUid && l.ownerUid !== me ? l.ownerUid : "staff"; CALLS.startCall(ctx, { convId: c.id, to, toName: to === "staff" ? "Faxton team" : c.agent.name, kind, title: c.listingTitle, image: c.image, area: c.area }); };
      const vis = () => convs.filter((c) => (tab === "all" || c.unread) && (!term || (c.agent.name + " " + c.listingTitle + " " + c.last).toLowerCase().includes(term)));
      const drawList = () => {
        $("#cnt").textContent = convs.length; $("#ucnt").textContent = convs.filter((c) => c.unread).length; $("#ccnt").textContent = calls.length;
        if (tab === "calls") {
          $("#convs").innerHTML = calls.length ? calls.filter((c) => !term || ((c.callerName || "") + (c.calleeName || "") + (c.title || "")).toLowerCase().includes(term)).map((c) => CALLS.logRow(c, me)).join("") : `<p class="muted" style="padding:14px">No calls yet. Open a conversation and tap the phone or video button to call.</p>`;
          $$("[data-cb]", $("#convs")).forEach((b) => (b.onclick = () => { const c = calls.find((x) => x.id === b.dataset.cb); if (!c) return; const out = c.callerUid === me; CALLS.startCall(ctx, { convId: c.convId, to: out ? c.calleeUid : c.callerUid, toName: out ? c.calleeName : c.callerName, kind: b.dataset.k, title: c.title }); }));
          return;
        }
        const list = vis();
        $("#convs").innerHTML = list.length ? list.map((c) => `<a class="conv ${c.id === cid ? "on" : ""}" href="#/messages/${esc(c.id)}" style="--i:${0}"><img class="avatar" src="${esc(c.agent.avatar)}" alt=""><div class="conv-main"><div class="conv-top"><b>${esc(c.agent.name)}</b><span>${c.lastAt ? fmtTime(c.lastAt) : ""}</span></div><p>${esc(c.last || c.listingTitle)}</p></div>${c.unread ? '<i class="udot" aria-label="Unread"></i>' : ""}</a>`).join("")
          : `<p class="muted" style="padding:14px">${convs.length ? "No conversations match." : "No conversations yet. Open a home and tap “Message agent”."}</p>`;
      };
      const AV = () => convs.find((x) => x.id === cid)?.agent.avatar || "";
      const bubble = (m, me) => m.type === "booking"
        ? `<div class="bubble card-b"><img src="${esc(m.image || "")}" alt=""><div><b class="bk-when">${icon("cal", 20)} ${esc(fmtDate(m.when))}, ${esc(m.slot)}</b><b>${esc(m.title)}</b><span class="muted">${esc(m.area)}</span><a class="btn sm block" href="#/bookings">View booking ${icon("chev", 14)}</a></div><time>${m.at ? fmtTime(m.at) : ""}</time></div>`
        : `<div class="brow ${me ? "me" : ""}">${me ? "" : `<img class="b-av" src="${esc(AV())}" alt="">`}<div class="bubble ${me ? "me" : ""}">${esc(m.text)}<time>${m.at ? fmtTime(m.at) : ""}${me ? `<span class="ticks">${icon("check", 14, 2.4)}${icon("check", 14, 2.4)}</span>` : ""}</time></div></div>`;
      const drawChat = () => {
        const c = convs.find((x) => x.id === cid); const chat = $("#chat");
        if (!c) { unsubM?.(); chat.innerHTML = `<div class="chat-empty"><h2>${convs.length ? "Select a conversation" : "No messages yet"}</h2><p style="margin-top:8px">Message a listing agent to start chatting.</p></div>`; return; }
        if (chat.dataset.cid === cid) return; chat.dataset.cid = cid;
        if (c.unread && c.uid === ctx.S.user.uid) st.markRead(cid).catch(() => {});
        chat.innerHTML = `<div class="chat-head"><a class="icon-btn back" href="#/messages" aria-label="Back" style="display:none">${icon("left", 20)}</a><a href="#/agent/${esc(c.agent.id)}" class="ch-av"><img class="avatar" src="${esc(c.agent.avatar)}" alt=""></a><div class="grow"><a href="#/agent/${esc(c.agent.id)}" class="ch-name">${esc(c.agent.name)}</a><span>Property Agent</span></div><div class="acts"><button type="button" class="icon-btn" data-call="video" aria-label="Video call" title="Video call">${icon("video", 22)}</button><button type="button" class="icon-btn" data-call="voice" aria-label="Voice call" title="Voice call">${icon("phone", 22)}</button><a class="icon-btn" href="#/home/${esc(c.listingId)}" aria-label="View home">${icon("home", 22)}</a></div></div>
          ${c.listingId === "direct" ? "" : `<a class="listing-strip" href="#/home/${esc(c.listingId)}"><img src="${esc(c.image)}" alt=""><div><b>${esc(c.listingTitle)}</b><span class="muted">${icon("bed", 16)} ${c.beds === 0 ? "Studio" : c.beds + " bedrooms"} <i>•</i> ${icon("bath", 16)} ${c.baths} bathrooms</span><span class="muted">${icon("pin", 16)} ${esc(c.area)}, Lagos</span></div><b class="ls-price">${naira(c.price)} / year</b>${icon("chev", 22).replace("<svg", '<svg style="transform:rotate(-90deg)"')}</a>`}
          <div class="thread" id="thread"></div><div class="emoji" id="emoji" hidden>${EMOJI.map((e) => `<button type="button">${e}</button>`).join("")}</div>
          <form class="composer" id="cf"><button type="button" class="icon-btn flat" data-soon aria-label="Attach">${icon("clip", 22)}</button><button type="button" class="icon-btn flat" id="emojiBtn" aria-label="Emoji">${icon("smile", 22)}</button><input id="ci" placeholder="Type a message…" autocomplete="off" maxlength="2000" aria-label="Message"><button type="button" class="icon-btn flat" data-soon aria-label="Voice message">${icon("mic", 22)}</button><button class="send" aria-label="Send">${icon("send", 22)}</button></form>`;
        $$("[data-soon]", chat).forEach((b) => (b.onclick = () => toast("Coming soon.")));
        $$("[data-call]", chat).forEach((b) => (b.onclick = () => beginCall(c, b.dataset.call)));
        const em = $("#emoji"); $("#emojiBtn").onclick = () => (em.hidden = !em.hidden); em.onclick = (e) => { const b = e.target.closest("button"); if (b) { $("#ci").value += b.textContent; $("#ci").focus(); } };
        $("#cf").onsubmit = async (e) => { e.preventDefault(); const i = $("#ci"), t = i.value.trim(); if (!t) return; i.value = ""; em.hidden = true; try { await st.sendMessage(ctx.S.user, cid, t, {}, c.uid !== ctx.S.user.uid); } catch (x) { toast(friendlyErr(x)); i.value = t; } };
        unsubM?.(); unsubM = st.watchMessages(cid, (ms) => {
          const th = $("#thread"); if (!th) return; const near = th.scrollHeight - th.scrollTop - th.clientHeight < 80;
          th.innerHTML = ms.length ? `<span class="day">Today</span>` + ms.map((m) => bubble(m, m.from === ctx.S.user.uid)).join("") : `<div class="chat-empty">Say hello to ${esc(c.agent.name.split(" ")[0])} 👋</div>`;
          if (near || ms.length < 2) th.scrollTop = th.scrollHeight;
        });
      };
      $$("[data-tab]").forEach((b) => (b.onclick = () => { tab = b.dataset.tab; $$("[data-tab]").forEach((x) => x.classList.toggle("on", x === b)); drawList(); }));
      $("#cs").oninput = (e) => { term = e.target.value.trim().toLowerCase(); drawList(); };
      const unsubC = st.watchConversations(ctx.S.user, (c) => { convs = c; drawList(); drawChat(); });
      const unsubL = CALLS.watchLogs(me, (l) => { calls = l; drawList(); });
      ctx.S.cleanups.push(() => { unsubC(); unsubL(); unsubM?.(); });
      if (matchMedia("(max-width:860px)").matches) setTimeout(() => { const b = $(".back"); if (b) b.style.display = "grid"; });
    } };
}

// ---------- settings ----------
const SET_NAV = [["profile", "user", "Profile"], ["account", "shield", "Account & security"], ["notifications", "bell", "Notifications"], ["appearance", "monitor", "Appearance"], ["privacy", "lock", "Privacy"], ["help", "help", "Help & support"]];
const SET_TITLE = { profile: ["Profile settings", "Manage your personal details and preferences."], account: ["Account & security", "Your sign-in details and account access."], notifications: ["Notifications", "Control the notifications you receive."], appearance: ["Appearance", "Choose how Faxton Rentals looks on your device."], privacy: ["Privacy", "Decide what agents can see about you."], help: ["Help & support", "Answers, the product tour and app details."] };
const LOCS = ["Lagos, Nigeria", "Abuja, Nigeria", "Port Harcourt, Nigeria", "Ibadan, Nigeria", "Other"];
const BUD = [["", "No preference"], ["0-2000000", "Up to ₦2,000,000"], ["2000000-4000000", "₦2,000,000 – ₦4,000,000"], ["4000000-6000000", "₦4,000,000 – ₦6,000,000"], ["6000000-0", "₦6,000,000+"]];
const NOTIFY = [["messages", "mail", "Message notifications", "Get notified when you receive new messages from landlords."], ["viewings", "cal", "Viewing reminders", "Get reminders about your scheduled property viewings."], ["applications", "doc", "Application updates", "Know when the status of a rental application changes."]];
const PRIVACY = [["sharePhone", "phone", "Share my phone number", "Let agents I message see my phone number."], ["sharePrefs", "sliders3", "Share my rental preferences", "Help agents suggest homes that suit you."]];
const sw = (g, k, on) => `<button type="button" class="switch ${on ? "on" : ""}" role="switch" aria-checked="${!!on}" data-sw="${g}.${k}" aria-label="${k}"><i></i></button>`;
const swRow = (g, k, ic, t, d, on) => `<div class="sw-row"><span class="sw-ic">${icon(ic, 26, 1.7)}</span><div><b>${t}</b><p>${d}</p></div>${sw(g, k, on)}</div>`;
const themeCards = (pref) => `<div class="theme-cards" role="radiogroup" aria-label="Theme">${[["light", "sun", "Light"], ["dark", "moon", "Dark"], ["system", "monitor", "System"]].map(([k, i, l]) => `<button type="button" class="theme-card ${pref === k ? "on" : ""}" role="radio" aria-checked="${pref === k}" data-theme-pref="${k}">${icon(i, 30, 1.6)}<span>${l}</span><i class="radio"></i></button>`).join("")}</div>`;

function settings(ctx, section) {
  const u = ctx.S.user, p = ctx.S.profile || {}, role = ctx.S.isOwner ? "owner" : ctx.S.role;
  if (!SET_TITLE[section]) section = "profile";
  const notify = { messages: true, viewings: true, applications: true, ...(p.notify || {}) }, privacy = { sharePhone: false, sharePrefs: true, ...(p.privacy || {}) };
  const pr = p.prefs || {}, name = u.displayName || p.name || "", pwd = u.providerData.some((x) => x.providerId === "password");
  const nav = `<aside class="set-nav" aria-label="Settings sections"><h2>Settings</h2>${SET_NAV.map(([k, ic, l]) => `<a class="${k === section ? "on" : ""}" href="#/settings/${k}" ${k === section ? 'aria-current="page"' : ""}>${icon(ic, 22)}<span>${l}</span></a>`).join("")}<hr><button type="button" id="out" class="set-out">${icon("logout", 22)}<span>Sign out</span></button></aside>`;
  const card = (t, sub, inner, cls = "") => `<section class="set-card ${cls}"><h3>${t}</h3>${sub ? `<p class="sub">${sub}</p>` : ""}${inner}</section>`;
  const shell = APPS.shellInfo(), autoUpd = !!pr.autoUpdate;
  const updCard = card("App updates", shell ? `You’re using the ${shell.platform.startsWith("mac") ? "Mac" : shell.platform === "windows" ? "Windows" : shell.platform === "android" ? "Android" : "iPhone"} app, version ${esc(shell.version)}.` : "On the web you always get the newest version automatically. Installed apps (Android, iPhone, Windows, Mac) can update themselves too.",
    `<div class="sw-row"><span class="sw-ic">${icon("download", 26, 1.7)}</span><div><b>Automatic updates</b><p>Download new versions as soon as they’re available.</p></div><button type="button" class="switch ${autoUpd ? "on" : ""}" role="switch" aria-checked="${autoUpd}" id="autoUpd" aria-label="Automatic updates"><i></i></button></div>${shell ? `<div class="set-actions"><button class="btn" id="chkUpd">Check for updates</button></div>` : ""}`);
  const apCard = card("Appearance", "Choose how Faxton Rentals looks on your device.", themeCards(ctx.themePref()));
  const ntCard = (all) => card("Notifications", "Control the notifications you receive.", NOTIFY.slice(0, all ? 3 : 2).map(([k, ic, t, d]) => swRow("notify", k, ic, t, d, notify[k])).join("") + (all ? "" : `<a class="link manage" href="#/settings/notifications">Manage notifications ${icon("arrow", 18)}</a>`));
  const initialsHtml = p.photo ? `<img class="big-av" src="${esc(p.photo)}" alt="">` : `<span class="big-av">${esc(initials(name || u.email))}</span>`;
  let body;
  if (section === "profile") body = `<div class="set-cols"><form id="pf" class="set-left" novalidate>
      ${card("Personal details", "", `<div class="pd-top">${initialsHtml}<div><b class="pd-name">${esc(name || "Your name")}</b><br><button type="button" class="btn sm" id="photoBtn">${icon("camera", 18)} Change photo</button><input type="file" id="photo" accept="image/*" hidden></div></div>
        <div class="f2"><label class="fl">Full name<input id="nm" value="${esc(name)}" autocomplete="name" maxlength="120"></label>
          <label class="fl">Email address<span class="in-wrap"><input value="${esc(u.email)}" disabled><span class="vbadge ${u.emailVerified ? "" : "no"}">${u.emailVerified ? `${icon("check", 14, 2.4)} Verified` : "Not verified"}</span></span></label>
          <label class="fl">Phone number<input id="ph" type="tel" placeholder="Add phone number" value="${esc(p.phone || "")}" autocomplete="tel" maxlength="30"></label>
          <label class="fl">Country<select id="lcc">${countryOptions(p.country || "Nigeria")}</select></label><label class="fl">City<input id="lct" maxlength="60" value="${esc(p.city || "")}" placeholder="e.g. Lagos"></label></div>
        <p class="note">Your contact details are only shared when you choose.</p>`)}
      ${card("Rental preferences", "Help us show you more relevant homes.", `<div class="f3"><label class="fl">Preferred location<select id="pl">${AREAS.filter((a) => a[0]).map(([c, l]) => `<option value="${c}" ${c === (pr.area || "lekki") ? "selected" : ""}>${l.replace(", Lagos", ", Lagos")}</option>`).join("")}</select></label>
        <label class="fl">Property type<select id="pt"><option value="">Any type</option>${typeOptions(pr.type)}</select></label>
        <label class="fl">Yearly budget<select id="pb">${BUD.map(([v, l]) => `<option value="${v}" ${v === (pr.budget || "") ? "selected" : ""}>${l}</option>`).join("")}</select></label></div>`)}
      <div class="err" id="perr" role="alert"></div>
      <div class="set-actions"><button class="btn primary" type="submit">Save changes</button><button class="btn plain" type="button" id="cancel">Cancel</button></div></form>
      <div class="set-right">${apCard}${ntCard(false)}</div></div>`;
  else if (section === "account") body = `<div class="set-one">${card("Sign-in", "", `<div class="kv"><span>Email</span><b>${esc(u.email)} <span class="vbadge ${u.emailVerified ? "" : "no"}">${u.emailVerified ? `${icon("check", 14, 2.4)} Verified` : "Not verified"}</span></b></div>
      <div class="kv"><span>Account type</span><b style="text-transform:capitalize">${esc(role)}</b></div><div class="kv"><span>Sign-in method</span><b>${u.providerData.map((x) => (x.providerId === "google.com" ? "Google" : "Email & password")).join(", ")}</b></div>
      ${!u.emailVerified && pwd ? `<div class="set-actions"><button class="btn" id="resendV">Resend verification email</button></div>` : ""}`)}
      ${pwd ? card("Password", "We'll email you a secure link to choose a new password.", `<div class="set-actions"><button class="btn" id="resetPw">Send password reset email</button></div>`) : ""}
      ${(() => { const d = ctx.S.profile?.deletion; return d?.status === "pending" ? card("Account deletion requested", "", `<p class="note" style="margin:0 0 10px">You asked to delete your account on ${new Date(d.requestedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}. Our team reviews every request, which takes about a day. Nothing is deleted until then, and you can cancel now.</p><div class="set-actions"><button class="btn" id="cancelDel">Cancel deletion</button></div>`) : d?.status === "approved" ? card("Account scheduled for deletion", "", `<p class="note" style="margin:0">Your request was approved. Your account will be removed the next time it’s opened after the one-day review period ends.</p>`) : card("Delete account", "Permanently remove your account and its data.", `<p class="note" style="margin:0 0 10px">Deletion is reviewed by our team first and takes about a day. You can cancel any time before it’s approved.</p><div class="set-actions"><button class="btn red-o" id="delAcct">${icon("trash", 18)} Delete my account</button></div>`); })()}
      ${ctx.S.isAdmin ? card("Admin console", "Manage listings, users, applications and viewings.", `<div class="set-actions"><a class="btn" href="#/admin">Open admin console</a></div>`) : ""}</div>`;
  else if (section === "notifications") body = `<div class="set-one">${ntCard(true)}<p class="note">These are your preferences. They are saved to your account and used as notifications roll out.</p></div>`;
  else if (section === "appearance") body = `<div class="set-one">${apCard}</div>`;
  else if (section === "privacy") body = `<div class="set-one">${card("Privacy", "Your contact details are only shared when you choose.", PRIVACY.map(([k, ic, t, d]) => swRow("privacy", k, ic, t, d, privacy[k])).join(""))}</div>`;
  else body = `<div class="set-one">${card("Frequently asked", "", `<details><summary>How do I book a viewing?</summary><p>Open any home and choose <b>Book a viewing</b>. Pick a date and time, and the agent will confirm it in Messages.</p></details>
      <details><summary>How do I apply to rent?</summary><p>On a home page choose <b>Apply to rent</b> and pick your move-in date. Track the status in <b>Payments</b>.</p></details>
      <details><summary>Where do I message an agent?</summary><p>Tap <b>Message agent</b> on a home, or open <b>Messages</b> in the side menu.</p></details>`)}
      ${card("Product tour", "Replay the quick tour of Faxton Rentals.", `<div class="set-actions"><button class="btn" id="tour">Replay tour</button></div>`)}
      ${updCard}${card("Install the app", "Add Faxton Rentals to your home screen or desktop.", `<div class="set-actions"><button class="btn" id="install">Install</button><a class="btn" href="#/download">All download options</a></div><p class="note">App version ${BUILD}</p>`)}</div>`;
  const [h1, sub] = SET_TITLE[section];
  return { title: "Settings", html: `<div class="set-grid">${nav}<div class="set-main"><div class="set-head"><div><h1>${h1}</h1><p class="lead-s">${sub}</p></div><button type="button" class="back-btn" data-back aria-label="Go back">${icon("left", 20)} Back</button></div>${body}</div></div>`,
    mount() {
      const save = async (patch, msg = "Saved.") => { try { await st.saveProfile(u.uid, patch); ctx.S.profile = { ...(ctx.S.profile || {}), ...patch }; toast(msg); } catch (x) { toast(friendlyErr(x)); throw x; } };
      const del = $("#delAcct"); if (del) del.onclick = () => { const m = modal(`<h2>Delete your account?</h2><p class="muted" style="margin:6px 0 12px">Our team reviews deletion requests, which takes about a day. Your saved homes, messages and details will be removed once it’s approved. You can cancel before then.</p><label class="fl">Type <b>DELETE</b> to confirm<input id="dc" autocomplete="off"></label><div class="so-act"><button class="btn" id="dcNo">Keep my account</button><button class="btn red" id="dcYes" disabled>Request deletion</button></div>`);
        $("#dc", m.el).oninput = (e) => ($("#dcYes", m.el).disabled = e.target.value.trim() !== "DELETE"); $("#dcNo", m.el).onclick = () => m.close();
        $("#dcYes", m.el).onclick = async () => { try { const d = { status: "pending", requestedAt: Date.now() }; await st.setDeletion(u.uid, d); ctx.S.profile = { ...(ctx.S.profile || {}), deletion: d }; m.close(); toast("Request sent. We’ll review it within about a day."); ctx.render(); } catch (x) { toast(friendlyErr(x)); } }; };
      const cd = $("#cancelDel"); if (cd) cd.onclick = async () => { try { await st.setDeletion(u.uid, null); const p = { ...(ctx.S.profile || {}) }; delete p.deletion; ctx.S.profile = p; toast("Deletion cancelled."); ctx.render(); } catch (x) { toast(friendlyErr(x)); } };
      $("#out").onclick = async () => { if (await ctx.confirmSignOut()) { await ctx.logout(); ctx.go("#/login"); } };
      $$("[data-theme-pref]").forEach((b) => (b.onclick = () => { ctx.setThemePref(b.dataset.themePref); $$("[data-theme-pref]").forEach((x) => { const on = x === b; x.classList.toggle("on", on); x.setAttribute("aria-checked", on); }); }));
      $$("[data-sw]").forEach((b) => (b.onclick = async () => {
        const [g, k] = b.dataset.sw.split("."), cur = ctx.S.profile?.[g] || {}, base = g === "notify" ? notify : privacy, next = !(cur[k] ?? base[k]);
        b.classList.toggle("on", next); b.setAttribute("aria-checked", next);
        try { await save({ [g]: { ...base, ...cur, [k]: next } }); } catch { b.classList.toggle("on", !next); b.setAttribute("aria-checked", !next); }
      }));
      const au = $("#autoUpd"); if (au) au.onclick = async () => { const next = !au.classList.contains("on"); au.classList.toggle("on", next); au.setAttribute("aria-checked", next); try { await save({ prefs: { ...(ctx.S.profile?.prefs || {}), autoUpdate: next } }, next ? "Automatic updates are on." : "Automatic updates are off."); APPS.syncShellAutoUpdate(next); } catch { au.classList.toggle("on", !next); au.setAttribute("aria-checked", !next); } };
      const cu = $("#chkUpd"); if (cu) cu.onclick = () => { const r = APPS.checkNow(ctx.S); if (r === "current") toast("You’re on the latest version."); };
      const pf = $("#pf");
      if (pf) {
        $("#cancel").onclick = () => ctx.render();
        pf.onsubmit = async (e) => {
          e.preventDefault(); const err = $("#perr"), nm = $("#nm").value.trim(); err.textContent = "";
          if (!nm) return (err.textContent = "Enter your full name.");
          const btn = pf.querySelector("button[type=submit]"); btn.disabled = true;
          try { await updateProfile(auth.currentUser, { displayName: nm }); await save({ name: nm, phone: $("#ph").value.trim(), country: $("#lcc").value, city: $("#lct").value.trim(), location: `${$("#lct").value.trim()}, ${$("#lcc").value}`, prefs: { ...(ctx.S.profile?.prefs || {}), area: $("#pl").value, type: $("#pt").value, budget: $("#pb").value } }, "Profile updated."); ctx.render(); } catch {} finally { btn.disabled = false; }
        };
        $("#photoBtn").onclick = () => $("#photo").click();
        $("#photo").onchange = (e) => {
          const f = e.target.files[0]; if (!f) return; if (!f.type.startsWith("image/")) return toast("Please choose an image.");
          const img = new Image(), url = URL.createObjectURL(f);
          img.onload = async () => {
            const c = document.createElement("canvas"); c.width = c.height = 192; const s = Math.min(img.width, img.height), x = c.getContext("2d");
            x.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 192, 192); URL.revokeObjectURL(url);
            try { await save({ photo: c.toDataURL("image/jpeg", 0.82) }, "Photo updated."); ctx.render(); } catch {}
          };
          img.onerror = () => toast("Couldn't read that image."); img.src = url;
        };
      }
      const rs = $("#resendV"); if (rs) rs.onclick = async () => { try { await ctx.resendVerification(); toast("Verification email sent."); } catch (x) { toast(friendlyErr(x)); } };
      const rp = $("#resetPw"); if (rp) rp.onclick = async () => { try { await ctx.resetPassword(u.email); toast("Password reset email sent."); } catch (x) { toast(friendlyErr(x)); } };
      const tr = $("#tour"); if (tr) tr.onclick = () => { ctx.resetTour(u); const h = "#" + ctx.dashHome(); ctx.go(h); };
      const ins = $("#install"); if (ins) ins.onclick = async () => { if (ctx.canInstall()) return void (await ctx.installApp()); ctx.go("#/download"); };
    } };
}

// ---------- admin ----------
async function admin(ctx, sub) {
  const isAdmin = ctx.S.isAdmin;
  if (!isAdmin) return { title: "Admin", html: `<div class="empty"><h2>Admin access required</h2><p>Your account isn’t an administrator. Ask the owner to promote your account.</p><p style="margin-top:14px"><a class="btn" href="#/">Back home</a></p></div>` };
  if (sub === "get-app") return APPS.installationsPage(ctx);
  const [ls, apps, views, users, tks] = await Promise.all([st.adminAll("listings"), st.adminAll("applications"), st.adminAll("viewings"), st.adminAll("users"), st.adminAll("tickets")]);
  const pending = ls.filter((l) => /pending|flag/i.test(l.status)), by = (a) => [...a].sort((x, y) => (y.createdAt?.seconds || 0) - (x.createdAt?.seconds || 0));
  const th = (x) => `<img class="th" src="${esc(x.images?.[0] || x.image || "img/palm-court.webp")}" alt="">`;
  const table = (head, rows) => `<div class="tbl-wrap"><table><thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.join("") || `<tr><td colspan="${head.length}" class="muted">Nothing here yet.</td></tr>`}</tbody></table></div>`;
  const lrow = (l) => `<tr><td><div class="cell">${th(l)}<div><b>${esc(l.title)}</b><small>${esc(l.area)}, ${esc(l.city)}</small></div></div></td><td><div class="cell"><img class="avatar" src="${esc(l.agent?.avatar || "")}" alt="">${esc(l.agent?.name || "")}</div></td><td>${statusPill(l.status === "pending" ? "Pending Review" : l.status === "flagged" ? "Flagged Review" : l.status)}</td><td><button class="btn primary sm" data-review="${esc(l.id)}">Review</button></td></tr>`;
  if (sub === "listings" || sub === "users" || sub === "support") { const v = sub === "listings" ? A2.listings(ctx, ls) : sub === "users" ? A2.users(ctx, users) : A2.support(ctx, tks); return { title: "Admin", admin: true, pending: pending.length, html: v.html, mount: v.mount }; }
  if (sub === "verifications") { const v = DASH.verifications(ctx, users); return { title: "Verifications", admin: true, pending: pending.length, html: v.html, mount: v.mount }; }
  if (sub === "suggestions") { const v = DASH.suggestions(ctx, await st.adminAll("suggestions")); return { title: "Suggestions", admin: true, pending: pending.length, html: v.html, mount: v.mount }; }
  if (sub === "") { const v = DASH.platform(ctx, { ls, apps, views, users, tks }); return { title: "Admin", admin: true, pending: pending.length, html: v.html, mount: v.mount }; }
  let body;
  if (sub === "") body = `<div class="adm-welcome"><div><h1>Welcome back, ${esc((ctx.S.user.displayName || "").split(" ")[0] || "there")}</h1><p>Here’s what’s happening on Faxton Rentals today.</p></div><span class="muted">${new Date().toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</span>${!ls.length ? `<button class="btn primary" id="seed">Add sample listings</button>` : ""}</div>
    <div class="stats4">${[["/admin/listings", "home", "Active listings", ls.filter((l) => l.status === "active").length], ["/admin/listings", "doc", "Pending reviews", pending.length], ["/admin/applications", "users", "Active tenancies", apps.filter((a) => /approved|active/i.test(a.status)).length], ["/admin/support", "msg", "Open tickets", tks.filter((t) => t.status !== "Resolved").length]].map(([h, ic, t, n]) => `<a class="stat4" href="#${h}"><span class="si">${icon(ic, 30)}</span><div><small>${t}</small><b>${n}</b></div>${icon("chev", 22).replace("<svg", '<svg style="transform:rotate(-90deg)"')}</a>`).join("")}</div>
    <div class="admin-grid"><div><div class="panel"><div class="panel-head"><h3>Listings awaiting approval</h3><a class="link" href="#/admin/listings">View all →</a></div>${table(["Property", "Agent", "Status", "Action"], pending.slice(0, 5).map(lrow))}</div>
      <div class="panel"><div class="panel-head"><h3>Recent rental applications</h3><a class="link" href="#/admin/applications">View all →</a></div>${table(["Applicant", "Property", "Status", "Submitted"], by(apps).slice(0, 5).map((a) => `<tr><td><b>${esc(a.name)}</b><small class="muted" style="display:block">${esc(a.email)}</small></td><td>${esc(a.title)}</td><td>${statusPill(a.status)}</td><td class="muted">${rel(a.createdAt)}</td></tr>`))}</div></div>
      <div><div class="panel"><div class="panel-head"><h3>Needs attention</h3></div>${[["/admin/listings", "doc", "Listings awaiting approval", pending.length], ["/admin/applications", "users", "Rental applications to review", apps.filter((a) => /review/i.test(a.status)).length], ["/admin/viewings", "cal", "Viewing requests", views.filter((v2) => v2.status === "Requested").length], ["/admin/support", "msg", "Open support tickets", tks.filter((t) => t.status !== "Resolved").length]].map(([h, ic, t, n]) => `<a class="attn" href="#${h}"><span class="ico">${icon(ic, 22)}</span><div class="grow">${t}</div><b>${n}</b>${icon("chev", 18).replace("<svg", '<svg style="transform:rotate(-90deg)"')}</a>`).join("")}</div>
      <div class="panel"><div class="panel-head"><h3>Recent activity</h3></div><ul class="timeline">${by([...apps.map((a) => ({ ...a, t: "New rental application received", s: a.title })), ...views.map((v2) => ({ ...v2, t: "Viewing requested", s: v2.title })), ...tks.map((k) => ({ ...k, t: "Support ticket opened", s: k.subject }))]).slice(0, 5).map((e) => `<li><i></i><div class="grow"><b>${e.t}</b><small>${esc(e.s)}</small></div><small>${rel(e.createdAt)}</small></li>`).join("") || '<li class="muted">No activity yet.</li>'}</ul></div></div></div>`;
  else if (sub === "listings") body = `<div class="page-head"><h1>Listings</h1>${!ls.length ? `<button class="btn primary" id="seed">Add sample listings</button>` : ""}</div><div class="panel">${table(["Property", "Agent", "Status", "Action"], ls.map(lrow))}</div>`;
  else if (sub === "users") {
    const me = ctx.S.user.uid, owner = ctx.S.ownerUid, canManage = ctx.S.isOwner;
    const roleOf = (u) => (u.id === owner ? "owner" : u.role === "owner" ? "admin" : u.role || "renter");
    body = `<div class="page-head"><div><h1>Users</h1><p>${canManage ? "As the owner you can promote, demote and transfer ownership." : "Only the owner can change roles."}</p></div></div><div class="panel">${table(["Name", "Email", "Role", ...(canManage ? ["Actions"] : [])], users.map((u) => { const r = roleOf(u);
      return `<tr><td><b>${esc(u.name || "—")}</b>${u.id === me ? ' <span class="muted">(you)</span>' : ""}</td><td>${esc(u.email)}</td><td><span class="pill ${r === "owner" ? "info" : ""}">${esc(r)}</span></td>${canManage ? `<td>${r === "owner" ? '<span class="muted">Owner</span>' : `<div style="display:flex;gap:8px;flex-wrap:wrap"><select data-role="${esc(u.id)}" aria-label="Role for ${esc(u.email)}">${["renter", "agent", "admin"].map((x) => `<option ${x === r ? "selected" : ""}>${x}</option>`).join("")}</select><button class="btn sm" data-transfer="${esc(u.id)}">Make owner</button></div>`}</td>` : ""}</tr>`; }))}</div>`;
  }
  else if (sub === "applications") body = `<div class="page-head"><h1>Rental applications</h1></div><div class="panel">${table(["Applicant", "Property", "Move-in", "Status", "Action"], by(apps).map((a) => `<tr><td><b>${esc(a.name)}</b><small class="muted" style="display:block">${esc(a.email)}</small></td><td>${esc(a.title)}</td><td>${esc(a.moveIn)}</td><td>${statusPill(a.status)}</td><td><select data-app="${esc(a.id)}" aria-label="Status">${["Under review", "Awaiting documents", "Approved", "Rejected"].map((s) => `<option ${s === a.status ? "selected" : ""}>${s}</option>`).join("")}</select></td></tr>`))}</div>`;
  else if (sub === "viewings") body = `<div class="page-head"><h1>Viewings</h1></div><div class="panel">${table(["Renter", "Property", "When", "Status", "Action"], by(views).map((v) => `<tr><td><b>${esc(v.name)}</b></td><td>${esc(v.title)}</td><td>${esc(fmtDate(v.when))}, ${esc(v.slot)}</td><td>${statusPill(v.status)}</td><td><select data-view="${esc(v.id)}" aria-label="Status">${["Requested", "Confirmed", "Completed", "Cancelled"].map((s) => `<option ${s === v.status ? "selected" : ""}>${s}</option>`).join("")}</select></td></tr>`))}</div>`;
  else if (sub === "support") body = `<div class="page-head"><h1>Support</h1></div><div class="panel">${table(["Ticket", "From", "Topic", "Message", "Status"], by(tks).map((t) => `<tr><td><b>#${esc(t.ref)}</b><small class="muted" style="display:block">${rel(t.createdAt)}</small></td><td>${esc(t.name)}</td><td>${esc(t.subject)}</td><td style="max-width:320px">${esc(String(t.message).slice(0, 140))}</td><td><select data-tk="${esc(t.id)}" aria-label="Status">${["Open", "In progress", "Resolved"].map((s) => `<option ${s === t.status ? "selected" : ""}>${s}</option>`).join("")}</select></td></tr>`))}</div>`;
  else body = `<div class="page-head"><h1 style="text-transform:capitalize">${esc(sub)}</h1></div><div class="empty panel">This section is coming soon.</div>`;
  return { title: "Admin", admin: true, pending: pending.length, html: body,
    mount(root) {
      const seed = $("#seed"); if (seed) seed.onclick = async () => { seed.disabled = true; try { await st.seedListings(); toast("Sample listings added."); ctx.render(); } catch (e) { toast(friendlyErr(e)); seed.disabled = false; } };
      $$("[data-review]", root).forEach((b) => (b.onclick = () => { const l = ls.find((x) => x.id === b.dataset.review); const m = modal(`<h2>${esc(l.title)}</h2><p class="muted" style="margin-bottom:14px">${esc(l.area)}, ${esc(l.city)} · ${naira(l.price)} / year</p><img src="${esc(l.images[0])}" alt="" style="width:100%;border-radius:12px;margin-bottom:14px"><p style="margin-bottom:18px">${esc(l.desc)}</p><div style="display:flex;gap:10px"><button class="btn primary" data-s="active">Approve</button><button class="btn" data-s="rejected">Reject</button></div>`);
        $$("[data-s]", m.el).forEach((x) => (x.onclick = async () => { try { await st.setStatus("listings", l.id, x.dataset.s); m.close(); toast("Listing updated."); ctx.render(); } catch (e) { toast(friendlyErr(e)); } })); }));
      $$("select[data-role]", root).forEach((sel) => (sel.onchange = async () => { const prev = users.find((u) => u.id === sel.dataset.role); try { await st.setRole(sel.dataset.role, sel.value); toast(sel.value === "admin" ? "Promoted to admin." : "Role updated."); } catch (e) { toast(friendlyErr(e)); sel.value = prev?.role || "renter"; } }));
      $$("[data-transfer]", root).forEach((b) => (b.onclick = () => { const t = users.find((u) => u.id === b.dataset.transfer);
        const m = modal(`<h2>Transfer ownership</h2><p class="muted" style="margin-bottom:14px">${esc(t.name || t.email)} will become the owner of Faxton Rentals and you will become an admin. Only they will be able to change roles or transfer ownership again.</p><form id="tf"><div class="field"><label for="tc">Type <b>${esc(t.email)}</b> to confirm</label><input id="tc" autocomplete="off"></div><div class="err" id="te"></div><button class="btn primary block">Transfer ownership</button></form>`);
        $("#tf", m.el).onsubmit = async (e) => { e.preventDefault(); if ($("#tc", m.el).value.trim().toLowerCase() !== String(t.email).toLowerCase()) return ($("#te", m.el).textContent = "Email doesn’t match."); try { await st.transferOwnership(ctx.S.user.uid, t.id); m.close(); toast("Ownership transferred."); await ctx.refreshUser(); } catch (x) { $("#te", m.el).textContent = friendlyErr(x); } }; }));
      $$("select[data-tk]", root).forEach((s) => (s.onchange = async () => { try { await st.setStatus("tickets", s.dataset.tk, s.value); toast("Ticket updated."); } catch (e) { toast(friendlyErr(e)); } }));
      $$("[data-app]", root).forEach((s) => (s.onchange = async () => { try { await st.setStatus("applications", s.dataset.app, s.value); toast("Status updated."); } catch (e) { toast(friendlyErr(e)); } }));
      $$("select[data-view]", root).forEach((s) => (s.onchange = async () => { try { await st.setStatus("viewings", s.dataset.view, s.value); toast("Status updated."); } catch (e) { toast(friendlyErr(e)); } }));
    } };
}
