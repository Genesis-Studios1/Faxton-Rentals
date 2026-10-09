// Agent profile, apply-to-rent, book-a-viewing and documents pages.
import { $, $$, esc, naira, icon, toast, modal, friendlyErr, initials } from "./ui.js";
import * as st from "./store.js";

const bedsLabel = (n) => (n === 0 ? "Studio" : `${n} bed${n > 1 ? "s" : ""}`);
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const longDate = (d) => d.toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const crumbs = (items) => `<nav class="crumbs pg-crumbs" aria-label="Breadcrumb">${items.map(([h, l], i) => (h ? `<a href="${h}">${esc(l)}</a>` : `<b>${esc(l)}</b>`) + (i < items.length - 1 ? icon("chev", 14).replace("<svg", '<svg style="transform:rotate(-90deg)"') : "")).join("")}</nav>`;
const stepper = (steps, cur, line) => `<ol class="pg-steps ${line || ""}" aria-label="Progress">${steps.map((s, i) => `<li class="${i + 1 < cur ? "done" : i + 1 === cur ? "on" : ""}"><span>${i + 1 < cur ? icon("check", 16, 2.6) : i + 1}</span><b>${s}</b></li>`).join("")}</ol>`;

const miniCard = (l, saved) => `<article class="card hcard pg-card" data-open="${esc(l.id)}" tabindex="0" aria-label="${esc(l.title)}">
  <div class="card-img wide"><img src="${esc(l.thumb || l.images[0])}" alt="${esc(l.title)}" loading="lazy"><span class="avail-dot"><i></i>${l.available === false ? "Rented" : "Available"}</span>
    <button class="heart ${saved.has(l.id) ? "on" : ""}" data-fav="${esc(l.id)}" aria-label="Save ${esc(l.title)}" aria-pressed="${saved.has(l.id)}">${icon("heart", 20)}</button></div>
  <div class="card-body"><h3>${esc(l.title)}</h3><div class="loc">${icon("pin", 16)}${esc(l.area)}, ${esc(l.city)}</div><div class="hc-price">${naira(l.price)} / year</div><div class="facts hr"><span>${icon("bed", 18)}${bedsLabel(l.beds)}</span><i>•</i><span>${icon("bath", 18)}${l.baths} bath${l.baths > 1 ? "s" : ""}</span></div></div></article>`;
function bindMini(root, ctx) {
  $$("[data-fav]", root).forEach((b) => (b.onclick = async (e) => { e.stopPropagation(); const id = b.dataset.fav, on = !ctx.S.saved.has(id); b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); await ctx.setSaved(id, on); }));
  $$("[data-open]", root).forEach((c) => { const open = () => ctx.go("#/home/" + c.dataset.open); c.onclick = open; c.onkeydown = (e) => { if (e.key === "Enter" && e.target === c) open(); }; });
}
const notFound = () => ({ title: "Not found", html: `<div class="empty wrap"><h2>We couldn’t find that</h2><p><a class="link" href="#/search">Browse homes</a></p></div>` });

// ============================ agent profile ============================
export async function agentPage(ctx, id) {
  const all = await st.getListings(), mine = all.filter((l) => l.agent?.id === id), a = mine[0]?.agent;
  if (!a) return notFound();
  const first = a.name.split(" ")[0], area = mine[0].area.split(" ")[0] + ", " + mine[0].city;
  const base = new Date(); base.setHours(0, 0, 0, 0); const days = []; for (let i = 1; days.length < 5; i++) { const d = new Date(base.getTime() + i * 864e5); if (d.getDay() !== 0) days.push(d); }
  const slots = ["10:00 AM – 11:00 AM", "12:00 PM – 1:00 PM", "3:00 PM – 4:00 PM", "5:00 PM – 6:00 PM"];
  return { title: a.name, html: `<div class="wrap pg">${crumbs([["#/search", "Find a home"], ["#/search", "Agents"], [null, a.name]])}
    <div class="ag-top"><section class="pg-box ag-card"><img class="ag-photo" src="${esc(a.photo || a.avatar)}" alt="${esc(a.name)}">
      <div class="ag-info"><h1>${esc(a.name)}</h1><p class="ag-role">Listing agent</p><p class="ag-loc">${icon("pin", 20)} ${esc(area)} <span class="idv">${icon("ver", 18)} Identity verified</span></p>
        <div class="ag-btns"><button class="btn solid" id="msgA">${icon("msg", 20)} Message agent</button><button class="btn" id="callA">${icon("phone", 20)} Call</button></div><hr>
        <p class="ag-bio">${esc(first)} helps people find beautiful, well-located homes across ${esc(mine[0].area.split(" ")[0])} and surrounding areas. ${first} is committed to making your rental journey smooth and stress-free.</p><hr>
        <div class="ag-facts"><div>${icon("globe", 34, 1.4)}<span><small>Languages</small>English, Yoruba</span></div><div>${icon("clock", 34, 1.4)}<span><small>Response time</small>Usually within an hour</span></div></div></div></section>
      <aside class="pg-box slots"><h2>Upcoming viewing slots</h2><p class="sub">Book a convenient time to view properties with ${esc(first)}.</p>
        <div class="day-chips" role="tablist">${days.map((d, i) => `<button type="button" role="tab" class="${i === 0 ? "on" : ""}" data-day="${iso(d)}"><span>${DAYS[d.getDay()]}</span>${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}</button>`).join("")}</div>
        <div class="slot-list">${slots.map((s) => `<button type="button" class="slot-row" data-slot="${s.split(" –")[0]}">${icon("clock", 22)}<span>${s}</span>${icon("chev", 18).replace("<svg", '<svg style="transform:rotate(-90deg)"')}</button>`).join("")}</div>
        <button class="btn solid block" id="vt">${icon("cal", 22)} View available times</button></aside></div>
    <div class="sec-head" style="margin-top:34px"><div><h2>Properties by this agent</h2><p class="muted">Explore homes listed by ${esc(a.name)}.</p></div><a class="link" href="#/search">View all properties ${icon("arrow", 18)}</a></div>
    <div class="cards pg-cards">${mine.map((l) => miniCard(l, ctx.S.saved)).join("")}</div></div>`,
    mount(root) {
      bindMini(root, ctx); let day = days[0] ? iso(days[0]) : "";
      const lid = mine[0].id;
      $$("[data-day]", root).forEach((b) => (b.onclick = () => { day = b.dataset.day; $$("[data-day]", root).forEach((x) => x.classList.toggle("on", x === b)); }));
      $$("[data-slot]", root).forEach((b) => (b.onclick = () => ctx.go(`#/book/${lid}?date=${day}&slot=${encodeURIComponent(b.dataset.slot)}`)));
      $("#vt").onclick = () => ctx.go(`#/book/${lid}?date=${day}`);
      $("#msgA").onclick = async () => { try { const cid = await st.ensureConversation(ctx.S.user, mine[0]); ctx.go("#/messages/" + cid); } catch (e) { toast(friendlyErr(e)); } };
      $("#callA").onclick = () => toast("Phone numbers are shared in chat once an agent replies.");
    } };
}

// ============================ book a viewing ============================
export async function bookPage(ctx, id) {
  const l = await st.getListing(id); if (!l) return notFound();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const S = { date: ctx.q.date ? new Date(ctx.q.date + "T00:00:00") : null, slot: ctx.q.slot || "", tour: "In-person tour", step: 1, month: null, phone: ctx.S.profile?.phone || "", note: "" };
  if (S.date && (isNaN(S.date) || S.date <= today || S.date.getDay() === 0)) S.date = null;
  if (!S.date) { const d = new Date(today.getTime() + 864e5); while (d.getDay() === 0) d.setDate(d.getDate() + 1); S.date = d; }
  S.month = new Date(S.date.getFullYear(), S.date.getMonth(), 1);
  const TIMES = ["10:00 AM", "12:00 PM", "2:00 PM", "4:00 PM"]; if (!TIMES.includes(S.slot)) S.slot = TIMES[0];
  const total = l.price + l.service + l.deposit;
  const side = `<aside class="pg-box prop-side"><div class="ps-img"><img src="${esc(l.thumb || l.images[0])}" alt="${esc(l.title)}"><button class="heart ${ctx.S.saved.has(l.id) ? "on" : ""}" data-fav="${esc(l.id)}" aria-label="Save">${icon("heart", 20)}</button></div>
    <h3>${esc(l.title)}</h3><p class="loc">${icon("pin", 16)} ${esc(l.area)}, ${esc(l.city)}</p><p class="facts hr"><span>${icon("bed", 18)}${bedsLabel(l.beds)}</span><i>•</i><span>${icon("bath", 18)}${l.baths} baths</span></p><hr>
    <div class="kvs"><div><span>Annual rent</span><b>${naira(l.price)}</b></div><div><span>Service charge</span><b>${naira(l.service)}</b></div><div><span>Refundable deposit</span><b>${naira(l.deposit)}</b></div></div><div class="kvs tot"><div><span>Total due</span><b>${naira(total)}</b></div></div>
    <div class="ps-agent"><img class="avatar" src="${esc(l.agent.avatar)}" alt=""><div><b>${esc(l.agent.name)}</b><small>Property Agent</small></div><a class="round-btn" href="#/agent/${esc(l.agent.id)}" aria-label="Agent profile">${icon("phone", 22)}</a><a class="round-btn" href="#/messages" aria-label="Messages">${icon("msg", 22)}</a></div></aside>`;
  return { title: "Book a viewing", html: `<div class="wrap pg"><a class="back-link" href="#/home/${esc(l.id)}">${icon("left", 20)} Back to property</a><h1 class="pg-h1">Book a viewing</h1><p class="pg-sub">Choose a date and time to see this property. It’s quick and easy.</p>
    <div id="bk"></div></div>`,
    mount(root) {
      const bk = $("#bk", root);
      const draw = () => {
        const { step } = S, steps = ["Choose a time", "Your details", "Confirm"];
        const hdr = `<ol class="pg-steps line-h" aria-label="Progress">${steps.map((s, i) => `<li class="${i + 1 < step ? "done" : i + 1 === step ? "on" : ""}"><span>${i + 1 < step ? icon("check", 16, 2.6) : i + 1}</span><b>${s}</b></li>`).join('<hr class="ln">')}</ol>`;
        let main;
        if (step === 1) {
          const first = S.month, y = first.getFullYear(), m = first.getMonth(), start = new Date(y, m, 1 - first.getDay()), cells = [];
          for (let i = 0; i < 42; i++) { const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i), out = d.getMonth() !== m, un = d <= today || d.getDay() === 0; cells.push(`<button type="button" class="day ${out ? "out" : ""} ${S.date && iso(d) === iso(S.date) ? "sel" : ""}" ${un || out ? "disabled" : ""} data-d="${iso(d)}">${d.getDate()}</button>`); }
          main = `<section class="pg-box cal-box"><div class="cal"><div class="cal-head"><h2>Select a date</h2><div class="cal-nav"><button type="button" id="pm" aria-label="Previous month">${icon("left", 18)}</button><b>${MONTHS[m]} ${y}</b><button type="button" id="nm" aria-label="Next month">${icon("arrow", 18)}</button></div></div>
            <div class="dow">${DAYS.map((d) => `<span>${d}</span>`).join("")}</div><div class="grid-days">${cells.join("")}</div>
            <div class="legend"><span><i class="a"></i>Available</span><span><i class="u"></i>Unavailable</span><span><i class="s"></i>Selected</span></div></div>
            <div class="times"><div class="cal-head"><h2>Select a time</h2><span class="tz">${icon("clock", 20)} Africa/Lagos (WAT)</span></div><p class="sub">Available times for <b>${longDate(S.date)}</b></p>
              ${TIMES.map((t) => `<button type="button" class="time ${t === S.slot ? "on" : ""}" data-t="${t}"><i class="rd"></i><span><b>${t}</b><small>Approx. 30 minutes</small></span></button>`).join("")}<hr>
              <h2 class="tt">Tour type</h2><div class="tour-types">${[["In-person tour", "pin", "Meet the agent at the property"], ["Virtual tour", "video", "Join a live video tour"]].map(([t, ic, d]) => `<button type="button" class="tt-opt ${S.tour === t ? "on" : ""}" data-tt="${t}"><i class="rd"></i><span><b>${icon(ic, 20)} ${t}</b><small>${d}</small></span></button>`).join("")}</div></div></section>`;
        } else if (step === 2) {
          main = `<section class="pg-box form-box"><h2>Your details</h2><p class="sub">The agent will use these to confirm your viewing.</p><div class="f2"><label class="fl">Full name<input id="bn" value="${esc(ctx.S.user.displayName || "")}" disabled></label><label class="fl">Email address<input value="${esc(ctx.S.user.email)}" disabled></label>
            <label class="fl">Phone number<input id="bp" type="tel" placeholder="Enter your phone number" value="${esc(S.phone)}" maxlength="30"></label></div><label class="fl" style="margin-top:14px">Note for the agent (optional)<textarea id="bnote" rows="3" maxlength="300" placeholder="Anything the agent should know?">${esc(S.note)}</textarea></label><div class="err" id="berr" role="alert"></div></section>`;
        } else main = `<section class="pg-box form-box"><h2>Confirm your viewing</h2><p class="sub">Check the details below, then confirm.</p><div class="kv"><span>Property</span><b>${esc(l.title)}</b></div><div class="kv"><span>Date</span><b>${longDate(S.date)}</b></div><div class="kv"><span>Time</span><b>${S.slot}</b></div><div class="kv"><span>Tour type</span><b>${S.tour}</b></div><div class="kv"><span>Agent</span><b>${esc(l.agent.name)}</b></div><div class="kv"><span>Phone</span><b>${esc(S.phone || "—")}</b></div><div class="err" id="berr" role="alert"></div></section>`;
        bk.innerHTML = `${hdr}<div class="bk-grid">${main}${side}</div>
          <div class="bk-bar"><span class="cal-ic">${icon("cal", 26)}</span><div><small>Selected viewing</small><b>${longDate(S.date)} at ${S.slot}</b></div>${step > 1 ? `<button class="btn" id="bb">Back</button>` : ""}<button class="btn solid" id="bn2">${step === 3 ? "Confirm viewing" : "Continue"} ${icon("arrow", 20)}</button></div>`;
        wire();
      };
      const wire = () => {
        bindMini(bk, ctx);
        $$("[data-d]", bk).forEach((b) => (b.onclick = () => { S.date = new Date(b.dataset.d + "T00:00:00"); draw(); }));
        $$("[data-t]", bk).forEach((b) => (b.onclick = () => { S.slot = b.dataset.t; draw(); })); $$("[data-tt]", bk).forEach((b) => (b.onclick = () => { S.tour = b.dataset.tt; draw(); }));
        const pm = $("#pm", bk), nm = $("#nm", bk); if (pm) { pm.onclick = () => { S.month = new Date(S.month.getFullYear(), S.month.getMonth() - 1, 1); draw(); }; nm.onclick = () => { S.month = new Date(S.month.getFullYear(), S.month.getMonth() + 1, 1); draw(); }; pm.disabled = S.month <= new Date(today.getFullYear(), today.getMonth(), 1); }
        const bb = $("#bb", bk); if (bb) bb.onclick = () => { keep(); S.step--; draw(); };
        $("#bn2", bk).onclick = async () => {
          keep(); const err = $("#berr", bk);
          if (S.step === 2 && !/^[+\d][\d\s-]{6,}$/.test(S.phone.trim())) return (err.textContent = "Enter a valid phone number.");
          if (S.step < 3) { S.step++; return draw(); }
          const b = $("#bn2", bk); b.disabled = true;
          try { await st.addViewing(ctx.S.user, l, iso(S.date), S.slot, { tour: S.tour, phone: S.phone, note: S.note });
            try { const cid = await st.ensureConversation(ctx.S.user, l); await st.sendMessage(ctx.S.user, cid, `Viewing requested: ${longDate(S.date)}, ${S.slot}`, { type: "booking", when: iso(S.date), slot: S.slot, title: l.title, area: l.area, image: l.thumb || l.images[0] }); } catch {}
            toast("Viewing requested. We’ll confirm shortly."); ctx.go("#/bookings"); } catch (e) { err.textContent = friendlyErr(e); b.disabled = false; }
        };
      };
      const keep = () => { const p = $("#bp", bk), n = $("#bnote", bk); if (p) S.phone = p.value; if (n) S.note = n.value; };
      draw();
    } };
}

// ============================ apply to rent ============================
const DKEY = (u, id) => `draft_${u.uid}_${id}`;
const loadDraft = (u, id) => { try { return JSON.parse(localStorage.getItem(DKEY(u, id))) || {}; } catch { return {}; } };
export async function applyPage(ctx, id) {
  const l = await st.getListing(id); if (!l) return notFound();
  const u = ctx.S.user, p = ctx.S.profile || {}, total = l.price + l.service + l.deposit, tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
  const D = { name: u.displayName || "", email: u.email, phone: p.phone || "", address: "", movein: "", occupants: "", note: "", status: "", employer: "", job: "", income: "", ...loadDraft(u, id) };
  let step = Math.min(Math.max(+D._step || 1, 1), 4); const files = { id: D.idFile || "", income: D.incomeFile || "" };
  const imgs = l.images, STEPS = ["Personal details", "Employment", "Documents", "Review"];
  return { title: "Apply to rent", html: `<div class="wrap pg"><h1 class="pg-h1">Apply for ${esc(l.title)}</h1><p class="pg-sub">Complete your application to be considered for this home.</p><div class="ap-grid"><div id="ap"></div>
    <aside class="pg-box prop-side"><div class="ps-img"><img id="apimg" src="${esc(imgs[0] || l.thumb)}" alt="${esc(l.title)}"><span class="counter" id="apc">1 / ${Math.max(imgs.length, 1)}</span></div>
    <h3>${esc(l.title)}</h3><p class="loc">${icon("pin", 16)} ${esc(l.area)}, ${esc(l.city)}</p><p class="facts hr"><span>${icon("bed", 18)}${l.beds === 0 ? "Studio" : l.beds + " bedrooms"}</span><i class="sep"></i><span>${icon("bath", 18)}${l.baths} bathrooms</span></p><hr>
    <h4>Rental details</h4><div class="kvs"><div><span>Annual rent</span><b>${naira(l.price)} / year</b></div><div><span>Service charge</span><b>${naira(l.service)} / year</b></div><div><span>Refundable deposit</span><b>${naira(l.deposit)}</b></div></div><div class="kvs tot"><div><span>Total due on signing</span><b>${naira(total)}</b></div></div><hr>
    <h4>Agent</h4><div class="ps-agent"><img class="avatar" src="${esc(l.agent.avatar)}" alt=""><div><b>${esc(l.agent.name)}</b><small>Property Consultant</small></div><a class="round-btn" href="#/agent/${esc(l.agent.id)}" aria-label="Agent profile">${icon("phone", 22)}</a><a class="round-btn" href="#/messages" aria-label="Messages">${icon("mail", 22)}</a></div></aside></div></div>`,
    mount(root) {
      const ap = $("#ap", root); let k = 0;
      const imgTimer = imgs.length > 1 ? setInterval(() => { k = (k + 1) % imgs.length; const i = $("#apimg"); if (i) { i.src = imgs[k]; $("#apc").textContent = `${k + 1} / ${imgs.length}`; } }, 3500) : 0; ctx.S.cleanups.push(() => clearInterval(imgTimer));
      const save = (msg) => { try { localStorage.setItem(DKEY(u, id), JSON.stringify({ ...D, _step: step, idFile: files.id, incomeFile: files.income })); if (msg) toast("Draft saved on this device."); } catch {} };
      const read = () => { for (const k2 of ["name", "email", "phone", "address", "movein", "occupants", "note", "status", "employer", "job", "income"]) { const e = $("#f_" + k2, ap); if (e) D[k2] = e.value; } };
      const field = (k2, label, ph, o = {}) => `<label class="fl ${o.cls || ""}">${label}${o.opt ? ' <span class="opt">(optional)</span>' : ""}<input id="f_${k2}" type="${o.type || "text"}" placeholder="${ph}" value="${esc(D[k2])}" ${o.extra || ""}></label>`;
      const sel = (k2, label, ph, opts) => `<label class="fl">${label}<select id="f_${k2}"><option value="">${ph}</option>${opts.map((x) => `<option ${x === D[k2] ? "selected" : ""}>${x}</option>`).join("")}</select></label>`;
      const draw = () => {
        let body;
        if (step === 1) body = `<h2>Personal details</h2><p class="sub">Tell us a bit about yourself so we can process your application.</p><div class="f2">${field("name", "Full name", "Enter your full name", { extra: 'autocomplete="name" maxlength="120"' })}${field("email", "Email address", "Enter your email address", { type: "email", extra: "disabled" })}
          <label class="fl">Phone number<span class="phone"><span class="cc"><i class="flag"></i>+234 ${icon("chev", 16)}</span><input id="f_phone" type="tel" placeholder="Enter your phone number" value="${esc(D.phone)}" maxlength="30" autocomplete="tel"></span></label>${field("address", "Current address", "Enter your current address", { opt: true, extra: 'maxlength="200" autocomplete="street-address"' })}
          <label class="fl">Intended move-in date<span class="dt">${icon("cal", 20)}<input id="f_movein" type="date" min="${tomorrow}" value="${esc(D.movein)}"></span></label>${sel("occupants", "Number of occupants", "Select number of occupants", ["1", "2", "3", "4", "5", "6+"])}</div>
          <label class="fl" style="margin-top:14px">Additional note <span class="opt">(optional)</span><textarea id="f_note" rows="3" maxlength="500" placeholder="Tell us anything else we should know about your application...">${esc(D.note)}</textarea></label><div class="cnt"><span id="ncount">${D.note.length}</span>/500</div>`;
        else if (step === 2) body = `<h2>Employment</h2><p class="sub">This helps the agent assess your application.</p><div class="f2">${sel("status", "Employment status", "Select status", ["Employed", "Self-employed", "Student", "Retired", "Other"])}${field("employer", "Employer or school", "Enter name", { extra: 'maxlength="120"' })}${field("job", "Job title", "Enter your job title", { opt: true, extra: 'maxlength="120"' })}${sel("income", "Monthly income", "Select range", ["Below ₦200,000", "₦200,000 – ₦500,000", "₦500,000 – ₦1,000,000", "Above ₦1,000,000"])}</div>`;
        else if (step === 3) body = `<h2>Documents</h2><p class="sub">Add your ID and proof of income. Only file names are submitted with this application; the agent will request the files in chat.</p>
          ${[["id", "Valid ID (required)", "National ID, passport or driver’s licence"], ["income", "Proof of income (optional)", "Payslip, bank statement or offer letter"]].map(([k2, t, d]) => `<div class="up-row"><span class="up-ic">${icon("pdf", 26)}</span><div><b>${t}</b><small>${files[k2] ? esc(files[k2]) : d}</small></div><label class="btn sm">${files[k2] ? "Replace" : "Choose file"}<input type="file" data-file="${k2}" accept=".pdf,image/*" hidden></label></div>`).join("")}`;
        else { read(); body = `<h2>Review your application</h2><p class="sub">Make sure everything is correct before you submit.</p><div class="rev"><div class="kv"><span>Full name</span><b>${esc(D.name)}</b></div><div class="kv"><span>Email</span><b>${esc(D.email)}</b></div><div class="kv"><span>Phone</span><b>+234 ${esc(D.phone)}</b></div><div class="kv"><span>Current address</span><b>${esc(D.address || "Not provided")}</b></div><div class="kv"><span>Move-in date</span><b>${esc(D.movein)}</b></div><div class="kv"><span>Occupants</span><b>${esc(D.occupants)}</b></div>
          <div class="kv"><span>Employment</span><b>${esc(D.status || "—")}${D.employer ? ", " + esc(D.employer) : ""}</b></div><div class="kv"><span>Monthly income</span><b>${esc(D.income || "—")}</b></div><div class="kv"><span>ID document</span><b>${esc(files.id || "—")}</b></div></div><label class="m-chk"><input type="checkbox" id="agree"> <span>I confirm the information above is accurate.</span></label>`; }
        ap.innerHTML = `${stepper(STEPS, step, "line-top")}<section class="pg-box form-box ap-form">${body}<div class="err" id="aerr" role="alert"></div>
          <div class="notice-b">${icon("info", 24)}<div><b>No payment is taken at this stage.</b><p>You won’t be charged now. We’ll only contact you if your application is successful.</p></div></div>
          <div class="ap-actions"><button type="button" class="btn" id="sd">${icon("save", 20)} Save draft</button>${step > 1 ? `<button type="button" class="btn" id="bk2">Back</button>` : ""}<button type="button" class="btn solid" id="ct">${step === 4 ? "Submit application" : "Continue"} ${icon("arrow", 20)}</button></div></section>`;
        const n = $("#f_note", ap); if (n) n.oninput = () => ($("#ncount").textContent = n.value.length);
        $$("[data-file]", ap).forEach((i) => (i.onchange = () => { const f = i.files[0]; if (f) { files[i.dataset.file] = f.name; save(); draw(); } }));
        $("#sd").onclick = () => { read(); save(true); };
        const b2 = $("#bk2"); if (b2) b2.onclick = () => { read(); step--; save(); draw(); scrollTo({ top: 0, behavior: "smooth" }); };
        $("#ct").onclick = async () => {
          read(); const err = $("#aerr");
          if (step === 1) { if (!D.name.trim()) return (err.textContent = "Enter your full name."); if (!/^[\d\s-]{7,}$/.test(D.phone.trim())) return (err.textContent = "Enter a valid phone number."); if (!D.movein) return (err.textContent = "Choose your intended move-in date."); if (!D.occupants) return (err.textContent = "Select the number of occupants."); }
          if (step === 2 && !D.status) return (err.textContent = "Select your employment status.");
          if (step === 3 && !files.id) return (err.textContent = "Add a valid ID to continue.");
          if (step < 4) { step++; save(); draw(); return scrollTo({ top: 0, behavior: "smooth" }); }
          if (!$("#agree").checked) return (err.textContent = "Please confirm your information is accurate.");
          const b = $("#ct"); b.disabled = true;
          try { await st.addApplication(u, l, D.movein, { name: D.name, phone: "+234 " + D.phone, address: D.address, occupants: D.occupants, note: D.note, employment: D.status, employer: D.employer, job: D.job, income: D.income, idFile: files.id, incomeFile: files.income });
            try { localStorage.removeItem(DKEY(u, id)); } catch {} toast("Application submitted."); ctx.go("#/payments"); } catch (e) { err.textContent = friendlyErr(e); b.disabled = false; }
        };
      };
      draw();
    } };
}

// ============================ rentals nav + documents ============================
export const rentalsNav = (active) => `<div class="rn-tabs" role="tablist">${[["/rentals", "Overview"], ["/bookings", "Viewings"], ["/applications", "Applications"], ["/payments", "Payments"], ["/documents", "Documents"]].map(([h, l]) => `<a href="#${h}" class="${h === active ? "on" : ""}" ${h === active ? 'aria-current="page"' : ""}>${l}</a>`).join("")}</div>`;
const fmtSize = (n) => (n > 1e6 ? (n / 1e6).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1e3)) + " KB");
const dstat = (s) => `<span class="pill ${/review/i.test(s) ? "warn" : ""}"><i class="dot"></i>${esc(s)}</span>`;
export async function documentsPage(ctx) {
  const docs = await st.myDocs(ctx.S.user), apps = await st.myApplications(ctx.S.user), prop = apps[0] || null;
  let tab = "all", sel = docs[0]?.id || null;
  const TYPES = [["Agreement", "Agreements"], ["Receipt", "Receipts"]];
  return { title: "My documents", html: `<div class="wrap pg">${rentalsNav("/documents")}<div class="doc-head"><div><h1 class="pg-h1">My documents</h1><p class="pg-sub">View and manage documents for your rentals, agreements and receipts.</p></div>
    ${prop ? `<div class="prop-pick"><img src="${esc(prop.image)}" alt=""><div><small>Property</small><b>${esc(prop.title)}</b><span>${esc(prop.area)}, Lagos</span></div></div>` : ""}</div>
    <div class="doc-bar"><div class="doc-tabs" id="dt"></div><label class="btn solid">${icon("upload", 20)} Upload document<input type="file" id="up" accept=".pdf,image/*" hidden></label></div><div class="doc-grid"><section class="pg-box"><h2>Private files</h2><p class="sub">These documents are only visible to you.</p><div id="dl"></div></section>
    <aside class="pg-box" id="dp"></aside></div></div>`,
    mount(root) {
      const cnt = (t) => docs.filter((d) => t === "all" || d.type === t).length, list = () => docs.filter((d) => tab === "all" || d.type === tab);
      const draw = () => {
        $("#dt", root).innerHTML = [["all", "All files"], ...TYPES].map(([k, l]) => `<button type="button" class="${tab === k ? "on" : ""}" data-tab="${k}">${l} (${cnt(k)})</button>`).join("");
        const L = list();
        $("#dl", root).innerHTML = L.length ? `<div class="tbl-wrap"><table class="dtab"><thead><tr><th>Name</th><th>Type</th><th>Added date</th><th>Status</th><th>Actions</th></tr></thead><tbody>${L.map((d) => `<tr class="${d.id === sel ? "sel" : ""}" data-sel="${esc(d.id)}"><td><span class="fname"><span class="up-ic">${icon("pdf", 24)}</span>${esc(d.name)}</span></td><td>${esc(d.type)}</td><td>${esc(d.date || "")}</td><td>${dstat(d.status)}</td><td class="acts"><button type="button" aria-label="Download" data-dl="${esc(d.id)}">${icon("upload", 20).replace("<svg", '<svg style="transform:rotate(180deg)"')}</button><button type="button" aria-label="Delete" data-del="${esc(d.id)}">${icon("trash", 20)}</button></td></tr>`).join("")}</tbody></table></div>` : `<div class="empty-d">${icon("pdf", 44, 1.2)}<h3>No documents yet</h3><p class="muted">Upload agreements, receipts or ID. Files up to 700 KB are kept privately in your account.</p></div>`;
        const d = docs.find((x) => x.id === sel);
        $("#dp", root).innerHTML = d ? `<h2>Document preview</h2><div class="prev">${d.mime?.startsWith("image/") ? `<img src="${esc(d.data)}" alt="${esc(d.name)}">` : d.mime === "application/pdf" && d.data ? `<object data="${esc(d.data)}" type="application/pdf" aria-label="${esc(d.name)}"><p class="muted">Preview not available. Use View document.</p></object>` : `<div class="paper"><b>${esc(d.name)}</b><span></span><span></span><span></span></div>`}</div>
          <div class="prev-meta"><div><b>${esc(d.name)}</b><small>${esc(d.type)} • Added ${esc(d.date || "")} • ${fmtSize(d.size || 0)}</small></div>${dstat(d.status)}</div><button class="btn solid block" data-view="${esc(d.id)}">${icon("eyeo", 22)} View document</button><button class="btn block" data-dl="${esc(d.id)}">${icon("upload", 20).replace("<svg", '<svg style="transform:rotate(180deg)"')} Download</button>` : `<h2>Document preview</h2><div class="prev empty-p"><p class="muted">Select a document to preview it.</p></div>`;
        $$("[data-tab]", root).forEach((b) => (b.onclick = () => { tab = b.dataset.tab; draw(); }));
        $$("[data-sel]", root).forEach((r) => (r.onclick = () => { sel = r.dataset.sel; draw(); }));
        const open = (id, dl) => { const x = docs.find((y) => y.id === id); if (!x?.data) return toast("This file has no stored copy."); const a = document.createElement("a"); a.href = x.data; if (dl) a.download = x.name; else { a.target = "_blank"; a.rel = "noopener"; } a.click(); };
        $$("[data-dl]", root).forEach((b) => (b.onclick = (e) => { e.stopPropagation(); open(b.dataset.dl, true); })); $$("[data-view]", root).forEach((b) => (b.onclick = () => open(b.dataset.view)));
        $$("[data-del]", root).forEach((b) => (b.onclick = async (e) => { e.stopPropagation(); const id = b.dataset.del; if (!confirm("Delete this document?")) return; try { await st.removeDocument(id); docs.splice(docs.findIndex((x) => x.id === id), 1); if (sel === id) sel = docs[0]?.id || null; draw(); toast("Document deleted."); } catch (x) { toast(friendlyErr(x)); } }));
      };
      $("#up", root).onchange = (e) => {
        const f = e.target.files[0]; if (!f) return; if (f.size > 700000) return toast("That file is over 700 KB. Please choose a smaller one.");
        const r = new FileReader(); r.onload = async () => {
          const type = /receipt/i.test(f.name) ? "Receipt" : /agreement|tenancy|lease/i.test(f.name) ? "Agreement" : "Other";
          const rec = { name: f.name.slice(0, 150), type, size: f.size, mime: f.type, data: r.result, date: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }), propertyId: prop?.listingId || "" };
          try { const ref = await st.addDocument(ctx.S.user, rec); docs.unshift({ ...rec, id: ref.id, status: "Uploaded" }); sel = ref.id; draw(); toast("Document uploaded."); } catch (x) { toast(friendlyErr(x)); }
        }; r.readAsDataURL(f);
      };
      draw();
    } };
}

// ============================ shared bits ============================
const fmtD = (t) => { const s = t?.seconds ? new Date(t.seconds * 1000) : null; return s ? s.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "Just now"; };
const fmtT = (t) => { const s = t?.seconds ? new Date(t.seconds * 1000) : null; return s ? s.toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" }) : ""; };
const loadDrafts = (u) => { const out = []; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith(`draft_${u.uid}_`)) out.push({ listingId: k.slice(`draft_${u.uid}_`.length), draft: true, status: "Draft", ...JSON.parse(localStorage.getItem(k)) }); } } catch {} return out; };
const ACTIVE = (s) => /approved|active/i.test(s);
const statusChip = (s) => { const k = /review|awaiting/i.test(s) ? ["warn", "clock"] : /draft/i.test(s) ? ["info", "pdf"] : /withdr|reject/i.test(s) ? ["bad", "x"] : ["", "check"]; return `<span class="st-chip ${k[0]}">${icon(k[1], 20)} ${esc(s)}</span>`; };
const crumbBar = (cur) => crumbs([["#/rentals", "My rentals"], [null, cur]]);
const propHead = (l) => `<div class="pp-head"><img src="${esc(l.thumb || l.images[0])}" alt=""><div><h2>${esc(l.title)}</h2><p class="loc">${icon("pin", 20)} ${esc(l.area)}, ${esc(l.city)}</p><p class="facts"><span>${icon("bed", 20)}${l.beds === 0 ? "Studio" : l.beds + " bedrooms"}</span><span>${icon("bath", 20)}${l.baths} bathrooms</span></p></div></div>`;
async function tenancy(ctx) {
  const [apps, listings] = await Promise.all([st.myApplications(ctx.S.user), st.getListings()]);
  const act = apps.find((a) => ACTIVE(a.status)) || null, l = (act && listings.find((x) => x.id === act.listingId)) || null;
  return { apps, listings, act, l };
}
const addYear = (iso) => { const d = new Date(iso + "T00:00:00"); if (isNaN(d)) return null; const e = new Date(d); e.setFullYear(e.getFullYear() + 1); e.setDate(e.getDate() - 1); return [d, e]; };
const dlong = (d) => d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

// ============================ payments ============================
export async function paymentsPage(ctx) {
  const { act, l, listings } = await tenancy(ctx), prop = l || listings[0];
  const rows = act && l ? [["Rent (Annual)", l.price], ["Service charge (Annual)", l.service], ["Refundable deposit", l.deposit]] : [];
  const total = rows.reduce((s, r) => s + r[1], 0);
  return { title: "Payments", html: `<div class="wrap pg">${crumbBar("Payments")}${rentalsNav("/payments")}<h1 class="pg-h1">Payments</h1><p class="pg-sub">Track your payments, view receipts and stay up to date with your rental.</p>
    <div class="pay-grid"><div><section class="pg-box">${prop ? propHead(prop) : ""}</section>
      <div class="stat3"><div class="stat-b"><span class="si">${icon("wallet", 30)}</span><div><small>Total paid</small><b>${naira(0)}</b><p>${act ? "Payments are recorded by your agent." : "No payments yet."}</p></div></div>
        <div class="stat-b"><span class="si">${icon("clock", 30)}</span><div><small>Outstanding</small><b>${naira(act ? total : 0)}</b><p>${act ? "Due on signing." : "You’re all up to date."}</p></div></div>
        <div class="stat-b"><span class="si">${icon("cal", 30)}</span><div><small>Next renewal</small><b>${act ? dlong(addYear(act.moveIn)?.[1] || new Date()).replace(/^\d+ /, "") : "—"}</b><p>${act ? "Your rent is due for renewal." : "Starts once a rental is active."}</p></div></div></div>
      <section class="pg-box"><h2>Transaction history</h2><div class="tbl-wrap"><table class="dtab"><thead><tr><th>Description</th><th>Amount</th><th>Date paid</th><th>Status</th><th>Receipt</th></tr></thead><tbody>
        ${rows.length ? rows.map((r) => `<tr><td><b>${r[0]}</b><small class="muted" style="display:block">${esc(l.title)}</small></td><td><b>${naira(r[1])}</b></td><td class="muted">—</td><td><span class="pill warn"><i class="dot"></i>Due</span></td><td class="muted">—</td></tr>`).join("") : `<tr><td colspan="5" class="muted" style="padding:28px">No transactions yet. Charges appear here once your application is approved.</td></tr>`}</tbody></table></div></section></div>
      <aside class="pg-box pay-side"><h2>Pay a charge</h2><p class="sub">Select a property and pay any outstanding charges such as rent or service charges.</p><label class="fl">Property<span class="prop-pick sm">${prop ? `<img src="${esc(prop.thumb || prop.images[0])}" alt=""><div><b>${esc(prop.title)}</b><span>${esc(prop.area)}, ${esc(prop.city)}</span></div>` : "<span class='muted'>No property</span>"}</span></label>
        <label class="fl">Amount due<div class="due"><b>${naira(act ? total : 0)}</b><p>${act ? "Total due on signing." : "You have no outstanding payments for this property."}</p></div></label><button class="btn block" disabled>Pay now</button><p class="note">Online payments are coming soon. Your agent will share payment details in Messages.</p><hr>
        <h3>Payment status</h3><ul class="pstat"><li><span>${icon("check", 22, 2)}</span><div><b>${act ? "Payment due" : "All payments up to date"}</b><p>${act ? "Your first payment is due on signing." : "You’ve paid all required charges."}</p></div></li><li><span>${icon("cal", 22)}</span><div><b>Next payment</b><p>${act ? "Rent renews each year." : "None scheduled."}</p></div></li><li><span>${icon("info", 22)}</span><div><b>Receipts available</b><p>Download receipts for completed payments from the transaction history.</p></div></li></ul></aside></div></div>` };
}

// ============================ applications ============================
export async function applicationsPage(ctx) {
  const [apps, listings] = await Promise.all([st.myApplications(ctx.S.user), st.getListings()]);
  const items = [...loadDrafts(ctx.S.user).filter((d) => !apps.some((a) => a.listingId === d.listingId && !/withdr/i.test(a.status))), ...apps].map((a) => ({ ...a, l: listings.find((x) => x.id === a.listingId) })).filter((a) => a.l);
  let tab = "all", sel = items[0]?.draft ? items[0].listingId + "_d" : items[0]?.id;
  const key = (a) => (a.draft ? a.listingId + "_d" : a.id), list = () => items.filter((a) => tab === "all" || (tab === "prog" && /review|draft|awaiting/i.test(a.status)) || (tab === "ok" && ACTIVE(a.status)));
  const cnt = (t) => items.filter((a) => t === "all" || (t === "prog" && /review|draft|awaiting/i.test(a.status)) || (t === "ok" && ACTIVE(a.status))).length;
  return { title: "My applications", html: `<div class="wrap pg">${rentalsNav("/applications")}<div class="ap-list-grid"><div><h1 class="pg-h1">My applications</h1><p class="pg-sub">Track the status of your rental applications.</p><div class="pill-tabs" id="at"></div><div id="al"></div></div><aside class="pg-box app-side" id="as"></aside></div></div>`,
    mount(root) {
      const draw = () => {
        $("#at", root).innerHTML = [["all", "All"], ["prog", "In progress"], ["ok", "Approved"]].map(([k, t]) => `<button type="button" class="${tab === k ? "on" : ""}" data-tab="${k}">${t} (${cnt(k)})</button>`).join("");
        const L = list(); if (!L.some((a) => key(a) === sel)) sel = L[0] ? key(L[0]) : null;
        $("#al", root).innerHTML = L.length ? L.map((a) => `<article class="app-card ${key(a) === sel ? "on" : ""}" data-sel="${esc(key(a))}" tabindex="0"><img src="${esc(a.l.thumb || a.l.images[0])}" alt=""><div class="ac-main"><h3>${esc(a.l.title)}</h3><p class="loc">${icon("pin", 18)} ${esc(a.l.area)}, ${esc(a.l.city)}</p><p class="facts"><span>${icon("bed", 18)}${bedsLabel(a.l.beds)}</span><i>•</i><span>${icon("bath", 18)}${a.l.baths} baths</span></p><b class="pr">${naira(a.l.price)} / year</b></div><div class="ac-st">${statusChip(a.status)}<small>${a.draft ? "Saved draft" : "Applied on " + fmtD(a.createdAt)}</small></div>${icon("chev", 22).replace("<svg", '<svg style="transform:rotate(-90deg)"')}</article>`).join("") : `<div class="pg-box empty-d"><h3>No applications yet</h3><p class="muted">When you apply for a home it will appear here.</p><a class="btn solid" href="#/search">Find a home</a></div>`;
        const a = items.find((x) => key(x) === sel), s = $("#as", root);
        if (!a) s.innerHTML = `<p class="muted">Select an application to see its progress.</p>`;
        else { const st1 = a.status, done = a.draft ? 0 : /review|awaiting/i.test(st1) ? 2 : ACTIVE(st1) ? 4 : 2, steps = [["Submitted", "Your application was submitted successfully."], ["Documents checked", "All required documents have been verified."], ["Agent review", "The agent is reviewing your application."], ["Decision", "You’ll be notified once a decision is made."]];
          s.innerHTML = `<div class="as-top"><div><h2>${esc(a.l.title)}</h2><p class="loc">${icon("pin", 18)} ${esc(a.l.area)}, ${esc(a.l.city)}</p></div>${statusChip(st1)}</div><img class="as-img" src="${esc(a.l.images[0])}" alt="">
            <p class="facts"><span>${icon("bed", 20)}${bedsLabel(a.l.beds)}</span><span>${icon("bath", 20)}${a.l.baths} bathrooms</span><span>${icon("area", 20)}${a.l.sqm} m²</span></p>
            ${a.draft ? "" : `<h3>Application timeline</h3><ol class="tl">${steps.map(([t, d], i) => `<li class="${i < done ? "ok" : i === done ? "cur" : ""}"><i>${i < done ? icon("check", 14, 3) : ""}</i><div><b>${t}</b><p>${d}</p></div><span>${i === 0 ? fmtD(a.createdAt) + "<br>" + fmtT(a.createdAt) : i === done && !ACTIVE(st1) ? '<em>In progress</em>' : "–"}</span></li>`).join("")}</ol>`}
            <h3>Payment summary</h3><div class="kvs"><div><span>Yearly rent</span><b>${naira(a.l.price)}</b></div><div><span>Service charge</span><b>${naira(a.l.service)}</b></div><div><span>Refundable deposit</span><b>${naira(a.l.deposit)}</b></div></div><div class="kvs tot"><div><span>Total (due on approval)</span><b>${naira(a.l.price + a.l.service + a.l.deposit)}</b></div></div>
            <div class="as-btns"><button class="btn" id="ma">${icon("msg", 22)} Message agent</button>${a.draft ? `<a class="btn solid" href="#/apply/${esc(a.listingId)}">${icon("pdf", 22)} Continue application</a>` : `<button class="btn solid" id="va">${icon("pdf", 22)} View application</button>`}</div>`;
          $("#ma", s).onclick = async () => { try { const cid = await st.ensureConversation(ctx.S.user, a.l); ctx.go("#/messages/" + cid); } catch (e) { toast(friendlyErr(e)); } };
          const va = $("#va", s); if (va) va.onclick = () => { const d = a.details || {}; modal(`<h2>Your application</h2><p class="muted" style="margin-bottom:12px">${esc(a.l.title)}</p>${[["Name", d.name], ["Phone", d.phone], ["Move-in date", a.moveIn], ["Occupants", d.occupants], ["Employment", d.employment], ["Employer", d.employer], ["Monthly income", d.income], ["Current address", d.address || "Not provided"]].filter((r) => r[1]).map(([k, v2]) => `<div class="kv"><span>${k}</span><b>${esc(v2)}</b></div>`).join("")}`); };
        }
        $$("[data-tab]", root).forEach((b) => (b.onclick = () => { tab = b.dataset.tab; draw(); }));
        $$("[data-sel]", root).forEach((c) => { const go = () => { sel = c.dataset.sel; draw(); }; c.onclick = go; c.onkeydown = (e) => { if (e.key === "Enter") go(); }; });
      };
      draw();
    } };
}

// ============================ my rental (overview) ============================
export async function rentalPage(ctx) {
  const { apps, listings, act, l } = await tenancy(ctx), [ds, de] = (act && addYear(act.moveIn)) || [], docs = await st.myDocs(ctx.S.user);
  const first = (ctx.S.user.displayName || "").split(" ")[0];
  const quick = [["#/documents", "pdf", "Documents", "View and download your tenancy files"], ["#/payments", "wallet", "Payments", "View payment history and receipts"], [l ? "#/messages" : "#/messages", "msg", l ? "Message agent" : "Messages", l ? "Chat with your property agent" : "Chat with agents"], ["#/applications", "list", "Applications", "Track your rental applications"]];
  const recent = [...apps.map((a) => ({ t: a.createdAt, i: "doc", h: "Application " + (/review/i.test(a.status) ? "submitted" : a.status.toLowerCase()), p: a.title })), ...docs.map((d) => ({ t: d.createdAt, i: "pdf", h: "Document uploaded", p: d.name }))].sort((x, y) => (y.t?.seconds || 0) - (x.t?.seconds || 0)).slice(0, 4);
  const hero = act && l ? `<section class="pg-box rent-hero"><img src="${esc(l.images[0])}" alt=""><div><span class="active-t">Active tenancy</span><h2>${esc(l.title)}</h2><p class="loc">${icon("pin", 22)} ${esc(l.area)}, ${esc(l.city)}</p><hr><div class="rh-2"><div><span>${icon("cal", 26)}</span><div><small>Tenancy term</small><b>${ds ? dlong(ds) + " –<br>" + dlong(de) : "—"}</b></div></div><div><span>${icon("coins", 26)}</span><div><small>Annual rent</small><b>${naira(l.price)} / year</b></div></div></div><hr>
      <div class="rh-3"><div><small>Service charge</small><b>${naira(l.service)} / year</b></div><div><small>Refundable deposit</small><b>${naira(l.deposit)}</b></div><div><small>Total (first year)</small><b>${naira(l.price + l.service + l.deposit)}</b></div></div></div></section>`
    : `<section class="pg-box rent-hero empty-r"><div class="er-in">${icon("home", 44, 1.3)}<h2>${first ? esc(first) + ", you" : "You"} don’t have an active rental yet</h2><p class="muted">Once an application is approved, your tenancy, payments and documents appear here.</p><div class="er-btns"><a class="btn solid" href="#/search">Find a home</a><a class="btn" href="#/applications">My applications</a></div></div></section>`;
  const a0 = l?.agent || listings[0]?.agent;
  const checklist = act ? [["Application approved", true], ["Tenancy agreement signed", docs.some((d) => d.type === "Agreement")], ["Initial payment completed", false], ["Move-in completed", false], ["Renewal reminder", false]] : [["Find a home", apps.length > 0 || false], ["Apply for a home", apps.length > 0], ["Application approved", false], ["Sign tenancy agreement", false], ["Move in", false]];
  return { title: "My rental", html: `<div class="wrap pg">${rentalsNav("/rentals")}<h1 class="pg-h1">My rental</h1><p class="pg-sub">Manage your tenancy, payments and requests in one place.</p>
    <div class="stat3"><div class="stat-b"><span class="si">${icon("wallet", 30)}</span><div><small>Rent paid</small><b>${naira(0)}</b><p>${act ? "Latest payment: none yet" : "No payments yet"}</p></div></div><div class="stat-b"><span class="si">${icon("cal", 30)}</span><div><small>Next renewal</small><b>${de ? dlong(new Date(de.getTime() + 864e5)).replace(/^\d+ /, "1 ") : "—"}</b><p>${de ? Math.max(0, Math.round((de - new Date()) / 2.63e9)) + " months remaining" : "Starts once a rental is active"}</p></div></div><div class="stat-b"><span class="si">${icon("doc", 30)}</span><div><small>Open requests</small><b>${apps.filter((a) => /review|awaiting/i.test(a.status)).length}</b><p>in progress</p></div></div></div>
    <div class="rent-grid">${hero}<section class="pg-box quick"><h2>Quick actions</h2>${quick.map(([h, ic, t, d]) => `<a class="qa" href="${h}"><span>${icon(ic, 26)}</span><div><b>${t}</b><small>${d}</small></div>${icon("chev", 20).replace("<svg", '<svg style="transform:rotate(-90deg)"')}</a>`).join("")}</section></div>
    <div class="rent-3"><section class="pg-box"><div class="sec-row"><h2>Tenancy checklist</h2><small>${checklist.filter((c) => c[1]).length} of ${checklist.length} complete</small></div><ol class="tl tlchk">${checklist.map(([t, ok]) => `<li class="${ok ? "ok" : ""}"><i>${ok ? icon("check", 14, 3) : ""}</i><div><b>${t}</b></div></li>`).join("")}</ol></section>
      <section class="pg-box"><div class="sec-row"><h2>Recent activity</h2><a class="link" href="#/applications">View all</a></div>${recent.length ? recent.map((r) => `<div class="act"><span class="si">${icon(r.i, 22)}</span><div><b>${r.h}</b><p>${esc(r.p)}</p></div><small>${fmtD(r.t)}</small></div>`).join("") : `<p class="muted" style="padding:14px 0">Nothing here yet.</p>`}</section>
      <section class="pg-box"><h2>Your agent</h2>${a0 ? `<div class="ya"><img src="${esc(a0.photo || a0.avatar)}" alt=""><div><b>${esc(a0.name)}</b><p>Property Agent</p><p>Faxton Rentals</p></div></div><a class="btn solid block" id="mya" href="#/agent/${esc(a0.id)}">${icon("msg", 22)} View ${esc(a0.name.split(" ")[0])}’s profile</a>` : `<p class="muted">Your agent appears here once you apply.</p>`}</section></div></div>` };
}

// ============================ call screen ============================
export async function callPage(ctx, cid) {
  const [listings] = [await st.getListings()]; const l = listings.find((x) => cid.endsWith("__" + x.id)) || listings[0], a = l.agent;
  return { title: "Voice call", html: `<div class="wrap pg"><a class="back-link" href="#/messages/${esc(cid)}">${icon("left", 20)} Back to messages</a><div class="call-grid"><section class="call"><img class="call-av" src="${esc(a.photo || a.avatar)}" alt=""><h1>${esc(a.name)}</h1><p class="cs">Calling isn’t available yet</p><p class="ct">We’re working on voice and video calls. Message ${esc(a.name.split(" ")[0])} in the meantime.</p>
    <div class="call-btns"><div><button class="cb" disabled aria-label="Mute">${icon("mic", 30)}</button><span>Mute</span></div><div><button class="cb on" disabled aria-label="Speaker">${icon("phone", 30)}</button><span>Speaker</span></div><div><button class="cb" disabled aria-label="Video">${icon("video", 30)}</button><span>Video</span></div><div><a class="cb end" href="#/messages/${esc(cid)}" aria-label="End call">${icon("phone", 30)}</a><span>End call</span></div></div></section>
    <aside><section class="pg-box prop-side"><p class="muted">Property you’re discussing</p><div class="ps-img"><img src="${esc(l.thumb || l.images[0])}" alt=""></div><h3>${esc(l.title)}</h3><p class="loc">${icon("pin", 16)} ${esc(l.area)}, ${esc(l.city)}</p><p class="facts hr"><span>${icon("bed", 18)}${l.beds} bedrooms</span><i class="sep"></i><span>${icon("bath", 18)}${l.baths} baths</span></p><hr><div class="kvs"><div><span>Annual rent</span><b>${naira(l.price)}</b></div><div><span>Service charge</span><b>${naira(l.service)}</b></div><div><span>Refundable deposit</span><b>${naira(l.deposit)}</b></div></div><div class="kvs tot"><div><span>Total (first payment)</span><b>${naira(l.price + l.service + l.deposit)}</b></div></div><a class="btn solid block" href="#/home/${esc(l.id)}">View property ${icon("arrow", 20)}</a></section>
      <a class="pg-box qa" href="#/messages/${esc(cid)}"><span>${icon("msg", 26)}</span><div><b>Messages</b><small>Chat with ${esc(a.name.split(" ")[0])} about this property</small></div>${icon("chev", 20).replace("<svg", '<svg style="transform:rotate(-90deg)"')}</a></aside></div></div>` };
}

// ============================ saved homes ============================
export async function savedPage(ctx) {
  const all = await st.getListings(), list = all.filter((l) => ctx.S.saved.has(l.id)), cmp = new Set();
  let tab = "all";
  const av = (l) => l.available !== false;
  return { title: "Saved homes", html: `<div class="wrap pg"><div class="sv-head"><div><h1 class="pg-h1">Saved homes</h1><p class="pg-sub">Your shortlist, all in one place.</p></div><div class="sv-tools"><div class="pill-tabs" id="svt"></div><button class="btn" id="cmp">${icon("chart", 22)} Compare homes (<span id="cc">0</span>)</button></div></div><div class="sv-grid" id="svg"></div></div>`,
    mount(root) {
      const shown = () => list.filter((l) => tab === "all" || (tab === "av" ? av(l) : !av(l)));
      const draw = () => {
        $("#svt", root).innerHTML = [["all", "All saved", list.length], ["av", "Available", list.filter(av).length], ["un", "Unavailable", list.filter((l) => !av(l)).length]].map(([k, t, n]) => `<button type="button" class="${tab === k ? "on" : ""}" data-tab="${k}">${t} (${n})</button>`).join("");
        const L = shown();
        $("#svg", root).innerHTML = L.length ? L.map((l) => `<article class="sv-card" data-open="${esc(l.id)}"><div class="sv-img"><img src="${esc(l.thumb || l.images[0])}" alt="${esc(l.title)}" loading="lazy"><span class="avail-dot ${av(l) ? "" : "off"}"><i></i>${av(l) ? "Available" : "Unavailable"}</span><button class="heart on" data-fav="${esc(l.id)}" aria-label="Remove ${esc(l.title)} from saved">${icon("heart", 22)}</button></div>
          <div class="sv-body"><label class="cmp-chk" aria-label="Compare ${esc(l.title)}"><input type="checkbox" data-cmp="${esc(l.id)}" ${cmp.has(l.id) ? "checked" : ""}></label><h3>${esc(l.title)}</h3><p class="loc">${icon("pin", 18)} ${esc(l.area)}, ${esc(l.city)}</p><b class="sv-price">${naira(l.price)} / year</b><hr>
            <p class="facts hr"><span>${icon("bed", 20)}${bedsLabel(l.beds)}</span><i>•</i><span>${icon("bath", 20)}${l.baths} bath${l.baths > 1 ? "s" : ""}</span></p><hr><div class="kvs sm"><div><span>Service charge</span><b>${naira(l.service)}</b></div><div><span>Refundable deposit</span><b>${naira(l.deposit)}</b></div></div><hr><div class="kvs sm tot2"><div><span>Total (first year)</span><b>${naira(l.price + l.service + l.deposit)}</b></div></div><a class="link vh" href="#/home/${esc(l.id)}">View home ${icon("arrow", 18)}</a></div></article>`).join("") : `<div class="pg-box empty-d" style="grid-column:1/-1"><h3>${list.length ? "Nothing in this view" : "Nothing saved yet"}</h3><p class="muted">Tap the heart on any home to keep it here.</p><a class="btn solid" href="#/search">Browse homes</a></div>`;
        $$("[data-tab]", root).forEach((b) => (b.onclick = () => { tab = b.dataset.tab; draw(); }));
        $$("[data-fav]", root).forEach((b) => (b.onclick = async (e) => { e.stopPropagation(); await ctx.setSaved(b.dataset.fav, false); const i = list.findIndex((x) => x.id === b.dataset.fav); if (i > -1) list.splice(i, 1); cmp.delete(b.dataset.fav); draw(); count(); }));
        $$("[data-cmp]", root).forEach((c) => { c.onclick = (e) => e.stopPropagation(); c.onchange = () => { if (c.checked && cmp.size >= 3) { c.checked = false; return toast("You can compare up to 3 homes."); } c.checked ? cmp.add(c.dataset.cmp) : cmp.delete(c.dataset.cmp); count(); }; });
        $$("[data-open]", root).forEach((c) => (c.onclick = (e) => { if (!e.target.closest("button,input,label,a")) ctx.go("#/home/" + c.dataset.open); }));
      };
      const count = () => ($("#cc", root).textContent = cmp.size);
      $("#cmp", root).onclick = () => {
        if (cmp.size < 2) return toast("Tick two or three homes to compare them.");
        const hs = list.filter((l) => cmp.has(l.id)), row = (k, f) => `<tr><th>${k}</th>${hs.map((h) => `<td>${f(h)}</td>`).join("")}</tr>`;
        modal(`<h2>Compare homes</h2><div class="tbl-wrap"><table class="dtab cmp"><thead><tr><th></th>${hs.map((h) => `<th>${esc(h.title)}</th>`).join("")}</tr></thead><tbody>${row("Area", (h) => esc(h.area))}${row("Rent / year", (h) => naira(h.price))}${row("Service charge", (h) => naira(h.service))}${row("Deposit", (h) => naira(h.deposit))}${row("Total (first year)", (h) => `<b>${naira(h.price + h.service + h.deposit)}</b>`)}${row("Bedrooms", (h) => bedsLabel(h.beds))}${row("Bathrooms", (h) => h.baths)}${row("Size", (h) => h.sqm + " m²")}${row("Status", (h) => (h.available === false ? "Unavailable" : "Available"))}</tbody></table></div>`);
      };
      draw();
    } };
}

// ============================ help centre ============================
const FAQ = [["How do I reschedule a viewing?", "You can reschedule a viewing from your Messages or by contacting the agent directly. If you can no longer make the time, please let us know at least 24 hours in advance so we can arrange an alternative slot.", "rent"],
  ["How do I make a rental payment?", "Once your application is approved, your agent shares the payment details in Messages. Receipts then appear under My rentals → Payments.", "pay"],
  ["What is the service charge?", "The service charge covers the upkeep of shared areas such as security, water supply and estate maintenance. It is listed on every home.", "pay"],
  ["How long is the tenancy agreement?", "Tenancies are usually for one year and renew each year. The exact term is in your tenancy agreement under My rentals → Documents.", "rent"],
  ["Can I get a refund on my deposit?", "The refundable deposit is returned at the end of your tenancy, once the agent has checked the home and any outstanding charges are settled.", "pay"],
  ["How do I change my password?", "Go to Settings → Account & security and choose “Send password reset email”.", "acct"]];
export async function helpPage(ctx) {
  const tickets = await st.myTickets(ctx.S.user); let open = 0, q = "", cat = "";
  const cats = [["rent", "home", "Renting a home", "Viewings, applications, contracts and moving in."], ["pay", "coins", "Payments & receipts", "Rent, service charges, deposits and invoices."], ["acct", "user", "Account access", "Logging in, account security and managing your details."]];
  const t0 = tickets[0];
  return { title: "Help centre", html: `<div class="wrap pg"><section class="help-hero"><div class="hh-text"><span class="eyebrow-s light">Help centre</span><h1>How can we help?</h1><p>Find answers to common questions or get in touch with our support team.</p><label class="hh-search">${icon("search", 24)}<input id="hq" type="search" placeholder="Search for help" aria-label="Search for help"></label></div><div class="hh-img"></div></section>
    <div class="help-cats">${cats.map(([k, ic, t, d]) => `<button type="button" class="hc" data-cat="${k}"><span class="si">${icon(ic, 30)}</span><div><b>${t}</b><small>${d}</small></div>${icon("chev", 22).replace("<svg", '<svg style="transform:rotate(-90deg)"')}</button>`).join("")}</div>
    <div class="help-grid"><section class="pg-box"><h2>Frequently asked questions</h2><p class="sub">Quick answers to the most common questions from our renters.</p><div id="faq"></div></section>
      <aside class="pg-box"><h2>Contact support</h2><p class="sub">Still need help? Our team is here for you.</p><button class="btn solid block" id="nt">${icon("mail", 22)} New support request</button><button class="link vt" id="vt">View my tickets ${icon("arrow", 18)}</button><hr><h3>Your latest support ticket</h3>
      ${t0 ? `<div class="tk"><div class="tk-top"><small>#${esc(t0.ref)}</small><span class="pill info">${esc(t0.status)}</span></div><b>${esc(t0.subject)}</b><p>${esc(t0.message.slice(0, 120))}</p><small class="muted">Opened ${fmtD(t0.createdAt)}</small></div>` : `<p class="muted">You haven’t opened a support ticket yet.</p>`}</aside></div></div>`,
    mount(root) {
      const draw = () => {
        const L = FAQ.filter((f) => (!cat || f[2] === cat) && (!q || (f[0] + f[1]).toLowerCase().includes(q)));
        $("#faq", root).innerHTML = L.length ? L.map((f, i) => `<div class="fq ${open === i ? "on" : ""}"><button type="button" data-i="${i}" aria-expanded="${open === i}"><span>${esc(f[0])}</span>${icon("chev", 22)}</button><div class="fa"><p>${esc(f[1])}</p></div></div>`).join("") : `<p class="muted" style="padding:14px">No answers match. Try the support request button.</p>`;
        $$("[data-i]", root).forEach((b) => (b.onclick = () => { const i = +b.dataset.i; open = open === i ? -1 : i; $$(".fq", root).forEach((el, k) => { el.classList.toggle("on", k === open); el.querySelector("button").setAttribute("aria-expanded", String(k === open)); }); }));
        $$("[data-cat]", root).forEach((b) => b.classList.toggle("on", b.dataset.cat === cat));
      };
      $("#hq", root).oninput = (e) => { q = e.target.value.trim().toLowerCase(); open = 0; draw(); };
      $$("[data-cat]", root).forEach((b) => (b.onclick = () => { cat = cat === b.dataset.cat ? "" : b.dataset.cat; open = 0; draw(); $("#faq", root).scrollIntoView({ behavior: "smooth", block: "center" }); }));
      const form = () => { const m = modal(`<h2>New support request</h2><p class="muted" style="margin-bottom:12px">Tell us what you need help with.</p><form id="tf2"><label class="fl">Topic<select id="ts"><option>Viewing or booking</option><option>Application</option><option>Payments</option><option>Account</option><option>Something else</option></select></label><label class="fl" style="margin-top:12px">Message<textarea id="tm" rows="5" maxlength="2000" placeholder="Describe your issue…"></textarea></label><div class="err" id="te2"></div><button class="btn primary block">Send request</button></form>`);
        $("#tf2", m.el).onsubmit = async (e) => { e.preventDefault(); const msg = $("#tm", m.el).value.trim(); if (msg.length < 10) return ($("#te2", m.el).textContent = "Please add a little more detail."); const b = e.target.querySelector("button"); b.disabled = true;
          try { await st.addTicket(ctx.S.user, { subject: $("#ts", m.el).value, message: msg }); m.close(); toast("Request sent. We’ll reply by email."); ctx.render(); } catch (x) { $("#te2", m.el).textContent = friendlyErr(x); b.disabled = false; } }; };
      $("#nt", root).onclick = form;
      $("#vt", root).onclick = () => { if (!tickets.length) return toast("No tickets yet."); modal(`<h2>My tickets</h2>${tickets.map((t) => `<div class="tk" style="margin-top:10px"><div class="tk-top"><small>#${esc(t.ref)}</small><span class="pill info">${esc(t.status)}</span></div><b>${esc(t.subject)}</b><p>${esc(t.message)}</p><small class="muted">Opened ${fmtD(t.createdAt)}</small></div>`).join("")}`); };
      draw();
    } };
}

// ---------- Forgot password / check your email ----------
export function forgotPage(ctx) {
  const pre = ctx.q.email || "", sent = ctx.q.sent === "1";
  const left = sent
    ? `<span class="fg-ic">${icon("mail", 30)}</span><h1>Check your email</h1><p class="fg-sub">We’ve sent a password reset link to</p><p class="fg-em">${esc(pre)}</p><p class="fg-sub">Open the email and tap the link to choose a new password. It can take a minute to arrive, so check your spam folder too.</p><div class="fg-actions"><button class="btn" id="fg-resend" type="button">Resend email</button><a class="btn primary" href="#/login">Back to sign in</a></div><p class="fg-err" id="fg-err" role="alert"></p>`
    : `<span class="fg-ic">${icon("lock", 30)}</span><h1>Forgot your password?</h1><p class="fg-sub">No worries. Enter the email linked to your account and we’ll send you a link to reset it.</p><form id="fg" novalidate><div class="field"><label for="fge">Email address</label><input id="fge" name="email" type="email" autocomplete="email" inputmode="email" placeholder="Enter your email address" value="${esc(pre)}" required></div><p class="fg-err" id="fg-err" role="alert"></p><button class="btn primary wide" type="submit">Send reset link</button></form><a class="fg-back" href="#/login">${icon("left", 18)} Back to sign in</a>`;
  const html = `<main class="fg-page"><a class="fg-logo" href="#/" aria-label="Faxton Rentals"><span class="logo-word"><b>Faxton</b> Rentals</span></a><div class="fg-card"><section class="fg-form">${left}</section><div class="fg-photo" role="img" aria-label="A welcoming front door"></div></div></main>`;
  return { title: "Reset password", full: true, html, mount(root) {
    const err = $("#fg-err", root), send = async (em, btn) => { err.textContent = ""; btn.disabled = true; try { await ctx.resetPassword(em); return true; } catch (e) { err.textContent = friendlyErr(e); return false; } finally { btn.disabled = false; } };
    const f = $("#fg", root);
    if (f) f.onsubmit = async (e) => { e.preventDefault(); const em = $("#fge", root).value.trim(); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) return (err.textContent = "Enter a valid email address."); if (await send(em, f.querySelector("button"))) ctx.go("#/forgot?sent=1&email=" + encodeURIComponent(em)); };
    const r = $("#fg-resend", root); if (r) r.onclick = async () => { if (await send(pre, r)) toast("Reset email sent again."); };
  } };
}
