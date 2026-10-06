import { $, esc, icon } from "./ui.js";

// A short, fixed product tour shown once after a user's first sign-in (and replayable from Settings).
const key = (u) => `tour_${u.uid}`;
export const tourSeen = (u) => { try { return localStorage.getItem(key(u)) === "1"; } catch { return true; } };
export const resetTour = (u) => { try { localStorage.removeItem(key(u)); } catch {} };
const done = (u) => { try { localStorage.setItem(key(u), "1"); } catch {} };
let running = false;

export function startTour(user, firstName = "") {
  if (running) return; running = true;
  const all = [
    { t: `Welcome${firstName ? ", " + esc(firstName) : ""}!`, b: "Take a 30-second tour of Faxton Rentals. You can skip it any time." },
    { sel: "#sb", t: "Search for homes", b: "Choose a location, property type and budget, then tap <b>Search homes</b>." },
    { sel: ".cards .card", t: "Browse and save", b: "Hover a home for a quick preview. Tap the heart to save it, or open it for photos, prices and to book a viewing." },
    { sel: ".tn-links", t: "Find your way around", b: "Use <b>Home</b>, <b>Find a home</b>, <b>Saved homes</b>, <b>Messages</b> and <b>My rentals</b> to move between pages." },
    { sel: "#bell", t: "Messages and updates", b: "A dot shows when an agent replies. Chat with agents before you visit." },
    { sel: "#meBtn", t: "Your account", b: "Settings, bookings, payments and sign out live in this menu." },
    { t: "You’re all set", b: "Find a home you love, book a viewing and apply to rent — all in one place." },
  ];
  const steps = all.filter((s) => !s.sel || $(s.sel)?.offsetParent);
  let i = 0;
  const root = document.createElement("div"); root.className = "tour"; root.setAttribute("role", "dialog"); root.setAttribute("aria-modal", "true"); root.setAttribute("aria-label", "Product tour");
  root.innerHTML = `<div class="tour-spot"></div><div class="tour-card"><div class="tour-step"></div><h3 class="tour-t"></h3><p class="tour-b"></p>
    <div class="tour-dots"></div><div class="tour-actions"><button class="btn sm ghost" data-skip>Skip tour</button><span style="flex:1"></span><button class="btn sm" data-back>Back</button><button class="btn sm primary" data-next>Next</button></div></div>`;
  document.body.append(root);
  const spot = $(".tour-spot", root), card = $(".tour-card", root);

  const place = () => {
    const s = steps[i], el = s.sel && $(s.sel), pad = 10;
    if (el) {
      const r = el.getBoundingClientRect();
      Object.assign(spot.style, { top: r.top - pad + "px", left: r.left - pad + "px", width: r.width + pad * 2 + "px", height: r.height + pad * 2 + "px", opacity: 1, borderRadius: "16px" });
      const cw = Math.min(360, innerWidth - 24), below = r.bottom + pad + 16 + 230 < innerHeight;
      let left = Math.min(Math.max(12, r.left + r.width / 2 - cw / 2), innerWidth - cw - 12);
      card.style.cssText = `width:${cw}px;left:${left}px;top:${below ? r.bottom + pad + 14 : Math.max(12, r.top - pad - 14 - card.offsetHeight)}px;transform:none`;
    } else {
      Object.assign(spot.style, { top: innerHeight / 2 + "px", left: innerWidth / 2 + "px", width: "0px", height: "0px", opacity: 1, borderRadius: "16px" });
      card.style.cssText = `width:${Math.min(400, innerWidth - 24)}px;left:50%;top:50%;transform:translate(-50%,-50%)`;
    }
  };
  const show = () => {
    const s = steps[i], el = s.sel && $(s.sel);
    $(".tour-step", root).textContent = `Step ${i + 1} of ${steps.length}`;
    $(".tour-t", root).innerHTML = s.t; $(".tour-b", root).innerHTML = s.b;
    $(".tour-dots", root).innerHTML = steps.map((_, k) => `<i class="${k === i ? "on" : ""}"></i>`).join("");
    $("[data-back]", root).style.visibility = i ? "visible" : "hidden";
    $("[data-skip]", root).style.visibility = i === steps.length - 1 ? "hidden" : "visible";
    $("[data-next]", root).textContent = i === steps.length - 1 ? "Get started" : "Next";
    card.classList.remove("in"); void card.offsetWidth; card.classList.add("in");
    if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
    document.body.classList.toggle("tour-rail", !!s.rail);
    place(); setTimeout(place, 350); setTimeout(place, 700);
  };
  const close = () => { done(user); running = false; document.body.classList.remove("tour-rail"); root.classList.add("out"); removeEventListener("resize", place); removeEventListener("keydown", key2); setTimeout(() => root.remove(), 350); };
  const key2 = (e) => { if (e.key === "Escape") close(); if (e.key === "ArrowRight") next(); if (e.key === "ArrowLeft") back(); };
  const next = () => (i < steps.length - 1 ? (i++, show()) : close()), back = () => { if (i) { i--; show(); } };
  $("[data-next]", root).onclick = next; $("[data-back]", root).onclick = back; $("[data-skip]", root).onclick = close;
  addEventListener("resize", place); addEventListener("keydown", key2);
  requestAnimationFrame(() => { root.classList.add("on"); show(); $("[data-next]", root).focus({ preventScroll: true }); });
}
