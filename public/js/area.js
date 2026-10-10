// Neighbourhood Intelligence + True Cost of Renting.
// Area ratings are Faxton estimates (owners can override them per listing with `hood`); nearby places come live from OpenStreetMap.
import { esc, naira, icon, $, $$ } from "./ui.js";
import { ddSelect } from "./dd.js";

// ---------- True cost of renting ----------
// Every listing shows the real move-in cost: rent plus agency, legal, caution and service charge.
export const AGENCY_PCT = 0.1, LEGAL_PCT = 0.05;
export function moveIn(l, rent = l.price) {
  const agency = l.agencyFee != null && l.agencyFee !== "" ? +l.agencyFee : Math.round(rent * AGENCY_PCT);
  const legal = l.legalFee != null && l.legalFee !== "" ? +l.legalFee : Math.round(rent * LEGAL_PCT);
  const caution = +l.deposit || 0, service = +l.service || 0;
  const items = [["Annual rent", rent, "home"], ["Agency fee", agency, "handshake", agency === 0 ? "No agency fee" : ""], ["Legal fee", legal, "doc"], ["Caution deposit", caution, "lock", "Refundable"], ["Service charge", service, "building"]];
  return { rent, agency, legal, caution, service, items, total: rent + agency + legal + caution + service, fees: agency + legal, year1: rent + agency + legal + service };
}

const PLANS = [["Yearly", 1], ["Every 6 months", 2], ["Quarterly", 4], ["Monthly", 12]];
export function costHtml(l, rent = l.price) {
  const m = moveIn(l, rent), pct = (v) => Math.max(2, Math.round((v / m.total) * 100));
  const COL = ["#13926f", "#f3a712", "#6366f1", "#0ea5e9", "#ec4899"];
  return `<div class="tc" data-rent="${rent}"><div class="tc-head"><div><h2>${icon("calc", 24)} True cost of renting</h2><p class="muted">The real amount you pay to move in, not only the annual rent.</p></div></div>
    <div class="tc-bar" aria-hidden="true">${m.items.map(([, v], i) => (v ? `<i style="flex:${pct(v)};background:${COL[i]}"></i>` : "")).join("")}</div>
    <ul class="tc-rows">${m.items.map(([t, v, ic, note], i) => `<li><span class="tc-dot" style="background:${COL[i]}"></span><span class="tc-t">${t}${note ? `<small class="${note === "Refundable" ? "ok" : ""}">${note}</small>` : ""}</span><b>${naira(v)}</b></li>`).join("")}</ul>
    <div class="tc-total"><span>Total move-in cost</span><b id="tcTotal">${naira(m.total)}</b></div>
    <div class="tc-sub"><div><small>Money you get back</small><b>${naira(m.caution)}</b><span>caution, if the flat is left in good order</span></div><div><small>First-year cost</small><b>${naira(m.year1)}</b><span>${naira(Math.round(m.year1 / 12))} a month, all in</span></div></div>
    <div class="tc-plan"><h4>How would you like to pay the rent?</h4><div class="dt-plans" role="radiogroup" aria-label="Payment plan">${PLANS.map(([t, n], i) => `<button type="button" role="radio" aria-checked="${i === 0}" class="${i === 0 ? "on" : ""}" data-n="${n}">${t}</button>`).join("")}</div>
      <div class="tc-due"><div><small>Due when you move in</small><b id="tcDue">${naira(m.total)}</b></div><div><small id="tcThenL">Then</small><b id="tcThen">Nothing until renewal</b></div></div>
      <p class="muted tc-note">Agency and legal fees follow the usual market rates (${Math.round(AGENCY_PCT * 100)}% and ${Math.round(LEGAL_PCT * 100)}% of the rent) unless the agent has set their own. The agent confirms the final figures before you pay.</p></div></div>`;
}
export function mountCost(root, l) {
  const box = $(".tc", root); if (!box) return;
  const m = moveIn(l, +box.dataset.rent || l.price);
  $$(".dt-plans [data-n]", box).forEach((b) => (b.onclick = () => {
    const n = +b.dataset.n; $$(".dt-plans button", box).forEach((x) => { x.classList.toggle("on", x === b); x.setAttribute("aria-checked", x === b); });
    const part = Math.round(m.rent / n), due = part + m.agency + m.legal + m.caution + m.service;
    $("#tcDue", box).textContent = naira(due);
    $("#tcThenL", box).textContent = n === 1 ? "Then" : `Then ${n - 1} more time${n > 2 ? "s" : ""}`;
    $("#tcThen", box).textContent = n === 1 ? "Nothing until renewal" : `${naira(part)} each`;
  }));
}

// ---------- the area guide ----------
const LEVEL = { low: ["Low", "good"], moderate: ["Moderate", "mid"], high: ["High", "bad"], good: ["Good", "good"], fair: ["Fair", "mid"], poor: ["Poor", "bad"] };
const AREAS = [
  [/ikate/i, { name: "Ikate", flood: "moderate", floodNote: "Some low streets near the lagoon hold water after heavy rain.", roads: "good", roadsNote: "Tarred main roads; a few estate streets are narrow.", security: "good", securityNote: "Mostly gated estates with private patrols.", power: 18, rent2: 3000000 }],
  [/lekki phase 1|lekki ph|^lekki$|lekki,/i, { name: "Lekki Phase 1", flood: "moderate", floodNote: "Low-lying pockets flood during the rainy season (June to October).", roads: "good", roadsNote: "Good main roads. Traffic on the Lekki–Epe corridor is heavy at peak hours.", security: "good", securityNote: "Gated estates, private guards and CCTV are common.", power: 18, rent2: 3400000 }],
  [/lekki/i, { name: "Lekki", flood: "moderate", floodNote: "Some low-lying parts flood in heavy rain.", roads: "fair", roadsNote: "Main roads are good; inner roads vary.", security: "good", securityNote: "Gated estates with private patrols.", power: 17, rent2: 3000000 }],
  [/ajah/i, { name: "Ajah", flood: "high", floodNote: "Several streets are prone to flooding in the rainy season. Ask about drainage.", roads: "fair", roadsNote: "The Lekki–Epe expressway is busy; many estate roads are untarred.", security: "fair", securityNote: "Safer inside gated estates. Check the estate’s guard arrangements.", power: 14, rent2: 1800000 }],
  [/victoria island|^vi$|\bvi\b/i, { name: "Victoria Island", flood: "moderate", floodNote: "Some streets flood during heavy storms.", roads: "good", roadsNote: "Well-maintained roads with heavy weekday traffic.", security: "good", securityNote: "Busy, well-patrolled area with many managed buildings.", power: 20, rent2: 4500000 }],
  [/yaba/i, { name: "Yaba", flood: "moderate", floodNote: "Some streets near channels flood after heavy rain.", roads: "fair", roadsNote: "Busy roads and frequent traffic; good access to the mainland.", security: "fair", securityNote: "Crowded, so look for a gated compound with a guard.", power: 14, rent2: 1900000 }],
];
const DEFAULT_AREA = { name: "", flood: "moderate", floodNote: "We don’t have a detailed flood record for this area yet. Ask the agent about drainage.", roads: "fair", roadsNote: "We don’t have a road rating for this area yet.", security: "fair", securityNote: "Ask the agent about guards, gates and CCTV.", power: 14, rent2: 0, generic: true };
export const areaGuide = (l) => {
  const hit = AREAS.find(([re]) => re.test(l.area || ""));
  const g = { ...(hit ? hit[1] : DEFAULT_AREA) }, o = l.hood || {};
  ["flood", "roads", "security"].forEach((k) => { if (LEVEL[o[k]]) g[k] = o[k]; if (o[k + "Note"]) g[k + "Note"] = String(o[k + "Note"]).slice(0, 200); });
  if (+o.power > 0) g.power = Math.min(24, +o.power);
  g.name = g.name || String(l.area || "").split(",")[0];
  return g;
};

// Average rent: real figures from Faxton listings in the same area first, then the area estimate.
export function avgRent(l, all) {
  const key = String(l.area || "").split(",")[0].trim().toLowerCase();
  const same = (all || []).filter((x) => x.id !== l.id && x.price > 0 && String(x.area || "").split(",")[0].trim().toLowerCase() === key);
  const beds = same.filter((x) => x.beds === l.beds);
  const pick = beds.length >= 1 ? beds : same;
  if (pick.length) return { value: Math.round(pick.reduce((a, x) => a + x.price, 0) / pick.length / 1e4) * 1e4, n: pick.length, basis: beds.length ? `${l.beds === 0 ? "studio" : l.beds + "-bed"} homes` : "homes of all sizes", live: true };
  const g = areaGuide(l);
  if (g.rent2) { const f = l.beds === 0 ? 0.45 : l.beds === 1 ? 0.65 : l.beds === 2 ? 1 : l.beds === 3 ? 1.35 : 1.9; return { value: Math.round((g.rent2 * f) / 1e4) * 1e4, n: 0, basis: "Faxton estimate", live: false }; }
  return null;
}

// ---------- commute ----------
export const WORK = [
  ["Victoria Island", 6.4281, 3.4219, 1], ["Ikoyi", 6.4549, 3.4339, 1], ["Lagos Island", 6.4541, 3.3947, 1], ["Lekki Phase 1", 6.4474, 3.4723, 1], ["Oniru", 6.4333, 3.45, 1], ["Ikate", 6.4408, 3.4856, 1], ["Ajah", 6.4698, 3.5852, 1],
  ["Yaba", 6.5095, 3.3711, 0], ["Surulere", 6.501, 3.3569, 0], ["Maryland", 6.5667, 3.3667, 0], ["Ikeja", 6.6018, 3.3515, 0],
];
const hav = (a, b, c, d) => { const R = 6371, r = Math.PI / 180, dl = (c - a) * r, dn = (d - b) * r, x = Math.sin(dl / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(dn / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
const near5 = (m) => Math.max(5, Math.round(m / 5) * 5);
// A rough drive-time estimate: straight-line distance, a road factor and a Lagos average speed. Crossing between the mainland and the island adds a bridge delay.
export function commute(l, w) {
  if (l.lat == null || l.lng == null || !w) return null;
  const km = hav(l.lat, l.lng, w[1], w[2]) * 1.4, island = (l.lng > 3.38 && l.lat < 6.48) ? 1 : 0, bridge = island !== w[3];
  return { km: Math.round(km * 10) / 10, peak: near5((km / 14) * 60 + (bridge ? 20 : 0)), off: near5((km / 32) * 60 + (bridge ? 6 : 0)) };
}
export const commuteScore = (l, w) => { const c = commute(l, w); return c ? c.peak : null; };
const minTxt = (m) => (m >= 60 ? `${Math.floor(m / 60)} h ${m % 60 ? (m % 60) + " min" : ""}`.trim() : `${m} min`);

// ---------- nearby places (OpenStreetMap, live) ----------
const CATS = [
  ["supermarket", "Supermarkets", "cart", (t) => t.shop === "supermarket" || t.shop === "mall"],
  ["school", "Schools", "cap", (t) => /^(school|kindergarten|college)$/.test(t.amenity || "")],
  ["hospital", "Hospitals & clinics", "cross", (t) => /^(hospital|clinic)$/.test(t.amenity || "")],
  ["restaurant", "Restaurants", "fork", (t) => /^(restaurant|cafe)$/.test(t.amenity || "")],
  ["gym", "Gyms", "dumbbell", (t) => /^(fitness_centre|sports_centre)$/.test(t.leisure || "")],
];
const dist = (m) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`);
export async function nearby(lat, lng) {
  const key = `nb_${lat.toFixed(3)}_${lng.toFixed(3)}`;
  try { const c = JSON.parse(localStorage.getItem(key) || "null"); if (c && Date.now() - c.t < 7 * 864e5) return c.v; } catch {}
  const q = `[out:json][timeout:12];(nwr["shop"~"^(supermarket|mall)$"](around:3000,${lat},${lng});nwr["amenity"~"^(school|kindergarten|college|hospital|clinic|restaurant|cafe)$"](around:3000,${lat},${lng});nwr["leisure"~"^(fitness_centre|sports_centre)$"](around:3000,${lat},${lng}););out center tags 300;`;
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 12000);
  let data;
  try {
    const r = await fetch("https://overpass-api.de/api/interpreter", { method: "POST", body: "data=" + encodeURIComponent(q), signal: ctl.signal, headers: { "Content-Type": "application/x-www-form-urlencoded" } });
    if (!r.ok) throw new Error("overpass " + r.status);
    data = await r.json();
  } finally { clearTimeout(timer); }
  const out = {};
  CATS.forEach(([k, , , test]) => {
    const seen = new Set();
    out[k] = (data.elements || []).filter((e) => e.tags?.name && test(e.tags)).map((e) => ({ name: e.tags.name, m: hav(lat, lng, e.lat ?? e.center?.lat, e.lon ?? e.center?.lon) * 1000 }))
      .filter((p) => Number.isFinite(p.m)).sort((a, b) => a.m - b.m).filter((p) => (seen.has(p.name) ? false : seen.add(p.name))).slice(0, 12);
  });
  try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), v: out })); } catch {}
  return out;
}

// ---------- the Neighbourhood tab ----------
const tone = (k) => (LEVEL[k] || LEVEL.fair)[1];
const tile = (ic, label, val, tn, note) => `<div class="nh-t"><span class="nh-ic ${tn}">${icon(ic, 22)}</span><div><small>${label}</small><b>${val}</b><p>${esc(note || "")}</p></div></div>`;
export function neighbourhoodHtml(l, all) {
  const g = areaGuide(l), rent = avgRent(l, all), hasPin = l.lat != null && l.lng != null && l.hasPin !== false;
  const hasBackup = (l.amenities || []).some((a) => /generator|solar|inverter|power|electric/i.test(a)), hasSec = (l.amenities || []).some((a) => /secur|guard|cctv|gate/i.test(a));
  const hrs = hasBackup ? 24 : g.power;
  const diff = rent ? Math.round(((l.price - rent.value) / rent.value) * 100) : 0;
  const rentNote = rent ? (Math.abs(diff) < 3 ? "In line with the area average." : diff < 0 ? `${Math.abs(diff)}% below the area average.` : `${diff}% above the area average.`) : "";
  const rentTone = !rent ? "mid" : diff <= 3 ? "good" : diff <= 15 ? "mid" : "bad";
  const wk = (() => { try { return localStorage.getItem("work") || "Victoria Island"; } catch { return "Victoria Island"; } })();
  return `<div class="nh"><div class="nh-head"><h2>${icon("map", 24)} About ${esc(g.name)}</h2><p class="muted">What it is really like to live here. Area ratings are Faxton estimates, so confirm them at your viewing.</p></div>
    <div class="nh-grid">
      ${tile("waves", "Flood risk", LEVEL[g.flood][0], tone(g.flood) === "good" ? "good" : tone(g.flood) === "mid" ? "mid" : "bad", g.floodNote)}
      ${tile("route", "Road and access", LEVEL[g.roads][0], tone(g.roads), g.roadsNote)}
      ${tile("shield", "Security", LEVEL[g.security][0], tone(g.security), g.securityNote + (hasSec ? " This home lists security features." : ""))}
      ${tile("bolt", "Electricity (estimate)", `About ${hrs} hours a day`, hrs >= 20 ? "good" : hrs >= 15 ? "mid" : "bad", hasBackup ? `Around ${g.power} hours from the grid, topped up by this home’s backup power.` : `Grid supply in this area. This home doesn’t list a generator or solar.`)}
      ${tile("coins", "Average rent nearby", rent ? naira(rent.value) + " / year" : "Not enough data", rentTone, rent ? `${rentNote} Based on ${rent.live ? rent.n + " Faxton listing" + (rent.n === 1 ? "" : "s") + " here (" + rent.basis + ")" : "a Faxton estimate for " + (l.beds === 0 ? "studios" : l.beds + "-bed homes")}.` : "We need a few more listings here.")}
    </div>
    <section class="nh-sec"><div class="nh-sh"><h3>${icon("clock", 20)} Commute estimates</h3><div class="nh-pick"><span>I work or study in</span>${ddSelect({ name: "nhWork", label: "Where you work or study", options: WORK.map((w) => [w[0], w[0]]), value: wk, bare: true, cls: "dd-sm", title: "Where do you work or study?" })}</div></div>
      <div id="nhCommute">${hasPin ? commuteHtml(l, wk) : `<p class="muted">The exact location of this home hasn’t been shared yet, so we can’t estimate the commute.</p>`}</div></section>
    <section class="nh-sec"><div class="nh-sh"><h3>${icon("pin", 20)} Nearby</h3>${hasPin ? `<small class="muted">Within about 3 km · from OpenStreetMap</small>` : ""}</div>
      <div id="nhNear" class="nh-near">${hasPin ? CATS.map(([k, t, ic]) => `<div class="nh-c" data-k="${k}"><div class="nh-ch"><span>${icon(ic, 20)}</span><b>${t}</b><em>…</em></div><ul><li class="sk"></li><li class="sk"></li></ul></div>`).join("") : `<p class="muted">Nearby places appear once the agent shares the exact location.</p>`}</div></section></div>`;
}
const commuteHtml = (l, wk) => {
  const w = WORK.find((x) => x[0] === wk), c = commute(l, w);
  if (!c) return "";
  const same = c.km < 1.2;
  return `<div class="nh-cm"><div><span class="nh-ic mid">${icon("car", 22)}</span><div><small>Rush hour</small><b>${same ? "Walkable" : "About " + minTxt(c.peak)}</b></div></div><div><span class="nh-ic good">${icon("car", 22)}</span><div><small>Off-peak</small><b>${same ? "Walkable" : "About " + minTxt(c.off)}</b></div></div><div><span class="nh-ic">${icon("route", 22)}</span><div><small>Distance by road</small><b>~${c.km} km</b></div></div></div><p class="muted nh-fine">Drive-time estimate to ${esc(wk)}. Real journeys vary with the day and the bridges.</p>`;
};
export function mountNeighbourhood(root, l) {
  if (!$("#nhCommute", root)) return;
  root.addEventListener("dd-change", (e) => { if (e.detail.name !== "nhWork") return; try { localStorage.setItem("work", e.detail.value); } catch {} $("#nhCommute", root).innerHTML = commuteHtml(l, e.detail.value); });
  if (l.lat == null || l.lng == null || l.hasPin === false) return;
  nearby(l.lat, l.lng).then((res) => {
    CATS.forEach(([k]) => {
      const c = $(`.nh-c[data-k="${k}"]`, root); if (!c) return;
      const list = res[k] || [];
      $("em", c).textContent = list.length ? (list.length >= 12 ? "12+" : list.length) + " nearby" : "None found";
      $("ul", c).innerHTML = list.length ? list.slice(0, 4).map((p) => `<li><span>${esc(p.name)}</span><b>${dist(p.m)}</b></li>`).join("") : `<li class="none">Nothing mapped within 3 km</li>`;
    });
  }).catch(() => {
    $("#nhNear", root).innerHTML = `<p class="muted">We couldn’t load nearby places just now. <a class="link" target="_blank" rel="noopener" href="https://www.google.com/maps/search/supermarkets+schools+hospitals/@${l.lat},${l.lng},15z">See them on Google Maps</a>.</p>`;
  });
}

// Compact itemised list used by the booking, application and payment pages.
export function costKvs(l, rent = l.price, totalLabel = "Total move-in cost") {
  const m = moveIn(l, rent);
  return `<div class="kvs">${m.items.map(([t, v, , note]) => `<div><span>${t}${note === "Refundable" ? " (refundable)" : ""}</span><b>${naira(v)}</b></div>`).join("")}</div><div class="kvs tot"><div><span>${totalLabel}</span><b>${naira(m.total)}</b></div></div>`;
}
