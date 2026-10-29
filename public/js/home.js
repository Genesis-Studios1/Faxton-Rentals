// Home (discover), Search and Saved homes. Styling lives in css/home.css (.hx*).
// The page frame renders at once with skeleton cards; the listings fill in as soon as they arrive.
import { $, $$, esc, naira, icon, toast, modal } from "./ui.js";
import * as st from "./store.js";
import * as MATCH from "./match.js";
import * as MYHOME from "./myhome.js";
import * as APPS from "./apps.js";
import { AREAS, BUDGETS, CATS, catOf, matchType, listingCard, skeletonCards, emptyState, noHomesState, bindCards, bedsLabel, bathsLabel, placeOf, photosOf, priceOf } from "./cards.js";
import { ddSelect, ddPanel, mountDd } from "./dd.js";
import * as SVC from "./services.js";
import { comboHtml, mountCombo, locFields, mountLoc, placeOpts, stateOpts, matchPlace, findState, norm, NIGERIA } from "./loc.js";

const opts = (list) => list.map(([v, l]) => [String(v), l]);
const inRange = (price, r) => { if (!r) return true; const [lo, hi] = String(r).split("-").map(Number); return price >= lo && (!hi || price <= hi); };
const knownArea = (slug) => AREAS.some((a) => a[0] === slug);
const areaLabel = (slug) => (slug ? AREAS.find((a) => a[0] === slug)?.[1] || `“${slug}”` : "Lagos");
const hit = (l, area) => !area || (l.area + " " + l.city).toLowerCase().includes(area);
// The home page "Location" box: popular areas, states and LGAs. Typing anything else searches that text.
const popAreas = () => AREAS.filter((a) => a[0] && a[0] !== "ikeja").map(([v, t]) => ({ t, sub: "Popular area", area: v }));
const locOptions = () => [...popAreas(), ...placeOpts()];
const locBrowse = () => [...popAreas(), ...stateOpts().map((o) => ({ ...o, sub: "State" }))];
const placeParams = (text, o) => {
  const t = String(text || "").trim(); if (!t) return {};
  if (o && o.t === t) return o.area ? { area: o.area } : o.lga ? { state: o.st, lga: o.lga } : o.st ? { state: o.st } : { area: t.toLowerCase() };
  const st = findState(t); return st ? { state: st } : { area: t.toLowerCase() };
};

// ============================================================ HOME
const TABS = [["", "All homes"], ["Apartment", "Apartments"], ["House", "Houses"], ["Studio", "Studios"]];
const os = (img, name, sub) => `<div class="hx-os"><img src="img/${img}" alt="" width="36" height="36" loading="lazy" decoding="async"><span><b>${name}</b><small>${sub}</small></span></div>`;
const macTile = `<div class="hx-os"><span class="hx-os-ic">${icon("download", 20)}</span><span><b>macOS</b><small>Use on MacBook</small></span></div>`;
const tuxTile = `<div class="hx-os"><span class="hx-os-ic tux"><svg viewBox="0 0 32 32" width="22" height="22" aria-hidden="true"><ellipse cx="16" cy="19" rx="9" ry="10" fill="#1b1b1f"/><ellipse cx="16" cy="21.5" rx="5.5" ry="6.5" fill="#f4f1ea"/><circle cx="12.6" cy="12.5" r="1.5" fill="#fff"/><circle cx="19.4" cy="12.5" r="1.5" fill="#fff"/><path d="M14 15.2h4l-2 2.2z" fill="#f2b233"/></svg></span><span><b>Linux</b><small>Use on desktop</small></span></div>`;

export function discover(ctx) {
  const S = ctx.S, pr = S.profile?.prefs || {}, first = String(S.profile?.name || S.user?.displayName || "").trim().split(/\s+/)[0];
  const POP = [["lekki", "Lekki"], ["ajah", "Ajah"], ["yaba", "Yaba"], ["ikeja", "Ikeja"], ["victoria", "Victoria Island"]];
  const html = `<div class="wrap hx">
    <section class="hx-hero" aria-labelledby="hxH1">
      <div class="hx-hero-text">
        <p class="hx-eyebrow rise">Find your next chapter</p>
        <h1 id="hxH1" class="rise" style="--d:.06s"><span>A place to live.</span> <span>A place to call home.</span></h1>
        <p class="hx-lead rise" style="--d:.12s">Find a rental that fits your life, in a neighbourhood you love.</p>
        <ul class="hx-ticks rise" style="--d:.18s"><li>${icon("check", 16, 2.4)} Verified agents</li><li>${icon("check", 16, 2.4)} True cost upfront</li><li>${icon("check", 16, 2.4)} Online viewings</li></ul>
      </div>
      <div class="hx-hero-img"><img src="img/hero-hd.webp" alt="A modern white and timber home with palm trees in Lagos" width="1718" height="1386" fetchpriority="high" decoding="async"></div>
    </section>
    <form class="hx-search" id="sb" role="search" aria-label="Search homes">
      ${comboHtml({ style: "hx", id: "hxLoc", name: "area", label: "Location", ph: "Area, LGA or state", value: AREAS.find((a) => a[0] && a[0] === pr.area)?.[1] || "" })}
      ${ddSelect({ name: "type", label: "Property type", ic: "home", options: [["", "Any type"], ...CATS], value: pr.type || "", cls: "dd-field" })}
      ${ddSelect({ name: "max", label: "Yearly budget", ic: "coins", options: opts(BUDGETS), value: "0", cls: "dd-field" })}
      <button class="btn primary hx-go">${icon("search", 20)} <span>Search homes</span></button>
    </form>
    <form class="hx-search-m" id="sbm" role="search" aria-label="Search homes">
      <span class="hx-sm-ic">${icon("search", 20)}</span>${comboHtml({ style: "hxm", id: "hxLocM", name: "area", label: "Search area, LGA or state", ph: "Search area, LGA or state" })}
      <button class="hx-sm-go" aria-label="Search">${icon("arrow", 20, 2)}</button>
    </form>
    <div class="hx-pop rise" style="--d:.2s"><span class="hx-pop-l">Popular locations</span><div class="hx-pop-row">${POP.map(([v, l], i) => `<a class="hx-chip" href="#/search?area=${v}" data-area="${v}">${i === 0 ? icon("pin", 15) : ""}${l}<em></em></a>`).join("")}</div></div>
    ${MYHOME.homeCard(S)}
    <section class="hx-sec" aria-labelledby="hxFind">
      <div class="hx-sec-head"><div><h2 id="hxFind">Find your kind of home</h2><p>Explore rentals selected for your next move.</p></div>
        <div class="hx-tabs" role="tablist" aria-label="Kind of home">${TABS.map(([v, l], i) => `<button type="button" role="tab" id="hxt${i}" class="${i ? "" : "on"}" aria-selected="${!i}" data-t="${v}" ${i ? 'tabindex="-1"' : ""}>${l}</button>`).join("")}</div>
        <a class="hx-all" href="#/search">View all homes ${icon("arrow", 18)}</a></div>
      <div class="hx-grid" id="hxGrid" role="tabpanel" aria-labelledby="hxt0" aria-live="polite">${skeletonCards(6)}</div>
    </section>
    ${MATCH.matchBanner("wide")}
    ${SVC.homeServices()}
    ${SVC.ownerBanner()}
    <section class="hx-app" id="hxApp" aria-labelledby="hxAppH">
      <div class="hx-app-top"><div><p class="hx-eyebrow light">Get Faxton Rentals everywhere</p><h2 id="hxAppH">Start exploring on your device.</h2><p class="hx-app-p">Get the Faxton Rentals app, or install the main website for quick browser access.</p>
        <button type="button" class="hx-dl" data-dlnow>${icon("download", 18)} Download now</button></div>
        <img src="img/app-devices.webp" alt="Faxton Rentals on a phone and a laptop" width="900" height="711" loading="lazy" decoding="async"></div>
      <div class="hx-os-row">${os("os-android.webp", "Android", "Get the app")}${os("os-apple.webp", "iOS", "Get the app")}${os("os-windows.webp", "Windows", "Use on desktop")}${macTile}${tuxTile}</div>
    </section>
    <div class="hx-feats"><div><span class="hx-fi">${icon("pin", 22)}</span><span><b>Find your neighbourhood</b><small>Discover great areas, with everything you need nearby.</small></span></div><div><span class="hx-fi">${icon("cal", 22)}</span><span><b>Book a viewing</b><small>Schedule and tour your shortlisted homes with ease.</small></span></div><div><span class="hx-fi">${icon("user", 22)}</span><span><b>Manage your rental</b><small>Keep track of your enquiries, viewings and tenancy in one place.</small></span></div></div>
  </div>`;
  return { title: "Home", html, mount(root) {
    const go = (p) => ctx.go("#/search" + (p.toString() ? "?" + p : ""));
    mountDd(root, { cleanups: S.cleanups });
    let o1 = null, o2 = null;
    const c1 = mountCombo(root, "hxLoc", { free: true, options: locOptions, browse: locBrowse, onPick: (o) => (o1 = o) }), c2 = mountCombo(root, "hxLocM", { free: true, options: locOptions, browse: locBrowse, onPick: (o) => (o2 = o) });
    $("#sb", root).onsubmit = (e) => { e.preventDefault(); c1.commit(); const p = new URLSearchParams(); new FormData(e.target).forEach((v, k) => v && v !== "0" && k !== "area" && p.set(k, v)); Object.entries(placeParams(c1.get(), o1)).forEach(([k, v]) => p.set(k, v)); go(p); };
    $("#sbm", root).onsubmit = (e) => { e.preventDefault(); c2.commit(); const p = new URLSearchParams(); Object.entries(placeParams(c2.get(), o2)).forEach(([k, v]) => p.set(k, v)); go(p); };
    SVC.bindOwnerBanner(root, ctx);
    $$("[data-dlnow]", root).forEach((b) => (b.onclick = () => APPS.openDownloadModal(ctx)));
    // "Get the app" links land on the app section
    if (ctx.q.to === "app") setTimeout(() => $("#hxApp", root)?.scrollIntoView({ behavior: "smooth", block: "center" }), 450);
    paintHome(ctx, root, pr);
  } };
}

async function paintHome(ctx, root, pr) {
  const grid = $("#hxGrid", root);
  let all = [];
  try { all = await st.getListings(); } catch { grid.innerHTML = emptyState({ ic: "info", title: "We couldn’t load homes", text: "Check your internet and try again.", actions: [["#/", "Try again", true]] }); return; }
  if (!grid.isConnected) return;
  // homes that match the saved rental preferences come first
  const score = (l) => (pr.area && (l.area + " " + l.city).toLowerCase().includes(pr.area) ? 2 : 0) + (pr.type && matchType(l, pr.type) ? 1 : 0) + (pr.budget && inRange(l.price, pr.budget) ? 1 : 0);
  const list = all.map((l, i) => [l, i]).sort((x, y) => score(y[0]) - score(x[0]) || x[1] - y[1]).map((x) => x[0]);
  if (!list.length) { $(".hx-sec", root).innerHTML = `<div class="hx-sec-head"><div><h2>Find your kind of home</h2></div></div>${noHomesState(ctx.S)}`; return; }
  // only offer tabs that have something in them; show how many homes each popular area has
  TABS.forEach(([v], i) => { if (v && !list.some((l) => l.type === v)) $(`[data-t="${v}"]`, root)?.remove(); });
  $$(".hx-chip[data-area]", root).forEach((c) => { const n = list.filter((l) => hit(l, c.dataset.area)).length; if (n) $("em", c).textContent = n; else c.classList.add("none"); });
  const cardsFor = (t) => { const rows = list.filter((l) => !t || l.type === t).slice(0, 6); return rows.length ? rows.map((l, i) => listingCard(l, ctx.S.saved, { i, eager: i < 2, size: "" })).join("") : `<p class="hx-none">No ${esc(TABS.find((x) => x[0] === t)?.[1].toLowerCase() || "homes")} listed yet.</p>`; };
  const draw = (t) => { grid.innerHTML = cardsFor(t); bindCards(grid, ctx); };
  draw("");
  const tabs = $$(".hx-tabs [data-t]", root);
  const pick = (b) => { tabs.forEach((x) => { const on = x === b; x.classList.toggle("on", on); x.setAttribute("aria-selected", on); x.tabIndex = on ? 0 : -1; }); grid.setAttribute("aria-labelledby", b.id); draw(b.dataset.t); };
  tabs.forEach((b) => { b.onclick = () => pick(b); b.onkeydown = (e) => { const k = tabs.indexOf(b), n = { ArrowRight: k + 1, ArrowLeft: k - 1, Home: 0, End: tabs.length - 1 }[e.key]; if (n == null) return; e.preventDefault(); const t = tabs[(n + tabs.length) % tabs.length]; t.focus(); pick(t); }; });
}

// ============================================================ SEARCH
const PAGE = 12;
const AMEN = ["Parking", "Water supply", "Security", "Generator", "Balcony", "Garden", "Pool", "Gym", "Wi-Fi"];
const SORTS = [["recommended", "Recommended"], ["newest", "Newest first"], ["low", "Price: low to high"], ["high", "Price: high to low"]];

export function search(ctx) {
  const q = ctx.q, S = ctx.S;
  const f = { area: q.area || "", state: findState(q.state) || "", lga: String(q.lga || "").slice(0, 60), country: q.country || "", max: +q.max || 0, beds: +q.beds || 0, type: q.type || "", sort: SORTS.some((s) => s[0] === q.sort) ? q.sort : "recommended", am: (q.am || "").split(",").filter(Boolean), avail: q.avail !== "0" };
  const areaOpts = AREAS.some((a) => a[0] === f.area) ? AREAS : [[f.area, `“${f.area}”`], ...AREAS];
  const maxOpts = BUDGETS.some((b) => b[0] === f.max) || !f.max ? BUDGETS : [...BUDGETS, [f.max, "Up to " + naira(f.max)]];
  const where = f.lga || f.state || areaLabel(f.area);
  const html = `<div class="wrap hx hx-s">
    <header class="hx-s-head rise"><div><h1 id="hxsT">${knownArea(f.area) || !f.area || f.state || f.lga ? `Homes for rent in ${esc(where)}` : `Homes matching ${esc(where)}`}</h1><p id="hxsC" class="hx-count" aria-live="polite">Finding homes…</p></div></header>
    <form class="hx-filters" id="ff" aria-label="Filters" onsubmit="return false">
      ${ddSelect({ name: "area", label: "Location", ic: "pin", options: opts(areaOpts), value: f.area, bare: true, cls: "dd-chipbtn", title: "Where in Lagos?" })}
      ${ddSelect({ name: "max", label: "Budget", ic: "wallet", options: opts(maxOpts), value: f.max, bare: true, cls: "dd-chipbtn", title: "Yearly budget" })}
      ${ddSelect({ name: "beds", label: "Bedrooms", ic: "bed", options: [["0", "Any bedrooms"], ["1", "1+ bedroom"], ["2", "2+ bedrooms"], ["3", "3+ bedrooms"], ["4", "4+ bedrooms"], ["5", "5+ bedrooms"]], value: f.beds, bare: true, cls: "dd-chipbtn", title: "Bedrooms" })}
      ${ddSelect({ name: "type", label: "Property type", ic: "home", options: [["", "Any type"], ...CATS], value: f.type, bare: true, cls: "dd-chipbtn", title: "Property type" })}
      ${ddPanel({ name: "more", label: "More filters", ic: "sliders", badge: f.am.length + (f.state ? 1 : 0) + (f.lga ? 1 : 0) + (f.country ? 1 : 0), cls: "dd-chipbtn", title: "More filters", body: `<p class="dd-lab">Location</p>${locFields({ style: "rf", flow: true, req: false, ids: { country: "sfC", state: "sfS", lga: "sfL" }, country: f.country || NIGERIA, state: f.state, lga: f.lga })}<p class="dd-lab">Amenities</p><div class="hx-am">${AMEN.map((x) => `<label class="hx-amc"><input type="checkbox" value="${esc(x)}" ${f.am.includes(x) ? "checked" : ""}><span>${esc(x)}</span></label>`).join("")}</div>
        <label class="hx-sw"><input type="checkbox" id="fAvail" ${f.avail ? "checked" : ""}><span>Only show homes that are available</span></label>
        <div class="dd-foot"><button type="button" class="btn ghost sm" id="moreClear">Clear</button><button type="button" class="btn primary sm" id="applyMore">Show homes</button></div>` })}
      <span class="hx-sortsp"></span>
      ${ddSelect({ name: "sort", label: "Sort by", ic: "list", options: SORTS, value: f.sort, cls: "dd-chipbtn dd-sort", title: "Sort homes" })}
    </form>
    <div class="hx-active" id="hxAct" aria-label="Active filters"></div>
    ${MATCH.matchBanner("slim")}
    <div id="hxRes" aria-live="polite"><div class="hx-grid">${skeletonCards(6)}</div></div>
  </div>`;
  return { title: "Search", html, mount(root) {
    const nav = (patch) => { const next = { ...q, ...patch }, p = new URLSearchParams(); Object.entries(next).forEach(([k, v]) => { if (v == null || v === "" || v === 0 || (v === "0" && k !== "avail")) return; p.set(k, v); }); ctx.go("#/search" + (p.toString() ? "?" + p : "")); };
    mountDd(root, { cleanups: S.cleanups, onSelect: (name, v) => nav({ [name]: v === "recommended" ? "" : v }) });
    const more = $('.dd[data-dd="more"]', root);
    const loc = mountLoc(root, { ids: { country: "sfC", state: "sfS", lga: "sfL" } });
    $("#applyMore", root).onclick = () => { const L = loc.commit(); nav({ country: L.country === NIGERIA ? "" : L.country, state: L.country === NIGERIA ? L.state : "", lga: L.lga, am: $$(".hx-am input:checked", more).map((i) => i.value).join(","), avail: $("#fAvail", root).checked ? "" : "0" }); };
    $("#moreClear", root).onclick = () => { $$(".hx-am input", more).forEach((i) => (i.checked = false)); $("#fAvail", root).checked = true; loc.set({}); };
    paintSearch(ctx, root, f, nav);
  } };
}

async function paintSearch(ctx, root, f, nav) {
  const res = $("#hxRes", root);
  let all;
  try { all = await st.getListings(); } catch { res.innerHTML = emptyState({ ic: "info", title: "We couldn’t load homes", text: "Check your internet and try again.", actions: [["#/search", "Try again", true]] }); $("#hxsC", root).textContent = ""; return; }
  if (!res.isConnected) return;
  let list = all.filter((l) => hit(l, f.area) && matchPlace(l, f) && (!f.country || (l.country || NIGERIA) === f.country) && (!f.max || l.price <= f.max) && (l.beds ?? 0) >= f.beds && matchType(l, f.type) && (!f.avail || l.available !== false) && f.am.every((x) => (l.amenities || []).includes(x)));
  if (f.sort === "low") list = [...list].sort((a, b) => a.price - b.price);
  else if (f.sort === "high") list = [...list].sort((a, b) => b.price - a.price);
  else if (f.sort === "newest") list = [...list].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  $("#hxsC", root).textContent = all.length ? `${list.length} home${list.length === 1 ? "" : "s"} match your search` : "";
  // removable filter chips
  const chips = [f.area && ["area", areaLabel(f.area)], f.country && ["country", f.country], f.state && ["state", f.state], f.lga && ["lga", f.lga + " LGA"], !f.avail && ["avail", "Including rented homes"], f.max && ["max", BUDGETS.find((b) => b[0] === f.max)?.[1] || "Up to " + naira(f.max)], f.beds && ["beds", f.beds + "+ bedrooms"], f.type && ["type", CATS.find((c) => c[0] === f.type)?.[1] || f.type], ...f.am.map((x) => ["am:" + x, x])].filter(Boolean);
  const act = $("#hxAct", root);
  act.innerHTML = chips.length ? chips.map(([k, t]) => `<button type="button" class="hx-fc" data-rm="${esc(k)}" aria-label="Remove filter ${esc(t)}">${esc(t)} ${icon("x", 14, 2.2)}</button>`).join("") + `<a class="hx-clear" href="#/search">Clear all</a>` : "";
  $$("[data-rm]", act).forEach((b) => (b.onclick = () => { const k = b.dataset.rm; if (k.startsWith("am:")) nav({ am: f.am.filter((x) => x !== k.slice(3)).join(",") }); else nav(k === "state" ? { state: "", lga: "" } : k === "country" ? { country: "", state: "", lga: "" } : { [k]: "" }); }));
  if (!all.length) { res.innerHTML = noHomesState(ctx.S); return; }
  if (!list.length) {
    const near = AREAS.filter((a) => a[0] && a[0] !== f.area && all.some((l) => hit(l, a[0]))).slice(0, 4);
    res.innerHTML = emptyState({ ic: "search", title: "No homes match your search", text: "Try widening your budget, or look at a nearby area.",
      actions: [["#/search", "Clear all filters", true], ["#/match", "Try Smart Home Match"]] }) + (near.length ? `<div class="hx-sugg"><span>Try instead</span>${near.map(([v, l]) => `<a class="hx-chip" href="#/search?area=${v}">${icon("pin", 15)}${l}</a>`).join("")}</div>` : "");
    return;
  }
  let shown = 0;
  res.innerHTML = `<div class="hx-grid" id="hxList"></div><div class="hx-more" id="hxMore"></div>`;
  const draw = () => {
    const next = list.slice(shown, shown + PAGE), g = $("#hxList", res);
    g.insertAdjacentHTML("beforeend", next.map((l, i) => listingCard(l, ctx.S.saved, { i: i % 9, eager: shown + i < 3 })).join("")); shown += next.length;
    bindCards(g, ctx);
    $("#hxMore", res).innerHTML = shown < list.length ? `<button type="button" class="btn" id="moreBtn">Show ${Math.min(PAGE, list.length - shown)} more homes</button><span class="muted">Showing ${shown} of ${list.length}</span>` : list.length > PAGE ? `<span class="muted">That’s all ${list.length} homes.</span>` : "";
    const mb = $("#moreBtn", res); if (mb) mb.onclick = draw;
  };
  draw();
}

// ============================================================ SAVED
export async function savedPage(ctx) {
  const html = `<div class="wrap hx hx-saved"><header class="hx-s-head rise"><div><h1>Saved homes</h1><p id="svC" class="hx-count">Your shortlist, all in one place.</p></div>
      <div class="hx-sv-tools"><div class="hx-tabs sm" id="svt" role="tablist" aria-label="Filter saved homes"></div><button class="btn" id="cmp" type="button">${icon("chart", 18)} Compare homes <em class="hx-cc" id="cc">0</em></button></div></header>
    <div class="hx-grid" id="svg">${skeletonCards(3)}</div></div>`;
  return { title: "Saved homes", html, async mount(root) {
    let all = []; try { all = await st.getListings(); } catch {}
    if (!root.isConnected) return;
    const list = all.filter((l) => ctx.S.saved.has(l.id)), cmp = new Set(); let tab = "all";
    const av = (l) => l.available !== false, grid = $("#svg", root);
    const count = () => ($("#cc", root).textContent = cmp.size);
    const draw = () => {
      $("#svC", root).textContent = list.length ? `${list.length} home${list.length === 1 ? "" : "s"} you love` : "Your shortlist, all in one place.";
      $("#svt", root).innerHTML = list.length ? [["all", "All saved", list.length], ["av", "Available", list.filter(av).length], ["un", "Rented", list.filter((l) => !av(l)).length]].map(([k, t, n]) => `<button type="button" role="tab" class="${tab === k ? "on" : ""}" aria-selected="${tab === k}" data-tab="${k}">${t} <b>${n}</b></button>`).join("") : "";
      $("#cmp", root).hidden = list.length < 2;
      const L = list.filter((l) => tab === "all" || (tab === "av" ? av(l) : !av(l)));
      grid.className = L.length ? "hx-grid" : "";
      grid.innerHTML = L.length ? L.map((l, i) => listingCard(l, ctx.S.saved, { i, eager: i < 2, extra: `<label class="lc-cmp"><input type="checkbox" data-cmp="${esc(l.id)}" ${cmp.has(l.id) ? "checked" : ""}> <span>Compare</span></label>` })).join("")
        : emptyState({ ic: "heart", title: list.length ? "Nothing in this list" : "Nothing saved yet", text: list.length ? "Try another tab." : "Tap the heart on any home to keep it here.", actions: list.length ? [] : [["#/search", "Browse homes", true]] });
      bindCards(grid, ctx, { onFav });
      $$("[data-cmp]", grid).forEach((c) => { c.onclick = (e) => e.stopPropagation(); c.onchange = () => { if (c.checked && cmp.size >= 3) { c.checked = false; return toast("You can compare up to 3 homes."); } c.checked ? cmp.add(c.dataset.cmp) : cmp.delete(c.dataset.cmp); count(); }; });
      $$("[data-tab]", root).forEach((b) => (b.onclick = () => { tab = b.dataset.tab; draw(); }));
    };
    // an un-hearted home leaves the list without a full reload
    const onFav = (id, on) => { if (on) return; const i = list.findIndex((x) => x.id === id); if (i > -1) { list.splice(i, 1); cmp.delete(id); setTimeout(() => { if (root.isConnected) { draw(); count(); } }, 260); } };
    $("#cmp", root).onclick = () => {
      if (cmp.size < 2) return toast("Tick two or three homes to compare them.");
      const hs = list.filter((l) => cmp.has(l.id)), row = (k, fn) => `<tr><th scope="row">${k}</th>${hs.map((h) => `<td>${fn(h)}</td>`).join("")}</tr>`, tot = (h) => (+h.price || 0) + (+h.service || 0) + (+h.deposit || 0);
      modal(`<h2>Compare homes</h2><div class="tbl-wrap"><table class="dtab cmp"><thead><tr><th></th>${hs.map((h) => `<th scope="col">${esc(h.title)}</th>`).join("")}</tr></thead><tbody>${row("Area", (h) => esc(placeOf(h)))}${row("Rent / year", (h) => naira(h.price))}${row("Service charge", (h) => naira(h.service))}${row("Deposit", (h) => naira(h.deposit))}${row("Total (first year)", (h) => `<b>${naira(tot(h))}</b>`)}${row("Bedrooms", (h) => bedsLabel(h.beds))}${row("Bathrooms", (h) => h.baths || "–")}${row("Size", (h) => (h.sqm ? h.sqm + " m²" : "Not listed"))}${row("Status", (h) => (h.available === false ? "Rented" : "Available"))}</tbody></table></div>`);
    };
    draw();
  } };
}
