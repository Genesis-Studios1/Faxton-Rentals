// Custom dropdowns and filter panels (the native select list is never shown).
// On phones the list opens as a bottom sheet with a grab handle, on larger screens as a popover under the button.
// Styling lives in css/home.css (.dd*).
import { esc, icon, $, $$ } from "./ui.js";

const SHEET = "(max-width:700px)";

// One value picked from a list. A hidden input carries the value, so the control works inside a normal <form>.
export const ddSelect = ({ name, label, ic, options, value = "", cls = "", title = "", bare = false }) => {
  const cur = options.find(([v]) => String(v) === String(value)) || options[0] || ["", ""];
  return `<div class="dd ${cls}" data-dd="${esc(name)}">
    <input type="hidden" name="${esc(name)}" value="${esc(cur[0])}">
    <button type="button" class="dd-btn" aria-haspopup="listbox" aria-expanded="false">${ic ? `<span class="dd-ic">${icon(ic, 20)}</span>` : ""}<span class="dd-txt">${bare ? "" : `<small>${esc(label)}</small>`}<b>${esc(cur[1])}</b></span><span class="dd-chev">${icon("chev", 16)}</span></button>
    <div class="dd-pop" role="listbox" aria-label="${esc(label)}" hidden>
      <div class="dd-head"><b>${esc(title || label)}</b><button type="button" class="dd-x" aria-label="Close">${icon("x", 20)}</button></div>
      <div class="dd-list">${options.map(([v, t]) => `<button type="button" role="option" class="dd-opt" data-v="${esc(v)}" aria-selected="${String(v) === String(cur[0])}"><span>${esc(t)}</span>${icon("check", 18, 2)}</button>`).join("")}</div>
    </div></div>`;
};

// A button that opens a panel of your own content (for example the amenities checklist).
export const ddPanel = ({ name, label, ic, badge = 0, body, cls = "", title = "" }) => `<div class="dd dd-panel ${cls}" data-dd="${esc(name)}">
    <button type="button" class="dd-btn" aria-haspopup="dialog" aria-expanded="false">${ic ? `<span class="dd-ic">${icon(ic, 20)}</span>` : ""}<span class="dd-txt"><b>${esc(label)}</b></span>${badge ? `<em class="dd-badge">${badge}</em>` : ""}<span class="dd-chev">${icon("chev", 16)}</span></button>
    <div class="dd-pop" role="dialog" aria-label="${esc(title || label)}" hidden>
      <div class="dd-head"><b>${esc(title || label)}</b><button type="button" class="dd-x" aria-label="Close">${icon("x", 20)}</button></div>
      <div class="dd-body">${body}</div>
    </div></div>`;

// Wires every .dd inside root. onSelect(name, value) fires when an option is picked.
export function mountDd(root, { onSelect, cleanups } = {}) {
  let cur = null, scrim = null;
  const sheet = () => matchMedia(SHEET).matches;
  const close = (back) => {
    if (!cur) return;
    const dd = cur; cur = null;
    $(".dd-pop", dd).hidden = true; $(".dd-btn", dd).setAttribute("aria-expanded", "false"); dd.classList.remove("open", "r");
    scrim?.remove(); scrim = null; document.documentElement.classList.remove("fx-lock");
    if (back) $(".dd-btn", dd).focus();
  };
  const open = (dd) => {
    if (cur === dd) return close(true);
    close();
    cur = dd; const pop = $(".dd-pop", dd);
    pop.hidden = false; $(".dd-btn", dd).setAttribute("aria-expanded", "true"); dd.classList.add("open");
    if (sheet()) {
      scrim = document.createElement("div"); scrim.className = "dd-scrim"; scrim.onclick = () => close(true); document.body.append(scrim);
      document.documentElement.classList.add("fx-lock");
    } else if (pop.getBoundingClientRect().right > innerWidth - 12) dd.classList.add("r");
    const pick = $('.dd-opt[aria-selected="true"]', pop) || $(".dd-opt", pop);
    pop.tabIndex = -1; setTimeout(() => (pick ? pick.focus() : pop.focus({ preventScroll: true })), 20);
  };
  const click = (e) => {
    const dd = e.target.closest?.(".dd");
    if (!dd || !root.contains(dd)) return;
    if (e.target.closest(".dd-x")) return close(true);
    const opt = e.target.closest(".dd-opt");
    if (opt && dd.contains(opt)) {
      const input = $("input[type=hidden]", dd); input.value = opt.dataset.v;
      $(".dd-txt b", dd).textContent = $("span", opt).textContent;
      $$(".dd-opt", dd).forEach((o) => o.setAttribute("aria-selected", String(o === opt)));
      close(true); dd.dispatchEvent(new CustomEvent("dd-change", { bubbles: true, detail: { name: dd.dataset.dd, value: opt.dataset.v } })); onSelect?.(dd.dataset.dd, opt.dataset.v, dd); return;
    }
    if (e.target.closest(".dd-btn")) open(dd);
  };
  const outside = (e) => { if (cur && !cur.contains(e.target) && !e.target.closest(".dd-scrim")) close(); };
  const key = (e) => {
    if (!cur) return;
    if (e.key === "Escape") { e.preventDefault(); return close(true); }
    const opts = $$(".dd-opt", cur); if (!opts.length || !["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const i = opts.indexOf(document.activeElement), n = e.key === "Home" ? 0 : e.key === "End" ? opts.length - 1 : e.key === "ArrowDown" ? (i + 1) % opts.length : (i - 1 + opts.length) % opts.length;
    opts[n].focus();
  };
  root.addEventListener("click", click); document.addEventListener("click", outside); document.addEventListener("keydown", key);
  const off = () => { close(); document.removeEventListener("click", outside); document.removeEventListener("keydown", key); };
  cleanups?.push(off);
  return { close, off };
}
