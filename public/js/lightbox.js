// One shared photo viewer: tap a person's profile picture (anywhere it shows as a photo) to see it large.
// Pictures with no photo (initials only) are not <img>s, so they do nothing. Opt a picture in with data-zoom, or it matches the list below.
const SEL = "[data-zoom], .mx-hav img, .mx-bav, .rf-person img, .rf-agent-ph, .pd-av, .cs-pic img, .cl-ph, .rf-avatar, img.avatar, img.ax-av, .pf-av img, .vs-id img.avatar, .ax-fbc img, .ax-agav img";
// Where the picture is only the handle for something else (a chat list row, a table row, the account button): leave those alone.
const SKIP = ".mx-conv, tr, [role=option], .fx-tab, .fx-ic, .ax-acct, .ax-acard, .cs-pill, .ax-tm, .ax-tar, .ax-btn";
const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
let cur = null;

const qualifies = (img) => img instanceof HTMLImageElement && img.matches(SEL) && !img.closest(SKIP) && img.complete && img.naturalWidth > 0 && !!(img.currentSrc || img.src);
const nameFor = (img) => (img.dataset.zoomName || img.alt || img.closest("[data-zoom-name]")?.dataset.zoomName || img.closest(".mx-head,.cs-ov,.rf-person,.rf-agent,.pf-sheet,.ax-id,.ax-fbc,.ax-ag,.vs-id,.cl-in,.cl-incoming,.pd-agent")?.querySelector("b,h1,h2,h3")?.textContent || "").trim().slice(0, 80);

export function closeLightbox(instant) { cur?.close(instant); }

export async function openLightbox(img, { name = nameFor(img), src = img.dataset.zoomSrc || img.currentSrc || img.src } = {}) {
  if (cur || document.documentElement.classList.contains("locked")) return; // never over the app-lock screen
  const opener = document.activeElement, from = img.getBoundingClientRect(), round = getComputedStyle(img).borderRadius.includes("%") || parseFloat(getComputedStyle(img).borderRadius) >= from.width / 2 - 1;
  const d = document.createElement("dialog"); d.className = "lbx"; d.setAttribute("aria-label", name ? `Photo of ${name}` : "Profile photo");
  d.innerHTML = `<button type="button" class="lbx-x" aria-label="Close photo"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button><figure class="lbx-f"><img class="lbx-img" alt="" decoding="async" referrerpolicy="no-referrer">${name ? `<figcaption>${name.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]))}</figcaption>` : ""}</figure>`;
  const big = d.querySelector(".lbx-img"), fig = d.querySelector(".lbx-f"), x = d.querySelector(".lbx-x"); big.src = src;
  document.body.append(d); document.documentElement.classList.add("lbx-lock"); d.showModal(); x.focus({ preventScroll: true });
  let closing = false, zoomed = false;
  const finish = () => { if (!d.isConnected) return; mo.disconnect(); d.close(); d.remove(); document.documentElement.classList.remove("lbx-lock"); cur = null; try { (img.isConnected ? (img.closest('button,a[href]') || img) : opener)?.focus?.({ preventScroll: true }); } catch {} };
  const flip = (reverse, done) => {
    if (reduce()) return done();
    const to = big.getBoundingClientRect(), a = img.isConnected ? img.getBoundingClientRect() : null;
    if (!a || !a.width || !to.width || a.bottom < 0 || a.top > innerHeight) { const an = fig.animate([{ opacity: reverse ? 1 : 0, transform: `scale(${reverse ? 1 : .96})` }, { opacity: reverse ? 0 : 1, transform: `scale(${reverse ? .96 : 1})` }], { duration: 180, fill: "both" }); an.onfinish = done; return; }
    const t = { translate: `${a.left + a.width / 2 - to.left - to.width / 2}px ${a.top + a.height / 2 - to.top - to.height / 2}px`, scale: `${a.width / to.width} ${a.height / to.height}`, borderRadius: round ? "50%" : "12px" }, n = { translate: "0 0", scale: "1 1", borderRadius: "16px" };
    const an = big.animate(reverse ? [n, t] : [t, n], { duration: 280, easing: "cubic-bezier(.2,.8,.2,1)", fill: "both" }); an.onfinish = done;
  };
  const close = (instant) => { if (closing) return; closing = true; d.classList.add("out"); if (instant) return finish(); flip(true, finish); };
  const api = { close }; cur = api;
  // The same picture, but sharper, when we only had a small thumbnail and know whose it is.
  const uid = img.dataset.zoomUid || img.closest("[data-zoom-uid],[data-u],[data-uid]")?.getAttribute("data-zoom-uid") || img.closest("[data-u],[data-uid]")?.dataset.u || img.closest("[data-uid]")?.dataset.uid;
  if (uid && !/^data:/.test(src) && !img.dataset.zoomSrc) import("./store.js").then((s) => s.getPublic(uid)).then((p) => { const hi = p?.photo; if (hi && hi !== src && !closing && /^(https:|data:image\/|img\/)/.test(hi)) { const t = new Image(); t.onload = () => { if (!closing && t.naturalWidth > big.naturalWidth) big.src = hi; }; t.src = hi; } }).catch(() => {});
  big.addEventListener("error", () => close(true), { once: true });
  const go = () => flip(false, () => {}); if (big.complete) requestAnimationFrame(go); else big.addEventListener("load", () => requestAnimationFrame(go), { once: true });
  x.onclick = () => close();
  d.addEventListener("cancel", (e) => { e.preventDefault(); close(); }); // Esc
  d.addEventListener("click", (e) => { if (e.target !== big && !e.target.closest(".lbx-x")) close(); }); // the dark area, or the caption row
  big.addEventListener("dblclick", () => { zoomed = !zoomed; big.style.transition = reduce() ? "none" : "transform .25s"; big.style.transform = zoomed ? "scale(2)" : ""; big.style.cursor = zoomed ? "zoom-out" : ""; });
  // swipe down to close (touch)
  let sy = null, dy = 0;
  fig.addEventListener("pointerdown", (e) => { if (e.pointerType === "touch" && !zoomed) { sy = e.clientY; dy = 0; } });
  fig.addEventListener("pointermove", (e) => { if (sy == null) return; dy = e.clientY - sy; if (dy > 0) { fig.style.transform = `translateY(${dy}px)`; d.style.setProperty("--lbx-o", String(Math.max(.2, 1 - dy / 400))); } });
  const up = () => { if (sy == null) return; sy = null; if (dy > 90) { close(); } else { fig.style.transform = ""; d.style.removeProperty("--lbx-o"); } };
  fig.addEventListener("pointerup", up); fig.addEventListener("pointercancel", up);
  // the app lock always wins
  const mo = new MutationObserver(() => { if (document.documentElement.classList.contains("locked")) close(true); }); mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
}

// ---- wiring (event delegation) ----
const open = (img, e) => { if (!qualifies(img)) return false; e?.preventDefault(); e?.stopPropagation(); e?.stopImmediatePropagation?.(); openLightbox(img); return true; };
document.addEventListener("click", (e) => { const img = e.target instanceof Element ? e.target.closest(SEL) : null; if (img) open(img, e); }, true);
document.addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && e.target instanceof HTMLImageElement && e.target.matches(SEL)) open(e.target, e); }, true);

// Pictures with a photo get a zoom cursor, a focus ring and keyboard access (initials-only avatars are not images, so they get none).
const mark = (root) => {
  if (!(root instanceof Element)) return;
  const list = root.matches?.(SEL) ? [root, ...root.querySelectorAll(SEL)] : [...root.querySelectorAll(SEL)];
  list.forEach((img) => {
    if (!(img instanceof HTMLImageElement) || img.__zm || img.closest(SKIP)) return; img.__zm = 1; img.classList.add("lbx-zoomable");
    if (!img.closest("button, a[href]")) { img.tabIndex = 0; img.setAttribute("role", "button"); if (!img.alt) img.setAttribute("aria-label", "View photo"); }
  });
};
let queued = [], raf = 0;
new MutationObserver((ms) => { ms.forEach((m) => m.addedNodes.forEach((n) => queued.push(n))); if (!raf) raf = requestAnimationFrame(() => { raf = 0; const q = queued; queued = []; q.forEach(mark); }); }).observe(document.documentElement, { childList: true, subtree: true });
mark(document.body || document.documentElement);
