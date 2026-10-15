// Location pickers: a searchable combobox, and the Country > State > Local Government (LGA) set built from it.
// Type to filter and press Enter (or tap a suggestion), open the whole list with the arrow, or type a name freely.
// Country, state and LGA snap to the matching list item when you leave the field; Area / neighbourhood stays free text.
// Styling lives in css/home.css (.cmb*, .lx*).
import { esc, icon } from "./ui.js";
import { COUNTRIES } from "./countries.js";
import { NG_LGAS, NG_STATES, NG_STATE_ALIASES, NG_AREAS } from "./ng-lga.js";

export const NIGERIA = "Nigeria", FCT = "Federal Capital Territory";
export const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/['’`]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const lev = (a, b) => {
  if (Math.abs(a.length - b.length) > 2) return 9;
  let p = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) { const c = [i]; for (let j = 1; j <= b.length; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); p = c; }
  return p[b.length];
};
const toOpt = (o) => { const x = typeof o === "string" ? { t: o } : { ...o }; x.k = norm(x.t); x.ak = (x.alts || []).map(norm); return x; };

// ---------- data helpers ----------
const COUNTRY_ALTS = { "Côte d’Ivoire": ["Ivory Coast"], "Türkiye": ["Turkey"], "United States": ["USA", "US", "America", "United States of America"], "United Kingdom": ["UK", "England", "Britain", "Great Britain"], "Czechia": ["Czech Republic"], "Eswatini": ["Swaziland"], "Cabo Verde": ["Cape Verde"], "Congo (Kinshasa)": ["DR Congo", "DRC", "Democratic Republic of the Congo"], "Congo (Brazzaville)": ["Republic of the Congo", "Congo"], "Myanmar": ["Burma"], "United Arab Emirates": ["UAE", "Dubai"], "South Korea": ["Korea"], "Timor-Leste": ["East Timor"], "Palestine": ["Gaza"], "Vatican City": ["Holy See"] };
export const countryOpts = () => COUNTRIES.map((t) => ({ t, alts: COUNTRY_ALTS[t] }));
export const stateOpts = () => NG_STATES.map((t) => ({ t, alts: NG_STATE_ALIASES[t] }));
export const lgaOpts = (state) => (NG_LGAS[state] || []).map((t) => ({ t }));
export const allAreaOpts = () => [...new Set(Object.values(NG_AREAS).flatMap((m) => Object.values(m).flat()))].map((t) => ({ t }));
export const areaOpts = (state, lga) => { const m = NG_AREAS[state] || {}; return (lga && m[lga] ? m[lga] : Object.values(m).flat()).map((t) => ({ t })); };
// All the places for a single search box: states, then every LGA (with its state next to it).
export const placeOpts = () => [...NG_STATES.map((t) => ({ t, sub: t === FCT ? "State (Abuja)" : "State", alts: NG_STATE_ALIASES[t], st: t })), ...NG_STATES.flatMap((s) => (NG_LGAS[s] || []).map((t) => ({ t, sub: "LGA · " + (s === FCT ? "Abuja" : s), st: s, lga: t })))];
export const findState = (s) => { const k = norm(s); return NG_STATES.find((x) => norm(x) === k || (NG_STATE_ALIASES[x] || []).some((a) => norm(a) === k)) || ""; };
// The old "city" field. For Nigeria it is the state's city (Lagos, Abuja); elsewhere the city or district that was typed.
export const cityOf = ({ country = NIGERIA, state = "", lga = "" } = {}) => (country === NIGERIA ? (state === FCT ? "Abuja" : state) : lga || state);
export const placeText = ({ lga, state, country } = {}) => [lga, state === FCT ? "FCT" : state, country].filter(Boolean).join(", ");
// The profile fields for a chosen residence { country, state, city }: country, state, lga, city and the one-line location.
export const resFields = (r) => ({ country: r.country, state: r.state || "", lga: r.country === NIGERIA ? r.lga || r.city || "" : "", city: r.city || r.lga || "", location: placeText({ lga: r.city || r.lga, state: r.state, country: r.country }).slice(0, 80) });
// Reads country/state/LGA out of a saved profile or listing, including old ones that only have `city` / `area` / `location`.
export function legacyLoc(p = {}) {
  const country = p.country || NIGERIA; let state = p.state || "", lga = p.lga || "";
  if (country === NIGERIA && !state) { state = findState(p.city) || findState(String(p.location || "").split(",")[0]); }
  if (country === NIGERIA && state && !lga && p.city) { const k = norm(p.city); lga = (NG_LGAS[state] || []).find((x) => norm(x) === k) || ""; }
  if (country !== NIGERIA && !lga) lga = p.lga || p.city || "";
  return { country, state, lga };
}

// ---------- the combobox ----------
// style: "rf" (page forms), "ax" (admin dialogs), "field" (sign-up pop-ups), "au" (sign-in / sign-up page)
export function comboHtml({ id, name = id, label, value = "", ph = "", style = "rf", req = false, flow = false, cls = "", maxlength = 80, auto = "off", hint = "" }) {
  const row = `<div class="${style === "au" ? "au-in " : ""}cmb-row"><input id="${id}" name="${esc(name)}" class="cmb-in${style === "ax" ? " ax-input" : ""}" type="text" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-haspopup="listbox" aria-controls="${id}-lb"${req ? ' aria-required="true"' : ""} autocomplete="${auto}" autocapitalize="words" autocorrect="off" spellcheck="false" enterkeyhint="next" maxlength="${maxlength}" placeholder="${esc(ph)}" value="${esc(value)}">`
    + `<button type="button" class="cmb-chev" tabindex="-1" aria-label="Show all: ${esc(label)}">${icon("chev", 16)}</button><ul class="cmb-list" id="${id}-lb" role="listbox" aria-label="${esc(label)}" hidden></ul></div>`
    + `<p class="cmb-hint" id="${id}-h" role="alert" hidden></p><span class="cmb-sr" role="status" aria-live="polite"></span>${hint ? `<small class="cmb-help">${esc(hint)}</small>` : ""}`;
  const c = `cmb ${flow ? "cmb-flow " : ""}${cls}`;
  if (style === "au") return `<div class="au-f ${c}" data-f="${id}" data-cb><label for="${id}">${esc(label)}</label>${row}<p class="au-fe" id="${id}-e" hidden></p></div>`;
  if (style === "ax") return `<div class="ax-field ${c}" data-cb><span><label for="${id}">${esc(label)}</label></span>${row}</div>`;
  if (style === "hx") return `<div class="hx-lc ${c}" data-cb><span class="hx-lc-ic">${icon("pin", 20)}</span><span class="hx-lc-t"><label for="${id}">${esc(label)}</label>${row}</span></div>`;
  if (style === "hxm") return `<div class="hx-m-cb ${c}" data-cb><label class="cmb-sr" for="${id}">${esc(label)}</label>${row}</div>`;
  if (style === "field") return `<div class="field ${c}" data-cb><label for="${id}">${esc(label)}</label>${row}</div>`;
  return `<div class="rf-fl ${c}" data-cb><label for="${id}">${esc(label)}</label>${row}</div>`;
}

export function mountCombo(root, id, cfg = {}) {
  const input = root.querySelector("#" + CSS.escape(id)); if (!input) return null; if (input._cb) return input._cb;
  const wrap = input.closest(".cmb"), list = wrap.querySelector(".cmb-list"), chev = wrap.querySelector(".cmb-chev"), hint = wrap.querySelector(".cmb-hint"), sr = wrap.querySelector(".cmb-sr"), lab = wrap.querySelector("label");
  let opts = [], shown = [], active = -1, committed = input.value.trim(), holding = false, isOpen = false, holdT = 0;
  const label = () => lab?.textContent || "this field";
  const browse = () => (cfg.browse ? cfg.browse().map(toOpt) : all());
  const all = () => (cfg.options ? (typeof cfg.options === "function" ? cfg.options() : cfg.options).map(toOpt) : opts);
  const say = (t) => { sr.textContent = t; };
  const showHint = (t) => { hint.textContent = t || ""; hint.hidden = !t; input.setAttribute("aria-invalid", t ? "true" : "false"); if (!t) input.removeAttribute("aria-invalid"); };
  // best matches first: exact, starts with, a word starts with, contains. The original order is kept inside each group (so Lagos stays on top).
  const match = (q) => {
    const k = norm(q); if (!k) return browse();
    const sc = (o) => { const ks = [o.k, ...o.ak]; if (ks.includes(k)) return 0; if (ks.some((x) => x.startsWith(k))) return 1; if (ks.some((x) => x.split(" ").some((w) => w.startsWith(k)))) return 2; if (ks.some((x) => x.includes(k))) return 3; return 9; };
    return all().map((o, i) => [sc(o), i, o]).filter((r) => r[0] < 9).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map((r) => r[2]);
  };
  const hl = (t, q) => { const i = q ? t.toLowerCase().indexOf(q.toLowerCase()) : -1; return i < 0 ? esc(t) : `${esc(t.slice(0, i))}<b>${esc(t.slice(i, i + q.length))}</b>${esc(t.slice(i + q.length))}`; };
  const paint = (q) => {
    list.innerHTML = shown.length ? shown.map((o, i) => `<li role="option" id="${id}-o${i}" data-i="${i}" aria-selected="${i === active}" class="${o.t === committed ? "cmb-sel" : ""}"><span>${hl(o.t, q)}</span>${o.sub ? `<small>${esc(o.sub)}</small>` : ""}</li>`).join("")
      : `<li class="cmb-none" role="presentation">${all().length ? "No match. Check the spelling" + (cfg.free ? ", or keep typing to use your own." : ".") : ""}</li>`;
    say(shown.length ? `${shown.length} suggestion${shown.length === 1 ? "" : "s"}` : "No suggestions");
  };
  const setActive = (i, scroll = true) => {
    active = i; list.querySelectorAll("[aria-selected]").forEach((li) => li.setAttribute("aria-selected", String(+li.dataset.i === i)));
    const el = i >= 0 ? list.children[i] : null; if (el?.id) input.setAttribute("aria-activedescendant", el.id); else input.removeAttribute("aria-activedescendant");
    if (el && scroll) { const t = el.offsetTop, b = t + el.offsetHeight; if (t < list.scrollTop) list.scrollTop = t; else if (b > list.scrollTop + list.clientHeight) list.scrollTop = b - list.clientHeight; }
  };
  const place = () => {
    wrap.classList.remove("up"); if (wrap.classList.contains("cmb-flow")) return;
    const r = list.getBoundingClientRect(), vh = window.visualViewport?.height || innerHeight, room = input.getBoundingClientRect().top;
    if (r.bottom > vh - 6 && room > r.height + 12 && room > vh - input.getBoundingClientRect().bottom) wrap.classList.add("up");
  };
  const openList = (full) => {
    const q = input.value.trim(); const list0 = browse(); if (!list0.length) return close();
    shown = full || !q || q === committed ? list0 : match(q); active = -1;
    if (!full && q && q !== committed) active = shown.length ? 0 : -1; else active = shown.findIndex((o) => o.t === committed);
    paint(full || q === committed ? "" : q); list.hidden = false; isOpen = true; input.setAttribute("aria-expanded", "true"); wrap.classList.add("open");
    setActive(active, false); place();
    const el = list.querySelector(".cmb-sel"); if (el && (full || q === committed)) list.scrollTop = Math.max(0, el.offsetTop - list.clientHeight / 2 + el.offsetHeight / 2);
  };
  function close() { if (!isOpen && list.hidden) return; list.hidden = true; isOpen = false; active = -1; input.setAttribute("aria-expanded", "false"); input.removeAttribute("aria-activedescendant"); wrap.classList.remove("open", "up"); }
  const emit = () => { input.dispatchEvent(new Event("change", { bubbles: true })); cfg.onChange?.(committed, ctl); };
  const set = (v, { silent = false } = {}) => { const t = String(v ?? "").trim(); const changed = t !== committed; input.value = t; committed = t; showHint(""); close(); if (changed && !silent) emit(); };
  const pick = (i) => { const o = shown[i]; if (!o) return; set(o.t); cfg.onPick?.(o, ctl); };
  // Leaving the field: a typed value snaps to the list item it matches (exact, the only one it starts, or one slip away).
  const commit = () => {
    const t = input.value.trim(); close();
    if (!t) { set(""); return ""; }
    const os = all(), k = norm(t);
    if (!os.length) { set(t); return t; }
    let hit = os.find((o) => o.k === k || o.ak.includes(k));
    if (!hit && !cfg.free) { const pre = os.filter((o) => o.k.startsWith(k) || o.ak.some((a) => a.startsWith(k))); if (pre.length === 1) hit = pre[0]; }
    if (!hit && !cfg.free && k.length >= 4) { const sc = os.map((o) => [Math.min(lev(k, o.k), ...o.ak.map((a) => lev(k, a))), o]).filter((r) => r[0] <= (k.length >= 7 ? 2 : 1)).sort((a, b) => a[0] - b[0]); if (sc.length && (sc.length === 1 || sc[0][0] < sc[1][0])) hit = sc[0][1]; }
    if (hit) { set(hit.t); cfg.onPick?.(hit, ctl); return hit.t; }
    if (cfg.free) { set(t); return t; }
    const pre = os.filter((o) => o.k.startsWith(k.split(" ")[0])).slice(0, 2).map((o) => o.t);
    input.value = ""; const changed = committed !== ""; committed = ""; showHint(`We couldn’t find “${t}” in the ${label().toLowerCase()} list.${pre.length ? " Did you mean " + pre.join(" or ") + "?" : " Pick one from the list."}`); if (changed) emit();
    return "";
  };
  input.addEventListener("input", () => { showHint(""); openList(false); });
  input.addEventListener("click", () => { if (!isOpen) openList(true); });
  input.addEventListener("focus", () => { if (input.value.trim() === committed) input.select?.(); });
  input.addEventListener("blur", () => { if (holding) return; commit(); });
  input.addEventListener("keydown", (e) => {
    const k = e.key;
    if (k === "ArrowDown" || k === "ArrowUp") {
      e.preventDefault(); if (!isOpen) { openList(true); if (active < 0 && shown.length) setActive(k === "ArrowDown" ? 0 : shown.length - 1); return; }
      if (!shown.length) return; setActive(k === "ArrowDown" ? (active + 1) % shown.length : (active - 1 + shown.length) % shown.length);
    } else if (k === "Home" && isOpen && active >= 0 && e.ctrlKey) { e.preventDefault(); setActive(0); }
    else if (k === "End" && isOpen && active >= 0 && e.ctrlKey) { e.preventDefault(); setActive(shown.length - 1); }
    else if (k === "Enter") {
      if (isOpen && active >= 0 && shown[active]) { e.preventDefault(); pick(active); }
      else if (isOpen && input.value.trim() && shown[0] && !cfg.free) { e.preventDefault(); pick(0); }
      else { const was = isOpen; commit(); if (was) e.preventDefault(); }
    } else if (k === "Escape" && isOpen) { e.preventDefault(); e.stopPropagation(); close(); }
    else if (k === "Tab") { /* blur commits */ }
  });
  list.addEventListener("pointerdown", (e) => { holding = true; clearTimeout(holdT); if (e.pointerType === "mouse") e.preventDefault(); });
  const release = () => { clearTimeout(holdT); holdT = setTimeout(() => { holding = false; }, 350); };
  list.addEventListener("pointerup", release); list.addEventListener("pointercancel", release);
  list.addEventListener("click", (e) => { const li = e.target.closest("li[data-i]"); holding = false; if (li) { pick(+li.dataset.i); input.focus({ preventScroll: true }); } });
  chev.addEventListener("pointerdown", (e) => { if (e.pointerType === "mouse") e.preventDefault(); });
  chev.addEventListener("click", () => { if (input.disabled) return; input.focus({ preventScroll: true }); if (isOpen) close(); else openList(true); });
  const ctl = {
    input, cfg, get: () => committed, set, commit, close, open: () => openList(true),
    setOptions(o) { opts = (o || []).map(toOpt); if (isOpen) openList(false); },
    setDisabled(b) { input.disabled = !!b; chev.disabled = !!b; wrap.classList.toggle("is-off", !!b); if (b) close(); },
    setLabel(t) { if (lab) lab.textContent = t; list.setAttribute("aria-label", t); chev.setAttribute("aria-label", "Show all: " + t); },
    setPlaceholder(t) { input.placeholder = t; }, showHint,
  };
  input._cb = ctl; if (cfg.options == null && cfg.initial) ctl.setOptions(cfg.initial); return ctl;
}

// ---------- Country > State > Local Government (LGA) ----------
const DEF_IDS = { country: "lcCountry", state: "lcState", lga: "lcLga" };
export function locFields({ style = "rf", ids = {}, names = {}, cityName = "city", country = NIGERIA, state = "", lga = "", flow = false, req = true, cls = "", area = null, cityId = "" } = {}) {
  const I = { ...DEF_IDS, ...ids }, N = { country: I.country, state: I.state, lga: I.lga, ...names }, ng = (country || NIGERIA) === NIGERIA, c = { style, flow, req };
  const quick = ng ? `<div class="lx-quick" ${state ? "hidden" : ""}><span>Quick pick</span><button type="button" data-q="Lagos">Lagos</button><button type="button" data-q="${FCT}">Abuja (FCT)</button></div>` : `<div class="lx-quick" hidden></div>`;
  return `<div class="lx lx-${style} ${cls}" data-lc>${comboHtml({ ...c, id: I.country, name: N.country, label: "Country", value: country || NIGERIA, ph: "Type or choose a country" })}
    ${comboHtml({ ...c, id: I.state, name: N.state, label: ng ? "State" : "State / region", value: state, ph: ng ? "Type or choose a state" : "State or region (optional)", req: req && ng })}
    ${comboHtml({ ...c, id: I.lga, name: N.lga, label: ng ? "Local Government (LGA)" : "City / district", value: lga, ph: ng ? (state ? "Type or choose an LGA" : "Choose a state first") : "City or district" })}
    ${area ? comboHtml({ ...c, id: area.id, name: area.name || area.id, label: area.label || "Area / neighbourhood", value: area.value || "", ph: area.ph || "e.g. Lekki Phase 1", req: false }) : ""}${quick}${cityId ? `<input type="hidden" id="${cityId}" name="${esc(cityName)}" value="${esc(cityOf({ country: country || NIGERIA, state, lga }))}">` : ""}</div>`;
}
// Wires the set above. get() gives { country, state, lga }; onChange fires after any change. `area` (optional) is a free-text field that suggests neighbourhoods.
export function mountLoc(root, { ids = {}, onChange, area = null, cityId = "" } = {}) {
  const I = { ...DEF_IDS, ...ids }, box = root.querySelector("#" + CSS.escape(I.country))?.closest("[data-lc]"); if (!box) return null;
  const q = box.querySelector(".lx-quick"), city = cityId ? root.querySelector("#" + CSS.escape(cityId)) : null;
  let c, s, l, a = null;
  const ng = () => c.get() === NIGERIA;
  const valid = () => ({ state: ng() ? (NG_STATES.includes(s.get()) ? s.get() : "") : s.get(), lga: l.get() });
  const get = () => ({ country: c.get(), state: s.get(), lga: l.get(), city: cityOf({ country: c.get(), state: s.get(), lga: l.get() }) });
  const refresh = () => {
    const n = ng(), st = s.get(), has = n && NG_LGAS[st];
    s.setLabel(n ? "State" : "State / region"); s.setPlaceholder(n ? "Type or choose a state" : "State or region (optional)"); s.setOptions(n ? stateOpts() : []);
    l.setLabel(n ? "Local Government (LGA)" : "City / district"); l.setOptions(has ? lgaOpts(st) : []); l.setDisabled(n && !has);
    l.setPlaceholder(n ? (has ? "Type or choose an LGA" : "Choose a state first") : "City or district");
    if (q) q.hidden = !(n && !st);
    if (a) a.setOptions(areaOpts(st, l.get()));
    if (city) city.value = get().city;
  };
  const fire = () => { refresh(); onChange?.(get()); };
  let wasNg = (box.querySelector("#" + CSS.escape(I.country)).value.trim() || NIGERIA) === NIGERIA;
  c = mountCombo(root, I.country, { initial: countryOpts(), onChange: () => { const n = ng(); if (n !== wasNg) { s.set("", { silent: true }); l.set("", { silent: true }); } wasNg = n; fire(); } });
  s = mountCombo(root, I.state, { onChange: () => { if (ng() && !(NG_LGAS[s.get()] || []).includes(l.get())) l.set("", { silent: true }); fire(); } });
  l = mountCombo(root, I.lga, { onChange: fire });
  if (area) a = mountCombo(root, area.id, { free: true, onChange: () => onChange?.(get()) });
  q?.addEventListener("click", (e) => { const b = e.target.closest("[data-q]"); if (b) { s.set(b.dataset.q); l.input.focus({ preventScroll: true }); } });
  refresh();
  return { get, c, s, l, a, refresh, commit: () => { c.commit(); s.commit(); l.commit(); a?.commit(); return get(); },
    set({ country = NIGERIA, state = "", lga = "" } = {}) { c.set(country, { silent: true }); s.set(state, { silent: true }); l.set(lga, { silent: true }); refresh(); }, valid };
}
// A one-line "Where?" search: suggestions are states and LGAs. Typing anything else searches that text.
export function mountPlaceSearch(root, id, { options, onPick } = {}) {
  return mountCombo(root, id, { free: true, options: options || placeOpts, onPick });
}
// What a listing form saves: the old `area` and `city` strings keep working; country, state and lga are added next to them.
export function listingLoc(L, area) { const a = String(area || "").trim(), ng = L.country === NIGERIA; return { area: a, city: L.city || cityOf(L), country: L.country, state: L.state || "", lga: ng ? L.lga || "" : "" }; }
export function listingLocError(L, area) {
  if (!L.country) return "Choose the country.";
  if (L.country === NIGERIA && !L.state) return "Choose the state.";
  if (L.country === NIGERIA && !L.lga) return "Choose the local government area (LGA).";
  if (L.country !== NIGERIA && !L.lga && !L.state) return "Enter the city or district.";
  if (!String(area || "").trim()) return "Enter the area or neighbourhood.";
  return "";
}

// Does a listing sit in this state / LGA? Listings saved with `state` / `lga` are matched exactly; older ones (city and area text only) by their text.
const lc = (v) => String(v || "").toLowerCase();
export function matchPlace(l, { state = "", lga = "" } = {}) {
  if (!state && !lga) return true;
  const st = l.state || findState(l.city) || findState(String(l.area || "").split(",").pop());
  if (state && st && st !== state) return false;
  if (state && !st && !lc(l.area + " " + l.city).includes(lc(state === FCT ? "abuja" : state))) return false;
  if (!lga) return true;
  if (l.lga) return l.lga === lga;
  const text = lc(l.area + " " + l.city);
  if (text.includes(lc(lga))) return true;
  const sts = state ? [state] : st ? [st] : Object.keys(NG_AREAS);
  return sts.some((x) => (NG_AREAS[x]?.[lga] || []).some((a) => text.includes(lc(a))));
}
