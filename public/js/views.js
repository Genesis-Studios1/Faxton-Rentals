import { auth } from "./firebase.js";
import { updateProfile } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { $, $$, esc, naira, short, icon, logo, logoMark, initials, toast, modal, friendlyErr, BUILD, verifiedBadge } from "./ui.js";
import * as st from "./store.js";
import * as PG from "./pages.js";
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
import * as LOCK from "./applock.js";
import * as TENANTS from "./tenants.js";
import * as VS from "./viewsafe.js";
import * as HOME from "./home.js";
import { fxErr, shrinkImage, ask } from "./fx.js";
import { openViewer, detail } from "./pdp.js";

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
// Listing cards, the filters and the property page live in cards.js, home.js and pdp.js.

// ---------- router ----------
export async function route(ctx) {
  const { path } = ctx; let m;
  if ((m = path.match(/^\/onboarding\/([123])$/))) return onboarding(ctx, +m[1]);
  if (path === "/login") return authPage(ctx, "login");
  if (path === "/signup") return authPage(ctx, "signup");
  if (path === "/forgot") return PG.forgotPage(ctx);
  if (path === "/terms" || path === "/privacy" || path === "/license") return LEGAL.legalPage(ctx, path.slice(1));
  if (path === "/download") return APPS.downloadPage(ctx);
  if (path === "/") return HOME.discover(ctx);
  if (path === "/search") return HOME.search(ctx);
  if ((m = path.match(/^\/home\/([^/]+)$/))) return detail(ctx, decodeURIComponent(m[1]));
  if (path === "/saved") return HOME.savedPage(ctx);
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
  if (path === "/support" || path === "/support/tickets" || path === "/support/suggestions") return (await import("./dash.js")).supportPage(ctx, path.split("/")[2] || "");
  if (path === "/portfolio") return (await import("./dash.js")).ownerPage(ctx, "landlord");
  if (path === "/agency") return (await import("./dash.js")).ownerPage(ctx, "agency");
  if (path === "/agent-dashboard" || /^\/agent-dashboard\/(leads|clients|viewings|listings)$/.test(path)) return (await import("./dash.js")).ownerPage(ctx, "agent", path.split("/")[2] || "");
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

// ---------- discover, search, property page, saved: see home.js and pdp.js ----------

// ---------- bookings / payments ----------
async function bookings(ctx) {
  const v = await st.myViewings(ctx.S.user);
  // Fill in who the agent is for viewings booked before the safety system existed.
  v.forEach((x) => { if (!x.agentName) x.agentName = "Faxton agent"; });
  let tab = "up"; const up = () => v.filter((x) => !VS.isPast(x)).sort((a, b) => VS.startOf(a) - VS.startOf(b)), past = () => v.filter((x) => VS.isPast(x)).sort((a, b) => VS.startOf(b) - VS.startOf(a));
  const draw = () => {
    const L = tab === "up" ? up() : past();
    return L.length ? L.map((x) => VS.viewingCard(x)).join("") : `<div class="rf-card"><div class="rf-empty"><span class="rf-empty-ic">${icon("cal", 26, 1.5)}</span><h3>${tab === "up" ? "No viewings coming up" : "No past viewings"}</h3><p>${tab === "up" ? "Open a home and choose “Book a viewing” to pick a day and time." : "Viewings you’ve been on, or cancelled, are kept here."}</p>${tab === "up" ? `<a class="btn primary" href="#/search">Find a home</a>` : ""}</div></div>`;
  };
  const tabs = () => `<button type="button" role="tab" aria-selected="${tab === "up"}" class="${tab === "up" ? "on" : ""}" data-vt="up">Upcoming <b>${up().length}</b></button><button type="button" role="tab" aria-selected="${tab === "past"}" class="${tab === "past" ? "on" : ""}" data-vt="past">Past <b>${past().length}</b></button>`;
  return { title: "Viewings", html: `<div class="rf rf-in">${PG.rentalsNav("/bookings")}<header class="rf-ph"><div><span class="rf-eyebrow">My rentals</span><h1 class="rf-h1">Viewings</h1><p class="rf-sub">Your scheduled and past viewings, with safety tools for each one.</p></div><div class="rf-ph-a"><a class="btn primary" href="#/search">${icon("search", 18)} Find a home</a></div></header><div class="rf-seg" id="vwTabs" role="tablist" style="margin-bottom:14px">${tabs()}</div><div class="rf-vw-list" id="vwList">${draw()}</div></div>`,
    mount(root) {
      const redraw = () => { $("#vwTabs", root).innerHTML = tabs(); $("#vwList", root).innerHTML = draw(); wire(); };
      const wire = () => { VS.mountViewings(root, ctx, v, redraw); $$("[data-vt]", root).forEach((b) => (b.onclick = () => { tab = b.dataset.vt; redraw(); })); };
      wire(); VS.watchOverdue(ctx, () => v, redraw);
    } };
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
  return { title: "Messages", bare: true, bleed: true, html,
    mount() {
      // An open chat takes the whole phone screen: html.in-chat hides the top bar and the four-icon bar (see chat.css).
      const root = document.documentElement, vv = window.visualViewport;
      root.classList.toggle("in-chat", !!cid);
      // iOS keeps the layout viewport tall while the keyboard is up; follow the visual viewport so the composer stays above it.
      const fitVV = () => { if (!cid || !vv) return root.style.removeProperty("--mx-vvh"); root.style.setProperty("--mx-vvh", Math.round(vv.height) + "px"); if (vv.offsetTop) window.scrollTo(0, 0); const th = document.getElementById("thread"); if (th) th.scrollTop = th.scrollHeight; };
      if (vv && cid) { vv.addEventListener("resize", fitVV); fitVV(); }
      ctx.S.cleanups.push(() => { root.classList.remove("in-chat"); root.style.removeProperty("--mx-vvh"); vv?.removeEventListener("resize", fitVV); });
      let mine = [], base = [], dms = [], team = [], calls = [], unsubM = null, tab = "all", term = "", mode = getMode(), teamErr = false, fetched = new Set();
      const faxton = () => mode === "faxton", convs = () => (faxton() ? team : mine);
      const iniAv = (name) => "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#0f7a5a"/><text x="32" y="42" font-family="system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif" font-size="28" font-weight="700" fill="#fff" text-anchor="middle">${esc((String(name || "?").trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("") || "?").toUpperCase())}</text></svg>`);
      // Who the person on the other side is, from the point of view of the current mode.
      const byMe = (c) => c.byStaff === me;
      const merge = () => { mine = [...base, ...dms].sort((a, b) => (b.lastAt?.seconds || 0) - (a.lastAt?.seconds || 0)); };
      const other = (c) => byMe(c) ? { name: c.userName || "User", avatar: c.userPhoto || iniAv(c.userName), role: "User", id: c.uid } : faxton() ? { name: c.userName || "User", avatar: c.userPhoto || iniAv(c.userName), role: "User", id: c.uid } : { name: c.agent.name, avatar: c.agent.avatar, role: c.listingId === "direct" ? "Faxton team" : "Property Agent", id: c.agent.id };
      const myAv = () => faxton() ? "assets/mark.svg" : ctx.S.profile?.photo || ctx.S.user.photoURL || iniAv(ctx.S.user.displayName || ctx.S.profile?.name || ctx.S.user.email);
      const isMine = (m, c) => (faxton() ? m.from !== c.uid : m.from === me);
      const unreadOf = (c) => (faxton() || byMe(c) ? !!c.staffUnread : !!c.unread);
      const FILTERS = () => [["all", "chatdots", "All", convs().length], ["unread", "bell", "Unread", convs().filter(unreadOf).length], ["calls", "phone", "Calls", calls.length]];
      const vis = () => convs().filter((c) => (tab === "all" || (tab === "unread" ? unreadOf(c) : true)) && (!term || (other(c).name + " " + c.listingTitle + " " + c.last).toLowerCase().includes(term)));
      const beginCall = async (c, kind) => {
        if (faxton()) return CALLS.startCall(ctx, { convId: c.id, to: c.uid, toName: c.userName || "User", toPhoto: c.userPhoto || "", kind, title: "Faxton team" });
        if (byMe(c)) return CALLS.startCall(ctx, { convId: c.id, to: c.uid, toName: c.userName || "User", toPhoto: c.userPhoto || "", kind, title: "Faxton team" });
        if (c.listingId === "direct") return CALLS.startCall(ctx, { convId: c.id, to: c.byStaff || "staff", toName: "Faxton team", kind, title: "Faxton team" });
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
        side.innerHTML = `<div class="mx-sidehead"><div class="mx-hrow"><h1>Messages</h1><a class="mx-newi" href="${ctx.S.isAdmin ? "#/admin/users" : faxton() ? "#/admin/users" : "#/search"}" aria-label="New conversation" title="New conversation">${icon("edit", 22)}</a></div>
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
      // One tick while a message is still being sent, two once it is stored, mint once the other side has opened the chat.
      const readByThem = () => { const cc = convs().find((x) => x.id === cid); if (!cc) return false; return faxton() || byMe(cc) ? !cc.unread : cc.listingId === "direct" ? !cc.staffUnread : false; };
      const tk = (mine, m) => (mine ? `<span class="ticks ${m && !m.at ? "pend" : readByThem() ? "read" : ""}" aria-label="${m && !m.at ? "Sending" : readByThem() ? "Seen" : "Delivered"}">${icon("check", 14, 2.4)}${icon("check", 14, 2.4)}</span>` : "");
      const bubble = (m, c) => {
        const mineB = isMine(m, c), av = mineB ? myAv() : other(c).avatar;
        if (m.type === "booking") return `<div class="mx-row"><div class="mx-bk"><img src="${esc(m.image || "")}" alt=""><div><b class="bk-when">${icon("cal", 18)} ${esc(fmtDate(m.when))}, ${esc(m.slot)}</b><b>${esc(m.title)}</b><span class="muted">${esc(m.area)}</span><a class="btn sm" href="#/bookings">View booking</a></div></div></div>`;
        const q = m.reply ? `<button type="button" class="mx-rq" data-goto="${esc(m.reply.id || "")}"><b>${esc(m.reply.name || "")}</b><span>${esc(m.reply.text || "")}</span></button>` : "";
        const pic = m.image ? `<img class="mx-pic" data-pic="${esc(m.id)}" src="${esc(m.image)}" alt="Photo">` : "";
        const wave = (m.wave && m.wave.length ? m.wave : Array.from({ length: 40 }, (_, i) => 20 + ((i * 37) % 55))).slice(0, 40);
        const vn = m.audio ? `<div class="mx-vn" data-vn="${esc(m.id)}"><button type="button" class="mx-play" aria-label="Play voice message">${icon("play", 20)}</button><div class="mx-wv">${wave.map((h) => `<i style="height:${Math.max(8, Math.min(100, h))}%"></i>`).join("")}</div><span class="mx-vd">${fmtDurS(m.dur)}</span></div>` : "";
        const fl = m.file ? `<div class="mx-file"><span class="mx-fi">${icon("doc", 22)}</span><div><b>${esc(m.fname || "File")}</b><small>${fmtSize(m.fsize)} · ${esc((String(m.fname || "").split(".").pop() || "file").toUpperCase())}</small></div><a class="mx-dl" href="${esc(m.file)}" download="${esc(m.fname || "file")}" aria-label="Download">${icon("download", 18)}</a></div>` : "";
        return `<div class="mx-row ${mineB ? "me" : ""}" data-mid="${esc(m.id || "")}"><img class="mx-bav" src="${esc(av)}" alt="" referrerpolicy="no-referrer"><div class="mx-bw"><div class="mx-b ${m.image ? "has-pic" : ""} ${m.audio ? "has-vn" : ""} ${m.file ? "has-file" : ""}">${q}${pic}${vn}${fl}${m.text ? `<span class="mx-tx">${esc(m.text)}</span>` : ""}<time class="in">${m.at ? fmtTime(m.at) : ""}${tk(mineB, m)}</time><button type="button" class="mx-ma" data-act="${esc(m.id || "")}" aria-label="Message options">${icon("dchev", 14)}</button></div><time class="out">${m.at ? fmtTime(m.at) : ""}${tk(mineB, m)}</time>${rxHtml(m)}</div></div>`;
      };
      const listingCard = (c) => c.listingId === "direct" ? "" : `<div class="mx-lcard"><div class="mx-limg"><img src="${esc(c.image)}" alt=""><span class="mx-badge">Available</span></div><div class="mx-lb"><div class="mx-lt"><h3>${esc(c.listingTitle)}</h3><span class="mx-lp">${naira(c.price)} <small>per year</small></span></div><p class="mx-lloc">${icon("pin", 16)} ${esc(c.area)}${/,/.test(c.area || "") ? "" : ", Lagos"}</p><div class="mx-lf"><span>${icon("bed", 18)} ${c.beds === 0 ? "Studio" : c.beds + " Beds"}</span><span>${icon("bath", 18)} ${c.baths} Baths</span></div></div><div class="mx-lact"><a class="btn mx-vl" href="#/home/${esc(c.listingId)}">View listing</a><a class="mx-ext" href="#/home/${esc(c.listingId)}" aria-label="Open listing">${icon("share", 18)}</a></div></div>`;
      const drawChat = () => {
        const c = convs().find((x) => x.id === cid); const chat = $("#chat");
        if (!c) { unsubM?.(); chat.dataset.cid = ""; chat.innerHTML = `<div class="mx-empty"><span>${icon("chatdots", 34)}</span><h2>${convs().length ? "Select a conversation" : "No messages yet"}</h2><p>${faxton() ? "Choose a person to reply as Faxton Rentals." : "Message a listing agent to start chatting."}</p></div>`; return; }
        if (chat.dataset.cid === cid + mode) { drawChat.paintPin?.(c); const rd = readByThem(); if (rd !== drawChat.lastRead) { drawChat.lastRead = rd; paintThread(); } return; } chat.dataset.cid = cid + mode; drawChat.lastRead = readByThem(); drawChat.stopAudio?.();
        if (faxton() || byMe(c) ? c.staffUnread : c.unread && c.uid === me) (faxton() || byMe(c) ? st.setStaffUnread(cid, false) : st.markRead(cid)).catch(() => {});
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
        const offMM = (e) => { if (!e.target.closest(".mx-mm")) mm.hidden = true; }; document.addEventListener("click", offMM);
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
          let stream; try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); } catch (x) { return toast(/NotFound|Overconstrained|DevicesNotFound/i.test(String(x?.name)) ? "No microphone was found on this device." : /NotReadable|TrackStart|Abort/i.test(String(x?.name)) ? "Your microphone is being used by another app. Close it and try again." : "Allow microphone access in your settings to send voice messages."); }
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
        // play a voice message (the thread is repainted when messages arrive, so the player state is re-applied after every paint)
        let playing = null;
        const paintPlay = () => { $$("[data-vn]", thread).forEach((box) => { const on = !!playing && playing.id === box.dataset.vn, a = playing?.a; box.classList.toggle("playing", on && !a.paused); const f = on && a.duration ? a.currentTime / a.duration : 0; $$(".mx-wv i", box).forEach((b, i, all) => b.classList.toggle("on", on && i / all.length < f)); const vd = $(".mx-vd", box), m = msgOf(box.dataset.vn); if (vd && m) vd.textContent = on && a.currentTime > 0 ? fmtDurS(a.currentTime) : fmtDurS(m.dur); }); };
        drawChat.paintPlay = paintPlay; drawChat.stopAudio = () => { try { playing?.a.pause(); } catch {} playing = null; };
        thread.addEventListener("click", (e) => { const btn = e.target.closest(".mx-play"); if (!btn) return; const box = btn.closest("[data-vn]"), id = box.dataset.vn, m = msgOf(id); if (!m) return;
          if (playing && playing.id === id) { playing.a.paused ? playing.a.play().catch(() => {}) : playing.a.pause(); return; }
          drawChat.stopAudio(); paintPlay();
          const a = new Audio(m.audio); a.preload = "auto"; playing = { id, a };
          ["play", "pause", "timeupdate"].forEach((ev) => a.addEventListener(ev, paintPlay));
          a.addEventListener("ended", () => { if (playing?.a === a) playing = null; paintPlay(); });
          a.addEventListener("error", () => { if (playing?.a === a) playing = null; paintPlay(); });
          a.play().catch(() => { if (playing?.a === a) playing = null; paintPlay(); toast("Couldn’t play that voice message on this device."); }); });
        // Tap a picture to see that person's profile; businesses and verified agents get the green tick.
        const showProfile = async () => {
          let uid = "", role = "user";
          if (faxton() || byMe(c)) { uid = c.uid; role = "user"; }
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
        (async () => { let ver = c.listingId === "direct" && !faxton() && !byMe(c); if (!ver && !faxton() && agentView) { const l = await st.getListing(c.listingId).catch(() => null); ver = !!(await st.getPublic(l?.ownerUid || c.agent.id))?.verified; } else if (faxton()) ver = !!(await st.getPublic(c.uid))?.verified; const nm = $(".mx-hn b"); if (ver && nm && !nm.querySelector(".vseal")) nm.insertAdjacentHTML("beforeend", " " + verifiedBadge(18)); })();
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
        const closeMenu = () => { menu.hidden = true; }; document.addEventListener("click", closeMenu);
        const onEsc = (e) => { if (e.key === "Escape") { mm.hidden = true; menu.hidden = true; } }; document.addEventListener("keydown", onEsc);
        drawChat.offDoc?.(); drawChat.offDoc = () => { document.removeEventListener("click", offMM); document.removeEventListener("click", closeMenu); document.removeEventListener("keydown", onEsc); };
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
          drawChat.paintPlay?.(); if (near || items.length < 3) th.scrollTop = th.scrollHeight;
        };
        unsubM?.(); unsubM = st.watchMessages(cid, (list) => { ms = list; paintThread(); });
        paintThread();
      };
      const refresh = () => {
        // A conversation opened from the admin console belongs to the Faxton inbox. If the list hasn't brought it yet, fetch it directly.
        if (staff && cid && !mine.some((x) => x.id === cid) && !team.some((x) => x.id === cid) && !fetched.has(cid)) { fetched.add(cid); st.getConversation(cid).then((c) => { if (c && c.byStaff === me) { dms = [c, ...dms.filter((x) => x.id !== c.id)]; merge(); refresh(); } else if (c && c.listingId === "direct") { team = [c, ...team.filter((x) => x.id !== c.id)]; refresh(); } }); }
        if (staff && cid && mode === "personal" && !mine.some((x) => x.id === cid) && team.some((x) => x.id === cid)) { mode = "faxton"; try { sessionStorage.setItem("msgMode", mode); } catch {} drawSide(); } else if ($("#convs")) { drawList(); } else drawSide();
        drawChat();
      };
      const unsubC = st.watchConversations(ctx.S.user, (c) => { base = c; merge(); refresh(); });
      const unsubD = staff ? st.watchStaffDMs(me, (c) => { dms = c; merge(); refresh(); }) : null;
      const unsubT = staff ? st.watchStaffConversations((c) => { team = c.length || !team.length ? c : team; teamErr = false; refresh(); }, () => { teamErr = true; refresh(); }) : null;
      const unsubL = CALLS.watchLogs(me, (l) => { calls = l; if ($("#convs")) drawList(); else drawSide(); paintThread(); });
      drawSide(); drawChat();
      ctx.S.cleanups.push(() => { unsubC(); unsubD?.(); unsubT?.(); unsubL(); unsubM?.(); drawChat.offDoc?.(); drawChat.stopAudio?.(); });
    } };
}

// ---------- settings ----------
const SET_NAV = [["profile", "user", "Profile"], ["account", "shield", "Account and security"], ["notifications", "bell", "Notifications"], ["privacy", "lock", "Privacy"], ["appearance", "monitor", "Appearance"], ["help", "help", "Help and app"]];
const SET_TITLE = { profile: ["Profile", "Your details, photo and what you’re looking for."], account: ["Account and security", "How you sign in, and keeping your account safe."], notifications: ["Notifications", "Choose which alerts you see in the app."], appearance: ["Appearance", "Pick how Faxton Rentals looks on this device."], privacy: ["Privacy", "Decide what agents can see, and ask for your data."], help: ["Help and app", "Answers, the quick tour and app updates."] };
const BUD = [["", "No preference"], ["0-2000000", "Up to ₦2,000,000"], ["2000000-4000000", "₦2,000,000 to ₦4,000,000"], ["4000000-6000000", "₦4,000,000 to ₦6,000,000"], ["6000000-0", "₦6,000,000 and above"]];
const NOTIFY = [["messages", "mail", "New messages", "When an agent or owner replies to you."], ["viewings", "cal", "Viewing updates", "Confirmations, changes and reminders for your viewings."], ["applications", "doc", "Application updates", "When the status of an application changes."], ["payments", "wallet", "Payment updates", "When a payment you sent is confirmed or needs attention."], ["offers", "tag", "Offers", "Replies and counter-offers on your rent offers."]];
const PRIVACY = [["sharePhone", "phone", "Share my phone number", "Let agents I message see my phone number."], ["sharePrefs", "sliders3", "Share my rental preferences", "Help agents suggest homes that suit you."]];
const sw = (g, k, on, label) => `<button type="button" class="switch ${on ? "on" : ""}" role="switch" aria-checked="${!!on}" data-sw="${g}.${k}" aria-label="${esc(label || k)}"><i></i></button>`;
const swRow = (g, k, ic, t, d, on) => `<div class="rf-sw"><span class="rf-sw-ic">${icon(ic, 20, 1.7)}</span><div><b>${t}</b><p>${d}</p></div>${sw(g, k, on, t)}</div>`;
const themeCards = (pref) => `<div class="rf-theme" role="radiogroup" aria-label="Theme">${[["light", "sun", "Light"], ["dark", "moon", "Dark"], ["system", "monitor", "Match my device"]].map(([k, i, l]) => `<button type="button" class="${pref === k ? "on" : ""}" role="radio" aria-checked="${pref === k}" data-theme-pref="${k}"><span class="rf-theme-prev ${k}"><i></i><i></i><i></i></span>${icon(i, 20, 1.6)}<b>${l}</b><em class="rf-rd"></em></button>`).join("")}</div>`;

function settings(ctx, section) {
  const u = ctx.S.user, p = ctx.S.profile || {}, role = ctx.S.isOwner ? "owner" : ctx.S.role;
  if (!SET_TITLE[section]) section = "profile";
  const notify = { messages: true, viewings: true, applications: true, payments: true, offers: true, ...(p.notify || {}) }, privacy = { sharePhone: false, sharePrefs: true, ...(p.privacy || {}) };
  const pr = p.prefs || {}, name = u.displayName || p.name || "", pwd = u.providerData.some((x) => x.providerId === "password"), google = u.providerData.some((x) => x.providerId === "google.com");
  const verified = `<span class="rf-pill ${u.emailVerified ? "ok" : "warn"}"><i></i>${u.emailVerified ? "Verified" : "Not verified"}</span>`;
  const nav = `<aside class="rf-set-nav" aria-label="Settings sections"><h2>Settings</h2><div class="rf-set-links">${SET_NAV.map(([k, ic, l]) => `<a class="${k === section ? "on" : ""}" href="#/settings/${k}" ${k === section ? 'aria-current="page"' : ""}>${icon(ic, 20)}<span>${l}</span></a>`).join("")}</div><button type="button" id="out" class="rf-set-out">${icon("logout", 20)}<span>Sign out</span></button></aside>`;
  const card = (t, sub, inner, cls = "") => `<section class="rf-card ${cls}"><div class="rf-card-h"><div><h3>${t}</h3>${sub ? `<p>${sub}</p>` : ""}</div></div>${inner}</section>`;
  const shell = APPS.shellInfo(), autoUpd = !!pr.autoUpdate;
  const updCard = card("App updates", shell ? `You’re using the ${shell.platform.startsWith("mac") ? "Mac" : shell.platform === "windows" ? "Windows" : shell.platform === "android" ? "Android" : "iPhone"} app, version ${esc(shell.version)}.` : "On the web you always get the newest version automatically. Installed apps can update themselves too.",
    `<div class="rf-sw first"><span class="rf-sw-ic">${icon("download", 20, 1.7)}</span><div><b>Automatic updates</b><p>Download new versions as soon as they’re ready.</p></div><button type="button" class="switch ${autoUpd ? "on" : ""}" role="switch" aria-checked="${autoUpd}" id="autoUpd" aria-label="Automatic updates"><i></i></button></div>${shell ? `<div class="rf-actions"><button class="btn" id="chkUpd">Check for updates</button></div>` : ""}`);
  const apCard = card("Theme", "Choose how Faxton Rentals looks on your device.", themeCards(ctx.themePref()));
  const ntCard = card("Alerts", "These show up in the bell and as banners in the app. We don’t send marketing email.", NOTIFY.map(([k, ic, t, d], i) => swRow("notify", k, ic, t, d, notify[k]).replace('class="rf-sw"', i ? 'class="rf-sw"' : 'class="rf-sw first"')).join(""));
  const avatar = p.photo ? `<img class="rf-avatar" src="${esc(p.photo)}" alt="">` : `<span class="rf-avatar">${esc(initials(name || u.email))}</span>`;
  let body;
  if (section === "profile") body = `<form id="pf" class="rf-col" novalidate>
      ${card("Your profile", "", `<div class="rf-pd"><div class="rf-avwrap">${avatar}<button type="button" class="rf-avcam" id="photoBtn" aria-label="Change photo">${icon("camera", 16)}</button><input type="file" id="photo" accept="image/*" hidden></div><div><b class="rf-pd-name">${esc(name || "Your name")}</b><p class="rf-meta">${esc(u.email)}</p><div class="rf-pd-btns"><button type="button" class="btn sm" id="photoBtn2">${icon("camera", 15)} ${p.photo ? "Change photo" : "Add a photo"}</button>${p.photo ? `<button type="button" class="btn sm ghost" id="photoRm">Remove</button>` : ""}</div></div></div>
        <div class="rf-form"><div class="rf-grid2"><label class="rf-fl">Full name<input id="nm" value="${esc(name)}" autocomplete="name" maxlength="120"></label>
          <label class="rf-fl">Email address<span class="rf-input-wrap"><input value="${esc(u.email)}" disabled>${verified.replace('class="rf-pill', 'class="rf-tag rf-pill')}</span></label>
          <label class="rf-fl">Phone number<input id="ph" type="tel" inputmode="tel" placeholder="e.g. 0803 000 0000" value="${esc(p.phone || "")}" autocomplete="tel" maxlength="30"></label>
          <label class="rf-fl">About you <span class="rf-help">Shown on your profile card</span><input id="ab" maxlength="160" placeholder="A short line about you" autocomplete="off"></label>
          <label class="rf-fl">Country of residence<select id="lcc">${countryOptions(p.country || "Nigeria")}</select></label><label class="rf-fl">City<input id="lct" maxlength="60" value="${esc(p.city || "")}" placeholder="e.g. Lagos" autocomplete="address-level2"></label></div>
        <p class="rf-meta">Your phone number is only shared when you choose. See Privacy.</p></div>`)}
      ${card("Rental preferences", "Helps us show you homes that fit.", `<div class="rf-grid3"><label class="rf-fl">Where<select id="pl">${AREAS.filter((a) => a[0]).map(([c, l]) => `<option value="${c}" ${c === (pr.area || "lekki") ? "selected" : ""}>${l}</option>`).join("")}</select></label>
        <label class="rf-fl">Home type<select id="pt"><option value="">Any type</option>${typeOptions(pr.type)}</select></label>
        <label class="rf-fl">Yearly budget<select id="pb">${BUD.map(([v, l]) => `<option value="${v}" ${v === (pr.budget || "") ? "selected" : ""}>${l}</option>`).join("")}</select></label></div>`)}
      <p class="rf-err" id="perr" role="alert"></p>
      <div class="rf-actions" style="margin:0"><button class="btn primary" type="submit">Save changes</button><button class="btn ghost" type="button" id="cancel">Discard</button></div></form>`;
  else if (section === "account") body = `<div class="rf-col">${card("Sign-in", "", `<div class="rf-kv"><div><span>Email</span><b class="rf-kv-em">${esc(u.email)} ${verified}</b></div><div><span>Account type</span><b style="text-transform:capitalize">${esc(role)}</b></div><div><span>Sign-in method</span><b>${u.providerData.map((x) => (x.providerId === "google.com" ? "Google" : "Email and password")).join(", ")}</b></div></div>
      ${!u.emailVerified && pwd ? `<div class="rf-actions"><button class="btn" id="resendV">Resend verification email</button></div>` : ""}`)}
      <div id="lockCard"></div>
      ${pwd ? card("Password", "Change it with a secure link we email to you. Nobody can see or read your password, not even us.", `<div class="rf-actions" style="margin-top:0"><button class="btn" id="resetPw">${icon("mail", 17)} Email me a password reset link</button></div><p class="rf-meta" id="resetNote" style="margin-top:10px"></p>`) : card("Password", "", `<p class="rf-muted">You sign in with Google, so there’s no Faxton password. To change how you sign in, manage your Google account.</p>`)}
      ${card("Signed in on other devices?", "", `<p class="rf-muted" style="margin:0 0 12px">Sign out here at any time. If you think someone else has access, reset your password: that signs your account out on your other devices.${google && !pwd ? " For a Google account, also review security in your Google account." : ""}</p><div class="rf-actions" style="margin-top:0"><button class="btn" id="out2">${icon("logout", 17)} Sign out on this device</button>${pwd ? `<button class="btn" id="resetPw2">Reset password to sign out other devices</button>` : ""}</div>`)}
      ${(() => { const d = ctx.S.profile?.deletion; return d?.status === "pending" ? card("Account deletion requested", "", `<p class="rf-muted" style="margin:0 0 12px">You asked to delete your account on ${new Date(d.requestedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}. Our team reviews every request, which takes about a day. Nothing is deleted until then, and you can cancel now.</p><div class="rf-actions" style="margin-top:0"><button class="btn" id="cancelDel">Cancel deletion</button></div>`, "rf-danger") : d?.status === "approved" ? card("Account scheduled for deletion", "", `<p class="rf-muted" style="margin:0">Your request was approved. Your account will be removed the next time it’s opened after the one-day review period ends.</p>`, "rf-danger") : card("Delete account", "Remove your account and its data.", `<p class="rf-muted" style="margin:0 0 12px">Our team reviews every request, which takes about a day, and you can cancel before it’s approved. Some records, like payment confirmations, may be kept where the law requires.</p><div class="rf-actions" style="margin-top:0"><button class="btn red-o" id="delAcct">${icon("trash", 17)} Delete my account</button></div>`, "rf-danger"); })()}
      ${ctx.S.isAdmin ? card("Admin console", "Manage listings, users, applications and viewings.", `<div class="rf-actions" style="margin-top:0"><a class="btn" href="#/admin">Open admin console</a></div>`) : ""}</div>`;
  else if (section === "notifications") body = `<div class="rf-col">${ntCard}<p class="rf-meta">Saved to your account as you switch them. Important account and security messages are always sent.</p></div>`;
  else if (section === "appearance") body = `<div class="rf-col">${apCard}</div>`;
  else if (section === "privacy") body = `<div class="rf-col">${card("What agents can see", "Your contact details are only shared when you choose.", PRIVACY.map(([k, ic, t, d], i) => swRow("privacy", k, ic, t, d, privacy[k]).replace('class="rf-sw"', i ? 'class="rf-sw"' : 'class="rf-sw first"')).join(""))}
      ${card("Your data", "Under Nigeria’s data protection law you can ask to see, correct or delete the personal data we hold about you.", `<div class="rf-actions" style="margin-top:0"><button class="btn" id="dataReq">${icon("download", 17)} Ask for a copy of my data</button><a class="btn ghost" href="#/privacy">Read the Privacy Policy</a></div>`)}</div>`;
  else body = `<div class="rf-col">${card("Quick answers", "", `<div class="rf-actions" style="margin-top:0"><a class="btn primary" href="#/help">${icon("help", 17)} Open the Help centre</a></div>`)}
      ${card("Product tour", "Replay the quick tour of Faxton Rentals.", `<div class="rf-actions" style="margin-top:0"><button class="btn" id="tour">Replay tour</button></div>`)}
      ${updCard}${card("Install the app", "Add Faxton Rentals to your home screen or desktop.", `<div class="rf-actions" style="margin-top:0"><button class="btn" id="install">Install</button><a class="btn" href="#/download">All download options</a></div><p class="rf-meta" style="margin-top:10px">App version ${BUILD}</p>`)}</div>`;
  const [h1, sub] = SET_TITLE[section];
  return { title: "Settings", html: `<div class="rf-set">${nav}<div class="rf-set-main"><div class="rf-set-head"><div><h1 class="rf-h1">${h1}</h1><p class="rf-sub">${sub}</p></div><button type="button" class="back-btn" data-back aria-label="Go back">${icon("left", 18)} Back</button></div>${body}</div></div>`,
    mount() {
      const save = async (patch, msg = "Saved.") => { try { await st.saveProfile(u.uid, patch); ctx.S.profile = { ...(ctx.S.profile || {}), ...patch }; toast(msg); } catch (x) { toast(fxErr(x)); throw x; } };
      const lk = $("#lockCard"); if (lk) LOCK.mountCard(lk, ctx.S.user, ctx.logout);
      const del = $("#delAcct"); if (del) del.onclick = () => { const m = modal(`<div class="rf-dlg"><h2>Delete your account?</h2><p class="rf-dlg-p">Our team reviews deletion requests, which takes about a day. Your saved homes, messages and details are removed once it’s approved. You can cancel before then.</p><label class="rf-fl">Type <b>DELETE</b> to confirm<input id="dc" autocomplete="off"></label><div class="rf-dlg-act"><button class="btn" id="dcNo">Keep my account</button><button class="btn red" id="dcYes" disabled>Request deletion</button></div></div>`);
        $("#dc", m.el).oninput = (e) => ($("#dcYes", m.el).disabled = e.target.value.trim() !== "DELETE"); $("#dcNo", m.el).onclick = () => m.close();
        $("#dcYes", m.el).onclick = async () => { try { const d = { status: "pending", requestedAt: Date.now() }; await st.setDeletion(u.uid, d); ctx.S.profile = { ...(ctx.S.profile || {}), deletion: d }; m.close(); toast("Request sent. We’ll review it within about a day."); ctx.render(); } catch (x) { toast(fxErr(x)); } }; };
      const cd = $("#cancelDel"); if (cd) cd.onclick = async () => { try { await st.setDeletion(u.uid, null); const p2 = { ...(ctx.S.profile || {}) }; delete p2.deletion; ctx.S.profile = p2; toast("Deletion cancelled."); ctx.render(); } catch (x) { toast(fxErr(x)); } };
      const signOut = async () => { if (await ctx.confirmSignOut()) { await ctx.logout(); ctx.go("#/login"); } };
      $("#out").onclick = signOut; const o2 = $("#out2"); if (o2) o2.onclick = signOut;
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
          const ph = $("#ph").value.trim(); if (ph && !/^[+\d][\d\s-]{6,}$/.test(ph)) return (err.textContent = "That phone number doesn’t look right. Use digits, like 0803 000 0000.");
          const btn = pf.querySelector("button[type=submit]"); btn.disabled = true;
          try { await updateProfile(auth.currentUser, { displayName: nm }); const city = $("#lct").value.trim(), country = $("#lcc").value, about = ($("#ab")?.value || "").trim();
            await save({ name: nm, phone: ph, country, city, location: `${city}${city ? ", " : ""}${country}`, prefs: { ...(ctx.S.profile?.prefs || {}), area: $("#pl").value, type: $("#pt").value, budget: $("#pb").value } }, "Profile saved.");
            st.syncPublic(ctx.S.user.uid, { name: nm, about, city, country, ...(ctx.S.profile?.photo ? { photo: ctx.S.profile.photo } : {}) }); ctx.render(); } catch {} finally { btn.disabled = false; }
        };
        const pick = () => $("#photo").click(); $("#photoBtn").onclick = pick; $("#photoBtn2").onclick = pick;
        $("#photo").onchange = async (e) => {
          const f = e.target.files[0]; e.target.value = ""; if (!f) return;
          try { const data = await shrinkImage(f, { square: 192, bytes: 40000 }); await save({ photo: data }, "Photo updated."); st.syncPublic(ctx.S.user.uid, { photo: data }); ctx.render(); } catch (x) { if (x.userMessage) toast(x.userMessage); }
        };
        const rm = $("#photoRm"); if (rm) rm.onclick = async () => { try { await save({ photo: "" }, "Photo removed."); st.syncPublic(ctx.S.user.uid, { photo: "" }); ctx.render(); } catch {} };
      }
      const rs = $("#resendV"); if (rs) rs.onclick = async () => { try { await ctx.resendVerification(); toast("Verification email sent."); } catch (x) { toast(fxErr(x)); } };
      const resetPw = async (b) => { b.disabled = true; try { await ctx.resetPassword(u.email); toast("Check your email for the reset link."); const n = $("#resetNote"); if (n) n.textContent = `We sent a link to ${u.email}. It can take a minute, so check spam too.`; let s = 45; const t = setInterval(() => { s--; b.textContent = s > 0 ? `Sent. Resend in ${s}s` : "Email me a password reset link"; if (s <= 0) { clearInterval(t); b.disabled = false; } }, 1000); ctx.S.cleanups.push(() => clearInterval(t)); } catch (x) { toast(fxErr(x)); b.disabled = false; } };
      const rp = $("#resetPw"); if (rp) rp.onclick = () => resetPw(rp);
      const rp2 = $("#resetPw2"); if (rp2) rp2.onclick = async () => { rp2.disabled = true; try { await ctx.resetPassword(u.email); toast("Check your email for the reset link."); } catch (x) { toast(fxErr(x)); } rp2.disabled = false; };
      const dr = $("#dataReq"); if (dr) dr.onclick = async () => { if (!(await ask({ title: "Ask for a copy of your data?", body: "We’ll open a support request. Our team replies by email, usually within a few days.", ok: "Send request", no: "Not now" }))) return; try { await st.addTicket(u, { subject: "Data request", message: "Please send me a copy of the personal data you hold about me (Nigeria Data Protection Act 2023)." }); toast("Request sent. We’ll reply by email."); } catch (x) { toast(fxErr(x)); } };
      const tr = $("#tour"); if (tr) tr.onclick = () => { ctx.resetTour(u); const h = "#" + ctx.dashHome(); ctx.go(h); };
      const ins = $("#install"); if (ins) ins.onclick = async () => { if (ctx.canInstall()) return void (await ctx.installApp()); ctx.go("#/download"); };
    } };
}

// ---------- admin ----------
// The console is a set of modules loaded only for staff: ax.js (components), ax-list.js (list + drawer), admin2.js (pages), dash.js (dashboards).
async function admin(ctx, sub) {
  if (!ctx.S.isAdmin) return { title: "Admin", html: `<div class="empty"><h2>Admin access required</h2><p>Your account isn’t an administrator. Ask the owner to promote your account.</p><p style="margin-top:14px"><a class="btn" href="#/">Back home</a></p></div>` };
  if (sub === "get-app") return APPS.installationsPage(ctx);
  return (await import("./admin2.js")).route(ctx, sub);
}
