import { auth } from "./firebase.js";
import { updateProfile } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { $, $$, esc, naira, short, icon, logo, logoMark, initials, toast, modal, friendlyErr } from "./ui.js";
import * as st from "./store.js";

export const splashMark = () => logoMark();
const GOOGLE = `<svg class="gicon" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.500c3.500 0 6.600 1.200 9.100 3.600l6.800-6.800C35.800 2.400 30.300 0 24 0 14.600 0 6.500 5.400 2.600 13.200l7.900 6.100C12.400 13.600 17.700 9.500 24 9.500z"/><path fill="#4285F4" d="M46.500 24.500c0-1.600-.1-3.100-.4-4.500H24v9h12.700c-.6 3-2.300 5.500-4.800 7.200l7.500 5.800c4.400-4.100 7.100-10.100 7.100-17.500z"/><path fill="#FBBC05" d="M10.500 28.700A14.500 14.500 0 019.500 24c0-1.600.3-3.200.8-4.700l-7.900-6.100A24 24 0 000 24c0 3.900.9 7.500 2.600 10.800l7.900-6.100z"/><path fill="#34A853" d="M24 48c6.500 0 11.900-2.100 15.900-5.800l-7.500-5.800c-2.100 1.400-4.800 2.300-8.400 2.300-6.300 0-11.600-4.100-13.500-9.800l-7.900 6.100C6.500 42.600 14.600 48 24 48z"/></svg>`;
const AREAS = [["lekki", "Lekki, Lagos"], ["ajah", "Ajah, Lagos"], ["yaba", "Yaba, Lagos"], ["victoria", "Victoria Island, Lagos"], ["ikate", "Ikate, Lagos"], ["", "All of Lagos"]];
const BUDGETS = [[0, "Any price"], [1500000, "Up to ₦1.5m"], [2500000, "Up to ₦2.5m"], [3600000, "Up to ₦3.6m"], [5000000, "Up to ₦5m"]];
const TYPES = ["Apartment", "House", "Studio"];
const opts = (list, sel) => list.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(sel) ? "selected" : ""}>${esc(l)}</option>`).join("");
const fmtDate = (s) => { const d = new Date(s); return isNaN(d) ? s : d.toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long" }); };
const fmtTime = (t) => (t?.toDate ? t.toDate() : new Date()).toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" });
const bedsLabel = (n) => (n === 0 ? "Studio" : `${n} bed${n > 1 ? "s" : ""}`);
const rel = (t) => { const s = t?.seconds; if (!s) return "Just now"; const h = (Date.now() / 1000 - s) / 3600; return h < 1 ? "Just now" : h < 24 ? `${Math.floor(h)} hours ago` : `${Math.floor(h / 24)} day${h >= 48 ? "s" : ""} ago`; };
const statusPill = (s) => `<span class="pill ${/pending|review|requested|awaiting/i.test(s) ? "warn" : /flag|reject|cancel/i.test(s) ? "bad" : ""}">${esc(s)}</span>`;

// ---------- cards ----------
const card = (l, saved, rc) => `<article class="card ${rc ? "rcard" : ""}" data-open="${esc(l.id)}" tabindex="0" aria-label="${esc(l.title)}">
  <div class="card-img"><img src="${esc(l.thumb || l.images[0])}" alt="${esc(l.title)}" loading="lazy"><span class="tag">Available</span>
    <button class="heart ${saved.has(l.id) ? "on" : ""}" data-fav="${esc(l.id)}" aria-label="Save ${esc(l.title)}" aria-pressed="${saved.has(l.id)}">${icon("heart", 20)}</button></div>
  <div class="card-body"><h3>${esc(l.title)}</h3><div class="loc">${icon("pin", 16)}${esc(l.area)}${rc ? "" : ", " + esc(l.city)}</div>
    ${rc ? `<div class="card-foot"><div class="facts"><span>${icon("bed", 18)}${bedsLabel(l.beds)}</span><span>${icon("bath", 18)}${l.baths} bath${l.baths > 1 ? "s" : ""}</span></div><div class="price">${naira(l.price)}<br><small>per year</small></div></div>`
    : `<div class="card-foot"><div class="price">${naira(l.price)} <small>/ year</small></div><div class="facts"><span>${icon("bed", 18)}${bedsLabel(l.beds)}</span><span>${icon("bath", 18)}${l.baths} bath${l.baths > 1 ? "s" : ""}</span></div></div>`}</div></article>`;

function bindCards(root, ctx) {
  $$("[data-fav]", root).forEach((b) => (b.onclick = async (e) => {
    e.stopPropagation(); const id = b.dataset.fav, on = !ctx.S.saved.has(id);
    b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); await ctx.setSaved(id, on);
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
  if (path === "/splash") return splash(ctx);
  if ((m = path.match(/^\/onboarding\/([123])$/))) return onboarding(ctx, +m[1]);
  if (path === "/login") return authPage(ctx, "login");
  if (path === "/signup") return authPage(ctx, "signup");
  if (path === "/") return discover(ctx);
  if (path === "/search") return search(ctx);
  if ((m = path.match(/^\/home\/([^/]+)$/))) return detail(ctx, decodeURIComponent(m[1]));
  if (path === "/saved") return saved(ctx);
  if (path === "/messages" || path.startsWith("/messages/")) return messages(ctx, decodeURIComponent(path.split("/")[2] || ""));
  if (path === "/bookings") return bookings(ctx);
  if (path === "/payments") return payments(ctx);
  if (path === "/settings") return settings(ctx);
  if (path === "/admin" || path.startsWith("/admin/")) return admin(ctx, path.split("/")[2] || "");
  return null;
}

// ---------- splash + onboarding ----------
function splash(ctx) {
  return { full: true, title: "Welcome", html: `<div class="splash"><img class="bg" src="img/splash-bld.webp" alt=""><div><div>${logoMark()}</div>
    <h1><b>Faxton</b> <span>Rentals</span></h1><p>Your next home starts here.</p></div><div class="dots"><i></i><i></i><i></i></div></div>`,
    mount() { const t = setTimeout(() => ctx.go("#/onboarding/1"), 2200); ctx.S.cleanups.push(() => clearTimeout(t)); $(".splash").onclick = () => ctx.go("#/onboarding/1"); } };
}
const markSeen = () => { try { localStorage.setItem("seen", "1"); } catch {} };
function onboarding(ctx, n) {
  const feat = (ic, t, d) => `<div class="feat"><div class="fi">${icon(ic, 28)}</div><div><b>${t}</b>${d ? `<span>${d}</span>` : ""}</div></div>`;
  const S = [
    { eye: "Find your space", h: "A home that<br>fits your life.", lead: "Explore rental homes across Nigeria, from your first apartment to your next family home.", img: "onb-house", alt: "Modern house in Lekki",
      f: [["search", "Search your favourite neighbourhoods"], ["sliders", "Filter by budget and bedrooms"], ["heart", "Save homes you love"]], float: "" },
    { eye: "See it for yourself", h: "Find a time.<br>Take a tour.", lead: "Speak with a realtor and book a viewing from their available times.", img: "onb-living", alt: "Bright living room",
      f: [["cal", "Choose an available slot", "See a realtor’s real-time availability and pick a time that works for you."], ["msg", "Chat before your visit", "Ask questions, get more details and confirm everything in chat."], ["list", "Keep track of your viewings", "All your scheduled and past viewings in one place."]],
      float: "" },
    { eye: "Settle in simply", h: "Your rental life,<br>organised.", lead: "Keep your applications, tenancy documents and conversations together in one place.", img: "onb-room", alt: "Furnished apartment",
      f: [["list", "Track rental applications", "See the status of all your applications in real time."], ["doc", "Access tenancy documents", "Store and view your agreements, receipts and important files."], ["msg", "Message your agent", "Chat with your agent easily, all in one place."]],
      float: "" },
  ][n - 1];
  const prog = `<div class="prog">${n === 1 ? `<b>01</b><span>/ 03</span>` : ""}${[1, 2, 3].map((i) => `<i class="${i <= n && (n === 1 ? i === 1 : n === 2 ? i === 2 : i === 3) ? "on" : ""}"></i>`).join("")}${n > 1 ? `<span>0${n} / 03</span>` : ""}</div>`;
  const next = n < 3 ? `<a class="btn primary" href="#/onboarding/${n + 1}">Continue ${icon("arrow", 20)}</a>` : `<a class="btn primary" href="#/signup">Create account</a>`;
  return { full: true, title: "Welcome", html: `<div class="onb"><header class="onb-top">${logo()}<a href="#/" data-skip class="skip" style="display:flex;gap:8px;align-items:center">Skip ${icon("arrow", 18)}</a></header>
    <div class="onb-body"><div><div class="eyebrow">${S.eye}</div><h1>${S.h}</h1><p class="lead">${S.lead}</p>${S.f.map((f) => feat(...f)).join("")}
      <div class="onb-foot" style="margin-top:26px">${prog}</div>
      <div class="onb-foot" style="margin-top:22px">${n > 1 ? `<a class="btn" href="#/onboarding/${n - 1}">${icon("left", 20)} Back</a>` : ""}${next}${n === 1 ? `<a href="#/login" style="border-bottom:2px solid var(--brand);font-weight:500">Sign in</a>` : ""}</div>
      ${n === 3 ? `<p class="muted" style="margin-top:12px">Already a member? <a class="link" href="#/login">Sign in</a></p>` : ""}</div>
    <div class="onb-img"><img src="img/${S.img}.webp" alt="${S.alt}">${S.float}</div></div></div>`,
    mount() { $$("[data-skip],a[href='#/signup'],a[href='#/login']").forEach((a) => a.addEventListener("click", markSeen)); } };
}

// ---------- login / signup ----------
function authPage(ctx, mode) {
  const login = mode === "login", next = ctx.q.next || "/";
  const field = (id, label, ic, ph, type = "text", extra = "") => `<div class="field"><label for="${id}">${label}</label><div class="input">${icon(ic, 20)}<input id="${id}" name="${id}" type="${type}" placeholder="${ph}" ${extra}>${type === "password" ? `<button type="button" class="eye" aria-label="Show password" style="border:0;background:none;color:var(--muted)">${icon("eye", 20)}</button>` : ""}</div></div>`;
  const html = login ? `<h1>Welcome back</h1><p class="sub">Sign in to find your next home.</p><form id="f" novalidate>
      ${field("email", "Email address", "mail", "Enter your email address", "email", 'autocomplete="email"')}${field("password", "Password", "lock", "Enter your password", "password", 'autocomplete="current-password"')}
      <div class="row-between check"><label><input type="checkbox" id="remember"> Remember me</label><a href="#" id="forgot" class="link" style="text-decoration:underline">Forgot password?</a></div>
      <div class="err" id="err" role="alert"></div><button class="btn primary block" type="submit">Sign in ${icon("arrow", 20)}</button></form>
      <div class="sep">or</div><button class="btn block" id="google">${GOOGLE} Continue with Google</button>
      <p style="text-align:center;margin-top:26px;color:var(--muted)">New to Faxton Rentals? <a class="link" href="#/signup">Create an account →</a></p>`
    : `<h1>Find your place with Faxton</h1><p class="sub">Create an account to get started.</p><div class="role" role="tablist"><button type="button" class="on" data-role="renter">I’m renting</button><button type="button" data-role="agent">I’m listing a home</button></div><form id="f" novalidate>
      ${field("name", "Full name", "user", "Your full name", "text", 'autocomplete="name"')}${field("email", "Email address", "mail", "you@example.com", "email", 'autocomplete="email"')}${field("password", "Password", "lock", "Create a password", "password", 'autocomplete="new-password"')}
      <p class="muted" style="margin:-8px 0 14px;font-size:.9rem">At least 8 characters</p>
      <div class="check" style="margin-bottom:16px"><label><input type="checkbox" id="terms"> I agree to the <a class="link" href="#/signup">Terms</a> and <a class="link" href="#/signup">Privacy Policy</a></label></div>
      <div class="err" id="err" role="alert"></div><button class="btn primary block" type="submit">Create account ${icon("arrow", 20)}</button></form>
      <div class="sep">or</div><button class="btn block" id="google">${GOOGLE} Continue with Google</button>
      <p style="text-align:center;margin-top:22px;color:var(--muted)">Already have an account? <a class="link" href="#/login">Sign in</a></p>`;
  return { full: true, title: login ? "Sign in" : "Create account", html: `<div class="auth ${login ? "" : "signup"}" style="${login ? "" : "grid-template-columns:1.05fr 1fr"}">
    <div class="auth-img" style="background-image:url(img/${login ? "login-hero" : "signup-hero"}.webp)">${logo()}<h2>${login ? "A fresh start begins here." : "Make room for what comes next."}</h2></div>
    <div class="auth-form"><div class="corner">${ctx.themeBtn()}</div>${html}</div></div>`,
    mount(root) {
      const err = $("#err"), form = $("#f"); let role = "renter";
      $$(".eye").forEach((b) => (b.onclick = () => { const i = b.previousElementSibling; i.type = i.type === "password" ? "text" : "password"; }));
      $$("[data-role]").forEach((b) => (b.onclick = () => { role = b.dataset.role; $$("[data-role]").forEach((x) => x.classList.toggle("on", x === b)); }));
      const run = async (fn, btn) => { err.textContent = ""; if (btn) btn.disabled = true; try { await fn(); ctx.go("#" + next); } catch (e) { err.textContent = friendlyErr(e); } finally { if (btn) btn.disabled = false; } };
      form.onsubmit = (e) => {
        e.preventDefault(); const v = Object.fromEntries(new FormData(form)); const btn = form.querySelector("button[type=submit]");
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email || "")) return (err.textContent = "Enter a valid email address.");
        if (login) { if (!v.password) return (err.textContent = "Enter your password."); return run(() => ctx.signIn(v.email, v.password), btn); }
        if (!v.name?.trim()) return (err.textContent = "Enter your full name.");
        if ((v.password || "").length < 8) return (err.textContent = "Password must be at least 8 characters.");
        if (!$("#terms").checked) return (err.textContent = "Please accept the Terms and Privacy Policy.");
        run(() => ctx.signUp(v.name.trim(), v.email, v.password, role), btn);
      };
      $("#google").onclick = (e) => run(ctx.signInGoogle, e.currentTarget);
      const f = $("#forgot"); if (f) f.onclick = async (e) => { e.preventDefault(); const em = $("#email").value; if (!em) return (err.textContent = "Enter your email above first."); try { await ctx.resetPassword(em); toast("Password reset email sent."); } catch (x) { err.textContent = friendlyErr(x); } };
    } };
}

// ---------- discover ----------
async function discover(ctx) {
  const list = await st.getListings(); const first = (ctx.S.user?.displayName || "").split(" ")[0];
  return { title: "Discover", html: `<section class="hero"><div><h1>Your next chapter<br>starts at home.</h1><p>${first ? `Welcome back, ${esc(first)}. ` : ""}Find a rental that feels right, in a neighbourhood you love.</p></div><img class="hero-img" src="img/hero.webp" alt="Modern home in Lagos"></section>
    <form class="searchbar" id="sb" role="search">
      <div class="sb-cell">${icon("pin", 28)}<label>Location<select name="area">${opts(AREAS, "lekki")}</select></label></div>
      <div class="sb-cell">${icon("home", 28)}<label>Property type<select name="type"><option value="">Any type</option>${TYPES.map((t) => `<option>${t}</option>`).join("")}</select></label></div>
      <div class="sb-cell">${icon("wallet", 28)}<label>Budget<select name="max">${opts(BUDGETS, 0)}</select></label></div>
      <button class="btn primary" style="padding:16px 34px">${icon("search", 20)} Search homes</button></form>
    <div class="sec-head"><h2>Recommended for you</h2><a class="link" href="#/search">View all →</a></div>
    <div class="cards">${list.slice(0, 3).map((l) => card(l, ctx.S.saved)).join("")}</div>`,
    mount(root) { bindCards(root, ctx); $("#sb").onsubmit = (e) => { e.preventDefault(); const p = new URLSearchParams(); new FormData(e.target).forEach((v, k) => v && v !== "0" && p.set(k, v)); ctx.go("#/search?" + p); }; } };
}

// ---------- search ----------
function loadLeaflet() {
  return window.L ? Promise.resolve() : new Promise((res, rej) => { const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"; s.onload = res; s.onerror = rej; document.head.append(s); });
}
async function search(ctx) {
  const q = ctx.q, all = await st.getListings(), view = q.view === "grid" ? "grid" : "map";
  const area = q.area || "", max = +q.max || 0, beds = +q.beds || 0, type = q.type || "", sort = q.sort || "recommended";
  let list = all.filter((l) => (!area || (l.area + " " + l.city).toLowerCase().includes(area)) && (!max || l.price <= max) && l.beds >= beds && (!type || l.type === type));
  if (sort === "low") list = [...list].sort((a, b) => a.price - b.price); if (sort === "high") list = [...list].sort((a, b) => b.price - a.price);
  const areaName = area ? AREAS.find((a) => a[0] === area)?.[1].replace(/, Lagos/, "") || "Lagos" : "Lagos";
  const chip = (k, label) => `<button class="chip" data-clear="${k}">${esc(label)} ${icon("x", 14)}</button>`;
  const chips = [area && chip("area", areaName), max && chip("max", BUDGETS.find((b) => b[0] === max)?.[1] || naira(max)), beds && chip("beds", beds + "+ beds"), type && chip("type", type)].filter(Boolean).join("") || chip("none", "Available now");
  return { title: "Search", html: `<div class="page-head"><div><h1 style="font-size:clamp(1.9rem,3.4vw,2.8rem)">Homes for rent in ${esc(areaName === "Lagos" ? "Lagos" : areaName)}</h1><p>${list.length} home${list.length === 1 ? "" : "s"} match your search</p></div>
      <div class="seg" role="group" aria-label="View"><button data-view="map" class="${view === "map" ? "on" : ""}">${icon("map", 18)} Map</button><button data-view="grid" class="${view === "grid" ? "on" : ""}">${icon("grid", 18)} Grid</button></div></div>
    <form class="filters" id="ff"><label class="fsel">${icon("pin", 18)}<select name="area" aria-label="Location">${opts(AREAS, area)}</select></label>
      <label class="fsel">${icon("wallet", 18)}<select name="max" aria-label="Budget">${opts(BUDGETS, max)}</select></label>
      <label class="fsel">${icon("bed", 18)}<select name="beds" aria-label="Bedrooms">${opts([[0, "Bedrooms"], [1, "1+"], [2, "2+"], [3, "3+"], [4, "4+"], [5, "5+"]], beds)}</select></label>
      <label class="fsel">${icon("home", 18)}<select name="type" aria-label="Property type"><option value="">Property type</option>${TYPES.map((t) => `<option ${t === type ? "selected" : ""}>${t}</option>`).join("")}</select></label>
      <label class="fsel sort"><span class="muted">Sort by</span><select name="sort" aria-label="Sort">${opts([["recommended", "Recommended"], ["low", "Price: low to high"], ["high", "Price: high to low"]], sort)}</select></label></form>
    <div class="chips">${chips}</div>
    ${list.length ? `<div class="results ${view === "grid" ? "grid-only" : ""}"><div class="cards">${list.map((l) => card(l, ctx.S.saved, true)).join("")}</div>${view === "map" ? '<div id="map" role="region" aria-label="Map of results"></div>' : ""}</div>` : `<div class="empty"><h3>No homes match your search</h3><p>Try widening your filters.</p><p style="margin-top:14px"><a class="btn" href="#/search">Reset filters</a></p></div>`}`,
    async mount(root) {
      bindCards(root, ctx);
      const nav = (patch) => { const p = new URLSearchParams(q); Object.entries(patch).forEach(([k, v]) => (v && v !== "0" ? p.set(k, v) : p.delete(k))); ctx.go("#/search?" + p); };
      $$("select", $("#ff")).forEach((s) => (s.onchange = () => nav({ [s.name]: s.value })));
      $$("[data-view]").forEach((b) => (b.onclick = () => nav({ view: b.dataset.view })));
      $$("[data-clear]").forEach((b) => (b.onclick = () => (b.dataset.clear === "none" ? 0 : nav({ [b.dataset.clear]: "" }))));
      if (view === "map" && list.length) try {
        await loadLeaflet(); if (!$("#map")) return; const map = L.map("map", { scrollWheelZoom: false }).setView([list[0].lat, list[0].lng], 12);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap contributors", maxZoom: 18 }).addTo(map);
        const pts = list.map((l) => { const m = L.marker([l.lat, l.lng], { icon: L.divIcon({ className: "", html: `<div class="pin">${short(l.price)}</div>`, iconSize: [0, 0] }), title: l.title }).addTo(map); m.on("click", () => ctx.go("#/home/" + l.id)); return [l.lat, l.lng]; });
        if (pts.length > 1) map.fitBounds(pts, { padding: [40, 40] }); ctx.S.cleanups.push(() => map.remove());
      } catch { const m = $("#map"); if (m) m.innerHTML = '<div class="empty">Map unavailable right now.</div>'; }
    } };
}

// ---------- detail ----------
async function detail(ctx, id) {
  const l = await st.getListing(id);
  if (!l) return { title: "Not found", html: `<div class="empty"><h2>This home isn’t available</h2><p><a class="link" href="#/search">Browse homes</a></p></div>` };
  const total = l.price + l.service + l.deposit, on = ctx.S.saved.has(l.id), A = { Parking: "car", "Water supply": "drop", Security: "shield", Balcony: "building" };
  const im = l.images, gal = im.length > 1 ? `<div class="gallery"><div><img src="${esc(im[0])}" alt="${esc(l.title)}"></div><div><img src="${esc(im[1])}" alt=""></div><div>${im[2] ? `<img src="${esc(im[2])}" alt="">` : ""}<button class="show-all" id="all">${icon("img", 18)} Show all photos</button></div></div>` : `<div class="gallery one"><div><img src="${esc(im[0])}" alt="${esc(l.title)}"></div></div>`;
  return { title: l.title, html: `<nav class="crumbs" aria-label="Breadcrumb"><a href="#/">Discover</a>${icon("chev", 14)}<a href="#/search">${esc(l.city)}</a>${icon("chev", 14)}<a href="#/search?area=${esc(l.area.split(/[ ,]/)[0].toLowerCase())}">${esc(l.area.split(",")[0].replace(" Phase 1", ""))}</a></nav>
    <div class="detail"><div><div class="d-head"><div><h1>${esc(l.title)}</h1><div class="loc" style="color:var(--text);margin-top:8px;font-size:1.05rem"><span style="color:var(--brand)">${icon("pin", 20)}</span>${esc(l.area)}, ${esc(l.city)}</div></div>
      <div style="display:flex;gap:10px"><button class="btn sm" id="save" style="border-color:var(--border);color:var(--text)">${icon("heart", 18)} <span>${on ? "Saved" : "Save"}</span></button><button class="btn sm" id="share" style="border-color:var(--border);color:var(--text)">${icon("share", 18)} Share</button></div></div>
      ${gal}<div class="facts-row"><div class="fact">${icon("bed", 22)}${l.beds === 0 ? "Studio" : l.beds + " bedroom" + (l.beds > 1 ? "s" : "")}</div><div class="fact">${icon("bath", 22)}${l.baths} bathroom${l.baths > 1 ? "s" : ""}</div><div class="fact">${icon("area", 22)}${l.sqm} m²</div></div>
      <h2 style="margin:28px 0 8px">About this home</h2><p class="muted" style="max-width:720px;font-size:1.05rem">${esc(l.desc)}</p><hr class="divider">
      <div style="display:flex;gap:26px;align-items:center;flex-wrap:wrap"><h2>Amenities</h2><div class="amen" style="margin:0">${l.amenities.map((a) => `<span>${icon(A[a] || "check", 22)}${esc(a)}</span>`).join("")}</div></div></div>
    <aside class="side-card"><div class="big-price">${naira(l.price)} <small>/ year</small></div><p class="muted">Annual payment</p>
      <div class="rows"><div><span>Rent</span><span>${naira(l.price)}</span></div><div><span>Service charge</span><span>${naira(l.service)}</span></div><div><span>Refundable deposit</span><span>${naira(l.deposit)}</span></div><div class="total"><span>Move-in total</span><span>${naira(total)}</span></div></div>
      <button class="btn primary block" id="apply" style="padding:15px">Apply to rent ${icon("arrow", 20)}</button><button class="btn block" id="view" style="padding:15px">${icon("cal", 20)} Book a viewing</button>
      <p class="muted" style="font-size:.9rem;display:flex;gap:8px">${icon("info", 18)}<span>Review the <a class="link" href="#/search" style="text-decoration:underline">terms</a> before making a payment.</span></p>
      <div class="agent"><img class="avatar" src="${esc(l.agent.avatar)}" alt=""><div><b style="color:var(--head);font-size:1.1rem">${esc(l.agent.name)}</b><p class="muted" style="margin-bottom:10px">Listing agent</p><button class="btn sm" id="msg">${icon("msg", 18)} Message agent</button></div></div></aside></div>`,
    mount() {
      const authed = (fn) => () => (ctx.S.user ? fn() : (toast("Please sign in first."), ctx.go("#/login?next=" + encodeURIComponent("/home/" + l.id))));
      $("#save").onclick = async () => { const n = !ctx.S.saved.has(l.id); await ctx.setSaved(l.id, n); $("#save span").textContent = n ? "Saved" : "Save"; };
      $("#share").onclick = async () => { const url = location.href; try { navigator.share ? await navigator.share({ title: l.title, url }) : (await navigator.clipboard.writeText(url), toast("Link copied.")); } catch {} };
      const all = $("#all"); if (all) all.onclick = () => modal(`<h2>${esc(l.title)}</h2><div class="lightbox">${im.map((s) => `<img src="${esc(s)}" alt="">`).join("")}</div>`);
      $("#msg").onclick = authed(async () => { try { const cid = await st.ensureConversation(ctx.S.user, l); ctx.go("#/messages/" + cid); } catch (e) { toast(friendlyErr(e)); } });
      const tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
      $("#view").onclick = authed(() => { const m = modal(`<h2>Book a viewing</h2><p class="muted" style="margin-bottom:16px">${esc(l.title)} · ${esc(l.area)}</p><form id="vf"><div class="field"><label for="vd">Date</label><input id="vd" type="date" min="${tomorrow}" value="${tomorrow}" required></div><div class="field">Time</div>
        <div class="slots">${["09:00 AM", "10:00 AM", "11:30 AM", "01:00 PM", "03:00 PM", "04:30 PM"].map((t, i) => `<label><input type="radio" name="slot" value="${t}" ${i === 1 ? "checked" : ""}><span>${t}</span></label>`).join("")}</div><div class="err" id="ve"></div><button class="btn primary block">Request viewing</button></form>`);
        $("#vf", m.el).onsubmit = async (e) => { e.preventDefault(); const b = e.target.querySelector("button"); b.disabled = true; try { await st.addViewing(ctx.S.user, l, $("#vd", m.el).value, new FormData(e.target).get("slot")); m.close(); toast("Viewing requested. We’ll confirm shortly."); ctx.go("#/bookings"); } catch (x) { $("#ve", m.el).textContent = friendlyErr(x); b.disabled = false; } }; });
      $("#apply").onclick = authed(() => { const m = modal(`<h2>Apply to rent</h2><p class="muted" style="margin-bottom:16px">${esc(l.title)} · Move-in total ${naira(total)}</p><form id="af"><div class="field"><label for="ad">Preferred move-in date</label><input id="ad" type="date" min="${tomorrow}" required></div><div class="err" id="ae"></div><button class="btn primary block">Submit application</button></form>`);
        $("#af", m.el).onsubmit = async (e) => { e.preventDefault(); const d = $("#ad", m.el).value; if (!d) return ($("#ae", m.el).textContent = "Choose a move-in date."); const b = e.target.querySelector("button"); b.disabled = true; try { await st.addApplication(ctx.S.user, l, d); m.close(); toast("Application submitted."); ctx.go("#/payments"); } catch (x) { $("#ae", m.el).textContent = friendlyErr(x); b.disabled = false; } }; });
    } };
}

// ---------- saved / bookings / payments ----------
async function saved(ctx) {
  const list = (await st.getListings()).filter((l) => ctx.S.saved.has(l.id));
  return { title: "Saved homes", html: `<div class="page-head"><div><h1>Saved homes</h1><p>${list.length} home${list.length === 1 ? "" : "s"} you love</p></div></div>${list.length ? `<div class="cards">${list.map((l) => card(l, ctx.S.saved)).join("")}</div>` : `<div class="empty"><h3>Nothing saved yet</h3><p>Tap the heart on any home to keep it here.</p><p style="margin-top:14px"><a class="btn primary" href="#/search">Browse homes</a></p></div>`}`, mount: (r) => bindCards(r, ctx) };
}
async function bookings(ctx) {
  const v = await st.myViewings(ctx.S.user);
  return { title: "Bookings", html: `<div class="page-head"><div><h1>Bookings</h1><p>Your scheduled and past viewings</p></div><a class="btn primary" href="#/search">Find a home</a></div><div class="panel">${v.length ? v.map((x) => `<div class="list-row"><img src="${esc(x.image)}" alt=""><div class="grow"><h3>${esc(x.title)}</h3><div class="loc">${icon("pin", 16)}${esc(x.area)}</div><p style="margin-top:6px;color:var(--head);font-weight:600">${icon("cal", 16)} ${esc(fmtDate(x.when))}, ${esc(x.slot)}</p></div>${statusPill(x.status)}</div>`).join("") : `<div class="empty">No viewings yet. Open a home and choose “Book a viewing”.</div>`}</div>` };
}
async function payments(ctx) {
  const a = await st.myApplications(ctx.S.user);
  return { title: "Payments", html: `<div class="page-head"><div><h1>Payments</h1><p>Rental applications and amounts due on move-in</p></div></div><div class="panel">${a.length ? a.map((x) => `<div class="list-row"><img src="${esc(x.image)}" alt=""><div class="grow"><h3>${esc(x.title)}</h3><div class="loc">${icon("pin", 16)}${esc(x.area)}</div><p class="muted" style="margin-top:6px">Move-in ${esc(fmtDate(x.moveIn))}</p></div><div style="text-align:right"><div class="price">${naira(x.amount)}</div>${statusPill(x.status)}</div></div>`).join("") : `<div class="empty">No applications yet.</div>`}</div><p class="muted">Online payments will be available once your application is approved.</p>` };
}

// ---------- messages ----------
async function messages(ctx, cid) {
  const html = `<div class="msg-shell ${cid ? "has-chat" : ""}"><section class="msg-list"><div class="msg-list-head"><h1>Messages</h1><a class="btn primary" href="#/search" aria-label="New conversation" style="width:48px;height:48px;padding:0">${icon("edit", 22)}</a></div>
    <div class="tabs"><button class="on">All (<span id="cnt">0</span>)</button></div><div id="convs"></div></section><section class="chat" id="chat"></section></div>`;
  return { title: "Messages", bare: true, html,
    mount() {
      let convs = [], unsubM = null;
      const drawList = () => { $("#cnt").textContent = convs.length; $("#convs").innerHTML = convs.length ? convs.map((c) => `<a class="conv ${c.id === cid ? "on" : ""}" href="#/messages/${esc(c.id)}"><img class="avatar" src="${esc(c.agent.avatar)}" alt=""><div class="conv-main"><div class="conv-top"><b>${esc(c.agent.name)}</b><span>${c.lastAt ? fmtTime(c.lastAt) : ""}</span></div><p>${esc(c.last || c.listingTitle)}</p></div></a>`).join("") : `<p class="muted" style="padding:14px">No conversations yet. Open a home and tap “Message agent”.</p>`; };
      const drawChat = () => {
        const c = convs.find((x) => x.id === cid); const chat = $("#chat");
        if (!c) { chat.innerHTML = `<div class="chat-empty"><h2>${convs.length ? "Select a conversation" : "No messages yet"}</h2><p style="margin-top:8px">Message a listing agent to start chatting.</p></div>`; return; }
        chat.innerHTML = `<div class="chat-head"><a class="icon-btn back" href="#/messages" aria-label="Back" style="display:none">${icon("left", 20)}</a><img class="avatar" src="${esc(c.agent.avatar)}" alt=""><div class="grow"><b style="font-size:1.3rem;color:var(--head)">${esc(c.agent.name)}</b><br><span class="muted">Listing agent</span></div><div class="acts">${["phone", "video", "search"].map((i) => `<button class="icon-btn" data-soon aria-label="${i}">${icon(i, 20)}</button>`).join("")}</div></div>
          <div class="listing-strip"><img src="${esc(c.image)}" alt=""><div><b style="color:var(--head);font-size:1.1rem">${esc(c.listingTitle)} · ${esc(c.area.split(" ")[0])}</b><br><span class="muted">${c.beds === 0 ? "Studio" : c.beds + " bed"} · ${c.baths} bath · ${naira(c.price)} / year</span></div><a class="btn sm" href="#/home/${esc(c.listingId)}">View home</a></div>
          <div class="thread" id="thread"></div><form class="composer" id="cf"><button type="button" class="icon-btn" data-soon aria-label="Attach" style="border:0;background:none">${icon("clip", 22)}</button><input id="ci" placeholder="Type a message…" autocomplete="off" aria-label="Message"><button class="send" aria-label="Send">${icon("send", 22)}</button></form>`;
        $$("[data-soon]", chat).forEach((b) => (b.onclick = () => toast("Coming soon.")));
        $("#cf").onsubmit = async (e) => { e.preventDefault(); const i = $("#ci"), t = i.value.trim(); if (!t) return; i.value = ""; try { await st.sendMessage(ctx.S.user, cid, t); } catch (x) { toast(friendlyErr(x)); i.value = t; } };
        unsubM?.(); unsubM = st.watchMessages(cid, (ms) => {
          const th = $("#thread"); if (!th) return; const near = th.scrollHeight - th.scrollTop - th.clientHeight < 80;
          th.innerHTML = ms.length ? `<span class="day">Today</span>` + ms.map((m) => `<div class="bubble ${m.from === ctx.S.user.uid ? "me" : ""}">${esc(m.text)}<time>${m.at ? fmtTime(m.at) : ""}</time></div>`).join("") : `<div class="chat-empty">Say hello to ${esc(c.agent.name.split(" ")[0])} 👋</div>`;
          if (near || ms.length < 2) th.scrollTop = th.scrollHeight;
        });
      };
      const unsubC = st.watchConversations(ctx.S.user, (c) => { convs = c; drawList(); if (!$("#chat").dataset.drawn || cid) { drawChat(); $("#chat").dataset.drawn = 1; } });
      ctx.S.cleanups.push(() => { unsubC(); unsubM?.(); });
      if (matchMedia("(max-width:860px)").matches) { const b = () => $(".back"); setTimeout(() => b() && (b().style.display = "grid")); }
    } };
}

// ---------- settings ----------
function settings(ctx) {
  const u = ctx.S.user, role = ctx.S.profile?.role || "renter";
  return { title: "Settings", html: `<div class="page-head"><div><h1>Settings</h1><p>Manage your account</p></div></div><div class="settings-grid">
    <div class="panel"><h3 style="margin-bottom:14px">Profile</h3><form id="pf"><div class="field"><label for="nm">Full name</label><input id="nm" value="${esc(u.displayName || "")}"></div><div class="field"><label>Email</label><input value="${esc(u.email)}" disabled></div>
      <div class="row-between"><span>Account type</span><span class="pill">${esc(role)}</span></div><button class="btn primary">Save changes</button></form></div>
    <div class="panel"><div class="row-between"><div><h3>Appearance</h3><p class="muted">Switch between light and dark mode</p></div>${ctx.themeBtn()}</div></div>
    ${role === "admin" ? `<div class="panel"><div class="row-between"><div><h3>Admin console</h3><p class="muted">Manage listings, users and applications</p></div><a class="btn" href="#/admin">Open</a></div></div>` : ""}
    <button class="btn" id="out" style="justify-self:start">${icon("logout", 18)} Sign out</button></div>`,
    mount() {
      $("#pf").onsubmit = async (e) => { e.preventDefault(); const name = $("#nm").value.trim(); try { await updateProfile(auth.currentUser, { displayName: name }); await st.saveProfile(u.uid, { name }); toast("Profile updated."); ctx.render(); } catch (x) { toast(friendlyErr(x)); } };
      $("#out").onclick = async () => { await ctx.logout(); ctx.go("#/login"); };
    } };
}

// ---------- admin ----------
async function admin(ctx, sub) {
  const isAdmin = ctx.S.profile?.role === "admin";
  if (!isAdmin) return { title: "Admin", html: `<div class="empty"><h2>Admin access required</h2><p>Your account isn’t an administrator. Set <code>role</code> to <code>admin</code> on your user document in Firestore.</p><p style="margin-top:14px"><a class="btn" href="#/">Back home</a></p></div>` };
  const [ls, apps, views, users] = await Promise.all([st.adminAll("listings"), st.adminAll("applications"), st.adminAll("viewings"), st.adminAll("users")]);
  const pending = ls.filter((l) => /pending|flag/i.test(l.status)), by = (a) => [...a].sort((x, y) => (y.createdAt?.seconds || 0) - (x.createdAt?.seconds || 0));
  const th = (x) => `<img class="th" src="${esc(x.images?.[0] || x.image || "img/palm-court.webp")}" alt="">`;
  const table = (head, rows) => `<div class="tbl-wrap"><table><thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.join("") || `<tr><td colspan="${head.length}" class="muted">Nothing here yet.</td></tr>`}</tbody></table></div>`;
  const lrow = (l) => `<tr><td><div class="cell">${th(l)}<div><b>${esc(l.title)}</b><small>${esc(l.area)}, ${esc(l.city)}</small></div></div></td><td><div class="cell"><img class="avatar" src="${esc(l.agent?.avatar || "")}" alt="">${esc(l.agent?.name || "")}</div></td><td>${statusPill(l.status === "pending" ? "Pending Review" : l.status === "flagged" ? "Flagged Review" : l.status)}</td><td><button class="btn primary sm" data-review="${esc(l.id)}">Review</button></td></tr>`;
  let body;
  if (sub === "") body = `<div class="page-head"><div><h1>Overview</h1><p>Here’s what needs your attention today.</p></div>${!ls.length ? `<button class="btn primary" id="seed">Add sample listings</button>` : ""}</div>
    <div class="stats"><div class="stat"><div class="ico">${icon("home", 30)}</div><div><span>Active listings</span><b>${ls.filter((l) => l.status === "active").length}</b></div></div><div class="stat"><div class="ico w">${icon("doc", 30)}</div><div><span>Pending reviews</span><b>${pending.length}</b></div></div><div class="stat"><div class="ico">${icon("users", 30)}</div><div><span>Applications</span><b>${apps.length}</b></div></div><div class="stat"><div class="ico r">${icon("cal", 30)}</div><div><span>Viewings requested</span><b>${views.length}</b></div></div></div>
    <div class="admin-grid"><div><div class="panel"><div class="panel-head"><h3>Listings awaiting approval</h3><a class="link" href="#/admin/listings">View all</a></div>${table(["Property", "Agent", "Status", "Action"], pending.slice(0, 5).map(lrow))}</div>
      <div class="panel"><div class="panel-head"><h3>Recent rental applications</h3><a class="link" href="#/admin/applications">View all</a></div>${table(["Applicant", "Property", "Status", "Submitted"], by(apps).slice(0, 5).map((a) => `<tr><td><b>${esc(a.name)}</b><small class="muted" style="display:block">${esc(a.email)}</small></td><td>${esc(a.title)}</td><td>${statusPill(a.status)}</td><td class="muted">${rel(a.createdAt)}</td></tr>`))}</div></div>
      <div><div class="panel"><h3 style="margin-bottom:8px">Needs attention</h3><div class="attn"><div class="ico">${icon("doc", 22)}</div><div class="grow"><b>${pending.length} listings to review</b><small>New submissions awaiting approval</small></div><a class="link" href="#/admin/listings">View →</a></div><div class="attn"><div class="ico">${icon("user", 22)}</div><div class="grow"><b>${apps.filter((a) => /review/i.test(a.status)).length} applications in review</b><small>Waiting for a decision</small></div><a class="link" href="#/admin/applications">View →</a></div></div>
      <div class="panel"><div class="panel-head"><h3>Recent activity</h3></div><ul class="timeline">${by([...apps.map((a) => ({ ...a, t: "Rental application submitted", s: a.title })), ...views.map((v) => ({ ...v, t: "Viewing requested", s: v.title }))]).slice(0, 5).map((e) => `<li><i></i><div class="grow"><b>${e.t}</b><small>${esc(e.s)}</small></div><small>${rel(e.createdAt)}</small></li>`).join("") || '<li class="muted">No activity yet.</li>'}</ul></div></div></div>`;
  else if (sub === "listings") body = `<div class="page-head"><h1>Listings</h1>${!ls.length ? `<button class="btn primary" id="seed">Add sample listings</button>` : ""}</div><div class="panel">${table(["Property", "Agent", "Status", "Action"], ls.map(lrow))}</div>`;
  else if (sub === "users") body = `<div class="page-head"><h1>Users</h1></div><div class="panel">${table(["Name", "Email", "Role"], users.map((u) => `<tr><td><b>${esc(u.name || "—")}</b></td><td>${esc(u.email)}</td><td><span class="pill">${esc(u.role)}</span></td></tr>`))}</div>`;
  else if (sub === "applications") body = `<div class="page-head"><h1>Rental applications</h1></div><div class="panel">${table(["Applicant", "Property", "Move-in", "Status", "Action"], by(apps).map((a) => `<tr><td><b>${esc(a.name)}</b><small class="muted" style="display:block">${esc(a.email)}</small></td><td>${esc(a.title)}</td><td>${esc(a.moveIn)}</td><td>${statusPill(a.status)}</td><td><select data-app="${esc(a.id)}" aria-label="Status">${["Under review", "Awaiting documents", "Approved", "Rejected"].map((s) => `<option ${s === a.status ? "selected" : ""}>${s}</option>`).join("")}</select></td></tr>`))}</div>`;
  else if (sub === "viewings") body = `<div class="page-head"><h1>Viewings</h1></div><div class="panel">${table(["Renter", "Property", "When", "Status", "Action"], by(views).map((v) => `<tr><td><b>${esc(v.name)}</b></td><td>${esc(v.title)}</td><td>${esc(fmtDate(v.when))}, ${esc(v.slot)}</td><td>${statusPill(v.status)}</td><td><select data-view="${esc(v.id)}" aria-label="Status">${["Requested", "Confirmed", "Completed", "Cancelled"].map((s) => `<option ${s === v.status ? "selected" : ""}>${s}</option>`).join("")}</select></td></tr>`))}</div>`;
  else body = `<div class="page-head"><h1 style="text-transform:capitalize">${esc(sub)}</h1></div><div class="empty panel">This section is coming soon.</div>`;
  return { title: "Admin", admin: true, pending: pending.length, html: body,
    mount(root) {
      const seed = $("#seed"); if (seed) seed.onclick = async () => { seed.disabled = true; try { await st.seedListings(); toast("Sample listings added."); ctx.render(); } catch (e) { toast(friendlyErr(e)); seed.disabled = false; } };
      $$("[data-review]", root).forEach((b) => (b.onclick = () => { const l = ls.find((x) => x.id === b.dataset.review); const m = modal(`<h2>${esc(l.title)}</h2><p class="muted" style="margin-bottom:14px">${esc(l.area)}, ${esc(l.city)} · ${naira(l.price)} / year</p><img src="${esc(l.images[0])}" alt="" style="width:100%;border-radius:12px;margin-bottom:14px"><p style="margin-bottom:18px">${esc(l.desc)}</p><div style="display:flex;gap:10px"><button class="btn primary" data-s="active">Approve</button><button class="btn" data-s="rejected">Reject</button></div>`);
        $$("[data-s]", m.el).forEach((x) => (x.onclick = async () => { try { await st.setStatus("listings", l.id, x.dataset.s); m.close(); toast("Listing updated."); ctx.render(); } catch (e) { toast(friendlyErr(e)); } })); }));
      $$("[data-app]", root).forEach((s) => (s.onchange = async () => { try { await st.setStatus("applications", s.dataset.app, s.value); toast("Status updated."); } catch (e) { toast(friendlyErr(e)); } }));
      $$("select[data-view]", root).forEach((s) => (s.onchange = async () => { try { await st.setStatus("viewings", s.dataset.view, s.value); toast("Status updated."); } catch (e) { toast(friendlyErr(e)); } }));
    } };
}
