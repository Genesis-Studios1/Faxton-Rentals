import { auth } from "./firebase.js";
import { updateProfile } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { $, $$, esc, naira, short, icon, logo, logoMark, initials, toast, modal, friendlyErr, BUILD, verifiedBadge } from "./ui.js";
import * as st from "./store.js";
import * as PG from "./pages.js";
import * as A2 from "./admin2.js";
import * as DASH from "./dash.js";
import * as LEGAL from "./legal.js";
import * as CALLS2 from "./calls.js";
import { loadLeaflet, ctrlZoom, tiles } from "./maps.js";
import * as CALLS from "./calls.js";
import { collectDetails, verifyPopup, resizePhoto, askResidence } from "./onboard.js";
import { countryOptions } from "./countries.js";
import * as APPS from "./apps.js";
import * as SAFE from "./safety.js";
import { openProfile } from "./profile.js";
import * as AREA from "./area.js";
import * as OFFERS from "./offers.js";
import * as MATCH from "./match.js";
import * as MYHOME from "./myhome.js";
import * as TENANTS from "./tenants.js";
import * as VS from "./viewsafe.js";

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
  if (path === "/terms" || path === "/privacy" || path === "/license") return LEGAL.legalPage(ctx, path.slice(1));
  if (path === "/download") return APPS.downloadPage(ctx);
  if (path === "/") return discover(ctx);
  if (path === "/search") return search(ctx);
  if ((m = path.match(/^\/home\/([^/]+)$/))) return detail(ctx, decodeURIComponent(m[1]));
  if (path === "/saved") return PG.savedPage(ctx);
  if (path === "/help") return PG.helpPage(ctx);
  if (path === "/messages" || path.startsWith("/messages/")) return messages(ctx, decodeURIComponent(path.split("/")[2] || ""));
  if (path === "/bookings") return bookings(ctx);
  if (path === "/myhome" || path.startsWith("/myhome/")) return MYHOME.myHomePage(ctx, path.split("/")[2] || "");
  if (path === "/tenants" || path.startsWith("/tenants/")) return TENANTS.tenantsPage(ctx, path.split("/")[2] || "maintenance");
  if (path === "/match") return MATCH.matchPage(ctx);
  if (path === "/offers") return OFFERS.offersPage(ctx, PG.rentalsNav);
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
  if (path === "/agent-dashboard" || /^\/agent-dashboard\/(leads|clients|viewings|listings)$/.test(path)) return DASH.ownerPage(ctx, "agent", path.split("/")[2] || "");
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
      : `<div class="m-avrow"><button type="button" id="avBtn" class="av-pick" aria-label="Add a profile photo">${icon("camera", 22)}</button><input type="file" id="avFile" accept="image/*" hidden><span><b>Profile photo</b><small>Optional. You can change it later in Settings.</small></span></div>` + mf("name", "Full name", "user", "Your full name", "text", 'autocomplete="name"') + mf("email", "Email address", "mail", "you@example.com", "email", 'autocomplete="email" inputmode="email"') + mf("password", "Password", "lock", "Create a password", "password", 'autocomplete="new-password"') + `<label class="m-chk terms"><input type="checkbox" id="terms"> <span>I agree to the <a class="dz-link" href="#/terms">Terms</a> and <a class="dz-link" href="#/privacy">Privacy Policy</a></span></label>`}
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
    <div class="at dz-check rise" ${P(1021, 650, null, null, `${FS(16)}${D(.55)}`)}><input type="checkbox" id="terms" aria-label="I agree to the Terms and Privacy Policy"><label for="terms">I agree to the <a class="dz-link" style="font-weight:400" href="#/terms">Terms</a> and <a class="dz-link" style="font-weight:400" href="#/privacy">Privacy Policy</a></label></div>
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
      try { const d = JSON.parse(sessionStorage.getItem("signupDraft") || "null"); if (d && !login) { ["name", "email"].forEach((k) => { if (d[k] && $("#" + k)) $("#" + k).value = d[k]; }); if (d.role && $(`[data-role="${d.role}"]`)) $(`[data-role="${d.role}"]`).click(); if (d.terms && $("#terms")) $("#terms").checked = true; } } catch {}
      if (!login) { const keep = () => { try { sessionStorage.setItem("signupDraft", JSON.stringify({ name: $("#name")?.value || "", email: $("#email")?.value || "", role, terms: !!$("#terms")?.checked })); } catch {} }; form.addEventListener("input", keep); form.addEventListener("change", keep); $$("[data-role]").forEach((b) => b.addEventListener("click", () => setTimeout(keep))); $$("a.dz-link[href='#/terms'],a.dz-link[href='#/privacy']").forEach((a) => a.addEventListener("click", keep)); }
      let photo = null; const av = $("#avBtn");
      if (av) { av.onclick = () => $("#avFile").click(); $("#avFile").onchange = async (e) => { const f = e.target.files[0]; if (!f) return; try { photo = await resizePhoto(f); av.innerHTML = `<img src="${photo}" alt="">`; av.classList.add("has"); } catch (x) { say(friendlyErr(x)); } }; }
      $$(".eye").forEach((b) => (b.onclick = () => { const i = b.parentElement.querySelector("input"); i.type = i.type === "password" ? "text" : "password"; }));
      $$("input", form).forEach((i) => i.addEventListener("input", () => say("")));
      const STAFF = ["admin", "owner", "support"], WHO = { landlord: "a home owner", agency: "an agency", agent: "an agent" };
      const run = async (fn, btn) => {
        say(""); if (btn) btn.disabled = true;
        try {
          const got = await fn();
          try { sessionStorage.removeItem("signupDraft"); } catch {}
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
    ${MYHOME.homeCard(ctx.S)}
    ${MATCH.matchBanner()}
    <section class="hmm-app rise" style="--d:.36s"><div class="hmm-app-top"><div><div class="hmm-eye light">Get Faxton Rentals everywhere</div><h2>Start exploring on your device.</h2><p>Download the Faxton Rentals app or continue on web.</p>${dlNow}</div><img src="img/app-devices.webp" alt="Faxton Rentals on phone and laptop" loading="lazy"></div>
      <div class="hm-os-row">${os("os-android.webp", "Android", "Get the app")}${os("os-apple.webp", "iOS", "Get the app")}${os("os-windows.webp", "Windows", "Use on desktop")}${macTile}</div></section>
    <div class="hmm-sec"><div><h2>Featured Homes</h2><p>Handpicked rental homes for you.</p></div><a class="hmm-all" href="#/search">View all ${icon("arrow", 18)}</a></div>
    <div class="hmm-grid">${list.slice(0, 6).map(hmCard).join("")}</div></div>`;
  return { title: "Home", html: `<div class="wrap hm">${mobile}
    <section class="hm-hero"><div class="hm-text"><div class="eyebrow-s rise">Find your next chapter</div><h1 class="rise" style="--d:.08s">A place to live.<br>A place to<br>call home.</h1><p class="rise" style="--d:.18s">Find a rental that fits your life, in a neighbourhood you love.</p></div><div class="hm-img reveal" style="background-image:url(img/hero-hd.webp)" role="img" aria-label="Modern home in Lagos"></div></section>
    <form class="searchbar hm-search rise" style="--d:.3s" id="sb" role="search">
      <div class="sb-cell">${icon("pin", 26)}<label>Location<select name="area">${opts(AREAS, pr.area || "lekki")}</select></label></div>
      <div class="sb-cell">${icon("home", 26)}<label>Property type<select name="type"><option value="">Any type</option>${typeOptions(pr.type)}</select></label></div>
      <div class="sb-cell">${icon("coins", 26)}<label>Yearly budget<select name="max">${opts(BUDGETS, 0)}</select></label></div>
      <button class="btn primary">${icon("search", 22)} Search homes</button></form>
    <div class="hm-pop rise" style="--d:.35s"><span>Popular locations:</span>${[["lekki", "Lekki"], ["ajah", "Ajah"], ["yaba", "Yaba"], ["ikeja", "Ikeja"]].map(([v, l], i) => `<a class="chip-l" href="#/search?area=${v}">${i === 0 ? icon("pin", 16) : ""}${l}</a>`).join("")}</div>
    ${MYHOME.homeCard(ctx.S)}
    ${MATCH.matchBanner("wide")}
    <div class="hm-sec rise" style="--d:.4s"><div><h2>Find your kind of home</h2><p>Explore rentals selected for your next move.</p></div><div class="hm-tabs" role="tablist">${TABS.map(([v, l], i) => `<button role="tab" class="${i ? "" : "on"}" data-t="${v}">${l}</button>`).join("")}</div><a class="link" href="#/search">View all homes ${icon("arrow", 18)}</a></div>
    <div class="cards" id="hmcards">${cardsFor("")}</div>
    <section class="hm-app hmd-app rise" style="--d:.55s"><div class="hmd-top"><div><div class="hmm-eye light">Get Faxton Rentals everywhere</div><h2>Start exploring on your device.</h2><p>Download the Faxton Rentals app or continue on web.</p>${dlNow}</div><img src="img/app-devices.webp" alt="Faxton Rentals on phone and laptop" loading="lazy"></div>
      <div class="hmd-os">${os("os-android.webp", "Android", "Get the app")}${os("os-apple.webp", "iOS", "Get the app")}${os("os-windows.webp", "Windows", "Use on desktop")}${macTile}${tuxTile}</div></section>
    <div class="hm-feats rise" style="--d:.5s"><div><span class="hm-fi">${icon("pin", 24)}</span><b>Find your neighbourhood</b><p>Discover great areas, with everything you need nearby.</p></div><div><span class="hm-fi">${icon("cal", 24)}</span><b>Book a viewing</b><p>Schedule and tour your shortlisted homes with ease.</p></div><div><span class="hm-fi">${icon("user", 24)}</span><b>Manage your rental</b><p>Keep track of your enquiries, viewings and tenancy all in one place.</p></div></div></div>`,
    mount(root) { bindCards(root, ctx);
      // "Get the app" links land here: scroll to the app section (the phone layout has its own copy of it).
      if (ctx.q.to === "app") setTimeout(() => { const t = [...root.querySelectorAll(".hmm-app, .hm-app")].find((e) => e.offsetParent !== null); t?.scrollIntoView({ behavior: "smooth", block: "center" }); }, 450);
      $$("[data-dlnow]", root).forEach((b) => (b.onclick = () => APPS.openDownloadModal())); $("#sb").onsubmit = (e) => { e.preventDefault(); const p = new URLSearchParams(); new FormData(e.target).forEach((v, k) => v && v !== "0" && p.set(k, v)); ctx.go("#/search?" + p); };
      const ms = $("#hmmS"); if (ms) ms.onsubmit = (e) => { e.preventDefault(); const t = ms.area.value.trim().toLowerCase(); ctx.go("#/search" + (t ? "?area=" + encodeURIComponent(t) : "")); };
      $$(".hm-tabs [data-t]", root).forEach((b) => (b.onclick = () => { $$(".hm-tabs [data-t]", root).forEach((x) => x.classList.toggle("on", x === b)); $("#hmcards").innerHTML = cardsFor(b.dataset.t); bindCards(root, ctx); })); } };
}

// ---------- search ----------
async function search(ctx) {
  const q = ctx.q, all = await st.getListings();
  const area = q.area || "", max = +q.max || 0, beds = +q.beds || 0, type = q.type || "", sort = q.sort || "recommended";
  const am = (q.am || "").split(",").filter(Boolean), avail = q.avail !== "0";
  let list = all.filter((l) => (!area || (l.area + " " + l.city).toLowerCase().includes(area)) && (!max || l.price <= max) && l.beds >= beds && matchType(l, type) && (!avail || l.available !== false) && am.every((x) => l.amenities.includes(x)));
  if (sort === "low") list = [...list].sort((a, b) => a.price - b.price); if (sort === "high") list = [...list].sort((a, b) => b.price - a.price);
  const areaName = area ? AREAS.find((a) => a[0] === area)?.[1].replace(/, Lagos/, "") || "Lagos" : "Lagos";
  const chip = (k, label) => `<span class="chip static">${esc(label)}</span>`;
  const chips = [chip("area", area ? areaName : "Lagos"), avail && chip("avail", "Available now"), max && chip("max", BUDGETS.find((b) => b[0] === max)?.[1] || naira(max)), beds && chip("beds", beds + "+ beds"), type && chip("type", CATS.find((c) => c[0] === type)?.[1] || type), ...am.map((x) => chip("am:" + x, x))].filter(Boolean).join("");
  const AMEN = ["Parking", "Water supply", "Security", "Generator", "Balcony", "Garden", "Pool", "Gym", "Wi-Fi"];
  return { title: "Search", html: `<div class="wrap"><div class="page-head rise"><div><h1 style="font-size:clamp(1.9rem,3.4vw,2.9rem)">Homes for rent in ${esc(areaName === "Lagos" ? "Lagos" : areaName)}</h1><p>${list.length} home${list.length === 1 ? "" : "s"} match your search</p></div>
</div>
    ${MATCH.matchBanner("slim")}
    <form class="filters" id="ff"><label class="fsel">${icon("pin", 18)}<select name="area" aria-label="Location">${opts(AREAS, area)}</select></label>
      <label class="fsel">${icon("wallet", 18)}<select name="max" aria-label="Budget">${opts(BUDGETS, max)}</select></label>
      <label class="fsel">${icon("bed", 18)}<select name="beds" aria-label="Bedrooms">${opts([[0, "Bedrooms"], [1, "1+"], [2, "2+"], [3, "3+"], [4, "4+"], [5, "5+"]], beds)}</select></label>
      <label class="fsel">${icon("home", 18)}<select name="type" aria-label="Property type"><option value="">Property type</option>${typeOptions(type)}</select></label>
      <div class="fsel more" style="padding:0;position:relative"><button type="button" id="moreBtn" aria-haspopup="true" aria-expanded="false" style="display:flex;align-items:center;gap:8px;border:0;background:none;padding:12px;font-weight:500">${icon("sliders", 18)} More filters${am.length ? ` (${am.length})` : ""} ${icon("chev", 16)}</button>
        <div class="pop-menu" id="morePanel" hidden><b>Amenities</b>${AMEN.map((x) => `<label class="chk"><input type="checkbox" value="${esc(x)}" ${am.includes(x) ? "checked" : ""}> ${esc(x)}</label>`).join("")}<button type="button" class="btn primary sm" id="applyMore">Apply</button></div></div>
      <label class="fsel sort"><span class="muted">Sort by</span><select name="sort" aria-label="Sort">${opts([["recommended", "Recommended"], ["low", "Price: low to high"], ["high", "Price: high to low"]], sort)}</select></label></form>
    <div class="chips">${chips}</div>
    ${list.length ? `<div class="results grid-only"><div class="cards">${list.map((l, i) => card(l, ctx.S.saved, true, i)).join("")}</div></div>` : `<div class="empty"><h3>No homes match your search</h3><p>Try widening your filters.</p><p style="margin-top:14px"><a class="btn" href="#/search">Reset filters</a></p></div>`}</div>`,
    async mount(root) {
      bindCards(root, ctx);
      const nav = (patch) => { const p = new URLSearchParams(q); Object.entries(patch).forEach(([k, v]) => (v && v !== "0" ? p.set(k, v) : p.delete(k))); ctx.go("#/search?" + p); };
      $$("select", $("#ff")).forEach((s) => (s.onchange = () => nav({ [s.name]: s.value })));
      const mb = $("#moreBtn"), mp = $("#morePanel");
      mb.onclick = (e) => { e.stopPropagation(); mp.hidden = !mp.hidden; mb.setAttribute("aria-expanded", String(!mp.hidden)); };
      mp.onclick = (e) => e.stopPropagation(); document.addEventListener("click", () => { mp.hidden = true; }, { once: true });
      $("#applyMore").onclick = () => nav({ am: $$("input:checked", mp).map((i) => i.value).join(",") });
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
const amenIcon = (a) => (/park/i.test(a) ? "car" : /secur|guard|cctv/i.test(a) ? "shield" : /pool|swim/i.test(a) ? "waves" : /power|generator|backup|solar|electric|inverter/i.test(a) ? "bolt" : /smart/i.test(a) ? "chip" : /garden|tree|lawn/i.test(a) ? "tree" : /water|borehole/i.test(a) ? "drop" : /balcon|terrace/i.test(a) ? "building" : "check");
// An illustrative room layout built from the bedrooms, bathrooms and size in the listing.
function planHtml(l) {
  const b = +l.beds || 0, ba = +l.baths || 0, sqft = l.sqm ? Math.round(l.sqm * 10.764) : 0, part = (f) => (sqft ? `≈ ${Math.round(sqft * f).toLocaleString("en-NG")} sqft` : "");
  const cell = (n, sub = "", cls = "") => `<div class="fp-c ${cls}"><b>${esc(n)}</b>${sub ? `<small>${esc(sub)}</small>` : ""}</div>`;
  if (!b) return `<div class="fp"><div class="fp-row">${cell("Living & Sleeping", part(0.6), "hl")}${cell("Kitchenette")}</div><div class="fp-row">${cell("Bathroom")}${cell("Entrance")}</div></div>`;
  const beds = Math.min(b, 6), top = [cell("Living & Dining", part(0.28), "hl wide"), cell("Kitchen")];
  if (b >= 3) top.push(cell("Family Lounge"));
  return `<div class="fp"><div class="fp-row top">${top.join("")}</div><div class="fp-row">${Array.from({ length: beds }, (_, i) => cell(i ? `Bedroom ${i + 1}` : "Master Suite", ba >= b ? "en suite" : i === 0 ? "en suite" : "")).join("")}</div></div><p class="fp-note">Illustrative layout based on the listing details. Not to scale.</p>`;
}
async function detail(ctx, id) {
  const l = await st.getListing(id);
  if (!l) return { title: "Not found", html: `<div class="empty"><h2>This home isn’t available</h2><p><a class="link" href="#/search">Browse homes</a></p></div>` };
  const mi = AREA.moveIn(l), total = mi.total, on = ctx.S.saved.has(l.id), A = { Parking: "car", "Water supply": "drop", Security: "shield", Balcony: "building" };
  const im = l.images, vids = (l.videos || []).map((u) => ({ type: "video", ...videoEmbed(u) })), media = [...im.map((src) => ({ type: "img", src })), ...vids];
  const gal = im.length > 1 ? `<div class="gallery"><div><img src="${esc(im[0])}" alt="${esc(l.title)}"></div><div><img src="${esc(im[1])}" alt=""></div><div>${im[2] ? `<img src="${esc(im[2])}" alt="">` : ""}<button class="show-all" id="all">${icon("img", 18)} Show all photos</button></div></div>` : `<div class="gallery one"><div><img src="${esc(im[0])}" alt="${esc(l.title)}"></div></div>`;
  const all = (await st.getListings().catch(() => [])).filter((x) => x.id !== l.id && x.city === l.city), cat = catOf(l);
  const similar = [...all.filter((x) => catOf(x) === cat), ...all.filter((x) => catOf(x) !== cat)].slice(0, 6);
  const hasPin = l.lat != null && l.lng != null && l.hasPin !== false, lid = "FR-" + String([...l.id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 9000, 7) + 1000);
  const parking = l.parking != null && l.parking !== "" ? `${l.parking} space${+l.parking === 1 ? "" : "s"}` : l.amenities.includes("Parking") ? "Available" : "None listed";
  const info = [["home", "Property type", catName(l)], ["area", "Size", l.sqm ? `${l.sqm} m²` : "Not listed"], ["cal", "Year built", l.yearBuilt || "Not listed"], ["car", "Parking", parking], ["building", "Furnishing", l.furnished || "Not listed"], ["list", "Listing ID", lid]];
  const bkDays = []; for (let i = 1; bkDays.length < 7; i++) { const d = new Date(Date.now() + i * 864e5); if (d.getDay() === 0) continue; bkDays.push([d.toISOString().slice(0, 10), d.toLocaleDateString("en-GB", { weekday: "short", month: "short", day: "numeric" })]); }
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
      <div class="dt-tabs" role="tablist">${[["overview", "Overview"], ["features", "Features"], ["location", "Location"], ["hood", "Neighbourhood"], ["plan", "Floor plan"], ["media", "Media"]].map(([k, t], i) => `<button type="button" role="tab" class="${i ? "" : "on"}" data-pane="${k}">${t}</button>`).join("")}</div>
      <section class="dt-pane" id="p-overview">${(desc.length ? desc : ["The agent hasn’t added a description yet."]).map((x) => `<p class="dt-desc">${esc(x)}</p>`).join("")}<p class="dt-desc">Listed by ${esc(l.agent.name)}. Rent is paid per year. Documents are available for inspection after your viewing.</p>
        <div class="dt-info">${info.map(([ic, k, v]) => `<div><span>${icon(ic, 18)} ${k}</span><b>${esc(v)}</b></div>`).join("")}</div>
        ${AREA.costHtml(l)}</section>
      <section class="dt-pane" id="p-features" hidden>${l.amenities.length ? `<div class="ft-grid">${l.amenities.map((a) => `<div class="ft"><span class="ft-i">${icon(amenIcon(a), 22)}</span><b>${esc(a)}</b></div>`).join("")}</div>` : `<p class="muted">No features have been listed yet.</p>`}<div class="ft-facts"><div><span>Bedrooms</span><b>${l.beds === 0 ? "Studio" : l.beds}</b></div><div><span>Bathrooms</span><b>${l.baths}</b></div><div><span>Area</span><b>${l.sqm ? l.sqm + " m²" : "Not listed"}</b></div><div><span>Parking</span><b>${esc(parking)}</b></div></div></section>
      <section class="dt-pane" id="p-location" hidden>${hasPin ? `<div class="dmap lg" id="dmap"><span class="dmap-pill">${esc(l.area)}${l.area.includes(",") ? "" : ", " + esc(l.city)}</span></div>` : `<div class="dmap lg dmap-none"><span>${icon("pin", 28)}</span><b>${esc(l.area)}${l.area.includes(",") ? "" : ", " + esc(l.city)}</b><small>The exact pin hasn’t been shared yet.</small></div>`}<div class="dmap-row"><span class="muted">${icon("pin", 16)} ${esc(l.area)}${l.area.includes(",") ? "" : ", " + esc(l.city)}</span><a class="btn" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${hasPin ? l.lat + "," + l.lng : encodeURIComponent(l.area + ", " + l.city)}">${icon("arrow", 16)} Open in Google Maps</a></div></section>
      <section class="dt-pane" id="p-hood" hidden>${AREA.neighbourhoodHtml(l, all)}</section>
      <section class="dt-pane" id="p-plan" hidden>${l.floorPlan ? `<img class="dt-fp" src="${esc(l.floorPlan)}" alt="Floor plan of ${esc(l.title)}">` : planHtml(l)}</section>
      <section class="dt-pane" id="p-media" hidden><h3 class="md-h">Photos <b>${im.length}</b></h3><div class="md-grid">${im.map((src, k) => `<button type="button" class="md-i" data-m="${k}" aria-label="Open photo ${k + 1}"><img src="${esc(src)}" alt="" loading="lazy"></button>`).join("")}</div>${vids.length ? `<h3 class="md-h">Videos <b>${vids.length}</b></h3><div class="md-grid">${vids.map((v, k) => `<button type="button" class="md-i md-v" data-m="${im.length + k}" aria-label="Play video ${k + 1}">${v.thumb ? `<img src="${esc(v.thumb)}" alt="" loading="lazy">` : `<span class="md-vb"></span>`}<span class="md-play">${icon("video", 26)}</span><em>Video ${k + 1}</em></button>`).join("")}</div>` : `<p class="muted" style="margin-top:14px">No videos have been added for this home yet.</p>`}</section>
    </div>
    <aside class="side-card"><div class="big-price">${naira(l.price)} <small>/ year</small></div><p class="muted">Annual payment</p>
      <div class="rows"><div><span>Rent</span><span>${naira(l.price)}</span></div><div><span>Agency &amp; legal fees</span><span>${naira(mi.fees)}</span></div><div><span>Service charge</span><span>${naira(l.service)}</span></div><div><span>Caution (refundable)</span><span>${naira(l.deposit)}</span></div><div class="total"><span>Move-in total</span><span>${naira(total)}</span></div></div>
      <a class="sc-tc" href="#" id="tcJump">${icon("calc", 16)} See the full cost breakdown</a>
      <button class="btn primary block" id="apply" style="padding:15px">Apply to rent ${icon("arrow", 20)}</button>
      <div class="sc-agent"><div class="sc-av"><img class="avatar" src="${esc(l.agent.avatar)}" alt=""><i class="on" title="Online"></i></div><div><a href="#/agent/${esc(l.agent.id)}" class="sc-name">${esc(l.agent.name)}</a><small>${esc(l.agent.title || "Property consultant")}</small>${l.agent.rating ? `<div class="sc-rate">${icon("star", 13)} <b>${esc(l.agent.rating)}</b></div>` : ""}</div></div>
      <div class="sc-msg"><button class="btn block" id="msg">${icon("msg", 18)} Message agent</button><button class="btn sc-call" id="callAgent" aria-label="Call the agent" title="Call the agent">${icon("phone", 20)}</button></div>
      <h3 class="sc-h">Book a viewing</h3>
      <div class="sc-seg" role="radiogroup" aria-label="Tour type"><button type="button" role="radio" aria-checked="true" class="on" data-tour="person">In person</button><button type="button" role="radio" aria-checked="false" data-tour="virtual">Virtual</button></div>
      <label class="sc-date">${icon("cal", 20)}<select id="bkDate" aria-label="Date">${bkDays.map(([v, t]) => `<option value="${v}">${t}</option>`).join("")}</select></label>
      <p class="muted sc-t">Available times</p><div class="sc-times" id="bkTimes">${["10:00 AM", "12:00 PM", "2:00 PM", "4:00 PM"].map((t, i) => `<button type="button" class="${i ? "" : "on"}" data-time="${t}">${t}</button>`).join("")}</div>
      <div class="sc-two"><button class="btn" id="view">${icon("cal", 18)} Book a viewing</button><button class="btn" id="offer">${icon("tag", 18)} Make an offer</button></div><div id="ofBanner"></div>
      <p class="muted" style="font-size:.88rem;display:flex;gap:8px;margin-top:12px">${icon("info", 18)}<span>Review the <a class="link" href="#/terms" style="text-decoration:underline">terms</a> before making a payment.</span></p></aside></div>
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
        if (b.dataset.pane === "hood" && !hoodDone) { hoodDone = true; AREA.mountNeighbourhood($("#p-hood"), l); }
        if (b.dataset.pane === "location" && hasPin && !mapDone) { mapDone = true; loadLeaflet().then(() => { const el = $("#dmap"); if (!el) return; const map = L.map(el, { scrollWheelZoom: false }).setView([l.lat, l.lng], 15); tiles().addTo(map); L.marker([l.lat, l.lng]).addTo(map); ctrlZoom(map); setTimeout(() => map.invalidateSize(), 100); ctx.S.cleanups.push(() => map.remove()); }).catch(() => { mapDone = false; }); }
      }));
      AREA.mountCost(root, l);
      let hoodDone = false;
      $("#tcJump").onclick = (e) => { e.preventDefault(); $$(".dt-tabs [data-pane]")[0].click(); $(".tc")?.scrollIntoView({ behavior: "smooth", block: "start" }); };
      st.getPublic(l.ownerUid || l.agent.id).then((pb) => { if (pb?.verified) $(".sc-name")?.insertAdjacentHTML("beforeend", " " + verifiedBadge(16)); });
      const scav = $(".sc-av"); if (scav) { scav.style.cursor = "pointer"; scav.onclick = async () => { const uid = l.ownerUid || l.agent.id, pb = await st.getPublic(uid); openProfile(ctx, { uid, name: l.agent.name, avatar: l.agent.avatar, role: ["agent", "agency", "landlord"].includes(pb?.role) ? pb.role : "agent", area: l.area, onMessage: () => $("#msg")?.click(), onCall: () => $("#callAgent")?.click() }); }; }
      $("#msg").onclick = authed(async () => { try { const cid = await st.ensureConversation(ctx.S.user, l); ctx.go("#/messages/" + cid); } catch (e) { toast(friendlyErr(e)); } });
      let tour = "person", slot = "10:00 AM";
      $$("[data-tour]").forEach((b) => (b.onclick = () => { tour = b.dataset.tour; $$("[data-tour]").forEach((x) => { x.classList.toggle("on", x === b); x.setAttribute("aria-checked", x === b); }); }));
      $$("[data-time]").forEach((b) => (b.onclick = () => { slot = b.dataset.time; $$("[data-time]").forEach((x) => x.classList.toggle("on", x === b)); }));
      $("#view").onclick = authed(() => ctx.go(`#/book/${l.id}?date=${$("#bkDate").value}&slot=${encodeURIComponent(slot)}&tour=${tour}`));
      $("#callAgent").onclick = authed(async () => { try { const cid = await st.ensureConversation(ctx.S.user, l), to = l.ownerUid && l.ownerUid !== ctx.S.user.uid ? l.ownerUid : "staff"; CALLS2.startCall(ctx, { convId: cid, to, toName: to === "staff" ? "Faxton team" : l.agent.name, kind: "voice", title: l.title, image: l.thumb || l.images[0], area: l.area }); } catch (e) { toast(friendlyErr(e)); } });
      $$("[data-m]").forEach((b) => (b.onclick = () => openViewer(media, +b.dataset.m)));
      $("#apply").onclick = authed(() => ctx.go("#/apply/" + l.id));
      const ofBan = async () => { if (!ctx.S.user) return; const o = await OFFERS.myOpenOffer(ctx.S.user.uid, l.id), b = $("#ofBanner"); if (!b) return; b.innerHTML = o ? `<a class="of-ban ${o.status.toLowerCase()}" href="#/offers">${icon("tag", 16)}<span><b>${o.status === "Accepted" ? "Offer accepted at " + naira(o.amount) : o.status === "Countered" ? "Counter-offer: " + naira(o.amount) : "Your offer: " + naira(o.amount)}</b><small>${o.status === "Accepted" ? "Apply at the agreed rent" : o.status === "Countered" ? "The owner replied. Your turn." : "Waiting for the owner"}</small></span>${icon("arrow", 16)}</a>` : ""; };
      ofBan();
      $("#offer").onclick = authed(() => { if (ctx.S.user.uid === l.ownerUid) return toast("This is your own listing."); if (l.available === false) return toast("This home isn’t available right now."); OFFERS.offerDialog(ctx, l, ofBan); });
    } };
}

// ---------- saved / bookings / payments ----------
async function saved(ctx) {
  const list = (await st.getListings()).filter((l) => ctx.S.saved.has(l.id));
  return { title: "Saved homes", html: `<div class="page-head"><div><h1>Saved homes</h1><p>${list.length} home${list.length === 1 ? "" : "s"} you love</p></div></div>${list.length ? `<div class="cards">${list.map((l) => card(l, ctx.S.saved)).join("")}</div>` : `<div class="empty"><h3>Nothing saved yet</h3><p>Tap the heart on any home to keep it here.</p><p style="margin-top:14px"><a class="btn primary" href="#/search">Browse homes</a></p></div>`}`, mount: (r) => bindCards(r, ctx) };
}
async function bookings(ctx) {
  const v = await st.myViewings(ctx.S.user);
  // Fill in who the agent is for viewings booked before the safety system existed.
  v.forEach((x) => { if (!x.agentName) x.agentName = "Faxton agent"; });
  const draw = () => v.length ? v.map((x) => VS.viewingCard(x)).join("") : `<div class="empty">No viewings yet. Open a home and choose “Book a viewing”.</div>`;
  return { title: "Viewings", html: `${PG.rentalsNav("/bookings")}<div class="page-head"><div><h1>Viewings</h1><p>Your scheduled and past viewings, with safety tools for each one</p></div><a class="btn primary" href="#/search">Find a home</a></div><div class="vw-list" id="vwList">${draw()}</div>`,
    mount(root) { const redraw = () => { $("#vwList", root).innerHTML = draw(); VS.mountViewings(root, ctx, v, redraw); }; VS.mountViewings(root, ctx, v, redraw); VS.watchOverdue(ctx, () => v, redraw); } };
}
async function payments(ctx) {
  const a = await st.myApplications(ctx.S.user);
  return { title: "Payments", html: `<div class="page-head"><div><h1>Payments</h1><p>Rental applications and amounts due on move-in</p></div></div><div class="panel">${a.length ? a.map((x) => `<div class="list-row"><img src="${esc(x.image)}" alt=""><div class="grow"><h3>${esc(x.title)}</h3><div class="loc">${icon("pin", 16)}${esc(x.area)}</div><p class="muted" style="margin-top:6px">Move-in ${esc(fmtDate(x.moveIn))}</p></div><div style="text-align:right"><div class="price">${naira(x.amount)}</div>${statusPill(x.status)}</div></div>`).join("") : `<div class="empty">No applications yet.</div>`}</div><p class="muted">Online payments will be available once your application is approved.</p>` };
}

// ---------- messages ----------
const EMOJI = ["😀", "😊", "😍", "👍", "🙏", "🎉", "🏠", "🔑", "📅", "📍", "💬", "✅", "❤️", "😅", "🤝", "👋"];
async function messages(ctx, cid) {
  const me = ctx.S.user.uid, staff = !!(ctx.S.isAdmin || ctx.S.isOwner || ctx.S.role === "support");
  const getMode = () => { try { return staff && sessionStorage.getItem("msgMode") === "faxton" ? "faxton" : "personal"; } catch { return "personal"; } };
  const html = `<div class="mx-shell ${cid ? "has-chat" : ""}"><aside class="mx-side" id="mxSide"></aside><section class="mx-chat" id="chat"></section></div>`;
  return { title: "Messages", bare: true, html,
    mount() {
      let mine = [], team = [], calls = [], unsubM = null, tab = "all", term = "", mode = getMode(), teamErr = false, fetched = new Set();
      const faxton = () => mode === "faxton", convs = () => (faxton() ? team : mine);
      const iniAv = (name) => "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#0f7a5a"/><text x="32" y="42" font-family="Arial,sans-serif" font-size="28" font-weight="700" fill="#fff" text-anchor="middle">${esc((String(name || "?").trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("") || "?").toUpperCase())}</text></svg>`);
      // Who the person on the other side is, from the point of view of the current mode.
      const other = (c) => faxton() ? { name: c.userName || "User", avatar: c.userPhoto || iniAv(c.userName), role: "User", id: c.uid } : { name: c.agent.name, avatar: c.agent.avatar, role: c.listingId === "direct" ? "Faxton team" : "Property Agent", id: c.agent.id };
      const myAv = () => faxton() ? "assets/mark.svg" : ctx.S.profile?.photo || ctx.S.user.photoURL || iniAv(ctx.S.user.displayName || ctx.S.profile?.name || ctx.S.user.email);
      const isMine = (m, c) => (faxton() ? m.from !== c.uid : m.from === me);
      const unreadOf = (c) => (faxton() ? !!c.staffUnread : !!c.unread);
      const FILTERS = () => [["all", "chatdots", "All", convs().length], ["unread", "bell", "Unread", convs().filter(unreadOf).length], ["calls", "phone", "Calls", calls.length]];
      const vis = () => convs().filter((c) => (tab === "all" || (tab === "unread" ? unreadOf(c) : true)) && (!term || (other(c).name + " " + c.listingTitle + " " + c.last).toLowerCase().includes(term)));
      const beginCall = async (c, kind) => {
        if (faxton()) return CALLS.startCall(ctx, { convId: c.id, to: c.uid, toName: c.userName || "User", toPhoto: c.userPhoto || "", kind, title: "Faxton team" });
        if (c.listingId === "direct") return CALLS.startCall(ctx, { convId: c.id, to: "staff", toName: "Faxton team", kind, title: "Faxton team" });
        const l = await st.getListing(c.listingId).catch(() => null); const to = l?.ownerUid && l.ownerUid !== me ? l.ownerUid : "staff";
        CALLS.startCall(ctx, { convId: c.id, to, toName: to === "staff" ? "Faxton team" : c.agent.name, toPhoto: c.agent.avatar, kind, title: c.listingTitle, image: c.image, area: c.area });
      };
      // The left column: title and new-message button, the Me / Faxton switch for staff, search, tabs and the list.
      const lastLine = (c) => {
        const k = calls.filter((x) => x.convId === c.id)[0]; // newest first
        if (k && (k.createdAt?.seconds || 0) >= (c.lastAt?.seconds || 0)) { const [t, sub] = callText(k); return `${icon(k.kind === "video" ? "video" : "phone", 14)} ${esc(t)}${sub ? " · " + esc(sub.split(" · ")[0]) : ""}`; }
        return esc(c.last || (c.listingId === "direct" ? "Say hello" : c.listingTitle));
      };
      const drawList = () => {
        const f = FILTERS(), list = vis();
        f.forEach(([k, , , n]) => { const c = $(`[data-cnt="${k}"]`); if (c) c.textContent = n; });
        const box = $("#convs"); if (!box) return;
        box.innerHTML = tab === "calls" ? (calls.length ? calls.filter((c) => !term || ((c.callerName || "") + (c.calleeName || "") + (c.title || "")).toLowerCase().includes(term)).map((c) => CALLS.logRow(c, me)).join("") : `<p class="muted mx-none">No calls yet. Open a conversation and tap Call or Video call.</p>`)
          : list.length ? list.map((c) => { const o = other(c); return `<a class="mx-conv ${c.id === cid ? "on" : ""}" href="#/messages/${esc(c.id)}"><img class="mx-av" src="${esc(o.avatar)}" alt="" referrerpolicy="no-referrer"><div><div class="mx-ct"><b>${esc(o.name)}</b><time>${c.lastAt ? fmtTime(c.lastAt) : ""}</time></div><p>${lastLine(c)}</p></div>${unreadOf(c) ? '<i class="mx-dot" aria-label="Unread"></i>' : ""}</a>`; }).join("")
          : `<p class="muted mx-none">${faxton() && teamErr ? "Couldn’t load the Faxton Rentals inbox. The database rules may not be published yet." : convs().length ? "No conversations match." : faxton() ? "No one has messaged Faxton Rentals yet." : "No conversations yet. Open a home and tap “Message agent”."}</p>`;
        $$("[data-cb]", box).forEach((b) => (b.onclick = () => { const c = calls.find((x) => x.id === b.dataset.cb); if (!c) return; const out = c.callerUid === me; CALLS.startCall(ctx, { convId: c.convId, to: out ? c.calleeUid : c.callerUid, toName: out ? c.calleeName : c.callerName, kind: b.dataset.k, title: c.title }); }));
      };
      const drawSide = () => {
        const side = $("#mxSide"); if (!side) return; const f = FILTERS();
        side.innerHTML = `<div class="mx-sidehead"><div class="mx-hrow"><h1>Messages</h1><a class="mx-newi" href="${faxton() ? "#/admin/users" : "#/search"}" aria-label="New conversation" title="New conversation">${icon("edit", 22)}</a></div>
          ${staff ? `<div class="mx-mode" role="tablist" aria-label="Message as"><button type="button" class="${faxton() ? "" : "on"}" data-mode="personal">Me</button><button type="button" class="${faxton() ? "on" : ""}" data-mode="faxton">Faxton</button></div><p class="mx-hint">Type <b>/switch</b> in a message to change.</p>` : ""}
          <label class="mx-search">${icon("search", 18)}<input id="cs" type="search" placeholder="Search conversations…" value="${esc(term)}" aria-label="Search conversations"></label>
          <div class="mx-tabs" role="tablist">${f.map(([k, , l]) => `<button type="button" role="tab" data-tab="${k}" class="${k === tab ? "on" : ""}">${l} (<span data-cnt="${k}">0</span>)</button>`).join("")}</div></div>
          <div class="mx-convs" id="convs"></div>`;
        $$("[data-tab]", side).forEach((b) => (b.onclick = () => { tab = b.dataset.tab; $$("[data-tab]", side).forEach((x) => x.classList.toggle("on", x === b)); drawList(); }));
        $$("[data-mode]", side).forEach((b) => (b.onclick = () => switchMode(b.dataset.mode)));
        const cs = $("#cs", side); cs.oninput = (e) => { term = e.target.value.trim().toLowerCase(); drawList(); }; cs.onkeydown = (e) => { if (e.key === "Enter" && cs.value.trim().toLowerCase() === "/switch") { e.preventDefault(); term = ""; cs.value = ""; switchMode(); } };
        drawList();
      };
      const switchMode = (to) => {
        if (!staff) return; const next = to || (faxton() ? "personal" : "faxton"); if (next === mode) return;
        mode = next; try { sessionStorage.setItem("msgMode", mode); } catch {} tab = "all"; term = "";
        toast(faxton() ? "Now messaging as Faxton Rentals." : "Now messaging as yourself.");
        const chat = $("#chat"); if (chat) chat.dataset.cid = ""; drawSide(); if (cid && !convs().some((x) => x.id === cid)) { ctx.go("#/messages"); } else drawChat();
      };
      let paintThread = () => {}, tfind = "";
      // Reactions grouped by emoji, with my own highlighted.
      const rxHtml = (m) => { const r = m.reactions || {}, g = {}; Object.entries(r).forEach(([u, e]) => { if (e) (g[e] ||= []).push(u); }); const k = Object.keys(g); return k.length ? `<div class="mx-rx">${k.map((e) => `<button type="button" class="${g[e].includes(me) ? "mine" : ""}" data-rx="${esc(e)}" data-mid2="${esc(m.id)}">${esc(e)}${g[e].length > 1 ? `<b>${g[e].length}</b>` : ""}</button>`).join("")}</div>` : ""; };
      const fmtDurS = (n) => { n = Math.max(0, Math.round(n || 0)); return Math.floor(n / 60) + ":" + String(n % 60).padStart(2, "0"); };
      const fmtSize = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round((n || 0) / 1024)) + " KB");
      const unreadFrom = (cid2) => { try { return +localStorage.getItem("seen_" + cid2) || 0; } catch { return 0; } };
      const dayLabel = (sec) => { const d = new Date(sec * 1000), n = new Date(); const same = (a, b) => a.toDateString() === b.toDateString(); const y = new Date(n); y.setDate(n.getDate() - 1); return same(d, n) ? "Today" : same(d, y) ? "Yesterday" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); };
      const callText = (c) => { const outc = c.callerUid === me || (faxton() && c.callerUid !== (convs().find((x) => x.id === cid)?.uid)), vid = c.kind === "video" ? "video" : "voice", st2 = c.status; return st2 === "missed" || st2 === "cancelled" ? [outc ? `Cancelled ${vid} call` : `Missed ${vid} call`, "No answer"] : st2 === "declined" ? [`Declined ${vid} call`, ""] : st2 === "ringing" ? [`${outc ? "Calling" : "Incoming"} ${vid} call`, "Ringing…"] : [`${outc ? "Outgoing" : "Incoming"} ${vid} call`, c.duration ? `${CALLS.fmtDur(c.duration)} · ${c.duration < 60 ? c.duration + " seconds" : Math.round(c.duration / 60) + " minutes"}` : ""]; };
      const callCard = (c) => { const [t, sub] = callText(c), outc = c.callerUid === me || (faxton() && c.callerUid !== (convs().find((x) => x.id === cid)?.uid)), bad = /Missed|Declined|Cancelled/.test(t), back = bad && !outc; return `<div class="mx-row ${outc ? "me" : ""}"><${back ? 'button type="button" data-cb2="' + esc(c.id) + '"' : "div"} class="mx-cc ${outc ? "me" : ""} ${bad ? "bad" : "ok"}"><span class="mx-ci">${icon(c.kind === "video" ? "video" : "phone", 22)}</span><div><b>${t}</b><small>${back ? "Tap to call back" : sub}</small></div><time>${c.createdAt?.seconds ? fmtTime(c.createdAt) : ""}</time></${back ? "button" : "div"}></div>`; };
      const tk = (mine) => (mine ? `<span class="ticks">${icon("check", 14, 2.4)}${icon("check", 14, 2.4)}</span>` : "");
      const bubble = (m, c) => {
        const mineB = isMine(m, c), av = mineB ? myAv() : other(c).avatar;
        if (m.type === "booking") return `<div class="mx-row"><div class="mx-bk"><img src="${esc(m.image || "")}" alt=""><div><b class="bk-when">${icon("cal", 18)} ${esc(fmtDate(m.when))}, ${esc(m.slot)}</b><b>${esc(m.title)}</b><span class="muted">${esc(m.area)}</span><a class="btn sm" href="#/bookings">View booking</a></div></div></div>`;
        const q = m.reply ? `<button type="button" class="mx-rq" data-goto="${esc(m.reply.id || "")}"><b>${esc(m.reply.name || "")}</b><span>${esc(m.reply.text || "")}</span></button>` : "";
        const pic = m.image ? `<img class="mx-pic" data-pic="${esc(m.id)}" src="${esc(m.image)}" alt="Photo">` : "";
        const wave = (m.wave && m.wave.length ? m.wave : Array.from({ length: 40 }, (_, i) => 20 + ((i * 37) % 55))).slice(0, 40);
        const vn = m.audio ? `<div class="mx-vn" data-vn="${esc(m.id)}"><button type="button" class="mx-play" aria-label="Play voice message">${icon("play", 20)}</button><div class="mx-wv">${wave.map((h) => `<i style="height:${Math.max(8, Math.min(100, h))}%"></i>`).join("")}</div><span class="mx-vd">${fmtDurS(m.dur)}</span></div>` : "";
        const fl = m.file ? `<div class="mx-file"><span class="mx-fi">${icon("doc", 22)}</span><div><b>${esc(m.fname || "File")}</b><small>${fmtSize(m.fsize)} · ${esc((String(m.fname || "").split(".").pop() || "file").toUpperCase())}</small></div><a class="mx-dl" href="${esc(m.file)}" download="${esc(m.fname || "file")}" aria-label="Download">${icon("download", 18)}</a></div>` : "";
        return `<div class="mx-row ${mineB ? "me" : ""}" data-mid="${esc(m.id || "")}"><img class="mx-bav" src="${esc(av)}" alt="" referrerpolicy="no-referrer"><div class="mx-bw"><div class="mx-b ${m.image ? "has-pic" : ""} ${m.audio ? "has-vn" : ""} ${m.file ? "has-file" : ""}">${q}${pic}${vn}${fl}${m.text ? `<span class="mx-tx">${esc(m.text)}</span>` : ""}<time class="in">${m.at ? fmtTime(m.at) : ""}${tk(mineB)}</time><button type="button" class="mx-ma" data-act="${esc(m.id || "")}" aria-label="Message options">${icon("dchev", 14)}</button></div><time class="out">${m.at ? fmtTime(m.at) : ""}${tk(mineB)}</time>${rxHtml(m)}</div></div>`;
      };
      const listingCard = (c) => c.listingId === "direct" ? "" : `<div class="mx-lcard"><div class="mx-limg"><img src="${esc(c.image)}" alt=""><span class="mx-badge">Available</span></div><div class="mx-lb"><div class="mx-lt"><h3>${esc(c.listingTitle)}</h3><span class="mx-lp">${naira(c.price)} <small>per year</small></span></div><p class="mx-lloc">${icon("pin", 16)} ${esc(c.area)}${/,/.test(c.area || "") ? "" : ", Lagos"}</p><div class="mx-lf"><span>${icon("bed", 18)} ${c.beds === 0 ? "Studio" : c.beds + " Beds"}</span><span>${icon("bath", 18)} ${c.baths} Baths</span></div></div><div class="mx-lact"><a class="btn mx-vl" href="#/home/${esc(c.listingId)}">View listing</a><a class="mx-ext" href="#/home/${esc(c.listingId)}" aria-label="Open listing">${icon("share", 18)}</a></div></div>`;
      const drawChat = () => {
        const c = convs().find((x) => x.id === cid); const chat = $("#chat");
        if (!c) { unsubM?.(); chat.dataset.cid = ""; chat.innerHTML = `<div class="mx-empty"><span>${icon("chatdots", 34)}</span><h2>${convs().length ? "Select a conversation" : "No messages yet"}</h2><p>${faxton() ? "Choose a person to reply as Faxton Rentals." : "Message a listing agent to start chatting."}</p></div>`; return; }
        if (chat.dataset.cid === cid + mode) { drawChat.paintPin?.(c); return; } chat.dataset.cid = cid + mode;
        if (faxton() ? c.staffUnread : c.unread && c.uid === me) (faxton() ? st.setStaffUnread(cid, false) : st.markRead(cid)).catch(() => {});
        const o = other(c), direct = c.listingId === "direct", agentView = !faxton() && !direct;
        const seenAt = unreadFrom(cid); try { localStorage.setItem("seen_" + cid, String(Math.floor(Date.now() / 1000))); } catch {}
        chat.innerHTML = `<header class="mx-head"><a class="mx-back" href="#/messages" aria-label="Back">${icon("left", 22)}</a><span class="mx-hav"><img src="${esc(o.avatar)}" alt="" referrerpolicy="no-referrer"></span><div class="mx-hn"><b>${esc(o.name)}</b><span>${faxton() ? "Replying as Faxton Rentals" : esc(o.role)}</span></div>
          <div class="mx-acts"><button type="button" class="mx-ab mx-d" id="mxFind" aria-label="Search in this chat" title="Search in this chat">${icon("search", 21)}</button><button type="button" class="mx-ab" data-call="voice" aria-label="Voice call" title="Voice call">${icon("phone", 21)}</button><button type="button" class="mx-ab" data-call="video" aria-label="Video call" title="Video call">${icon("video", 21)}</button>
          <span class="mx-more"><button type="button" class="mx-dots" id="mxMore" aria-label="More options" aria-haspopup="menu">${icon("dots", 20)}</button><div class="menu mx-menu" id="mxMenu" role="menu" hidden>${agentView ? `<a role="menuitem" href="#/book/${esc(c.listingId)}">${icon("cal", 18)} Schedule viewing</a><a role="menuitem" href="#/agent/${esc(c.agent.id)}">${icon("user", 18)} View profile</a><a role="menuitem" href="#/home/${esc(c.listingId)}">${icon("home", 18)} View listing</a>` : ""}${faxton() ? `<a role="menuitem" href="#/admin/users">${icon("users", 18)} All users</a>` : ""}<a role="menuitem" href="#/messages" data-calls>${icon("phone", 18)} Call history</a>${agentView ? `<span id="mxSafe"></span>` : ""}${staff ? `<button role="menuitem" type="button" data-sw>${icon("share", 18)} Switch to ${faxton() ? "me" : "Faxton"}</button>` : ""}</div></span></div></header>
          <div class="mx-pin" id="mxPin" hidden></div>
          <div class="mx-find" id="mxFindBar" hidden><input id="mxFindIn" type="search" placeholder="Search in this chat…" aria-label="Search in this chat"></div>
          <div class="mx-thread" id="thread"></div><div class="mx-emoji" id="emoji" hidden>${EMOJI.map((e) => `<button type="button">${e}</button>`).join("")}</div>
          <div class="mx-reply" id="mxReply" hidden></div>
          <form class="mx-comp" id="cf" autocomplete="off"><div class="mx-rec" id="mxRec" hidden><button type="button" id="recX" aria-label="Cancel recording">${icon("trash", 20)}</button><i class="mx-rdot"></i><span id="recT">0:00</span><div class="mx-live" id="recW">${"<i></i>".repeat(28)}</div><button type="button" class="mx-recsend" id="recS" aria-label="Send voice message">${icon("send", 20)}</button></div><input type="file" id="mxFile" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv" multiple hidden><button type="button" class="mx-ib mx-circ" id="emojiBtn" aria-label="Emoji">${icon("smile", 22)}</button><button type="button" class="mx-ib mx-circ" id="mxAttach" aria-label="Add a photo" title="Add a photo">${icon("plus", 22)}</button><input id="ci" placeholder="${staff ? "Type a message… or /switch" : "Type a message"}" maxlength="2000" aria-label="Message"><button class="mx-send" id="sendB" aria-label="Send" type="submit"><span class="mx-mic">${icon("mic", 24)}</span><span class="mx-snd">${icon("send", 22)}</span></button></form>`;
        $$("[data-soon]", chat).forEach((b) => (b.onclick = () => toast("Coming soon.")));
        // --- reply, pin, photos ---
        let replyTo = null, ms = [];
        const paintReply = () => { const r = $("#mxReply"); if (!r) return; r.hidden = !replyTo; r.innerHTML = replyTo ? `<div><b>${esc(replyTo.name)}</b><span>${esc(replyTo.text)}</span></div><button type="button" aria-label="Cancel reply">${icon("x", 16)}</button>` : ""; const x = $("button", r); if (x) x.onclick = () => { replyTo = null; paintReply(); }; };
        const msgOf = (id) => ms.find((m) => m.id === id);
        const startReply = (m) => { replyTo = { id: m.id, name: isMine(m, c) ? "You" : o.name, text: (m.text || (m.image ? "📷 Photo" : "")).slice(0, 140) }; paintReply(); $("#ci")?.focus(); };
        const paintPin = (cc) => { const pn = $("#mxPin"); if (!pn) return; const p0 = cc?.pinned; pn.hidden = !p0; pn.innerHTML = p0 ? `<span>${icon("pin", 16)}</span><button type="button" class="mx-pt" data-goto="${esc(p0.id)}"><b>Pinned message</b><span>${esc(p0.text || "📷 Photo")}</span></button><button type="button" class="mx-pu" aria-label="Unpin">${icon("x", 16)}</button>` : ""; const u = $(".mx-pu", pn); if (u) u.onclick = () => st.pinMessage(cid, null).catch((x) => toast(friendlyErr(x))); };
        paintPin(c); drawChat.paintPin = paintPin;
        const jump = (id) => { const row = $(`[data-mid="${CSS.escape(id)}"]`); if (!row) return toast("That message is further up."); row.scrollIntoView({ block: "center", behavior: "smooth" }); row.classList.add("flash"); setTimeout(() => row.classList.remove("flash"), 1400); };
        const squeeze = (file) => new Promise((res, rej) => { if (!/^image\//.test(file.type)) return rej(new Error("Choose an image file.")); const img = new Image(), url = URL.createObjectURL(file); img.onload = () => { let w = Math.min(1280, img.width), q = 0.78, out = ""; for (let i = 0; i < 6; i++) { const cv = document.createElement("canvas"); cv.width = w; cv.height = Math.round(img.height * w / img.width); cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height); out = cv.toDataURL("image/jpeg", q); if (out.length < 380000) break; w = Math.round(w * 0.8); q = Math.max(0.5, q - 0.08); } URL.revokeObjectURL(url); out.length < 420000 ? res(out) : rej(new Error("That picture is too large.")); }; img.onerror = () => rej(new Error("That picture couldn’t be read.")); img.src = url; });
        const sendPics = async (files) => { for (const f of [...files].filter((x) => /^image\//.test(x.type)).slice(0, 6)) { try { const data = await squeeze(f), extra = { image: data }; if (replyTo) extra.reply = replyTo; replyTo = null; paintReply(); await send("", extra); } catch (x) { toast(friendlyErr(x)); } } };
        const send = (t, extra = {}) => (faxton() ? st.sendMessage(ctx.S.user, cid, t, extra, true, { staffUnread: false }) : st.sendMessage(ctx.S.user, cid, t, extra, c.uid !== me, c.listingId === "direct" && c.uid === me ? { staffUnread: true } : {}));
        const file = $("#mxFile"); $("#mxAttach").onclick = () => file.click(); file.onchange = () => { sendFiles(file.files); file.value = ""; };
        chat.ondragover = (e) => { if ([...(e.dataTransfer?.types || [])].includes("Files")) { e.preventDefault(); chat.classList.add("drop"); } };
        chat.ondragleave = (e) => { if (e.target === chat || !chat.contains(e.relatedTarget)) chat.classList.remove("drop"); };
        chat.ondrop = (e) => { e.preventDefault(); chat.classList.remove("drop"); if (e.dataTransfer?.files?.length) sendFiles(e.dataTransfer.files); };
        $("#ci").addEventListener("paste", (e) => { const fs = [...(e.clipboardData?.files || [])]; if (fs.some((f) => /^image\//.test(f.type))) { e.preventDefault(); sendPics(fs); } });
        // The small menu for one message: reply, pin, copy.
        const react = async (m, emoji) => { try { await st.reactToMessage(cid, m.id, me, m.reactions?.[me] === emoji ? null : emoji); } catch (x) { toast(friendlyErr(x)); } };
        const mm = document.createElement("div"); mm.className = "menu mx-mm"; mm.hidden = true; chat.append(mm);
        const openMM = (id, x, y) => { const m = msgOf(id); if (!m) return; const pinned = c.pinned?.id === id || convs().find((z) => z.id === cid)?.pinned?.id === id; mm.innerHTML = `<div class="mx-react">${["👍", "❤️", "😂", "😮", "😢", "🙏"].map((e) => `<button type="button" data-r="${e}" class="${m.reactions?.[me] === e ? "on" : ""}">${e}</button>`).join("")}<button type="button" data-more aria-label="More emojis">${icon("plus", 18)}</button></div><div class="mx-rmore" hidden>${EMOJI.map((e) => `<button type="button" data-r="${e}">${e}</button>`).join("")}</div><button type="button" data-a="reply">${icon("chev", 16)} Reply</button><button type="button" data-a="pin">${icon("pin", 16)} ${pinned ? "Unpin" : "Pin"}</button>${m.text ? `<button type="button" data-a="copy">${icon("doc", 16)} Copy</button>` : ""}`; mm.hidden = false; const r = chat.getBoundingClientRect(); mm.style.left = Math.max(8, Math.min(x - r.left, r.width - 170)) + "px"; mm.style.top = Math.max(8, Math.min(y - r.top, r.height - 140)) + "px";
          mm.onclick = async (e) => { const btn = e.target.closest("button"); if (btn?.dataset.more !== undefined) { e.stopPropagation(); $(".mx-rmore", mm).hidden = false; return; } if (btn?.dataset.r) { mm.hidden = true; return react(m, btn.dataset.r); } const a = btn?.dataset.a; mm.hidden = true; if (a === "reply") startReply(m); else if (a === "copy") { try { await navigator.clipboard.writeText(m.text); toast("Copied."); } catch {} } else if (a === "pin") { try { await st.pinMessage(cid, pinned ? null : { id: m.id, text: (m.text || "").slice(0, 120), name: isMine(m, c) ? "You" : o.name }); } catch (x) { toast(friendlyErr(x)); } } }; };
        document.addEventListener("click", (e) => { if (!e.target.closest(".mx-mm")) mm.hidden = true; }); 
        const thread = $("#thread");
        const sendFiles = async (files) => { for (const f of [...files].slice(0, 6)) { if (/^image\//.test(f.type)) { await sendPics([f]); continue; }
            if (f.size > 400000) { toast("Documents can be up to 400 KB here. Send a smaller file or share a link."); continue; }
            try { const data = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error("That file couldn’t be read.")); r.readAsDataURL(f); }); const extra = { file: data, fname: f.name.slice(0, 80), fsize: f.size }; if (replyTo) extra.reply = replyTo; replyTo = null; paintReply(); await send("", extra); } catch (x) { toast(friendlyErr(x)); } } };
        // --- voice messages ---
        let vr = null;
        const recUi = (on) => { $("#mxRec").hidden = !on; $("#cf").classList.toggle("recording", on); };
        const stopVoice = (send2) => { if (!vr) return; const v = vr; vr = null; v.finish(send2); };
        const startVoice = async () => {
          if (vr) return stopVoice(true);
          if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return toast("Voice messages aren’t supported on this device.");
          let stream; try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); } catch { return toast("Allow microphone access to record voice messages."); }
          const mime = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find((t) => MediaRecorder.isTypeSupported(t)) || "";
          const rec = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: 20000 }), chunks = [], peaks = [];
          rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
          let ac = null, an = null, buf = null; try { ac = new (window.AudioContext || window.webkitAudioContext)(); an = ac.createAnalyser(); an.fftSize = 512; ac.createMediaStreamSource(stream).connect(an); buf = new Uint8Array(an.fftSize); } catch {}
          const t0 = Date.now(), bars = [...$("#recW").children];
          const iv = setInterval(() => { let m = 0; if (an) { an.getByteTimeDomainData(buf); for (const x of buf) m = Math.max(m, Math.abs(x - 128)); } peaks.push(m / 128); bars.forEach((b, i) => { const v = peaks[peaks.length - bars.length + i] ?? 0; b.style.height = Math.max(8, Math.min(100, Math.round(v * 160))) + "%"; }); const sec = (Date.now() - t0) / 1000; $("#recT").textContent = fmtDurS(sec); if (sec >= 90) stopVoice(true); }, 100);
          vr = { finish: (doSend) => { clearInterval(iv); const dur = Math.round((Date.now() - t0) / 1000); rec.onstop = async () => { stream.getTracks().forEach((t) => t.stop()); try { ac?.close(); } catch {} recUi(false); if (!doSend || dur < 1 || !chunks.length) return; const blob = new Blob(chunks, { type: rec.mimeType || mime || "audio/webm" });
              const data = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); }); if (data.length > 560000) return toast("That voice message is too long. Keep it under a minute and a half.");
              const n = 40, wave = Array.from({ length: n }, (_, i) => { const a = Math.floor(i * peaks.length / n), z = Math.max(a + 1, Math.floor((i + 1) * peaks.length / n)); return Math.max(...peaks.slice(a, z), 0.04); }), mx = Math.max(...wave, 0.05);
              const extra = { audio: data, dur, wave: wave.map((w) => Math.max(10, Math.round(w / mx * 100))) }; if (replyTo) extra.reply = replyTo; replyTo = null; paintReply(); try { await send("", extra); } catch (x) { toast(friendlyErr(x)); } };
            try { rec.stop(); } catch { recUi(false); } } };
          rec.start(250); recUi(true); $("#recT").textContent = "0:00";
        };
        $("#recX").onclick = () => stopVoice(false); $("#recS").onclick = () => stopVoice(true); drawChat.startVoice = startVoice;
        // play a voice message
        let playing = null;
        thread.addEventListener("click", (e) => { const btn = e.target.closest(".mx-play"); if (!btn) return; const box = btn.closest("[data-vn]"), id = box.dataset.vn, m = msgOf(id); if (!m) return;
          if (playing && playing.id === id) { playing.a.paused ? playing.a.play() : playing.a.pause(); return; }
          if (playing) { playing.a.pause(); playing.reset(); }
          const a = new Audio(m.audio), bars = [...box.querySelectorAll(".mx-wv i")], reset = () => { box.classList.remove("playing"); bars.forEach((b) => b.classList.remove("on")); };
          playing = { id, a, reset }; a.onplay = () => box.classList.add("playing"); a.onpause = () => box.classList.remove("playing");
          a.ontimeupdate = () => { const f = a.duration ? a.currentTime / a.duration : 0; bars.forEach((b, i) => b.classList.toggle("on", i / bars.length < f)); };
          a.onended = () => { reset(); playing = null; }; a.play().catch(() => toast("Couldn’t play that message.")); });
        // Tap a picture to see that person's profile; businesses and verified agents get the green tick.
        const showProfile = async () => {
          let uid = "", role = "user";
          if (faxton()) { uid = c.uid; role = "user"; }
          else if (c.listingId === "direct") role = "team";
          else { const l = await st.getListing(c.listingId).catch(() => null); uid = l?.ownerUid || c.agent.id || ""; const pb = await st.getPublic(uid); role = ["agent", "agency", "landlord"].includes(pb?.role) ? pb.role : "agent"; }
          const imgs = ms.filter((m) => m.image).map((m) => ({ type: "image", src: m.image }));
          openProfile(ctx, { uid, name: o.name, avatar: o.avatar && !o.avatar.startsWith("data:") ? o.avatar : "", role, area: agentView ? c.area : "", media: ms.filter((m) => m.image || m.file),
            pinned: convs().find((z) => z.id === cid)?.pinned, onMessage: () => $("#ci")?.focus(), onCall: (k) => beginCall(c, k), onSearch: () => { const bar = $("#mxFindBar"); bar.hidden = false; $("#mxFindIn").focus(); },
            onMedia: () => (imgs.length ? openViewer(imgs, 0) : toast("Documents are saved with their messages. Use the download button on each one.")), onPinned: () => jump(convs().find((z) => z.id === cid)?.pinned?.id),
            ...(safety && safety.uid() ? { onBlock: () => safety.block(), blocked: safety.blocked() } : {}), ...(safety ? { onReport: () => safety.report() } : {}) });
        };
        const hav = $(".mx-hav"); if (hav) { hav.style.cursor = "pointer"; hav.onclick = showProfile; }
        thread.addEventListener("click", (e) => { const av = e.target.closest(".mx-bav"); if (av && !av.closest(".me")) showProfile(); });
        // a green tick next to the name when the person is verified
        (async () => { let ver = c.listingId === "direct" && !faxton(); if (!ver && !faxton() && agentView) { const l = await st.getListing(c.listingId).catch(() => null); ver = !!(await st.getPublic(l?.ownerUid || c.agent.id))?.verified; } else if (faxton()) ver = !!(await st.getPublic(c.uid))?.verified; const nm = $(".mx-hn b"); if (ver && nm && !nm.querySelector(".vseal")) nm.insertAdjacentHTML("beforeend", " " + verifiedBadge(18)); })();
        // call back from a missed-call card
        thread.addEventListener("click", (e) => { const cb = e.target.closest("[data-cb2]"); if (cb) beginCall(c, "voice"); });
        thread.addEventListener("click", (e) => { const a = e.target.closest("[data-act]"); if (a) { e.stopPropagation(); const r = a.getBoundingClientRect(); return openMM(a.dataset.act, r.left - 120, r.bottom + 6); } const g = e.target.closest("[data-goto]"); if (g) return jump(g.dataset.goto); const pc2 = e.target.closest("[data-pic]"); if (pc2) openViewer([{ type: "image", src: pc2.src }], 0); });
        thread.addEventListener("click", (e) => { const rb = e.target.closest("[data-rx]"); if (rb) { const m = msgOf(rb.dataset.mid2); if (m) react(m, rb.dataset.rx); } });
        thread.addEventListener("dblclick", (e) => { const b = e.target.closest(".mx-b"); const row = b?.closest("[data-mid]"); if (row && !e.target.closest("a,button,audio,.mx-vn")) { const m = msgOf(row.dataset.mid); if (m) react(m, "❤️"); } });
        thread.addEventListener("contextmenu", (e) => { const row = e.target.closest("[data-mid]"); if (row) { e.preventDefault(); openMM(row.dataset.mid, e.clientX, e.clientY); } });
        // Swipe a message sideways to reply to it; hold it to open the menu (phones).
        let sx = 0, sy = 0, row = null, dx = 0, lp = null, moved = false;
        thread.addEventListener("touchstart", (e) => { row = e.target.closest("[data-mid]"); if (!row || e.touches.length !== 1) return; sx = e.touches[0].clientX; sy = e.touches[0].clientY; dx = 0; moved = false; const id = row.dataset.mid, t = e.touches[0]; lp = setTimeout(() => { if (!moved) { navigator.vibrate?.(15); openMM(id, t.clientX, t.clientY); } }, 520); }, { passive: true });
        thread.addEventListener("touchmove", (e) => { if (!row) return; const t = e.touches[0], mx = t.clientX - sx, my = t.clientY - sy; if (!moved && Math.abs(mx) > 12 && Math.abs(mx) > Math.abs(my) * 1.4) moved = true; if (Math.abs(my) > 14 && !moved) { clearTimeout(lp); row = null; return; } if (moved) { clearTimeout(lp); dx = Math.max(-80, Math.min(80, mx)); const w = row.querySelector(".mx-bw"); if (w) w.style.transform = `translateX(${dx}px)`; row.classList.toggle("swipe", Math.abs(dx) > 52); } }, { passive: true });
        const endSwipe = () => { clearTimeout(lp); if (!row) return; const w = row.querySelector(".mx-bw"); if (w) { w.style.transition = "transform .18s"; w.style.transform = ""; setTimeout(() => (w.style.transition = ""), 200); } if (moved && Math.abs(dx) > 52) { const m = msgOf(row.dataset.mid); if (m) startReply(m); } row.classList.remove("swipe"); row = null; moved = false; };
        thread.addEventListener("touchend", endSwipe); thread.addEventListener("touchcancel", endSwipe);
        const ciEl = $("#ci"), sendB = $("#sendB"); const syncSend = () => sendB.classList.toggle("has", !!ciEl.value.trim()); ciEl.addEventListener("input", syncSend);
        $("#mxFind").onclick = () => { const bar = $("#mxFindBar"); bar.hidden = !bar.hidden; if (!bar.hidden) $("#mxFindIn").focus(); else { tfind = ""; $("#mxFindIn").value = ""; paintThread(); } };
        $("#mxFindIn").oninput = (e) => { tfind = e.target.value.trim().toLowerCase(); paintThread(); };
        $$("[data-call]", chat).forEach((b) => (b.onclick = () => beginCall(c, b.dataset.call)));
        const menu = $("#mxMenu"); $("#mxMore").onclick = (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; };
        const closeMenu = () => { menu.hidden = true; }; document.addEventListener("click", closeMenu); ctx.S.cleanups.push(() => document.removeEventListener("click", closeMenu));
        const cl = $("[data-calls]", menu); if (cl) cl.onclick = (e) => { e.preventDefault(); tab = "calls"; drawSide(); closeMenu(); };
        // Block and report the person on the other side (listing owners and agents).
        let safety = null;
        if (agentView) {
          let ouid = "", blocked = false;
          const paint = () => {
            const box = $("#mxSafe"); if (!box) return;
            box.innerHTML = `${ouid ? `<button role="menuitem" type="button" data-blk>${icon("shield", 18)} ${blocked ? "Unblock user" : "Block user"}</button>` : ""}<button role="menuitem" type="button" data-rep class="danger-i">${icon("flag", 18)} Report user</button>`;
            const ci = $("#ci"); if (ci) { ci.disabled = blocked; ci.placeholder = blocked ? "You blocked this user. Unblock to message." : "Type a message…"; }
            const bk = $("[data-blk]", box); if (bk) bk.onclick = async () => { closeMenu(); if (blocked) { try { await st.unblockUser(ctx.S.user, ouid); blocked = false; toast("Unblocked."); paint(); } catch (x) { toast(friendlyErr(x)); } } else if (await SAFE.blockDialog(ctx, { uid: ouid, name: o.name })) { blocked = true; paint(); } };
            $("[data-rep]", box).onclick = () => { closeMenu(); SAFE.reportDialog(ctx, { targetUid: ouid || c.agent.id, targetName: o.name, convId: cid }); };
          };
          const doBlock = async () => { if (blocked) { try { await st.unblockUser(ctx.S.user, ouid); blocked = false; toast("Unblocked."); paint(); } catch (x) { toast(friendlyErr(x)); } } else if (await SAFE.blockDialog(ctx, { uid: ouid, name: o.name })) { blocked = true; paint(); } };
          safety = { uid: () => ouid, blocked: () => blocked, block: () => ouid && doBlock(), report: () => SAFE.reportDialog(ctx, { targetUid: ouid || c.agent.id, targetName: o.name, convId: cid }) };
          paint();
          st.getListing(c.listingId).then(async (l) => { ouid = l?.ownerUid && l.ownerUid !== me ? l.ownerUid : ""; blocked = ouid ? await st.isBlocked(me, ouid) : false; paint(); }).catch(() => {});
        }
        const sw = $("[data-sw]", menu); if (sw) sw.onclick = () => { closeMenu(); switchMode(); };
        const em = $("#emoji"); $("#emojiBtn").onclick = () => (em.hidden = !em.hidden); em.onclick = (e) => { const b = e.target.closest("button"); if (b) { $("#ci").value += b.textContent; $("#ci").focus(); } };
        $("#cf").onsubmit = async (e) => {
          e.preventDefault(); const i = $("#ci"), t = i.value.trim(); if (!t) return startVoice();
          if (staff && t.toLowerCase() === "/switch") { i.value = ""; return switchMode(); }
          i.value = ""; syncSend(); em.hidden = true;
          try { const extra = replyTo ? { reply: replyTo } : {}; replyTo = null; paintReply(); await send(t, extra); } catch (x) { toast(friendlyErr(x)); i.value = t; }
        };
        paintThread = () => {
          const th = $("#thread"); if (!th) return; const near = th.scrollHeight - th.scrollTop - th.clientHeight < 80;
          const items = [...ms.map((m) => ({ t: m.at?.seconds || Date.now() / 1000, m })), ...calls.filter((x) => x.convId === cid && x.callerUid && (x.status !== "ringing" || Date.now() / 1000 - (x.createdAt?.seconds || 0) < 90)).map((x) => ({ t: x.createdAt?.seconds || Date.now() / 1000, k: x }))].sort((a, b) => a.t - b.t);
          const out = []; let day = "", first = true;
          let divDone = false; const newCount = items.filter((x) => !x.k && !isMine(x.m, c) && x.t > seenAt).length;
          items.forEach((it) => {
            if (!divDone && seenAt && newCount && !it.k && !isMine(it.m, c) && it.t > seenAt) { divDone = true; out.push(`<div class="mx-unread"><span>${newCount} unread message${newCount > 1 ? "s" : ""}</span></div>`); }
            const d = dayLabel(it.t); if (d !== day) { day = d; out.push(`<span class="mx-day">${d}</span>`); }
            if (it.k) out.push(callCard(it.k)); else if (!tfind || String(it.m.text || "").toLowerCase().includes(tfind)) { out.push(bubble(it.m, c)); if (first) { out.push(listingCard(c)); first = false; } }
          });
          if (first) out.push(listingCard(c));
          th.innerHTML = `${out.join("") || `<div class="mx-hello">Say hello to ${esc(o.name.split(" ")[0])} 👋</div>`}${agentView ? `<div class="mx-quick"><a href="#/book/${esc(c.listingId)}">${icon("cal", 20)}<span>Schedule Viewing</span></a><a href="#/documents">${icon("doc", 20)}<span>Send Documents</span></a><button type="button" data-qcall>${icon("phone", 20)}<span>Call Agent</span></button></div>` : ""}`;
          const q = $("[data-qcall]", th); if (q) q.onclick = () => beginCall(c, "voice");
          if (near || items.length < 3) th.scrollTop = th.scrollHeight;
        };
        unsubM?.(); unsubM = st.watchMessages(cid, (list) => { ms = list; paintThread(); });
        paintThread();
      };
      const refresh = () => {
        // A conversation opened from the admin console belongs to the Faxton inbox. If the list hasn't brought it yet, fetch it directly.
        if (staff && cid && !mine.some((x) => x.id === cid) && !team.some((x) => x.id === cid) && !fetched.has(cid)) { fetched.add(cid); st.getConversation(cid).then((c) => { if (c && c.listingId === "direct") { team = [c, ...team.filter((x) => x.id !== c.id)]; refresh(); } }); }
        if (staff && cid && mode === "personal" && !mine.some((x) => x.id === cid) && team.some((x) => x.id === cid)) { mode = "faxton"; try { sessionStorage.setItem("msgMode", mode); } catch {} drawSide(); } else if ($("#convs")) { drawList(); } else drawSide();
        drawChat();
      };
      const unsubC = st.watchConversations(ctx.S.user, (c) => { mine = c; refresh(); });
      const unsubT = staff ? st.watchStaffConversations((c) => { team = c.length || !team.length ? c : team; teamErr = false; refresh(); }, () => { teamErr = true; refresh(); }) : null;
      const unsubL = CALLS.watchLogs(me, (l) => { calls = l; if ($("#convs")) drawList(); else drawSide(); paintThread(); });
      drawSide(); drawChat();
      ctx.S.cleanups.push(() => { unsubC(); unsubT?.(); unsubL(); unsubM?.(); });
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
          <label class="fl">About<input id="ab" maxlength="160" placeholder="A short line about you" autocomplete="off"></label>
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
        st.getPublic(ctx.S.user.uid).then((pp) => { const a = $("#ab"); if (a && pp?.about) a.value = pp.about; });
        $("#cancel").onclick = () => ctx.render();
        pf.onsubmit = async (e) => {
          e.preventDefault(); const err = $("#perr"), nm = $("#nm").value.trim(); err.textContent = "";
          if (!nm) return (err.textContent = "Enter your full name.");
          const btn = pf.querySelector("button[type=submit]"); btn.disabled = true; st.syncPublic(ctx.S.user.uid, { about: ($("#ab")?.value || "").trim() });
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
  if (sub === "calls") { const v = DASH.callSetup(ctx, await st.getIce()); return { title: "Call setup", admin: true, pending: pending.length, html: v.html, mount: v.mount }; }
  if (sub === "user-reports") { const v = DASH.userReports(ctx, await st.adminAll("reports")); return { title: "User reports", admin: true, pending: pending.length, html: v.html, mount: v.mount }; }
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
  else if (sub === "viewings") body = `<div class="page-head"><h1>Viewings</h1></div><div class="panel">${table(["Renter", "Property", "When", "Status", "Action"], by(views).map((v) => `<tr><td><b>${esc(v.name)}</b></td><td>${esc(v.title)}</td><td>${esc(fmtDate(v.when))}, ${esc(v.slot)}</td><td>${statusPill(v.status)}</td><td><select data-view="${esc(v.id)}" aria-label="Status">${["Requested", "Confirmed", "Completed", "Cancelled"].map((s) => `<option ${s === v.status ? "selected" : ""}>${s}</option>`).join("")}</select> ${VS.safeBadge(v)}${v.sos && !v.sos.resolved ? ` <button class="btn sm" data-sosdone="${esc(v.id)}">Resolve</button>` : ""}</td></tr>`))}</div>`;
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
      $$("[data-sosdone]", root).forEach((b) => (b.onclick = async () => { const v = views.find((x) => x.id === b.dataset.sosdone); try { await VS.resolveSos(v); toast("Marked as resolved."); b.closest("td").querySelector(".pill.bad")?.remove(); b.remove(); } catch (e) { toast(friendlyErr(e)); } }));
      $$("select[data-tk]", root).forEach((s) => (s.onchange = async () => { try { await st.setStatus("tickets", s.dataset.tk, s.value); toast("Ticket updated."); } catch (e) { toast(friendlyErr(e)); } }));
      $$("[data-app]", root).forEach((s) => (s.onchange = async () => { try { await st.setStatus("applications", s.dataset.app, s.value); toast("Status updated."); } catch (e) { toast(friendlyErr(e)); } }));
      $$("select[data-view]", root).forEach((s) => (s.onchange = async () => { try { await st.setStatus("viewings", s.dataset.view, s.value); toast("Status updated."); } catch (e) { toast(friendlyErr(e)); } }));
    } };
}
