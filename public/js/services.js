// Home services: the tiles and the "own a property?" banner on the home page, the /services page with its request form, and the
// writes to the serviceRequests collection. Admin and support read them in js/admin2.js (Admin > Service requests).
// Styling lives in css/home.css (.hx-svc*, .hx-own*, .hx-svp*).
import { db } from "./firebase.js";
import { collection, doc, addDoc, getDocs, updateDoc, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { $, $$, esc, icon, logoMark, toast, modal, friendlyErr } from "./ui.js";
import { AREAS } from "./cards.js";
import { comboHtml, mountCombo, allAreaOpts } from "./loc.js";

// id (used in the address), label, icon, tile colour, one line for the services page
export const SERVICES = [
  ["tiling", "Tiling", "tiles", "#0f9b8e", "Floors, walls, bathrooms and kitchens, laid and finished."],
  ["electrical", "Electrical works", "bolt", "#d98a1f", "Wiring, sockets, lighting, inverters and fault finding."],
  ["automation", "Home automation", "chip", "#5b6cf0", "Smart locks, lights, cameras, gates and remote control."],
  ["painting", "Painting", "paint", "#e0587a", "Inside and outside, with the right finish and clean edges."],
  ["plumbing", "Plumbing", "drop", "#2f7de1", "Leaks, taps, toilets, pumps, tanks and water heaters."],
  ["carpentry", "Carpentry & furniture", "hammer", "#a8703d", "Doors, wardrobes, kitchen cabinets and made-to-measure furniture."],
  ["pop-roofing", "POP ceilings & roofing", "roof", "#8a5cf5", "POP and PVC ceilings, roof repairs and new roofing sheets."],
  ["cleaning", "Cleaning & fumigation", "sparkle", "#2fa35f", "Move-in cleaning, deep cleaning, pest and mosquito control."],
];
const byId = (id) => SERVICES.find((s) => s[0] === id);
const tint = (c) => `style="--c:${c}"`;

// ---------- home page pieces ----------
export const homeServices = () => `<section class="hx-sec hx-svc" aria-labelledby="hxSvc">
  <div class="hx-sec-head"><div><h2 id="hxSvc">Home services</h2><p>Trusted help for fixing, finishing and looking after your home.</p></div>
    <a class="hx-all" href="#/services">See all ${icon("arrow", 18)}</a></div>
  <ul class="hx-svc-row" aria-label="Home services">${SERVICES.map(([id, label, ic, c]) => `<li><a class="hx-svc-t" href="#/services?cat=${id}" ${tint(c)}><span class="hx-svc-i">${icon(ic, 26, 1.6)}</span><b>${esc(label)}</b></a></li>`).join("")}</ul>
</section>`;

export const ownerBanner = () => `<section class="hx-own" aria-labelledby="hxOwn">
  <span class="hx-own-logo">${logoMark()}</span>
  <div class="hx-own-t"><h2 id="hxOwn">Own a property? List it on Faxton Rentals.</h2><p>Reach thousands of verified renters. Track views and leads from your dashboard.</p></div>
  <button type="button" class="hx-own-btn" data-addprop>${icon("plus", 18, 2.2)} Add property</button>
</section>`;

// The "+ Add property" button: owners, agencies and agents go to their dashboard with the form open; signed-out visitors sign up as a home owner.
export function bindOwnerBanner(root, ctx) {
  const S = ctx.S, role = S.role;
  $$("[data-addprop]", root).forEach((b) => (b.onclick = () => {
    if (!S.user) return ctx.go("#/signup?role=landlord");
    const to = S.isAdmin ? "#/admin/listings" : { landlord: "#/portfolio?new=1", agency: "#/agency?new=1", agent: "#/agent-dashboard?new=1" }[role];
    if (to) return ctx.go(to);
    const m = modal(`<h2>List a property</h2><p class="muted">Listing is for home owners, agencies and agents. You are signed in with a renter account, so create an owner account with a different email address to list a property. Our team can help if you need to change this account instead.</p>
      <div class="row" style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px"><button class="btn primary" type="button" data-so>Sign out and sign up as an owner</button><a class="btn" href="#/help" data-close>Contact us</a></div>`);
    const el = m.el, so = el.querySelector("[data-so]"); el.querySelector("[data-close]").onclick = () => m.close();
    so.onclick = async () => { m.close(); await ctx.logout(); ctx.go("#/signup?role=landlord"); };
  }));
}

// ---------- requests ----------
const OPEN = ["New", "Contacted", "Scheduled"];
export async function sendRequest(user, profile, f) {
  const d = { uid: user.uid, name: f.name, phone: f.phone, category: f.category, description: f.description, status: "New", createdAt: serverTimestamp() };
  if (f.area) d.area = f.area; if (f.preferredDate) d.preferredDate = f.preferredDate; if (user.email) d.email = user.email;
  return addDoc(collection(db, "serviceRequests"), d);
}
// Staff: change status and/or the private note.
export const updateRequest = (id, patch) => updateDoc(doc(db, "serviceRequests", id), { ...patch, updatedAt: serverTimestamp() });
const mine = async (uid) => (await getDocs(query(collection(db, "serviceRequests"), where("uid", "==", uid)))).docs.map((d) => ({ ...d.data(), id: d.id })).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
const day = (t) => (t?.seconds ? new Date(t.seconds * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "Just now");
const tone = (s) => ({ New: "warn", Contacted: "info", Scheduled: "info", Done: "ok", Cancelled: "mute" }[s] || "mute");

// ---------- the /services page ----------
export function servicesPage(ctx) {
  const S = ctx.S, cat = byId(ctx.q.cat), prof = S.profile || {}, u = S.user;
  const today = new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
  const form = `<form class="hx-svp-form" id="svForm" novalidate aria-labelledby="svFT">
      <div class="hx-svp-fh"><span class="hx-svc-i" ${tint(cat ? cat[3] : "#0f9b8e")} id="svFI">${icon(cat ? cat[2] : "wrench", 24, 1.6)}</span><div><h2 id="svFT">Request a service</h2><p>Tell us what you need. Our team calls you to agree the work, the price and a day.</p></div></div>
      <div class="hx-svp-grid">
        <label class="rf-fl full">Service<select name="category" id="svCat" required>${SERVICES.map(([id, l]) => `<option value="${id}" ${cat && cat[0] === id ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></label>
        <label class="rf-fl">Your name<input name="name" autocomplete="name" required maxlength="120" value="${esc(prof.name || u?.displayName || "")}"></label>
        <label class="rf-fl">Phone number<input name="phone" type="tel" inputmode="tel" autocomplete="tel" required maxlength="30" placeholder="0801 234 5678" value="${esc(prof.phone || "")}"></label>
        ${comboHtml({ style: "rf", id: "svArea", name: "area", label: "Area", ph: "Lekki Phase 1", cls: "", maxlength: 80 })}
        <label class="rf-fl">Preferred date<input name="preferredDate" type="date" min="${today}"></label>
        <label class="rf-fl full">What needs doing?<textarea name="description" required maxlength="1500" rows="4" placeholder="For example: two bathrooms to retile, about 12 square metres each."></textarea></label>
      </div>
      <p class="ax-err hx-svp-err" id="svErr" role="alert"></p>
      <div class="hx-svp-act"><button class="btn primary" type="submit" id="svGo">Send request</button><span class="muted">Free to ask. You pay the service provider directly.</span></div>
    </form>`;
  const html = `<div class="wrap hx hx-svp">
    <header class="hx-s-head rise"><div><nav class="rf-crumbs" aria-label="Breadcrumb"><a href="#/">Home</a> <span aria-hidden="true">/</span> <b>Home services</b></nav><h1>Home services</h1><p class="hx-count">Pick what you need and send one request. We match you with a trusted professional.</p></div></header>
    <div id="svFormHost">${cat ? form : ""}</div>
    <section aria-labelledby="svAll"><h2 class="hx-svp-h" id="svAll">${cat ? "Other services" : "All services"}</h2>
      <ul class="hx-svp-list">${SERVICES.map(([id, label, ic, c, blurb]) => `<li><a class="hx-svp-card ${cat && cat[0] === id ? "on" : ""}" href="#/services?cat=${id}" ${tint(c)} ${cat && cat[0] === id ? 'aria-current="true"' : ""}><span class="hx-svc-i">${icon(ic, 26, 1.6)}</span><span><b>${esc(label)}</b><small>${esc(blurb)}</small></span><span class="hx-svp-go">${cat && cat[0] === id ? "Selected" : "Request"} ${icon("arrow", 16)}</span></a></li>`).join("")}</ul></section>
    <section aria-labelledby="svMine" id="svMineSec" hidden><h2 class="hx-svp-h" id="svMine">Your requests</h2><div id="svMine2" class="hx-svp-mine" aria-live="polite"></div></section>
  </div>`;
  return { title: "Home services", html, mount(root) {
    const host = $("#svFormHost", root), err = () => $("#svErr", root);
    const paintMine = async () => {
      let rows = []; try { rows = await mine(u.uid); } catch { return; }
      if (!root.isConnected || !rows.length) return;
      $("#svMineSec", root).hidden = false;
      $("#svMine2", root).innerHTML = rows.map((r) => `<article class="hx-svp-req"><div><b>${esc(r.category)}</b><small>${esc([r.area, r.preferredDate && "wanted " + r.preferredDate, "sent " + day(r.createdAt)].filter(Boolean).join(" · "))}</small><p>${esc(r.description)}</p>${r.note ? `<p class="hx-svp-note"><b>From our team:</b> ${esc(r.note)}</p>` : ""}</div>
        <div class="hx-svp-side"><span class="hx-svp-st" data-t="${tone(r.status)}">${esc(r.status)}</span>${r.status === "New" ? `<button type="button" class="btn sm" data-cancel="${esc(r.id)}">Cancel</button>` : ""}</div></article>`).join("");
      $$("[data-cancel]", root).forEach((b) => (b.onclick = async () => { b.disabled = true; try { await updateRequest(b.dataset.cancel, { status: "Cancelled" }); toast("Request cancelled."); paintMine(); } catch (e) { b.disabled = false; toast(friendlyErr(e), { tone: "bad" }); } }));
    };
    const wire = () => {
      const f = $("#svForm", root); if (!f) return;
      const areaBox = mountCombo(root, "svArea", { free: true, options: () => [...AREAS.filter((a) => a[0]).map((a) => ({ t: a[1] })), ...allAreaOpts()] });
      $("#svCat", root).onchange = (e) => { const s = byId(e.target.value); if (s) { const i = $("#svFI", root); i.setAttribute("style", `--c:${s[3]}`); i.innerHTML = icon(s[2], 24, 1.6); } };
      f.onsubmit = async (e) => {
        e.preventDefault(); areaBox?.commit(); const fd = Object.fromEntries(new FormData(f)), s = byId(fd.category), name = fd.name.trim(), phone = fd.phone.trim(), description = fd.description.trim();
        if (!name) return (err().textContent = "Enter your name.");
        if (phone.replace(/\D/g, "").length < 7) return (err().textContent = "Enter a phone number we can call.");
        if (!description) return (err().textContent = "Tell us a little about the job.");
        err().textContent = ""; const b = $("#svGo", root); b.disabled = true; b.textContent = "Sending…";
        try { await sendRequest(u, prof, { name, phone, area: fd.area.trim(), preferredDate: fd.preferredDate, description, category: s[1] }); }
        catch (x) { b.disabled = false; b.textContent = "Send request"; return (err().textContent = friendlyErr(x)); }
        host.innerHTML = `<div class="hx-svp-done" role="status"><span class="hx-svc-i" ${tint("#2fa35f")}>${icon("check", 26, 2)}</span><div><h2>Request sent</h2><p>Thank you, ${esc(name.split(/\s+/)[0])}. We will call you on ${esc(phone)} about your ${esc(s[1].toLowerCase())} job.</p><p><a class="btn" href="#/services">Request another service</a></p></div></div>`;
        host.scrollIntoView({ block: "nearest", behavior: "smooth" }); paintMine();
      };
      if (ctx.q.cat) setTimeout(() => $("[name=description]", root)?.focus({ preventScroll: true }), 300);
    };
    wire(); paintMine();
  } };
}
