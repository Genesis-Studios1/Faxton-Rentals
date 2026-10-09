// Smart Home Match: answer a few questions about your life and Faxton recommends homes, instead of endless filtering.
import { $, $$, esc, naira, icon, toast } from "./ui.js";
import * as st from "./store.js";
import { areaGuide, WORK, commute, moveIn } from "./area.js";

const KEY = "match_v1";
export const loadAnswers = () => { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; } };
const saveAnswers = (a) => { try { localStorage.setItem(KEY, JSON.stringify(a)); } catch {} };
const DEFAULT = { budget: 3600000, beds: 2, work: "", maxCommute: 60, hoods: [], power: "backup", security: "nice", furnished: "any", life: [] };
const BUDGETS = [1500000, 2500000, 3600000, 5000000, 8000000];
const LIFE = [["family", "Family with children", "home", "Space, a safe compound, schools nearby"], ["pro", "Young professional", "chart", "Easy commute and good restaurants"], ["remote", "Work from home", "chip", "Reliable power and a quiet place"], ["student", "Student", "cap", "Affordable and close to campus"], ["social", "Social and city life", "smile", "Close to nightlife and friends"], ["car", "I have a car", "car", "Parking at home"], ["pets", "I have a pet", "heart", "A compound or garden"]];

// ---- scoring ----
const hasAm = (l, re) => (l.amenities || []).some((a) => re.test(a));
const backup = (l) => hasAm(l, /generator|solar|inverter|power|electric/i);
const secure = (l) => hasAm(l, /secur|guard|cctv|gate/i);
const clamp = (x) => Math.max(0, Math.min(1, x));
export function scoreHome(l, a) {
  const g = areaGuide(l), reasons = [], flags = [], parts = {};
  // budget (annual rent)
  if (l.price <= a.budget) { parts.budget = l.price < a.budget * 0.55 ? 0.9 : 1; reasons.push(l.price <= a.budget * 0.85 ? `${naira(a.budget - l.price)} under your budget` : "Within your budget"); }
  else { parts.budget = clamp(1 - (l.price - a.budget) / (a.budget * 0.15)) * 0.7; flags.push(`${naira(l.price - a.budget)} over your budget`); }
  // bedrooms
  const d = Math.abs((l.beds ?? 0) - a.beds); parts.beds = d === 0 ? 1 : d === 1 ? 0.6 : 0.15;
  if (d === 0) reasons.push(a.beds === 0 ? "A studio, as you wanted" : `${a.beds} bedroom${a.beds > 1 ? "s" : ""}, as you wanted`); else flags.push(`${l.beds === 0 ? "A studio" : l.beds + " bedroom" + (l.beds > 1 ? "s" : "")} (you asked for ${a.beds === 0 ? "a studio" : a.beds})`);
  // neighbourhood
  const key = String(l.area || "").toLowerCase();
  if (!a.hoods.length) parts.hood = 1; else if (a.hoods.some((h) => key.includes(h.toLowerCase()))) { parts.hood = 1; reasons.push(`In ${String(l.area).split(",")[0]}, one of your areas`); } else { parts.hood = 0.3; flags.push(`Not in your chosen areas`); }
  // commute
  const w = WORK.find((x) => x[0] === a.work), c = w ? commute(l, w) : null;
  if (!w) parts.commute = 1; else if (!c) parts.commute = 0.5; else if (c.peak <= a.maxCommute) { parts.commute = 1; reasons.push(c.km < 1.2 ? `Walkable to ${a.work}` : `About ${c.peak} min to ${a.work} at rush hour`); } else { parts.commute = c.peak <= a.maxCommute * 1.3 ? 0.55 : 0.15; flags.push(`About ${c.peak} min to ${a.work} at rush hour`); }
  // power
  const hasB = backup(l);
  if (a.power === "must") { parts.power = hasB || g.power >= 20 ? 1 : g.power >= 16 ? 0.5 : 0.1; if (parts.power === 1) reasons.push("Round-the-clock power"); else flags.push("No generator or solar listed"); }
  else if (a.power === "backup") { parts.power = hasB ? 1 : g.power >= 16 ? 0.7 : 0.3; if (hasB) reasons.push("Has backup power"); else if (parts.power < 0.7) flags.push("No backup power listed"); }
  else parts.power = 1;
  // security
  const sec = secure(l);
  if (a.security === "must") { parts.security = sec && g.security !== "poor" ? 1 : sec ? 0.7 : 0.2; if (sec) reasons.push("Secure, with guards or gates"); else flags.push("No security features listed"); }
  else if (a.security === "nice") { parts.security = sec ? 1 : 0.6; if (sec) reasons.push("Has security features"); }
  else parts.security = 1;
  // furnished
  const f = String(l.furnished || "").toLowerCase();
  if (a.furnished === "any") parts.furn = 1;
  else if (!f) parts.furn = 0.5;
  else { const want = a.furnished === "furnished" ? /^furnished|semi/ : /^unfurn/; parts.furn = want.test(f) ? (a.furnished === "furnished" && /semi/.test(f) ? 0.7 : 1) : 0.1; if (parts.furn >= 0.7) reasons.push(a.furnished === "furnished" ? "Comes furnished" : "Unfurnished, ready for your things"); else flags.push(`Listed as ${l.furnished.toLowerCase()}`); }
  // lifestyle
  const life = [];
  if (a.life.includes("family")) life.push(l.beds >= 3 ? 1 : l.beds === 2 ? 0.6 : 0.2, sec ? 1 : 0.5, /house|duplex|terrace|detached/i.test(l.type || "") ? 1 : 0.7);
  if (a.life.includes("pro")) life.push(["victoria", "ikoyi", "lekki", "yaba", "ikeja", "ikate"].some((k) => key.includes(k)) ? 1 : 0.5);
  if (a.life.includes("remote")) life.push(hasB ? 1 : 0.4, hasAm(l, /wi-?fi|internet/i) ? 1 : 0.7);
  if (a.life.includes("student")) life.push(l.price <= 2000000 ? 1 : l.price <= 3000000 ? 0.6 : 0.3);
  if (a.life.includes("social")) life.push(["victoria", "lekki", "yaba", "ikoyi", "oniru"].some((k) => key.includes(k)) ? 1 : 0.4);
  if (a.life.includes("car")) life.push(hasAm(l, /park/i) || +l.parking > 0 ? 1 : 0.2);
  if (a.life.includes("pets")) life.push(hasAm(l, /garden|compound/i) || /house|duplex|terrace|detached/i.test(l.type || "") ? 1 : 0.5);
  parts.life = life.length ? life.reduce((x, y) => x + y, 0) / life.length : 1;
  if (a.life.includes("car") && (hasAm(l, /park/i) || +l.parking > 0)) reasons.push("Parking included");
  if (a.life.includes("family") && l.beds >= 3) reasons.push("Room for the whole family");
  if (a.life.includes("remote") && hasB) reasons.push("Power for working from home");
  const W = { budget: 25, beds: 15, hood: 10, commute: 15, power: 10, security: 10, furn: 5, life: 10 };
  // Bedrooms and budget are the two things people rarely bend on, so a miss also scales the whole score down.
  const mult = (d === 0 ? 1 : d === 1 ? 0.9 : 0.65) * (l.price <= a.budget ? 1 : 0.85);
  const score = Math.round(Object.entries(W).reduce((s, [k, wt]) => s + wt * (parts[k] ?? 1), 0) * mult);
  return { score, reasons, flags, parts };
}
export function recommend(listings, a) {
  return listings.filter((l) => l.available !== false && l.price > 0 && l.price <= a.budget * 1.15)
    .map((l) => ({ l, ...scoreHome(l, a) })).sort((x, y) => y.score - x.score || x.l.price - y.l.price);
}
const verdict = (s) => (s >= 85 ? "Excellent match" : s >= 70 ? "Great match" : s >= 55 ? "Good match" : "Partial match");

// ---- the page ----
const Q = [
  { k: "budget", t: "What’s your yearly rent budget?", d: "The most you would pay in rent each year, before fees." },
  { k: "beds", t: "How many bedrooms do you need?", d: "We also show homes one bedroom either side." },
  { k: "work", t: "Where do you work or study?", d: "We estimate your rush-hour drive from each home." },
  { k: "hoods", t: "Which neighbourhoods do you like?", d: "Pick as many as you want, or leave it open." },
  { k: "power", t: "How much does power matter?", d: "Electricity is a big part of daily life in Lagos." },
  { k: "security", t: "And security?", d: "Guards, gates and CCTV." },
  { k: "furnished", t: "Furnished or unfurnished?", d: "" },
  { k: "life", t: "What does your life look like?", d: "Pick everything that fits." },
];
const opt = (on, val, title, sub = "", ic = "") => `<button type="button" class="mm-o ${on ? "on" : ""}" data-v="${esc(val)}" aria-pressed="${on}">${ic ? `<span class="mm-oi">${icon(ic, 22)}</span>` : ""}<span><b>${title}</b>${sub ? `<small>${sub}</small>` : ""}</span><i>${icon("check", 14, 3)}</i></button>`;
export async function matchPage(ctx) {
  const all = await st.getListings();
  const areaSet = []; all.forEach((l) => { const n = String(l.area || "").split(",")[0].trim(); if (n && !areaSet.includes(n)) areaSet.push(n); });
  let a = { ...DEFAULT, ...(loadAnswers() || {}) }, step = loadAnswers() && ctx.q.edit !== "1" ? Q.length : 0;
  return { title: "Smart Home Match", html: `<div class="wrap mm-pg"><div id="mm"></div></div>`, mount(root) {
    const box = $("#mm", root);
    const body = (k) => {
      if (k === "budget") return `<div class="mm-grid">${BUDGETS.map((b) => opt(a.budget === b, b, "Up to " + naira(b), b <= 1500000 ? "Studios and small flats" : b <= 2500000 ? "1 to 2 bedrooms" : b <= 3600000 ? "2 to 3 bedrooms" : b <= 5000000 ? "3 to 4 bedrooms" : "Large homes and houses")).join("")}</div><label class="mm-or">Or type your own<div class="of-in"><span>₦</span><input id="mmBud" inputmode="numeric" value="${BUDGETS.includes(a.budget) ? "" : a.budget.toLocaleString("en-NG")}" placeholder="e.g. 4,200,000"></div></label>`;
      if (k === "beds") return `<div class="mm-grid c5">${[[0, "Studio"], [1, "1 bed"], [2, "2 beds"], [3, "3 beds"], [4, "4+ beds"]].map(([v, t]) => opt(a.beds === v, v, t)).join("")}</div>`;
      if (k === "work") return `<label class="field">I work or study in<select id="mmWork"><option value="">I work from home / not sure</option>${WORK.map((w) => `<option ${a.work === w[0] ? "selected" : ""}>${w[0]}</option>`).join("")}</select></label><div id="mmCm" ${a.work ? "" : "hidden"}><p class="mm-sub">How long a rush-hour drive is okay?</p><div class="mm-grid c4">${[30, 45, 60, 90].map((m) => opt(a.maxCommute === m, m, m + " min")).join("")}</div></div>`;
      if (k === "hoods") return `<div class="mm-chips">${areaSet.map((n) => `<button type="button" class="mm-c ${a.hoods.includes(n) ? "on" : ""}" data-h="${esc(n)}" aria-pressed="${a.hoods.includes(n)}">${esc(n)}</button>`).join("")}</div><p class="muted" style="margin-top:12px">${a.hoods.length ? `${a.hoods.length} selected` : "Anywhere is fine."}</p>`;
      if (k === "power") return `<div class="mm-grid c1">${[["must", "24/7 power is a must", "Backup power or a strong grid area", "bolt"], ["backup", "A generator or solar is fine", "I just need power to be there", "chip"], ["any", "Not a concern", "", "check"]].map(([v, t, s, ic]) => opt(a.power === v, v, t, s, ic)).join("")}</div>`;
      if (k === "security") return `<div class="mm-grid c1">${[["must", "Must be secure", "Guards, a gate or CCTV", "shield"], ["nice", "Nice to have", "", "eye"], ["any", "Not a concern", "", "check"]].map(([v, t, s, ic]) => opt(a.security === v, v, t, s, ic)).join("")}</div>`;
      if (k === "furnished") return `<div class="mm-grid c1">${[["furnished", "Furnished", "Move in with your suitcase", "building"], ["unfurnished", "Unfurnished", "I’ll bring my own things", "home"], ["any", "No preference", "", "check"]].map(([v, t, s, ic]) => opt(a.furnished === v, v, t, s, ic)).join("")}</div>`;
      if (k === "life") return `<div class="mm-grid c1">${LIFE.map(([v, t, ic, s]) => opt(a.life.includes(v), v, t, s, ic)).join("")}</div>`;
    };
    const drawQ = () => {
      const q = Q[step], pct = Math.round((step / Q.length) * 100);
      box.innerHTML = `<div class="mm-card"><div class="mm-top"><button type="button" class="mm-back" id="mmBack" ${step ? "" : "hidden"}>${icon("left", 18)} Previous question</button><span class="mm-count">Question ${step + 1} of ${Q.length}</span></div><div class="mm-bar"><i style="width:${pct}%"></i></div>
        <h1>${q.t}</h1>${q.d ? `<p class="muted mm-d">${q.d}</p>` : ""}<div class="mm-body">${body(q.k)}</div>
        <div class="mm-nav"><button type="button" class="btn" id="mmSkip">${q.k === "life" ? "Skip" : "Skip this"}</button><button type="button" class="btn primary" id="mmNext">${step === Q.length - 1 ? `${icon("sparkle", 18)} Show my matches` : "Next"}</button></div></div>`;
      wireQ(q.k);
    };
    const next = () => { if (step >= Q.length - 1) { saveAnswers(a); step = Q.length; return drawR(); } step++; drawQ(); scrollTo({ top: 0 }); };
    const wireQ = (k) => {
      $("#mmBack", box).onclick = () => { step = Math.max(0, step - 1); drawQ(); };
      $("#mmNext", box).onclick = next; $("#mmSkip", box).onclick = next;
      $$(".mm-o", box).forEach((b) => (b.onclick = () => {
        const v = b.dataset.v;
        if (k === "life") { a.life = a.life.includes(v) ? a.life.filter((x) => x !== v) : [...a.life, v]; b.classList.toggle("on", a.life.includes(v)); b.setAttribute("aria-pressed", a.life.includes(v)); return; }
        if (k === "work") a.maxCommute = +v; else if (k === "budget" || k === "beds") a[k] = +v; else a[k] = v;
        $$(".mm-o", box).forEach((x) => { x.classList.toggle("on", x === b); x.setAttribute("aria-pressed", x === b); });
        if (k === "budget") { const i = $("#mmBud", box); if (i) i.value = ""; }
        if (k !== "work") setTimeout(next, 220);
      }));
      $$(".mm-c", box).forEach((b) => (b.onclick = () => { const n = b.dataset.h; a.hoods = a.hoods.includes(n) ? a.hoods.filter((x) => x !== n) : [...a.hoods, n]; b.classList.toggle("on", a.hoods.includes(n)); b.setAttribute("aria-pressed", a.hoods.includes(n)); b.parentElement.nextElementSibling.textContent = a.hoods.length ? `${a.hoods.length} selected` : "Anywhere is fine."; }));
      const bud = $("#mmBud", box); if (bud) bud.oninput = () => { const v = +bud.value.replace(/\D/g, "") || 0; bud.value = v ? v.toLocaleString("en-NG") : ""; if (v) { a.budget = Math.max(300000, v); $$(".mm-o", box).forEach((x) => { x.classList.remove("on"); x.setAttribute("aria-pressed", false); }); } };
      const wk = $("#mmWork", box); if (wk) wk.onchange = () => { a.work = wk.value; $("#mmCm", box).hidden = !a.work; };
    };
    const drawR = () => {
      const res = recommend(all, a), top = res.filter((r) => r.score >= 40).slice(0, 8), best = top[0];
      const sum = [`Up to ${naira(a.budget)}`, a.beds === 0 ? "Studio" : `${a.beds} bed${a.beds > 1 ? "s" : ""}`, a.work && `Work in ${a.work}`, a.hoods.length && a.hoods.join(", "), a.power === "must" ? "24/7 power" : a.power === "backup" ? "Backup power" : "", a.security === "must" ? "Secure" : "", a.furnished !== "any" ? a.furnished : "", ...a.life.map((v) => LIFE.find((x) => x[0] === v)?.[1])].filter(Boolean);
      box.innerHTML = `<div class="mm-res"><div class="mm-rh"><div><span class="mm-eye">${icon("sparkle", 16)} Smart Home Match</span><h1>${top.length ? `We found ${top.length} home${top.length === 1 ? "" : "s"} for you` : "No close matches yet"}</h1><p class="muted">${top.length ? "Ranked by how well each one fits what you told us." : "Try a higher budget, more areas or fewer must-haves."}</p></div><button class="btn" id="mmEdit">${icon("edit", 16)} Change answers</button></div>
        <div class="mm-sum">${sum.map((s) => `<span>${esc(s)}</span>`).join("")}</div>
        <div class="mm-list">${top.map((r, i) => resultCard(r, i)).join("") || `<div class="empty"><h3>Nothing fits yet</h3><p>Loosen a few answers, or browse every home.</p><p style="margin-top:14px"><a class="btn primary" href="#/search">Browse all homes</a></p></div>`}</div></div>`;
      $("#mmEdit", box).onclick = () => { step = 0; drawQ(); scrollTo({ top: 0 }); };
      $$("[data-open]", box).forEach((c) => (c.onclick = (e) => { if (e.target.closest("a,button")) return; ctx.go("#/home/" + c.dataset.open); }));
    };
    const resultCard = (r, i) => { const l = r.l, cls = r.score >= 85 ? "top" : r.score >= 70 ? "good" : r.score >= 55 ? "ok" : "low";
      return `<article class="mm-r" data-open="${esc(l.id)}" tabindex="0"><div class="mm-img"><img src="${esc(l.thumb || l.images[0])}" alt="${esc(l.title)}" loading="lazy">${i === 0 ? `<span class="mm-best">${icon("star", 13)} Best match</span>` : ""}</div>
        <div class="mm-rb"><div class="mm-rt"><div><h3>${esc(l.title)}</h3><p class="muted">${icon("pin", 14)} ${esc(l.area)}</p></div><div class="mm-score ${cls}" style="--p:${r.score}" role="img" aria-label="${r.score} percent match"><b>${r.score}<small>%</small></b></div></div>
        <p class="mm-price"><b>${naira(l.price)}</b> / year <span>· ${naira(moveIn(l).total)} to move in</span></p><p class="mm-v ${cls}">${verdict(r.score)}</p>
        <ul class="mm-why">${r.reasons.slice(0, 4).map((x) => `<li class="y">${icon("check", 14, 2.6)} ${esc(x)}</li>`).join("")}${r.flags.slice(0, 2).map((x) => `<li class="n">${icon("info", 14, 2.2)} ${esc(x)}</li>`).join("")}</ul>
        <div class="mm-ra"><a class="btn sm primary" href="#/home/${esc(l.id)}">View home</a></div></div></article>`; };
    step >= Q.length ? drawR() : drawQ();
  } };
}
export const matchBanner = (cls = "") => `<a class="mm-ban ${cls}" href="#/match"><span class="mm-bi">${icon("sparkle", 26)}</span><span class="mm-bt"><b>Not sure where to start?</b><small>Tell us about your life and we’ll recommend homes that fit, based on your budget, commute, power and security.</small></span><span class="mm-bg">Find my match ${icon("arrow", 16)}</span></a>`;
