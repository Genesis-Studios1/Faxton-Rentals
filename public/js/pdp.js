// The property page and the full-screen photo and video viewer. Styling lives in css/home.css (.pd*, .vx*).
import { $, $$, esc, naira, icon, toast, friendlyErr, verifiedBadge, initials } from "./ui.js";
import * as st from "./store.js";
import * as AREA from "./area.js";
import * as OFFERS from "./offers.js";
import * as CALLS2 from "./calls.js";
import { openProfile } from "./profile.js";
import { loadLeaflet, ctrlZoom, tiles, homePin } from "./maps.js";
import { listingCard, bindCards, emptyState, catOf, catName, placeOf, photosOf, bedsLabel, bathsLabel, isOpen } from "./cards.js";
import { ddSelect, mountDd } from "./dd.js";

// ============================================================ viewer
export const videoEmbed = (u) => {
  let m;
  if ((m = /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/))([\w-]{11})/.exec(u))) return { kind: "frame", src: `https://www.youtube-nocookie.com/embed/${m[1]}?rel=0`, thumb: `https://i.ytimg.com/vi/${m[1]}/hqdefault.jpg` };
  if ((m = /vimeo\.com\/(?:video\/)?(\d+)/.exec(u))) return { kind: "frame", src: `https://player.vimeo.com/video/${m[1]}` };
  return { kind: "file", src: u };
};
const reduced = () => matchMedia("(prefers-reduced-motion:reduce)").matches;

// items: [{ type: "img" | "image" | "video", src, kind?, thumb? }]. Swipe, arrow keys, thumbnails; Back or Escape closes it.
export function openViewer(items, start = 0) {
  if (!items?.length || document.querySelector(".vx")) return;
  const opener = document.activeElement, N = items.length;
  let i = Math.max(0, Math.min(start, N - 1)), closed = false, pushed = false;
  const ov = document.createElement("div"); ov.className = "vx"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true"); ov.setAttribute("aria-label", "Photos and videos");
  const isVid = (k) => items[k].type === "video";
  ov.innerHTML = `<div class="vx-top"><span class="vx-count" aria-live="polite"></span><button type="button" class="vx-x" aria-label="Close">${icon("x", 22, 2)}</button></div>
    <div class="vx-track" tabindex="-1">${items.map((_, k) => `<div class="vx-slide" data-k="${k}"></div>`).join("")}</div>
    ${N > 1 ? `<button type="button" class="vx-nav vx-prev" aria-label="Previous">${icon("chev", 26, 2)}</button><button type="button" class="vx-nav vx-next" aria-label="Next">${icon("chev", 26, 2)}</button>
    <div class="vx-strip">${items.map((it, k) => `<button type="button" class="vx-th" data-k="${k}" aria-label="${isVid(k) ? "Video" : "Photo"} ${k + 1}">${isVid(k) ? `<span class="vx-play">${icon("video", 18)}</span>` : `<img src="${esc(it.src)}" alt="" width="64" height="48" loading="lazy" decoding="async" draggable="false">`}</button>`).join("")}</div>` : ""}`;
  const track = $(".vx-track", ov);
  const slide = (k) => $(`.vx-slide[data-k="${k}"]`, ov);
  const playVideo = (k) => { const it = items[k], s = slide(k); s.innerHTML = it.kind === "frame" ? `<iframe src="${esc(it.src)}" title="Video tour" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>` : `<video src="${esc(it.src)}" controls playsinline preload="metadata" autoplay></video>`; };
  const fill = (k, now) => {
    if (k < 0 || k >= N) return; const s = slide(k), it = items[k];
    if (isVid(k)) { if (now && s.dataset.live !== "1") { s.dataset.live = "1"; if (s.dataset.auto === "1") playVideo(k); } if (!s.firstChild) s.innerHTML = `<button type="button" class="vx-vp" data-k="${k}" aria-label="Play video">${it.thumb ? `<img src="${esc(it.thumb)}" alt="" draggable="false">` : ""}<span>${icon("play", 34)}</span></button>`; return; }
    if (!s.firstChild) s.innerHTML = `<img src="${esc(it.src)}" alt="" decoding="async" draggable="false">`;
  };
  const paint = () => {
    $(".vx-count", ov).textContent = `${i + 1} / ${N}`;
    [i - 1, i, i + 1].forEach((k) => fill(k, k === i));
    // a video that is no longer in view stops playing
    $$(".vx-slide", ov).forEach((s) => { const k = +s.dataset.k; if (isVid(k) && k !== i && s.dataset.live === "1") { s.dataset.live = ""; s.dataset.auto = ""; s.innerHTML = ""; fill(k, false); } });
    $$(".vx-th", ov).forEach((b) => { const on = +b.dataset.k === i; b.classList.toggle("on", on); b.setAttribute("aria-current", on); });
    const th = $(".vx-th.on", ov); if (th) { const st0 = $(".vx-strip", ov); st0.scrollTo({ left: th.offsetLeft - st0.clientWidth / 2 + th.clientWidth / 2, behavior: reduced() ? "auto" : "smooth" }); }
  };
  const to = (k, smooth = true) => { track.scrollTo({ left: k * track.clientWidth, behavior: smooth && !reduced() ? "smooth" : "auto" }); };
  const go = (d) => { const k = i + d; if (k < 0 || k >= N) { i = (k + N) % N; to(i, false); paint(); } else to(k); };
  let tm; track.addEventListener("scroll", () => { const k = Math.round(track.scrollLeft / Math.max(1, track.clientWidth)); if (k !== i && k >= 0 && k < N) { i = k; paint(); } }, { passive: true });
  const shut = (fromPop) => {
    if (closed) return; closed = true; clearTimeout(tm);
    document.removeEventListener("keydown", key); removeEventListener("popstate", onPop); removeEventListener("hashchange", onHash); removeEventListener("resize", onResize);
    document.documentElement.classList.remove("dlx-lock", "fx-lock"); ov.classList.add("out");
    setTimeout(() => ov.remove(), reduced() ? 0 : 160);
    if (pushed && !fromPop) { pushed = false; try { history.back(); } catch {} }
    try { opener?.focus?.({ preventScroll: true }); } catch {}
  };
  const onPop = () => { pushed = false; shut(true); }, onHash = () => shut(true), onResize = () => to(i, false);
  const key = (e) => {
    if (e.key === "Escape") { e.preventDefault(); return shut(); }
    if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); } else if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
    else if (e.key === "Tab") { const f = $$("button,a,iframe,video", ov).filter((x) => x.offsetParent !== null || x === document.activeElement); if (!f.length) return; const a = f[0], z = f[f.length - 1]; if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); } }
  };
  document.body.append(ov); document.documentElement.classList.add("dlx-lock", "fx-lock");
  try { history.pushState({ vx: 1 }, ""); pushed = true; } catch {}
  document.addEventListener("keydown", key); addEventListener("popstate", onPop); addEventListener("hashchange", onHash); addEventListener("resize", onResize);
  $(".vx-x", ov).onclick = () => shut();
  if (N > 1) { $(".vx-prev", ov).onclick = () => go(-1); $(".vx-next", ov).onclick = () => go(1); }
  ov.addEventListener("click", (e) => {
    const th = e.target.closest(".vx-th"); if (th) return to(+th.dataset.k);
    const vp = e.target.closest(".vx-vp"); if (vp) { const k = +vp.dataset.k; playVideo(k); return; }
    if (e.target.classList.contains("vx-slide") || e.target === track) shut();
  });
  if (isVid(i)) slide(i).dataset.auto = "1";
  track.style.scrollBehavior = "auto"; paint(); to(i, false); requestAnimationFrame(() => { track.style.scrollBehavior = ""; }); ov.tabIndex = -1; ov.focus({ preventScroll: true });
}

// ============================================================ the page
const amenIcon = (a) => (/park/i.test(a) ? "car" : /secur|guard|cctv|gate/i.test(a) ? "shield" : /pool|swim/i.test(a) ? "waves" : /power|generator|backup|solar|electric|inverter/i.test(a) ? "bolt" : /smart|wi-?fi|internet/i.test(a) ? "chip" : /garden|tree|lawn/i.test(a) ? "tree" : /water|borehole/i.test(a) ? "drop" : /gym|fitness/i.test(a) ? "dumbbell" : /balcon|terrace/i.test(a) ? "building" : "check");

// An illustrative room layout built from the bedrooms, bathrooms and size in the listing.
function planHtml(l) {
  const b = +l.beds || 0, ba = +l.baths || 0, sqft = l.sqm ? Math.round(l.sqm * 10.764) : 0, part = (f) => (sqft ? `≈ ${Math.round(sqft * f).toLocaleString("en-NG")} sqft` : "");
  const cell = (n, sub = "", cls = "") => `<div class="fp-c ${cls}"><b>${esc(n)}</b>${sub ? `<small>${esc(sub)}</small>` : ""}</div>`;
  if (!b) return `<div class="fp"><div class="fp-row">${cell("Living & Sleeping", part(0.6), "hl")}${cell("Kitchenette")}</div><div class="fp-row">${cell("Bathroom")}${cell("Entrance")}</div></div><p class="fp-note">Illustrative layout based on the listing details. Not to scale.</p>`;
  const beds = Math.min(b, 6), top = [cell("Living & Dining", part(0.28), "hl wide"), cell("Kitchen")];
  if (b >= 3) top.push(cell("Family Lounge"));
  return `<div class="fp"><div class="fp-row top">${top.join("")}</div><div class="fp-row">${Array.from({ length: beds }, (_, k) => cell(k ? `Bedroom ${k + 1}` : "Master Suite", ba >= b ? "en suite" : k === 0 ? "en suite" : "")).join("")}</div></div><p class="fp-note">Illustrative layout based on the listing details. Not to scale.</p>`;
}

const TABS = [["overview", "Overview"], ["features", "Features"], ["location", "Location"], ["hood", "Neighbourhood"], ["plan", "Floor plan"], ["media", "Media"]];
const PLACE = (l) => placeOf(l);

export async function detail(ctx, id) {
  const l = await st.getListing(id);
  if (!l) return { title: "Not found", html: `<div class="wrap hx">${emptyState({ ic: "home", cls: "hx-empty--lg", title: "This home isn’t available", text: "It may have been rented or taken down. There are plenty more to explore.", actions: [["#/search", "Browse homes", true], ["#/", "Back home"]] })}</div>` };
  const S = ctx.S, mi = AREA.moveIn(l), total = mi.total, on = S.saved.has(l.id), open = isOpen(l);
  const im = photosOf(l), n = im.length, vids = (l.videos || []).map((u) => ({ type: "video", ...videoEmbed(u) })), media = [...im.map((src) => ({ type: "img", src })), ...vids];
  const all = (await st.getListings().catch(() => [])).filter((x) => x.id !== l.id), sameCity = all.filter((x) => !l.city || x.city === l.city), cat = catOf(l);
  const similar = [...sameCity.filter((x) => catOf(x) === cat), ...sameCity.filter((x) => catOf(x) !== cat)].slice(0, 8);
  const hasPin = l.lat != null && l.lng != null && l.hasPin !== false && isFinite(+l.lat) && isFinite(+l.lng);
  const lid = "FR-" + String([...String(l.id)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 9000, 7) + 1000);
  const amen = Array.isArray(l.amenities) ? l.amenities : [];
  const featureRows = Array.isArray(l.features) ? l.features.filter((x) => x && typeof x.name === "string" && +x.count > 0) : [];
  const featureNames = new Set(featureRows.map((x) => x.name.toLowerCase()));
  const parking = l.parking != null && l.parking !== "" ? `${l.parking} space${+l.parking === 1 ? "" : "s"}` : amen.includes("Parking") ? "Available" : "None listed";
  const info = [["home", "Property type", catName(l)], ...(l.buildingType ? [["building", "Building", l.buildingType]] : []), ...(l.floorNumber != null ? [["layers", "Floor", +l.floorNumber === 0 ? "Ground floor" : l.floorNumber]] : []), ...(l.roomNumber ? [["door-open", "Room / apartment", l.roomNumber]] : []), ["area", "Size", l.sqm ? `${l.sqm} m²` : ""], ["cal", "Year built", l.yearBuilt || ""], ["car", "Parking", parking === "None listed" ? "" : parking], ["building", "Furnishing", l.furnished || ""], ["list", "Listing ID", lid]];
  const bkDays = []; for (let k = 1; bkDays.length < 7; k++) { const d = new Date(Date.now() + k * 864e5); if (d.getDay() === 0) continue; bkDays.push([d.toISOString().slice(0, 10), d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })]); }
  const desc = String(l.desc || "").split(/\n+/).map((x) => x.trim()).filter(Boolean), long = desc.join(" ").length > 520;
  const agent = l.agent || {}, aName = agent.name || "Faxton agent", place = PLACE(l), crumbArea = String(l.area || "").split(",")[0].trim();
  const feesOnly = total - mi.rent - mi.caution;
  const TIMES = [["10:00 AM", "10 AM"], ["12:00 PM", "12 PM"], ["2:00 PM", "2 PM"], ["4:00 PM", "4 PM"]];
  const av = agent.avatar ? `<img class="pd-av" src="${esc(agent.avatar)}" alt="" width="48" height="48" decoding="async">` : `<span class="pd-av fb">${esc(initials(aName))}</span>`;

  // ----- gallery -----
  const shown = im.slice(0, 6);
  const gal = n
    ? `<div class="pd-galw"><div class="pd-gal n${Math.min(n, 5) === 4 ? 3 : Math.min(n, 5)}" id="pdGal" data-total="${n}">${shown.map((src, k) => `<button type="button" class="pd-ph" data-k="${k}" aria-label="Open photo ${k + 1} of ${n}"><img src="${esc(src)}" alt="${k ? "" : esc(l.title)}" width="1200" height="800" decoding="async" ${k ? 'loading="lazy"' : 'fetchpriority="high"'}></button>`).join("")}</div>
        <span class="pd-cnt" aria-hidden="true">1 / ${n}</span>${n > 1 ? `<button type="button" class="pd-show" id="all">${icon("img", 18)} <span>Show all ${n} photos</span></button>` : ""}</div>`
    : `<div class="pd-galw"><div class="pd-gal n0"><div class="pd-none">${icon("camera", 34, 1.4)}<b>Photos coming soon</b><span>The agent hasn’t added photos to this home yet.</span></div></div></div>`;

  const sideCard = `<div class="pd-card" id="pdCard">
      <div class="pd-pr"><div class="pd-price num">${l.price > 0 ? naira(l.price) : "Price on request"}${l.price > 0 ? "<small> / year</small>" : ""}</div><span class="pd-tag ${open ? "" : "off"}"><i></i>${open ? "Available" : "Rented"}</span></div>
      <dl class="pd-sum num"><div><dt>Rent</dt><dd>${naira(mi.rent)}</dd></div><div><dt>Fees and charges</dt><dd>${naira(feesOnly)}</dd></div><div><dt>Caution <em>refundable</em></dt><dd>${naira(mi.caution)}</dd></div><div class="tot"><dt>Move-in total</dt><dd>${naira(total)}</dd></div></dl>
      <a class="pd-tcl" href="#" id="tcJump">${icon("calc", 16)} See the full cost breakdown</a>
      <button class="btn primary block pd-apply" id="apply" ${open ? "" : "disabled"}>${open ? "Apply to rent" : "Not available right now"} ${open ? icon("arrow", 18) : ""}</button>
      <div class="pd-agent"><button type="button" class="pd-agent-b" id="pdAgent" aria-label="View ${esc(aName)}’s profile">${av}<i class="on" title="Online"></i></button><div><a class="pd-agent-n" href="#/agent/${esc(agent.id || "")}">${esc(aName)}</a><small>${esc(agent.title || "Property consultant")}</small>${agent.rating ? `<div class="pd-rate">${icon("star", 13)} <b>${esc(agent.rating)}</b></div>` : ""}</div></div>
      <div class="pd-msg"><button class="btn block" id="msg">${icon("msg", 18)} Message agent</button><button class="btn pd-call" id="callAgent" aria-label="Call the agent" title="Call the agent">${icon("phone", 18)}</button></div>
      <div class="pd-book" id="pdBook"><h3>Book a viewing</h3>
        <div class="pd-seg" role="radiogroup" aria-label="Tour type"><button type="button" role="radio" aria-checked="true" class="on" data-tour="person">In person</button><button type="button" role="radio" aria-checked="false" data-tour="virtual">Virtual</button></div>
        ${ddSelect({ name: "bkDate", label: "Date", ic: "cal", options: bkDays, value: bkDays[0][0], bare: true, cls: "dd-field dd-block dd-sm", title: "Pick a day" })}
        <div class="pd-times" id="bkTimes" role="radiogroup" aria-label="Time">${TIMES.map(([v, t], k) => `<button type="button" role="radio" aria-checked="${!k}" class="${k ? "" : "on"}" data-time="${v}">${t}</button>`).join("")}</div>
        <div class="pd-two"><button class="btn" id="view">${icon("cal", 17)} Book a viewing</button><button class="btn" id="offer">${icon("tag", 17)} Make an offer</button></div><div id="ofBanner"></div></div>
      <p class="pd-terms">${icon("info", 16)}<span>Read the <a class="link" href="#/terms">terms</a> before you make a payment.</span></p></div>`;

  const html = `<div class="wrap pd">
    <nav class="pd-crumbs" aria-label="Breadcrumb"><a href="#/">Home</a><span aria-hidden="true">/</span><a href="#/search">Rent</a>${crumbArea ? `<span aria-hidden="true">/</span><b aria-current="page">${esc(crumbArea)}</b>` : ""}</nav>
    <header class="pd-head"><div class="pd-ttl">
        <div class="pd-badges"><span class="pd-tag ${open ? "" : "off"}"><i></i>${open ? "Available" : "Rented"}</span><span class="pd-kind">${esc(catName(l))}</span><span class="pd-ver" hidden>${verifiedBadge(15)}<em>Verified agent</em></span></div>
        <h1 class="${String(l.title || "").length > 56 ? "sm" : ""}">${esc(l.title || "Untitled home")}</h1><p class="pd-loc">${icon("pin", 17)}<span>${esc(place)}</span></p></div>
      <div class="pd-acts"><button class="btn" id="save" aria-pressed="${on}">${icon("heart", 18)} <span>${on ? "Saved" : "Save"}</span></button><button class="btn" id="share">${icon("share", 18)} Share</button></div></header>
    ${gal}
    ${vids.length ? `<div class="pd-vid"><button type="button" class="pd-vidb" data-vid="${im.length}"><span class="pd-vidi">${icon("video", 20)}</span><span><b>Watch ${vids.length > 1 ? vids.length + " videos" : "the video tour"}</b><small>${n} photo${n === 1 ? "" : "s"} · ${vids.length} video${vids.length === 1 ? "" : "s"}</small></span></button></div>` : ""}
    <div class="pd-grid"><div class="pd-main">
      <ul class="pd-facts"><li>${icon("bed", 20)}<span>${l.beds === 0 ? "Studio" : bedsLabel(l.beds ?? 0).replace("bed", "bedroom")}</span></li>${l.baths ? `<li>${icon("bath", 20)}<span>${bathsLabel(l.baths).replace("bath", "bathroom")}</span></li>` : ""}${l.sqm ? `<li>${icon("area", 20)}<span>${esc(l.sqm)} m²</span></li>` : ""}${parking !== "None listed" ? `<li>${icon("car", 20)}<span>${esc(parking)}</span></li>` : ""}</ul>
      <div class="pd-tabs dt-tabs" role="tablist" aria-label="About this home">${TABS.map(([k, t], k2) => `<button type="button" role="tab" id="tab-${k}" class="${k2 ? "" : "on"}" aria-selected="${!k2}" aria-controls="p-${k}" data-pane="${k}" ${k2 ? 'tabindex="-1"' : ""}>${t}</button>`).join("")}</div>
      <section class="pd-pane" id="p-overview" role="tabpanel" aria-labelledby="tab-overview"><h2>About this home</h2>
        ${desc.length ? `<div class="pd-desc ${long ? "clamp" : ""}" id="pdDesc">${desc.map((x) => `<p>${esc(x)}</p>`).join("")}</div>${long ? `<button type="button" class="pd-more" id="pdMore" aria-expanded="false">Read more</button>` : ""}` : `<p class="muted">The agent hasn’t added a description yet. Message them to ask anything about this home.</p>`}
        <p class="pd-listed">Listed by ${esc(aName)}. Rent is paid per year. Documents are available for inspection after your viewing.</p>
        <div class="pd-info">${info.map(([ic, k, v]) => `<div><span>${icon(ic, 17)} ${k}</span><b class="${v ? "" : "no"}">${v ? esc(v) : "Not listed"}</b></div>`).join("")}</div>
        ${AREA.costHtml(l)}</section>
      <section class="pd-pane" id="p-features" role="tabpanel" aria-labelledby="tab-features" hidden><h2>Features and amenities</h2>${featureRows.length || amen.length ? `<div class="pd-am">${[...featureRows.map((f) => ({ name: f.name, label: `${f.name} · ${f.count}` })), ...amen.filter((a) => !featureNames.has(String(a).toLowerCase())).map((a) => ({ name: a, label: a }))].map((f) => `<div class="pd-amc"><span>${icon(amenIcon(f.name), 20)}</span><b>${esc(f.label)}</b></div>`).join("")}</div>` : `<p class="muted">No features have been listed yet.</p>`}
        <div class="pd-info two"><div><span>Bedrooms</span><b>${l.beds === 0 ? "Studio" : esc(l.beds ?? "–")}</b></div><div><span>Bathrooms</span><b>${esc(l.baths ?? "–")}</b></div><div><span>Area</span><b class="${l.sqm ? "" : "no"}">${l.sqm ? l.sqm + " m²" : "Not listed"}</b></div><div><span>Parking</span><b>${esc(parking)}</b></div></div></section>
      <section class="pd-pane" id="p-location" role="tabpanel" aria-labelledby="tab-location" hidden><h2>Location</h2>
        ${hasPin ? `<div class="pd-map" id="dmap"><span class="pd-map-pill">${esc(place)}</span></div>` : `<div class="pd-map none"><span>${icon("pin", 28)}</span><b>${esc(place)}</b><small>The exact pin hasn’t been shared yet.</small></div>`}
        <div class="pd-map-row"><span class="muted">${icon("pin", 16)} ${esc(place)}</span><a class="btn" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${hasPin ? l.lat + "," + l.lng : encodeURIComponent(place)}">${icon("arrow", 16)} Open in Google Maps</a></div></section>
      <section class="pd-pane" id="p-hood" role="tabpanel" aria-labelledby="tab-hood" hidden>${AREA.neighbourhoodHtml(l, all)}</section>
      <section class="pd-pane" id="p-plan" role="tabpanel" aria-labelledby="tab-plan" hidden><h2>Floor plan</h2>${l.floorPlan ? `<img class="pd-fp" src="${esc(l.floorPlan)}" alt="Floor plan of ${esc(l.title)}" loading="lazy" decoding="async">` : planHtml(l)}</section>
      <section class="pd-pane" id="p-media" role="tabpanel" aria-labelledby="tab-media" hidden><h2>Photos <b class="pd-n">${n}</b></h2>${n ? `<div class="pd-mg">${im.map((src, k) => `<button type="button" class="pd-mi" data-m="${k}" aria-label="Open photo ${k + 1}"><img src="${esc(src)}" alt="" width="400" height="300" loading="lazy" decoding="async"></button>`).join("")}</div>` : `<p class="muted">No photos yet.</p>`}
        ${vids.length ? `<h2>Videos <b class="pd-n">${vids.length}</b></h2><div class="pd-mg">${vids.map((v, k) => `<button type="button" class="pd-mi pd-mv" data-m="${im.length + k}" aria-label="Play video ${k + 1}">${v.thumb ? `<img src="${esc(v.thumb)}" alt="" width="400" height="300" loading="lazy" decoding="async">` : `<span class="pd-mvb"></span>`}<span class="pd-play">${icon("play", 24)}</span><em>Video ${k + 1}</em></button>`).join("")}</div>` : `<p class="muted pd-novid">No videos have been added for this home yet.</p>`}</section>
    </div>
    <aside class="pd-side" aria-label="Rent and contact">${sideCard}</aside></div>
    ${similar.length ? `<section class="pd-sim" aria-labelledby="pdSimH"><div class="pd-sim-head"><div><h2 id="pdSimH">Similar homes</h2><p class="muted">More like this${l.city ? " in " + esc(l.city) : ""}</p></div><div class="pd-sim-nav"><button type="button" class="icon-btn" id="simPrev" aria-label="Previous homes">${icon("chev", 18, 2)}</button><button type="button" class="icon-btn" id="simNext" aria-label="Next homes">${icon("chev", 18, 2)}</button></div></div>
      <div class="pd-sim-row" id="pdSim">${similar.map((x, k) => listingCard(x, S.saved, { i: k, size: "sim" })).join("")}</div></section>` : ""}
    <div class="pd-bar" id="pdBar"><div class="pd-bar-p"><b class="num">${l.price > 0 ? naira(l.price) : "On request"}${l.price > 0 ? "<small> / year</small>" : ""}</b><small class="num">Move-in ${naira(total)}</small></div><button type="button" class="icon-btn pd-bar-m" data-act="msg" aria-label="Message the agent">${icon("msg", 20)}</button><button type="button" class="btn primary" data-act="apply" ${open ? "" : "disabled"}>${open ? "Apply to rent" : "Rented"}</button></div>
  </div>`;

  return { title: l.title || "Home", html, mount(root) {
    const authed = (fn) => () => (S.user ? fn() : (toast("Please sign in first."), ctx.go("#/login?next=" + encodeURIComponent("/home/" + l.id))));
    bindCards(root, ctx); mountDd(root, { cleanups: S.cleanups });
    // ---- save / share ----
    $("#save").onclick = async () => { const nxt = !S.saved.has(l.id); await ctx.setSaved(l.id, nxt); const now = S.saved.has(l.id); $("#save span").textContent = now ? "Saved" : "Save"; $("#save").setAttribute("aria-pressed", now); $("#save").classList.toggle("is-on", now); };
    $("#save").classList.toggle("is-on", on);
    $("#share").onclick = async () => { const url = location.href; try { navigator.share ? await navigator.share({ title: l.title, url }) : (await navigator.clipboard.writeText(url), toast("Link copied.")); } catch {} };
    // ---- gallery ----
    const openAt = (k) => openViewer(media, k);
    $$(".pd-ph", root).forEach((b) => (b.onclick = () => openAt(+b.dataset.k)));
    $("#all", root)?.addEventListener("click", () => openAt(0));
    const gal = $("#pdGal", root);
    if (gal && n > 1) gal.addEventListener("scroll", () => { const t = $(".pd-ph", gal), k = Math.round(gal.scrollLeft / Math.max(1, (t?.offsetWidth || gal.clientWidth) + 8)); $(".pd-cnt", root).textContent = `${Math.min(k + 1, n)} / ${n}`; }, { passive: true });
    $$("[data-vid]", root).forEach((b) => (b.onclick = () => openAt(+b.dataset.vid)));
    $$("[data-m]", root).forEach((b) => (b.onclick = () => openAt(+b.dataset.m)));
    // ---- tabs ----
    let mapDone = false, hoodDone = false;
    const tabs = $$(".pd-tabs [data-pane]", root), bar = $(".pd-tabs", root);
    const topH = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--fx-top-h")) || 64;
    const pick = (b, focus) => {
      tabs.forEach((x) => { const o = x === b; x.classList.toggle("on", o); x.setAttribute("aria-selected", o); x.tabIndex = o ? 0 : -1; });
      $$(".pd-pane", root).forEach((p) => (p.hidden = p.id !== "p-" + b.dataset.pane));
      if (focus) b.focus();
      const y = bar.getBoundingClientRect().top + scrollY - topH() - 4; if (scrollY > y) scrollTo({ top: Math.max(0, y), behavior: "auto" });
      b.scrollIntoView?.({ block: "nearest", inline: "center" });
      if (b.dataset.pane === "hood" && !hoodDone) { hoodDone = true; AREA.mountNeighbourhood($("#p-hood", root), l); }
      if (b.dataset.pane === "location" && hasPin && !mapDone) { mapDone = true; mountMap(); }
    };
    tabs.forEach((b) => { b.onclick = () => pick(b); b.onkeydown = (e) => { const k = tabs.indexOf(b), nx = { ArrowRight: k + 1, ArrowLeft: k - 1, Home: 0, End: tabs.length - 1 }[e.key]; if (nx == null) return; e.preventDefault(); const t = tabs[(nx + tabs.length) % tabs.length]; pick(t, true); }; });
    const mountMap = () => loadLeaflet().then(() => {
      const el = $("#dmap", root); if (!el) return;
      const map = L.map(el, { scrollWheelZoom: false, zoomControl: true }).setView([+l.lat, +l.lng], 15); tiles().addTo(map); L.marker([+l.lat, +l.lng], { icon: homePin(l.title) }).addTo(map); ctrlZoom(map);
      setTimeout(() => map.invalidateSize(), 120); S.cleanups.push(() => map.remove());
    }).catch(() => { mapDone = false; const el = $("#dmap", root); if (el && !$(".pd-map-err", el)) el.insertAdjacentHTML("beforeend", `<div class="pd-map-err">${icon("info", 18)}<span>The map couldn’t load. Open it in Google Maps instead.</span></div>`); });
    $("#pdMore", root)?.addEventListener("click", (e) => { const d = $("#pdDesc", root), x = d.classList.toggle("clamp"); e.target.textContent = x ? "Read more" : "Show less"; e.target.setAttribute("aria-expanded", String(!x)); });
    AREA.mountCost(root, l);
    $("#tcJump", root).onclick = (e) => { e.preventDefault(); pick(tabs[0]); $(".tc", root)?.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "start" }); };
    // ---- verified mark ----
    st.getPublic(l.ownerUid || agent.id).then((pb) => { if (pb?.verified) { $(".pd-agent-n", root)?.insertAdjacentHTML("beforeend", " " + verifiedBadge(16)); const v = $(".pd-ver", root); if (v) v.hidden = false; } }).catch(() => {});
    $("#pdAgent", root).onclick = async () => { const uid = l.ownerUid || agent.id, pb = await st.getPublic(uid); openProfile(ctx, { uid, name: aName, avatar: agent.avatar, role: ["agent", "agency", "landlord"].includes(pb?.role) ? pb.role : "agent", area: l.area, onMessage: () => $("#msg")?.click(), onCall: () => $("#callAgent")?.click() }); };
    // ---- actions ----
    $("#msg").onclick = authed(async () => { try { const cid = await st.ensureConversation(S.user, l); ctx.go("#/messages/" + cid); } catch (e) { toast(friendlyErr(e)); } });
    let tour = "person", slot = "10:00 AM";
    $$("[data-tour]", root).forEach((b) => (b.onclick = () => { tour = b.dataset.tour; $$("[data-tour]", root).forEach((x) => { x.classList.toggle("on", x === b); x.setAttribute("aria-checked", x === b); }); }));
    $$("[data-time]", root).forEach((b) => (b.onclick = () => { slot = b.dataset.time; $$("[data-time]", root).forEach((x) => { x.classList.toggle("on", x === b); x.setAttribute("aria-checked", x === b); }); }));
    $("#view").onclick = authed(() => ctx.go(`#/book/${l.id}?date=${$("input[name=bkDate]", root).value}&slot=${encodeURIComponent(slot)}&tour=${tour}`));
    $("#callAgent").onclick = authed(async () => { try { const cid = await st.ensureConversation(S.user, l), to = l.ownerUid && l.ownerUid !== S.user.uid ? l.ownerUid : "staff"; CALLS2.startCall(ctx, { convId: cid, to, toName: to === "staff" ? "Faxton team" : aName, kind: "voice", title: l.title, image: l.thumb || im[0], area: l.area }); } catch (e) { toast(friendlyErr(e)); } });
    const apply = authed(() => { if (!open) return toast("This home isn’t available right now."); ctx.go("#/apply/" + l.id); });
    $("#apply").onclick = apply;
    $$("[data-act]", root).forEach((b) => (b.onclick = b.dataset.act === "apply" ? apply : () => $("#msg").click()));
    const ofBan = async () => { if (!S.user) return; const o = await OFFERS.myOpenOffer(S.user.uid, l.id).catch(() => null), b = $("#ofBanner"); if (!b) return; b.innerHTML = o ? `<a class="of-ban ${esc(String(o.status).toLowerCase())}" href="#/offers">${icon("tag", 16)}<span><b>${o.status === "Accepted" ? "Offer accepted at " + naira(o.amount) : o.status === "Countered" ? "Counter-offer: " + naira(o.amount) : "Your offer: " + naira(o.amount)}</b><small>${o.status === "Accepted" ? "Apply at the agreed rent" : o.status === "Countered" ? "The owner replied. Your turn." : "Waiting for the owner"}</small></span>${icon("arrow", 16)}</a>` : ""; };
    ofBan();
    $("#offer").onclick = authed(() => { if (S.user.uid === l.ownerUid) return toast("This is your own listing."); if (!open) return toast("This home isn’t available right now."); OFFERS.offerDialog(ctx, l, ofBan); });
    // ---- similar homes ----
    const row = $("#pdSim", root);
    if (row) { const sc = (d) => row.scrollBy({ left: d * Math.max(260, row.clientWidth * .8), behavior: reduced() ? "auto" : "smooth" }); $("#simPrev", root).onclick = () => sc(-1); $("#simNext", root).onclick = () => sc(1); }
    // ---- the sticky card must always fit the window: never taller than the screen, never scrolling inside itself ----
    const card = $("#pdCard", root), side = $(".pd-side", root);
    const fit = () => { if (!card.isConnected) return; side.classList.remove("static"); const room = innerHeight - topH() - 28; side.classList.toggle("static", card.offsetHeight > room); };
    fit(); addEventListener("resize", fit); S.cleanups.push(() => removeEventListener("resize", fit));
    if (window.ResizeObserver) { const ro = new ResizeObserver(fit); ro.observe(card); S.cleanups.push(() => ro.disconnect()); }
  } };
}
