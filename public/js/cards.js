// Shared pieces for the home, search, saved and property pages: listing cards (with a photo carousel), skeletons,
// empty states and the click wiring for hearts, cards and the verified mark. Styling lives in css/home.css (.lc*).
import { esc, naira, icon, $, $$, verifiedBadge } from "./ui.js";
import * as st from "./store.js";

// ---------- vocabulary ----------
export const AREAS = [["lekki", "Lekki"], ["ajah", "Ajah"], ["yaba", "Yaba"], ["victoria", "Victoria Island"], ["ikate", "Ikate"], ["ikeja", "Ikeja"], ["", "All of Lagos"]];
export const BUDGETS = [[0, "Any price"], [1500000, "Up to ₦1.5m"], [2500000, "Up to ₦2.5m"], [3600000, "Up to ₦3.6m"], [5000000, "Up to ₦5m"], [10000000, "Up to ₦10m"]];
export const CATS = [["1bed", "1 Bedroom Apartment"], ["2bed", "2 Bedroom Apartment"], ["3bed", "3 Bedroom Apartment"], ["shortlet", "Shortlet"], ["house", "House or Duplex"], ["studio", "Studio"]];
export const catOf = (l) => { const t = String(l.type || ""); return l.shortlet || /short/i.test(t) ? "shortlet" : /studio/i.test(t) || l.beds === 0 ? "studio" : /house|duplex|detached|terrace|mansion|villa|bungalow/i.test(t) ? "house" : l.beds === 1 ? "1bed" : l.beds === 2 ? "2bed" : l.beds === 3 ? "3bed" : "house"; };
export const catName = (l) => (CATS.find((c) => c[0] === catOf(l)) || CATS[4])[1];
export const matchType = (l, t) => !t || catOf(l) === t || l.type === t;

// ---------- small helpers that never trip over missing data ----------
export const bedsLabel = (n) => (+n === 0 ? "Studio" : `${n} bed${n > 1 ? "s" : ""}`);
export const bathsLabel = (n) => `${n} bath${n > 1 ? "s" : ""}`;
export const placeOf = (l) => { const a = String(l.area || "").trim(), c = String(l.city || "").trim(); return a && c && !a.toLowerCase().includes(c.toLowerCase()) ? `${a}, ${c}` : a || c || "Lagos"; };
export const photosOf = (l) => (Array.isArray(l.images) && l.images.length ? l.images : l.thumb ? [l.thumb] : []).filter((x) => typeof x === "string" && x);
export const priceOf = (l) => (+l.price > 0 ? naira(l.price) : "Price on request");
export const isOpen = (l) => l.available !== false;

const REG = new Map(); // id -> listing, so a card can add its other photos only when someone looks at them

// ---------- the listing card ----------
// o.size "sm" is the compact phone card; o.eager marks the first cards on a page so their photos load first.
export function listingCard(l, saved, o = {}) {
  const { i = 0, size = "", eager = false, extra = "" } = o; REG.set(l.id, l);
  const photos = photosOf(l), first = l.thumb || photos[0] || "", n = Math.min(photos.length, 5), on = saved.has(l.id), open = isOpen(l);
  const media = first
    ? `<div class="lc-track"><img class="lc-img" src="${esc(first)}" alt="${esc(l.title)}" width="640" height="480" decoding="async" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'}></div>`
    : `<div class="lc-ph">${icon("home", 30, 1.4)}<span>Photos coming soon</span></div>`;
  const nav = n > 1 ? `<button type="button" class="lc-nav lc-prev" aria-label="Previous photo" tabindex="-1">${icon("chev", 18, 2)}</button><button type="button" class="lc-nav lc-next" aria-label="Next photo" tabindex="-1">${icon("chev", 18, 2)}</button>
    <div class="lc-dots" aria-hidden="true">${Array.from({ length: n }, (_, k) => `<i class="${k ? "" : "on"}"></i>`).join("")}</div>` : "";
  const meta = [[l.beds != null ? "bed" : "", bedsLabel(l.beds ?? 0)], [l.baths ? "bath" : "", l.baths ? bathsLabel(l.baths) : ""], [l.sqm ? "area" : "", l.sqm ? `${l.sqm} m²` : ""], [+l.parking > 0 ? "car" : "", +l.parking > 0 ? `${l.parking}` : ""]]
    .filter(([ic, t]) => ic && t).map(([ic, t]) => `<li>${icon(ic, 16)}<span>${esc(t)}</span></li>`).join("");
  const owner = l.ownerUid || l.agent?.id || "";
  const known = l.agent?.verified === true || l.verified === true || l.agentVerified === true;
  const ownershipChecked = l.ownershipVerified === true;
  return `<article class="lc ${size ? "lc--" + size : ""} ${open ? "" : "is-rented"}" style="--i:${Math.min(i, 9)}" data-open="${esc(l.id)}" data-owner="${esc(owner)}" data-n="${photos.length}">
    <div class="lc-media">${media}
      <span class="lc-tag ${open ? "" : "off"}"><i></i>${open ? "Available" : "Rented"}</span>
      <button type="button" class="lc-heart ${on ? "on" : ""}" data-fav="${esc(l.id)}" aria-label="${on ? "Remove " + esc(l.title) + " from saved" : "Save " + esc(l.title)}" aria-pressed="${on}">${icon("heart", 20)}</button>${nav}
    </div>
    <div class="lc-body">
      <h3 class="lc-title"><a href="#/home/${esc(l.id)}">${esc(l.title || "Untitled home")}</a></h3>
      <p class="lc-loc">${icon("pin", 15)}<span>${esc(placeOf(l))}</span></p>
      <div class="lc-price num">${esc(priceOf(l))}${+l.price > 0 ? "<small> / year</small>" : ""}</div>
      <div class="lc-foot"><ul class="lc-meta">${meta}</ul><div class="lc-verifieds"><span class="lc-v" ${known ? "" : "hidden"} title="Agent identity reviewed">${verifiedBadge(16)}<em>Verified agent</em></span><span class="lc-v lc-v--ownership" ${ownershipChecked ? "" : "hidden"} title="Property ownership evidence reviewed">${icon("shield-check", 16, 2)}<em>Ownership checked</em></span></div></div>${extra}
    </div></article>`;
}

// Cards that look like the real thing while the listings load.
export const skeletonCards = (n = 6, size = "") => Array.from({ length: n }, () => `<div class="lc lc-sk ${size ? "lc--" + size : ""}" aria-hidden="true"><div class="lc-media skel"></div><div class="lc-body"><span class="skel-line w80"></span><span class="skel-line w60"></span><span class="skel-line w40"></span></div></div>`).join("");

// ---------- empty and error states ----------
export const emptyState = ({ ic = "home", title, text = "", actions = [], cls = "" }) => `<div class="hx-empty ${cls}"><span class="hx-empty-ic">${icon(ic, 30, 1.5)}</span><h3>${title}</h3>${text ? `<p>${text}</p>` : ""}${actions.length ? `<div class="hx-empty-act">${actions.map(([href, label, primary, attr = ""]) => `<a class="btn ${primary ? "primary" : ""}" href="${href}" ${attr}>${label}</a>`).join("")}</div>` : ""}</div>`;

// "No homes yet": the real empty state when nothing has been listed. Owners get a way in, renters get a promise.
export function noHomesState(S) {
  const role = S?.profile?.role || "", home = { landlord: "#/portfolio", agency: "#/agency", agent: "#/agent-dashboard" }[role];
  return emptyState({ ic: "home", cls: "hx-empty--lg", title: "No homes yet", text: "New rentals are added every day. Check back soon, or list your own home and reach renters across Lagos.",
    actions: home ? [[home, "Add your first home", true]] : S?.user ? [["#/match", "Try Smart Home Match", true], ["#/help", "Talk to us"]] : [["#/signup", "List your home", true], ["#/login", "Sign in"]] });
}

// ---------- wiring ----------
const reduced = () => matchMedia("(prefers-reduced-motion:reduce)").matches;
function slides(card) {
  const track = $(".lc-track", card); if (!track || track.dataset.full) return track;
  track.dataset.full = "1"; const l = REG.get(card.dataset.open); if (!l) return track;
  const firstSrc = $("img", track)?.getAttribute("src");
  photosOf(l).filter((p) => p !== firstSrc).slice(0, 4).forEach((src) => { const im = new Image(); im.className = "lc-img"; im.alt = ""; im.width = 640; im.height = 480; im.loading = "lazy"; im.decoding = "async"; im.src = src; track.append(im); });
  track.addEventListener("scroll", () => { const k = Math.round(track.scrollLeft / Math.max(1, track.clientWidth)); $$(".lc-dots i", card).forEach((d, j) => d.classList.toggle("on", j === k)); }, { passive: true });
  return track;
}
const step = (card, d) => { const t = slides(card); if (!t) return; const w = t.clientWidth, max = t.scrollWidth - w, now = Math.round(t.scrollLeft / w) * w, to = now + d * w; t.scrollTo({ left: to < 0 ? max : to > max + 2 ? 0 : to, behavior: reduced() ? "auto" : "smooth" }); };

export function bindCards(root, ctx, o = {}) {
  $$("[data-fav]", root).forEach((b) => (b.onclick = async (e) => {
    e.stopPropagation(); e.preventDefault(); const id = b.dataset.fav, on = !ctx.S.saved.has(id);
    b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); if (on) { b.classList.remove("pop"); void b.offsetWidth; b.classList.add("pop"); }
    await ctx.setSaved(id, on); const now = ctx.S.saved.has(id); b.classList.toggle("on", now); b.setAttribute("aria-pressed", now); o.onFav?.(id, now);
  }));
  $$(".lc", root).forEach((c) => {
    c.addEventListener("click", (e) => {
      const nav = e.target.closest(".lc-nav");
      if (nav) { e.stopPropagation(); return step(c, nav.classList.contains("lc-next") ? 1 : -1); }
      if (e.target.closest("button,a")) return;
      ctx.go("#/home/" + c.dataset.open);
    });
    const warm = () => slides(c);
    c.addEventListener("pointerenter", warm, { once: true }); c.addEventListener("touchstart", warm, { once: true, passive: true }); c.addEventListener("focusin", warm, { once: true });
  });
  // a broken photo becomes a calm placeholder, never a broken-image icon
  if (!root.__lcErr) root.addEventListener("error", (e) => { const im = e.target; if (im.tagName === "IMG" && im.classList.contains("lc-img")) { const ph = document.createElement("div"); ph.className = "lc-ph"; ph.innerHTML = `${icon("home", 30, 1.4)}<span>Photo unavailable</span>`; im.closest(".lc-track")?.replaceWith(ph); } }, true);
  root.__lcErr = true;
  hydrateVerified(root);
}

// The green seal appears on cards whose agent has been verified by the Faxton team (looked up once per agent).
export function hydrateVerified(root) {
  const ids = [...new Set($$(".lc[data-owner]", root).map((c) => c.dataset.owner).filter(Boolean))].slice(0, 16);
  ids.forEach((uid) => st.getPublic(uid).then((p) => { if (p?.verified) $$(`.lc[data-owner="${CSS.escape(uid)}"] .lc-v`, root).forEach((v) => (v.hidden = false)); }).catch(() => {}));
}
