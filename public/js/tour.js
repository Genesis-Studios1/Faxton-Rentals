import { $, esc, icon } from "./ui.js";

// Short product tours, one per kind of account. Each is shown once, the first time that dashboard opens, and can be skipped or replayed from Settings.
const key = (u, kind = "renter") => (kind === "renter" ? `tour_${u.uid}` : `tour_${u.uid}_${kind}`);
export const tourSeen = (u, kind = "renter") => { try { return localStorage.getItem(key(u, kind)) === "1"; } catch { return true; } };
export const resetTour = (u) => { try { Object.keys(localStorage).filter((k) => k.startsWith(`tour_${u.uid}`)).forEach((k) => localStorage.removeItem(k)); } catch {} };
const done = (u, kind) => { try { localStorage.setItem(key(u, kind), "1"); } catch {} };
let running = false;

const MENU = { sel: ".adm-side nav", t: "Your menu", b: "Everything you can do is in this menu. On a phone it sits along the bottom of the screen." };
const THEME = { sel: ".toggle-theme", t: "Light or dark", b: "Switch between light and dark mode any time with this button." };
const ME = { sel: ".me-btn", t: "Your account", b: "Settings and sign out live here." };
const stepsFor = (kind, name) => {
  const hi = (what) => ({ t: `Welcome${name ? ", " + esc(name) : ""}!`, b: `${what} Take a 30-second tour. You can skip it any time.` });
  const bye = (b) => ({ t: "You’re all set", b });
  return ({
    renter: [
      hi("This is Faxton Rentals."),
      { sel: "#sb", t: "Search for homes", b: "Choose a location, property type and budget, then tap <b>Search homes</b>." },
      { sel: ".cards .card", t: "Browse and save", b: "Hover a home for a quick preview. Tap the heart to save it, or open it for photos, videos, prices and to book a viewing." },
      { sel: ".tn-links", t: "Find your way around", b: "Use <b>Home</b>, <b>Find a home</b>, <b>Saved homes</b>, <b>Messages</b> and <b>My rentals</b> to move between pages." },
      { sel: "#bell", t: "Messages and updates", b: "A dot shows when an agent replies. Chat with agents before you visit." },
      { sel: "#meBtn", t: "Your account", b: "Settings, bookings, payments and sign out live in this menu." },
      bye("Find a home you love, book a viewing and apply to rent, all in one place."),
    ],
    landlord: [
      hi("This is your owner portal."), MENU,
      { sel: "[data-t=kpis]", t: "Your numbers", b: "Listings, tenants, rent roll, occupancy and viewing requests, all at a glance." },
      { sel: "#addp", t: "Add a property", b: "Submit a home with photos and a video. The Faxton team reviews it before it goes live." },
      { sel: "[data-t=pipe]", t: "Enquiries", b: "See how many people are viewing and applying month by month." },
      { sel: "[data-t=props]", t: "Your properties", b: "Each property shows its status: pending review, available or occupied." },
      { sel: "[data-t=views]", t: "Viewing requests", b: "Confirm or decline viewing requests right here." },
      THEME, ME, bye("Add your first property and start receiving enquiries."),
    ],
    agency: [
      hi("This is your agency portal."), MENU,
      { sel: "[data-t=verify]", t: "Verification", b: "Your agency is checked by the Faxton team first. You’ll be notified the moment you’re verified, and then you can list properties." },
      { sel: "[data-t=kpis]", t: "Your agency at a glance", b: "Active listings, tenants, occupancy and viewing requests across your team." },
      { sel: "#addp", t: "Add a property", b: "List homes for your clients. New listings are reviewed before they go live." },
      { sel: "[data-t=pipe]", t: "Leads pipeline", b: "Follow every lead from new enquiry to approved tenant." },
      { sel: "[data-t=props]", t: "Your listings", b: "Track every listing, its rent and how many people have enquired." },
      { sel: "[data-t=views]", t: "Viewing requests", b: "Respond quickly: fast replies win more tenants." },
      THEME, ME, bye("Your agency is ready to grow."),
    ],
    agent: [
      hi("This is your agent desk."), MENU,
      { sel: "[data-t=verify]", t: "Verification", b: "A quick check by the Faxton team comes first, usually within about 10 minutes. You’ll be notified straight away." },
      { sel: "[data-t=kpis]", t: "Your performance", b: "Your listings, leads, viewings and approved tenants in one row." },
      { sel: "#addp", t: "List a property", b: "Add homes you manage. They go live after a quick review." },
      { sel: "[data-t=pipe]", t: "Your leads", b: "See where each lead is, from first enquiry to approved tenant." },
      { sel: "[data-t=props]", t: "Your listings", b: "Open any listing to see how renters see it." },
      { sel: "[data-t=views]", t: "Viewings", b: "Confirm viewing requests and keep your diary full." },
      THEME, ME, bye("List your first home and start receiving leads."),
    ],
    admin: [
      hi("This is the Faxton admin console."), MENU,
      { sel: "[data-t=kpis]", t: "The platform at a glance", b: "Users, signups, listings, applications and open tickets. Cards with a link open the full page." },
      { sel: "[data-t=chart]", t: "Growth", b: "Charts show how signups, listings and requests grow month by month." },
      { sel: "[data-t=att]", t: "Needs attention", b: "Verifications, listings, applications, viewings and tickets that are waiting for you." },
      { sel: '.adm-side a[href="#/admin/verifications"]', t: "Verify agencies and agents", b: "Review the details they gave and verify them. They’re notified immediately and can start listing." },
      { sel: '.adm-side a[href="#/admin/users"]', t: "People and roles", b: "Give someone a role (agent, agency, support, admin) or ban an account." },
      { sel: '.adm-side a[href="#/admin/get-app"]', t: "Installations", b: "Publish new versions of the Android, Windows, Mac and Linux apps." },
      THEME, ME, bye("You’re in control. Start with anything marked Needs attention."),
    ],
    support: [
      hi("This is the support console."), MENU,
      { sel: "[data-t=kpis]", t: "Your queue in numbers", b: "Open, in-progress, resolved and overdue tickets at a glance." },
      { sel: "[data-t=queue]", t: "Ticket queue", b: "The oldest unresolved tickets come first. Click one to reply." },
      { sel: "[data-t=chats]", t: "Live conversations", b: "A red dot shows a customer is waiting for an answer." },
      { sel: '.adm-side a[href="#/support/tickets"]', t: "Reply to tickets", b: "Send replies or leave internal notes only your team can see." },
      { sel: '.adm-side a[href="#/support/suggestions"]', t: "Suggestions", b: "Ideas sent by customers from the Contact us page." },
      THEME, ME, bye("Answer the oldest tickets first and keep the overdue count at zero."),
    ],
  })[kind] || [];
};

export function startTour(user, firstName = "", kind = "renter") {
  if (running) return; running = true;
  const all = stepsFor(kind, firstName);
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
  const close = () => { done(user, kind); running = false; document.body.classList.remove("tour-rail"); root.classList.add("out"); removeEventListener("resize", place); removeEventListener("keydown", key2); setTimeout(() => root.remove(), 350); };
  const key2 = (e) => { if (e.key === "Escape") close(); if (e.key === "ArrowRight") next(); if (e.key === "ArrowLeft") back(); };
  const next = () => (i < steps.length - 1 ? (i++, show()) : close()), back = () => { if (i) { i--; show(); } };
  $("[data-next]", root).onclick = next; $("[data-back]", root).onclick = back; $("[data-skip]", root).onclick = close;
  addEventListener("resize", place); addEventListener("keydown", key2);
  requestAnimationFrame(() => { root.classList.add("on"); show(); $("[data-next]", root).focus({ preventScroll: true }); });
}
