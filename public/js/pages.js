// Renter pages: agent profile, book a viewing, apply to rent, My rentals (overview, applications, documents), payments, help.
// Styling lives in css/flow.css (rf- classes). Bank-transfer payments are in paymentspage.js and paymentinfo.js.
import { db } from "./firebase.js";
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { $, $$, esc, naira, icon, toast, modal, verifiedBadge } from "./ui.js";
import * as st from "./store.js";
import * as AREA from "./area.js";
import * as OFFERS from "./offers.js";
import * as VS from "./viewsafe.js";
import { listingCard, bindCards } from "./cards.js";
import { fxErr, xicon, statusPill, empty, ask, fmtDay, tsMs, longDay, shrinkImage, openStored, supportLine } from "./fx.js";
import * as PAY from "./paymentinfo.js";

const bedsLabel = (n) => (n === 0 ? "Studio" : `${n} bed${n > 1 ? "s" : ""}`);
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const longDate = (d) => d.toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const chevRight = (s = 16) => icon("chev", s).replace("<svg", '<svg style="transform:rotate(-90deg)"');
const crumbs = (items) => `<nav class="rf-crumbs" aria-label="Breadcrumb">${items.map(([h, l], i) => (h ? `<a href="${h}">${esc(l)}</a>` : `<b>${esc(l)}</b>`) + (i < items.length - 1 ? chevRight(14) : "")).join("")}</nav>`;
const pageHead = (eyebrow, title, sub, actions = "") => `<header class="rf-ph"><div>${eyebrow ? `<span class="rf-eyebrow">${esc(eyebrow)}</span>` : ""}<h1 class="rf-h1">${title}</h1>${sub ? `<p class="rf-sub">${sub}</p>` : ""}</div>${actions ? `<div class="rf-ph-a">${actions}</div>` : ""}</header>`;
const costRows = (l, rent = l.price, label = "Total move-in cost") => { const m = AREA.moveIn(l, rent); return `<div class="rf-kv">${m.items.map(([t, v, , note]) => `<div><span>${esc(t)}${note === "Refundable" ? " (refundable)" : ""}</span><b>${naira(v)}</b></div>`).join("")}<div class="total"><span>${esc(label)}</span><b>${naira(m.total)}</b></div></div>`; };
const locOf = (l) => `${l.area}${l.city && !String(l.area).includes(l.city) ? ", " + l.city : ""}`;
const notFound = () => ({ title: "Not found", html: `<div class="rf">${empty({ ic: "search", title: "We couldn’t find that home", hint: "It may have been rented or taken down.", action: `<a class="btn primary" href="#/search">Browse homes</a>` })}</div>` });
const stepper = (steps, cur) => `<ol class="rf-steps" aria-label="Progress">${steps.map((s, i) => `<li class="${i + 1 < cur ? "done" : i + 1 === cur ? "on" : ""}" ${i + 1 === cur ? 'aria-current="step"' : ""}><span>${i + 1 < cur ? icon("check", 15, 2.8) : i + 1}</span><b>${s}</b></li>`).join('<hr class="ln">')}</ol>`;
const agentOf = (l) => l.agent || { name: "Faxton agent", avatar: "img/av-daniel.webp" };
const agentRow = (l, role = "Property agent") => { const a = agentOf(l); return `<div class="rf-person"><img src="${esc(a.avatar || a.photo || "img/av-daniel.webp")}" alt=""><div><b>${esc(a.name)}</b><small>${role}</small></div><div class="rf-agrow"><a class="rf-ib" href="#/agent/${esc(a.id || "")}" aria-label="${esc(a.name)}’s profile">${icon("user", 18)}</a><a class="rf-ib" href="#/messages" aria-label="Messages">${icon("msg", 18)}</a></div></div>`; };
const propSummary = (l, { counter = "", total = "", rent = l.price, heading = "", extra = "" } = {}) => `<aside class="rf-card rf-prop"><div class="rf-prop-img"><img id="apimg" src="${esc(l.thumb || l.images?.[0] || "")}" alt="${esc(l.title)}">${counter}</div><h3>${esc(l.title)}</h3><p class="rf-loc">${icon("pin", 15)} ${esc(locOf(l))}</p><p class="rf-facts"><span>${icon("bed", 17)}${bedsLabel(l.beds)}</span><span>${icon("bath", 17)}${l.baths} bath${l.baths > 1 ? "s" : ""}</span></p><hr>${heading ? `<h4>${heading}</h4>` : ""}${extra}${costRows(l, rent, total || "Total due on move-in")}${agentRow(l)}</aside>`;

// ============================ agent profile ============================
export async function agentPage(ctx, id) {
  const all = await st.getListings(), mine = all.filter((l) => l.agent?.id === id), a = mine[0]?.agent;
  if (!a) return notFound();
  const first = a.name.split(" ")[0], area = locOf(mine[0]);
  const base = new Date(); base.setHours(0, 0, 0, 0); const days = []; for (let i = 1; days.length < 5; i++) { const d = new Date(base.getTime() + i * 864e5); if (d.getDay() !== 0) days.push(d); }
  const slots = ["10:00 AM", "12:00 PM", "2:00 PM", "4:00 PM"];
  return { title: a.name, html: `<div class="rf">${crumbs([["#/search", "Find a home"], [null, a.name]])}
    <div class="rf-grid wide-side"><section class="rf-card rf-agent"><img class="rf-agent-ph" src="${esc(a.photo || a.avatar)}" alt="${esc(a.name)}">
      <div class="rf-agent-in"><h1 class="rf-h1">${esc(a.name)}</h1><p class="rf-agent-role">Listing agent</p><p class="rf-loc">${icon("pin", 16)} ${esc(area)} <span class="idv">${icon("ver", 16)} Identity verified</span></p>
        <div class="rf-actions"><button class="btn primary" id="msgA">${icon("msg", 18)} Message</button><button class="btn" id="callA">${icon("phone", 18)} Call</button></div>
        <hr><p class="rf-agent-bio">${esc(first)} helps people find well-located homes across ${esc(mine[0].area.split(" ")[0])} and nearby areas, and answers questions before you visit.</p>
        <div class="rf-agent-facts"><div>${icon("globe", 20)}<span><small>Speaks</small>English, Yoruba</span></div><div>${icon("clock", 20)}<span><small>Replies</small>Usually within an hour</span></div><div>${icon("home", 20)}<span><small>Listings</small>${mine.length} home${mine.length > 1 ? "s" : ""}</span></div></div></div></section>
      <aside class="rf-card"><div class="rf-card-h"><div><h2>Book a viewing</h2><p>Pick a day and a time to see a home with ${esc(first)}.</p></div></div>
        <div class="rf-chips" role="tablist" aria-label="Day">${days.map((d, i) => `<button type="button" role="tab" aria-selected="${i === 0}" class="${i === 0 ? "on" : ""}" data-day="${iso(d)}"><small>${DAYS[d.getDay()]}</small><b>${d.getDate()}</b><small>${MONTHS[d.getMonth()].slice(0, 3)}</small></button>`).join("")}</div>
        <div class="rf-slots">${slots.map((s) => `<button type="button" class="rf-slot" data-slot="${s}">${icon("clock", 18)}<span>${s}</span>${chevRight(16)}</button>`).join("")}</div>
        <button class="btn primary block" id="vt" style="margin-top:12px">${icon("cal", 18)} See all times</button></aside></div>
    <div class="rf-sec"><div><h2>Homes by ${esc(first)}</h2><p class="rf-muted">${mine.length} listing${mine.length > 1 ? "s" : ""} on Faxton Rentals.</p></div><a class="rf-card-link" href="#/search">Browse all homes ${chevRight(14)}</a></div>
    <div class="rf-cards" id="agCards">${mine.map((l, i) => listingCard(l, ctx.S.saved, { i })).join("")}</div></div>`,
    mount(root) {
      bindCards($("#agCards", root), ctx); let day = days[0] ? iso(days[0]) : "";
      // The green tick only appears for agents an admin has verified; "identity verified" is hidden for real agents who aren't.
      st.getPublic(id).then((pb) => { const idv = $(".idv", root); if (pb?.verified) $(".rf-agent-in h1", root)?.insertAdjacentHTML("beforeend", " " + verifiedBadge(24)); else if (mine[0].ownerUid && idv) idv.remove(); });
      const lid = mine[0].id;
      $$("[data-day]", root).forEach((b) => (b.onclick = () => { day = b.dataset.day; $$("[data-day]", root).forEach((x) => { x.classList.toggle("on", x === b); x.setAttribute("aria-selected", x === b); }); }));
      $$("[data-slot]", root).forEach((b) => (b.onclick = () => ctx.go(`#/book/${lid}?date=${day}&slot=${encodeURIComponent(b.dataset.slot)}`)));
      $("#vt", root).onclick = () => ctx.go(`#/book/${lid}?date=${day}`);
      $("#msgA", root).onclick = async () => { try { const cid = await st.ensureConversation(ctx.S.user, mine[0]); ctx.go("#/messages/" + cid); } catch (e) { toast(fxErr(e)); } };
      $("#callA", root).onclick = async () => {
        try { const cid = await st.ensureConversation(ctx.S.user, mine[0]), to = mine[0].ownerUid && mine[0].ownerUid !== ctx.S.user.uid ? mine[0].ownerUid : "staff"; const C = await import("./calls.js");
          C.startCall(ctx, { convId: cid, to, toName: to === "staff" ? "Faxton team" : a.name, toPhoto: a.avatar || "", kind: "voice", title: mine[0].title, image: mine[0].thumb || mine[0].images?.[0] || "", area: mine[0].area }); } catch (e) { toast(fxErr(e)); }
      };
    } };
}

// ============================ book a viewing ============================
export async function bookPage(ctx, id) {
  const l = await st.getListing(id); if (!l) return notFound();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const S = { date: ctx.q.date ? new Date(ctx.q.date + "T00:00:00") : null, slot: ctx.q.slot || "", tour: ctx.q.tour === "virtual" ? "Virtual tour" : "In-person tour", step: 1, month: null, phone: ctx.S.profile?.phone || "", note: "", trusted: VS.getTrusted(ctx.S.user.uid) || {}, agentVerified: false, existing: null };
  if (S.date && (isNaN(S.date) || S.date <= today || S.date.getDay() === 0)) S.date = null;
  if (!S.date) { const d = new Date(today.getTime() + 864e5); while (d.getDay() === 0) d.setDate(d.getDate() + 1); S.date = d; }
  S.month = new Date(S.date.getFullYear(), S.date.getMonth(), 1);
  const TIMES = ["10:00 AM", "12:00 PM", "2:00 PM", "4:00 PM"]; if (!TIMES.includes(S.slot)) S.slot = TIMES[0];
  const a = agentOf(l);
  const side = `<aside class="rf-card rf-prop rf-bk-side"><div class="rf-prop-img"><img src="${esc(l.thumb || l.images?.[0] || "")}" alt="${esc(l.title)}"></div><h3>${esc(l.title)}</h3><p class="rf-loc">${icon("pin", 15)} ${esc(locOf(l))}</p><p class="rf-facts"><span>${icon("bed", 17)}${bedsLabel(l.beds)}</span><span>${icon("bath", 17)}${l.baths} bath${l.baths > 1 ? "s" : ""}</span></p><hr>${costRows(l, l.price, "Total due on move-in")}${agentRow(l)}</aside>`;
  const mini = `<a class="rf-card rf-bk-mini" href="#/home/${esc(l.id)}"><img src="${esc(l.thumb || l.images?.[0] || "")}" alt=""><div><b>${esc(l.title)}</b><small>${esc(locOf(l))}</small></div>${chevRight(18)}</a>`;
  return { title: "Book a viewing", html: `<div class="rf">${pageHead("", "Book a viewing", "Pick a day and time to see this home. It only takes a minute.")}<div id="bk"></div></div>`,
    mount(root) {
      const bk = $("#bk", root);
      const draw = () => {
        const { step } = S, steps = ["Choose a time", "Your details", "Confirm"];
        let main;
        if (step === 1) {
          const first = S.month, y = first.getFullYear(), m = first.getMonth(), start = new Date(y, m, 1 - first.getDay()), cells = [];
          for (let i = 0; i < 42; i++) { const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i), out = d.getMonth() !== m, un = d <= today || d.getDay() === 0; if (i >= 35 && out) break; cells.push(`<button type="button" class="rf-day ${out ? "out" : ""} ${iso(d) === iso(today) ? "today" : ""} ${iso(d) === iso(S.date) ? "sel" : ""}" ${un || out ? "disabled" : ""} data-d="${iso(d)}" aria-label="${d.toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long" })}" ${iso(d) === iso(S.date) ? 'aria-pressed="true"' : ""}>${d.getDate()}</button>`); }
          main = `<section class="rf-card rf-cal-card">${S.existing ? `<div class="rf-note warn">${icon("info", 20)}<div><b>You already have a viewing for this home</b><p>${esc(longDay(S.existing.when))} at ${esc(S.existing.slot)} (${esc(S.existing.status)}). Book another only if you need a different time. <a class="rf-link" href="#/bookings">See your viewings</a></p></div></div>` : ""}
            <div class="rf-cal-grid"><div class="rf-cal"><div class="rf-card-h"><h2>Select a date</h2><div class="rf-cal-nav"><button type="button" id="pm" aria-label="Previous month">${icon("left", 18)}</button><b>${MONTHS[m]} ${y}</b><button type="button" id="nm" aria-label="Next month">${icon("arrow", 18)}</button></div></div>
              <div class="rf-dow">${DAYS.map((d) => `<span>${d}</span>`).join("")}</div><div class="rf-days">${cells.join("")}</div>
              <div class="rf-legend"><span><i class="a"></i>Available</span><span><i class="u"></i>Unavailable</span><span><i class="s"></i>Selected</span></div></div>
            <div class="rf-times"><div class="rf-card-h"><h2>Select a time</h2><span class="rf-meta rf-tz">${icon("clock", 16)} Lagos time (WAT)</span></div><p class="rf-meta" style="margin:-6px 0 10px">Times for <b>${longDate(S.date)}</b></p>
              <div class="rf-opts" role="radiogroup" aria-label="Time">${TIMES.map((t) => `<button type="button" role="radio" aria-checked="${t === S.slot}" class="rf-opt ${t === S.slot ? "on" : ""}" data-t="${t}"><i class="rf-rd"></i><span><b>${t}</b><small>About 30 minutes</small></span></button>`).join("")}</div>
              <h3 class="rf-h3">Tour type</h3><div class="rf-opts two" role="radiogroup" aria-label="Tour type">${[["In-person tour", "pin", "Meet the agent at the home"], ["Virtual tour", "video", "Join a live video tour"]].map(([t, ic, d]) => `<button type="button" role="radio" aria-checked="${S.tour === t}" class="rf-opt ${S.tour === t ? "on" : ""}" data-tt="${t}"><i class="rf-rd"></i><span><b>${icon(ic, 17)} ${t}</b><small>${d}</small></span></button>`).join("")}</div></div></div></section>`;
        } else if (step === 2) {
          main = `<section class="rf-card"><div class="rf-card-h"><div><h2>Your details</h2><p>The agent uses these to confirm your viewing.</p></div></div><div class="rf-form"><div class="rf-grid2"><label class="rf-fl">Full name<input id="bn" value="${esc(ctx.S.user.displayName || "")}" disabled></label><label class="rf-fl">Email address<input value="${esc(ctx.S.user.email)}" disabled></label>
            <label class="rf-fl">Phone number<input id="bp" type="tel" inputmode="tel" placeholder="e.g. 0803 000 0000" value="${esc(S.phone)}" maxlength="30" autocomplete="tel"></label></div>
            <label class="rf-fl"><span>Note for the agent <span class="rf-optl">(optional)</span></span><textarea id="bnote" rows="3" maxlength="300" placeholder="Anything the agent should know?">${esc(S.note)}</textarea></label>${VS.trustedFields(S.trusted)}<p class="rf-err" id="berr" role="alert"></p></div></section>`;
        } else main = `<section class="rf-card"><div class="rf-card-h"><div><h2>Confirm your viewing</h2><p>Check the details, then confirm.</p></div></div><div class="rf-kv"><div><span>Home</span><b>${esc(l.title)}</b></div><div><span>Date</span><b>${longDate(S.date)}</b></div><div><span>Time</span><b>${S.slot}</b></div><div><span>Tour</span><b>${S.tour}</b></div><div><span>Agent</span><b>${esc(a.name)}</b></div><div><span>Your phone</span><b>${esc(S.phone || "—")}</b></div>${S.trusted?.name ? `<div><span>Trusted contact</span><b>${esc(S.trusted.name)}</b></div>` : ""}</div>
          <h3 class="rf-h3">Your agent</h3>${VS.identityHtml(a, S.agentVerified)}<details class="rf-tips"><summary>${icon("shield", 16)} Staying safe at a viewing</summary><ul><li>View in daylight and tell someone where you’re going.</li><li>Check in when you arrive and out when you leave. We’ll nudge you if it runs long.</li><li>Never pay cash or a deposit before you’ve seen the home and its documents.</li><li>Use the Emergency button on your Viewings page if anything feels wrong.</li></ul></details><p class="rf-err" id="berr" role="alert"></p></section>`;
        bk.innerHTML = `${stepper(steps, step)}<div class="rf-grid"><div class="rf-col">${mini}${main}</div>${side}</div>
          <div class="rf-bar"><span class="rf-bar-ic">${icon("cal", 22)}</span><div><small>Your viewing</small><b>${longDate(S.date)} at ${S.slot}</b></div>${step > 1 ? `<button class="btn" id="bb">Back</button>` : ""}<button class="btn primary" id="bn2">${step === 3 ? "Confirm viewing" : "Continue"} ${icon("arrow", 18)}</button></div>`;
        wire();
      };
      const wire = () => {
        $$("[data-d]", bk).forEach((b) => (b.onclick = () => { S.date = new Date(b.dataset.d + "T00:00:00"); draw(); }));
        $$("[data-t]", bk).forEach((b) => (b.onclick = () => { S.slot = b.dataset.t; draw(); })); $$("[data-tt]", bk).forEach((b) => (b.onclick = () => { S.tour = b.dataset.tt; draw(); }));
        const pm = $("#pm", bk), nm = $("#nm", bk); if (pm) { pm.onclick = () => { S.month = new Date(S.month.getFullYear(), S.month.getMonth() - 1, 1); draw(); }; nm.onclick = () => { S.month = new Date(S.month.getFullYear(), S.month.getMonth() + 1, 1); draw(); }; pm.disabled = S.month <= new Date(today.getFullYear(), today.getMonth(), 1); }
        const bb = $("#bb", bk); if (bb) bb.onclick = () => { keep(); S.step--; draw(); };
        $("#bn2", bk).onclick = async () => {
          keep(); const err = $("#berr", bk);
          if (S.step === 2 && !/^[+\d][\d\s-]{6,}$/.test(S.phone.trim())) return (err.textContent = "Enter a valid phone number.");
          if (S.step === 2 && !VS.validTrusted(bk)) return (err.textContent = "Enter both the name and a valid phone number for your trusted contact, or leave both empty.");
          if (S.step < 3) { S.step++; draw(); return scrollTo({ top: 0, behavior: "smooth" }); }
          const b = $("#bn2", bk); b.disabled = true;
          try { await st.addViewing(ctx.S.user, l, iso(S.date), S.slot, { tour: S.tour, phone: S.phone, note: S.note, agentUid: l.ownerUid || a.id, agentName: a.name, agentPhoto: a.avatar, agentVerified: !!S.agentVerified, ...(S.trusted?.name && S.trusted?.phone ? { trusted: S.trusted } : {}) });
            if (S.trusted?.name && S.trusted?.phone) VS.saveTrusted(ctx.S.user.uid, S.trusted);
            try { const cid = await st.ensureConversation(ctx.S.user, l); await st.sendMessage(ctx.S.user, cid, `Viewing requested: ${longDate(S.date)}, ${S.slot}`, { type: "booking", when: iso(S.date), slot: S.slot, title: l.title, area: l.area, image: l.thumb || l.images?.[0] }); } catch {}
            toast("Viewing requested. We’ll confirm shortly."); ctx.go("#/bookings"); } catch (e) { err.textContent = fxErr(e); b.disabled = false; }
        };
      };
      const keep = () => { const p = $("#bp", bk), n = $("#bnote", bk); if (p) S.phone = p.value; if (n) S.note = n.value; if ($("#tcName", bk)) S.trusted = { name: $("#tcName", bk).value.trim(), phone: $("#tcPhone", bk).value.trim() }; };
      st.getPublic(l.ownerUid || a.id).then((pb) => { S.agentVerified = !!pb?.verified; if (S.step === 3) draw(); });
      st.myViewings(ctx.S.user).then((vs) => { const ex = vs.find((v) => v.listingId === l.id && /requested|confirmed/i.test(v.status) && new Date(String(v.when).slice(0, 10) + "T23:59:59") >= new Date()); if (ex) { S.existing = ex; if (S.step === 1) draw(); } });
      draw();
    } };
}

// ============================ apply to rent ============================
const DKEY = (u, id) => `draft_${u.uid}_${id}`;
const loadDraft = (u, id) => { try { return JSON.parse(localStorage.getItem(DKEY(u, id))) || {}; } catch { return {}; } };
const localPhone = (p) => { let d = String(p || "").replace(/\D/g, ""); if (d.startsWith("234")) d = d.slice(3); if (d.startsWith("0")) d = d.slice(1); return d.replace(/^(\d{3})(\d{3})(\d{0,4}).*$/, (m, a, b, c) => [a, b, c].filter(Boolean).join(" ")) || d; };
const readPdf = (f) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
export async function applyPage(ctx, id) {
  const l = await st.getListing(id); if (!l) return notFound();
  let rent = l.price, offerId = "";
  if (ctx.q.offer) { const o = await OFFERS.getOffer(ctx.q.offer); if (o && o.uid === ctx.S.user.uid && o.listingId === l.id && o.status === "Accepted") { rent = o.amount; offerId = o.id; } }
  const u = ctx.S.user, p = ctx.S.profile || {}, tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
  const D = { name: u.displayName || "", email: u.email, phone: localPhone(p.phone), address: "", movein: "", occupants: "", note: "", status: "", employer: "", job: "", income: "", ...loadDraft(u, id) };
  let step = Math.min(Math.max(+D._step || 1, 1), 4); const files = { id: D.idFile || "", income: D.incomeFile || "" }, blobs = { id: D.idDoc || "", income: D.incomeDoc || "" };
  const imgs = (l.images || []).filter(Boolean), STEPS = ["Personal details", "Employment", "Documents", "Review"];
  const agreed = offerId ? `<p class="rf-note" style="margin:0 0 8px">${icon("checkc", 18)}<span><b>Agreed rent ${naira(rent)}</b>Asking was ${naira(l.price)}.</span></p>` : "";
  const side = propSummary(l, { rent, total: "Total due on signing", counter: `<span class="counter" id="apc">1 / ${Math.max(imgs.length, 1)}</span>`, heading: "Rental details", extra: agreed });
  return { title: "Apply to rent", html: `<div class="rf">${pageHead("", `Apply for ${esc(l.title)}`, "Complete your application so the agent can consider you for this home.")}<div class="rf-grid"><div id="ap" class="rf-col"></div>${side}</div></div>`,
    mount(root) {
      const ap = $("#ap", root); let k = 0;
      const imgTimer = imgs.length > 1 ? setInterval(() => { k = (k + 1) % imgs.length; const i = $("#apimg"); if (i) { i.src = imgs[k]; $("#apc").textContent = `${k + 1} / ${imgs.length}`; } }, 3500) : 0; ctx.S.cleanups.push(() => clearInterval(imgTimer));
      const save = (msg) => {
        const base = { ...D, _step: step, idFile: files.id, incomeFile: files.income };
        try { localStorage.setItem(DKEY(u, id), JSON.stringify({ ...base, idDoc: blobs.id, incomeDoc: blobs.income })); if (msg) toast("Draft saved on this device."); }
        catch { try { localStorage.setItem(DKEY(u, id), JSON.stringify(base)); if (msg) toast("Draft saved. Attach your documents again before you submit."); } catch { if (msg) toast("We couldn’t save the draft on this device."); } }
      };
      const read = () => { for (const k2 of ["name", "email", "phone", "address", "movein", "occupants", "note", "status", "employer", "job", "income"]) { const e = $("#f_" + k2, ap); if (e) D[k2] = e.value; } };
      const field = (k2, label, ph, o = {}) => `<label class="rf-fl"><span>${label}${o.opt ? ' <span class="rf-optl">(optional)</span>' : ""}</span><input id="f_${k2}" type="${o.type || "text"}" placeholder="${ph}" value="${esc(D[k2])}" ${o.extra || ""}></label>`;
      const sel = (k2, label, ph, opts) => `<label class="rf-fl">${label}<select id="f_${k2}"><option value="">${ph}</option>${opts.map((x) => `<option ${x === D[k2] ? "selected" : ""}>${x}</option>`).join("")}</select></label>`;
      const draw = () => {
        let body;
        if (step === 1) body = `<div class="rf-card-h"><div><h2>Personal details</h2><p>Tell us a little about yourself.</p></div></div><div class="rf-form"><div class="rf-grid2">${field("name", "Full name", "Your full name", { extra: 'autocomplete="name" maxlength="120"' })}${field("email", "Email address", "Your email", { type: "email", extra: "disabled" })}
          <label class="rf-fl">Phone number<span class="rf-phone"><span class="rf-cc"><i></i>+234</span><input id="f_phone" type="tel" inputmode="tel" placeholder="803 000 0000" value="${esc(D.phone)}" maxlength="20" autocomplete="tel-national"></span></label>${field("address", "Current address", "Where you live now", { opt: true, extra: 'maxlength="200" autocomplete="street-address"' })}
          <label class="rf-fl">Intended move-in date<span class="rf-date">${icon("cal", 18)}<input id="f_movein" type="date" min="${tomorrow}" value="${esc(D.movein)}"></span></label>${sel("occupants", "Number of occupants", "Select", ["1", "2", "3", "4", "5", "6+"])}</div>
          <label class="rf-fl"><span>Anything else? <span class="rf-optl">(optional)</span></span><textarea id="f_note" rows="3" maxlength="500" placeholder="Tell the agent anything that helps your application.">${esc(D.note)}</textarea></label><div class="rf-cnt"><span id="ncount">${D.note.length}</span>/500</div></div>`;
        else if (step === 2) body = `<div class="rf-card-h"><div><h2>Employment</h2><p>This helps the agent assess your application.</p></div></div><div class="rf-form"><div class="rf-grid2">${sel("status", "Employment status", "Select status", ["Employed", "Self-employed", "Student", "Retired", "Other"])}${field("employer", "Employer or school", "Name", { extra: 'maxlength="120"' })}${field("job", "Job title", "Your job title", { opt: true, extra: 'maxlength="120"' })}${sel("income", "Monthly income", "Select range", ["Below ₦200,000", "₦200,000 – ₦500,000", "₦500,000 – ₦1,000,000", "Above ₦1,000,000"])}</div></div>`;
        else if (step === 3) body = `<div class="rf-card-h"><div><h2>Documents</h2><p>Attach a photo of your ID and, if you can, proof of income. Only the agent and Faxton can see them.</p></div></div>
          ${[["id", "Valid ID (required)", "National ID, passport or driver’s licence"], ["income", "Proof of income (optional)", "Payslip, bank statement or offer letter"]].map(([k2, t, d]) => `<div class="rf-up ${files[k2] ? "has" : ""}"><span class="rf-up-ic">${xicon(blobs[k2] ? "checkc" : "doc", 20)}</span><div><b>${t}</b><small>${files[k2] ? esc(files[k2]) + (blobs[k2] ? "" : " (attach it again)") : d}</small></div><label class="btn sm">${files[k2] ? "Replace" : "Choose file"}<input type="file" data-file="${k2}" accept="image/*,application/pdf" hidden></label></div>`).join("")}<p class="rf-meta" style="margin-top:10px">Photos are shrunk to fit. PDFs must be under 280 KB.</p>`;
        else { read(); body = `<div class="rf-card-h"><div><h2>Review your application</h2><p>Make sure everything is right before you submit.</p></div></div><div class="rf-kv"><div><span>Full name</span><b>${esc(D.name)}</b></div><div><span>Email</span><b>${esc(D.email)}</b></div><div><span>Phone</span><b>+234 ${esc(D.phone)}</b></div><div><span>Current address</span><b>${esc(D.address || "Not provided")}</b></div><div><span>Move-in date</span><b>${esc(D.movein ? longDay(D.movein) : "—")}</b></div><div><span>Occupants</span><b>${esc(D.occupants)}</b></div>
          <div><span>Employment</span><b>${esc(D.status || "—")}${D.employer ? ", " + esc(D.employer) : ""}</b></div><div><span>Monthly income</span><b>${esc(D.income || "—")}</b></div><div><span>ID document</span><b>${esc(files.id || "—")}</b></div><div><span>Proof of income</span><b>${esc(files.income || "Not added")}</b></div></div><label class="rf-chk" style="margin-top:14px"><input type="checkbox" id="agree"> <span>I confirm the information above is accurate.</span></label>`; }
        ap.innerHTML = `${stepper(STEPS, step)}<section class="rf-card">${body}<p class="rf-err" id="aerr" role="alert"></p>
          <div class="rf-note" style="margin-top:14px">${icon("info", 20)}<div><b>No payment is taken at this stage.</b><p>You won’t be charged now. We’ll only ask for payment if your application is approved.</p></div></div>
          <div class="rf-actions apx"><button type="button" class="btn" id="sd">${icon("save", 18)} Save draft</button><span class="grow"></span>${step > 1 ? `<button type="button" class="btn" id="bk2">Back</button>` : ""}<button type="button" class="btn primary" id="ct">${step === 4 ? "Submit application" : "Continue"} ${icon("arrow", 18)}</button></div></section>`;
        const n = $("#f_note", ap); if (n) n.oninput = () => ($("#ncount").textContent = n.value.length);
        $$("[data-file]", ap).forEach((i) => (i.onchange = async () => {
          const f = i.files[0]; if (!f) return; const err = $("#aerr", ap); err.textContent = ""; read();
          try { const data = /^image\//.test(f.type) ? await shrinkImage(f, { max: 1400, bytes: 260000 }) : f.type === "application/pdf" && f.size <= 280000 ? await readPdf(f) : (() => { throw Object.assign(new Error("x"), { userMessage: f.type === "application/pdf" ? "That PDF is over 280 KB. Please choose a smaller one or take a photo of the page." : "Please choose a photo or a PDF." }); })();
            files[i.dataset.file] = f.name.slice(0, 120); blobs[i.dataset.file] = data; save(); draw(); } catch (x) { err.textContent = x.userMessage || fxErr(x); }
        }));
        $("#sd").onclick = () => { read(); save(true); };
        const b2 = $("#bk2"); if (b2) b2.onclick = () => { read(); step--; save(); draw(); scrollTo({ top: 0, behavior: "smooth" }); };
        $("#ct").onclick = async () => {
          read(); const err = $("#aerr");
          if (step === 1) { if (!D.name.trim()) return (err.textContent = "Enter your full name."); if (!/^[\d\s-]{7,}$/.test(D.phone.trim())) return (err.textContent = "Enter a valid phone number."); if (!D.movein) return (err.textContent = "Choose your intended move-in date."); if (!D.occupants) return (err.textContent = "Select the number of occupants."); }
          if (step === 2 && !D.status) return (err.textContent = "Select your employment status.");
          if (step === 3 && !files.id) return (err.textContent = "Add a valid ID to continue.");
          if (step === 3 && !blobs.id) return (err.textContent = "Attach your ID again so we can send it with your application.");
          if (step < 4) { step++; save(); draw(); return scrollTo({ top: 0, behavior: "smooth" }); }
          if (!$("#agree").checked) return (err.textContent = "Please confirm your information is accurate.");
          const b = $("#ct"); b.disabled = true;
          try { await st.addApplication(u, l, D.movein, { name: D.name, phone: "+234 " + D.phone, address: D.address, occupants: D.occupants, note: D.note, employment: D.status, employer: D.employer, job: D.job, income: D.income, idFile: files.id, incomeFile: files.income, ...(blobs.id ? { idDoc: blobs.id } : {}), ...(blobs.income ? { incomeDoc: blobs.income } : {}) }, offerId ? { rent, offerId } : {});
            try { localStorage.removeItem(DKEY(u, id)); } catch {} toast("Application sent. We’ll tell you what the agent decides."); ctx.go("#/applications"); } catch (e) { err.textContent = fxErr(e); b.disabled = false; }
        };
      };
      draw();
    } };
}

// ============================ My rentals: nav, documents ============================
export const rentalsNav = (active) => `<nav class="rf-tabs rn-tabs" aria-label="My rentals">${[["/rentals", "Overview"], ["/bookings", "Viewings"], ["/applications", "Applications"], ["/payments", "Payments"], ["/offers", "Offers"], ["/documents", "Documents"]].map(([h, l]) => `<a href="#${h}" class="${h === active ? "on" : ""}" ${h === active ? 'aria-current="page"' : ""}>${l}</a>`).join("")}</nav>`;
const fmtSize = (n) => (n > 1e6 ? (n / 1e6).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1e3)) + " KB");
const DOC_TYPES = ["Agreement", "Receipt", "ID", "Other"];
export async function documentsPage(ctx) {
  const [docs, apps, proofs, info] = await Promise.all([st.myDocs(ctx.S.user), st.myApplications(ctx.S.user), PAY.myProofs(ctx.S.user.uid), PAY.getPaymentInfo()]);
  const prop = apps.find((a) => !/withdr|reject/i.test(a.status)) || null;
  // Confirmed bank-transfer receipts show here too.
  const receipts = proofs.filter((p) => p.status === "Confirmed").map((p) => ({ id: "rc_" + p.id, name: `Receipt ${PAY.receiptNo(p)}.pdf`, type: "Receipt", date: fmtDay(p.reviewedAt || p.decidedAt || p.createdAt), status: "Confirmed", virtual: p }));
  let tab = "all", sel = (docs[0] || receipts[0])?.id || null;
  const all = () => [...docs, ...receipts], TYPES = [["Agreement", "Agreements"], ["Receipt", "Receipts"], ["ID", "ID"]];
  return { title: "My documents", html: `<div class="rf">${rentalsNav("/documents")}${pageHead("My rentals", "My documents", "Agreements, receipts and ID for your rentals, kept private to you.", `<button class="btn primary" id="upBtn">${icon("upload", 18)} Add a document</button><input type="file" id="up" accept=".pdf,image/*" hidden>`)}
    <div class="rf-bar-tabs"><div class="rf-seg" id="dt" role="tablist"></div>${prop ? `<span class="rf-meta rf-prop-chip"><img src="${esc(prop.image)}" alt=""> ${esc(prop.title)}</span>` : ""}</div>
    <div class="rf-grid wide-side"><section class="rf-card"><div class="rf-card-h"><div><h2>Private files</h2><p>Only you can see these.</p></div></div><div id="dl"></div></section><aside class="rf-card" id="dp"></aside></div></div>`,
    mount(root) {
      const cnt = (t) => all().filter((d) => t === "all" || d.type === t).length, list = () => all().filter((d) => tab === "all" || d.type === tab);
      const draw = () => {
        $("#dt", root).innerHTML = [["all", "All"], ...TYPES].map(([k, l]) => `<button type="button" role="tab" aria-selected="${tab === k}" class="${tab === k ? "on" : ""}" data-tab="${k}">${l} <b>${cnt(k)}</b></button>`).join("");
        const L = list(); if (sel && !L.some((d) => d.id === sel)) sel = L[0]?.id || null;
        $("#dl", root).innerHTML = L.length ? `<div class="rf-tbl-wrap fold"><table class="rf-tbl fold"><thead><tr><th>Name</th><th>Type</th><th>Added</th><th>Status</th><th></th></tr></thead><tbody>${L.map((d) => `<tr class="${d.id === sel ? "sel" : ""}" data-sel="${esc(d.id)}" tabindex="0"><td class="main"><span class="rf-fname"><span class="rf-up-ic sm">${xicon(d.mime?.startsWith("image/") ? "image" : d.virtual ? "receipt" : "pdf", 18)}</span><span><b>${esc(d.name)}</b></span></span></td><td data-l="Type">${esc(d.type)}</td><td data-l="Added">${esc(d.date || "")}</td><td class="end" data-l="Status">${statusPill(d.status)}</td><td class="rf-row-act"><div class="rf-act"><button type="button" class="rf-iconbtn" aria-label="Download ${esc(d.name)}" data-dl="${esc(d.id)}">${icon("download", 18)}</button>${d.virtual ? "" : `<button type="button" class="rf-iconbtn danger" aria-label="Delete ${esc(d.name)}" data-del="${esc(d.id)}">${icon("trash", 18)}</button>`}</div></td></tr>`).join("")}</tbody></table></div>`
          : empty({ ic: "folder", title: tab === "all" ? "No documents yet" : "Nothing in this folder", hint: "Add your agreement, receipts or ID. Photos are shrunk automatically; PDFs can be up to 700 KB.", action: `<button class="btn primary" data-upl>${icon("upload", 18)} Add a document</button>` });
        const d = all().find((x) => x.id === sel);
        $("#dp", root).innerHTML = d ? `<div class="rf-card-h"><h2>Preview</h2></div><div class="rf-prev">${d.virtual ? `<div class="rf-prev-doc">${xicon("receipt", 34, 1.4)}<b>${naira(d.virtual.amount)}</b><small>${esc(d.virtual.forLabel || "Payment")}</small></div>` : d.mime?.startsWith("image/") ? `<img src="${esc(d.data)}" alt="${esc(d.name)}">` : `<div class="rf-prev-doc">${xicon("pdf", 34, 1.4)}<b>${esc(d.name)}</b><small>${fmtSize(d.size || 0)}. Opens in a new tab.</small></div>`}</div>
          <div class="rf-prev-meta"><div><b>${esc(d.name)}</b><small>${esc(d.type)} · Added ${esc(d.date || "")}${d.size ? " · " + fmtSize(d.size) : ""}</small></div>${statusPill(d.status)}</div>
          <button class="btn primary block" data-view="${esc(d.id)}">${icon("eyeo", 18)} ${d.virtual ? "View receipt" : "Open"}</button>${d.virtual ? "" : `<button class="btn block" style="margin-top:8px" data-dl="${esc(d.id)}">${icon("download", 17)} Download</button>`}` : `<div class="rf-card-h"><h2>Preview</h2></div>${empty({ ic: "doc", title: "Pick a file", hint: "Select a document to preview it here." })}`;
        $$("[data-tab]", root).forEach((b) => (b.onclick = () => { tab = b.dataset.tab; draw(); }));
        $$("[data-sel]", root).forEach((r) => { const go = () => { sel = r.dataset.sel; draw(); }; r.onclick = go; r.onkeydown = (e) => { if (e.key === "Enter" && e.target === r) go(); }; });
        const open = (id, dl) => { const x = all().find((y) => y.id === id); if (!x) return; if (x.virtual) return PAY.openReceipt(x.virtual, info); if (!x.data || !openStored(x.data, x.name, dl)) toast("This file has no stored copy."); };
        $$("[data-dl]", root).forEach((b) => (b.onclick = (e) => { e.stopPropagation(); open(b.dataset.dl, true); })); $$("[data-view]", root).forEach((b) => (b.onclick = () => open(b.dataset.view)));
        $$("[data-del]", root).forEach((b) => (b.onclick = async (e) => { e.stopPropagation(); const id = b.dataset.del, x = docs.find((y) => y.id === id); if (!(await ask({ title: "Delete this document?", body: `“${esc(x?.name || "This file")}” will be removed from your account. This can’t be undone.`, ok: "Delete", tone: "danger" }))) return; try { await st.removeDocument(id); docs.splice(docs.findIndex((y) => y.id === id), 1); draw(); toast("Document deleted."); } catch (x2) { toast(fxErr(x2)); } }));
        $$("[data-upl]", root).forEach((b) => (b.onclick = () => $("#up", root).click()));
      };
      $("#upBtn", root).onclick = () => $("#up", root).click();
      $("#up", root).onchange = async (e) => {
        const f = e.target.files[0]; e.target.value = ""; if (!f) return;
        let data, mime = f.type, size = f.size;
        try {
          if (/^image\//.test(f.type)) { data = await shrinkImage(f, { max: 1600, bytes: 600000 }); mime = "image/jpeg"; size = Math.round(data.length * 0.74); }
          else if (f.type === "application/pdf") { if (f.size > 700000) return toast("That PDF is over 700 KB. Please choose a smaller one."); data = await readPdf(f); }
          else return toast("Please choose a PDF or a photo.");
        } catch (x) { return toast(x.userMessage || fxErr(x)); }
        const guess = /receipt/i.test(f.name) ? "Receipt" : /agreement|tenancy|lease/i.test(f.name) ? "Agreement" : /\bid\b|passport|licen[cs]e|nin/i.test(f.name) ? "ID" : "Other";
        const m = modal(`<div class="rf-dlg"><h2>Add this document</h2><form class="rf-form" id="dnF"><label class="rf-fl">Name<input id="dnN" maxlength="150" value="${esc(f.name)}"></label><label class="rf-fl">What is it?<select id="dnT">${DOC_TYPES.map((t) => `<option ${t === guess ? "selected" : ""}>${t}</option>`).join("")}</select></label><p class="rf-err" id="dnE" role="alert"></p><div class="rf-dlg-act"><button type="button" class="btn" data-x>Cancel</button><button class="btn primary" type="submit">Save</button></div></form></div>`);
        $("[data-x]", m.el).onclick = m.close;
        $("#dnF", m.el).onsubmit = async (ev) => { ev.preventDefault(); const name = $("#dnN", m.el).value.trim(); if (!name) return ($("#dnE", m.el).textContent = "Give it a name."); const b = ev.target.querySelector("button[type=submit]"); b.disabled = true;
          const rec = { name: name.slice(0, 150), type: $("#dnT", m.el).value, size, mime, data, date: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }), propertyId: prop?.listingId || "" };
          try { const ref = await st.addDocument(ctx.S.user, rec); docs.unshift({ ...rec, id: ref.id, status: "Uploaded" }); sel = ref.id; m.close(); draw(); toast("Document saved."); } catch (x) { $("#dnE", m.el).textContent = fxErr(x); b.disabled = false; } };
      };
      draw();
    } };
}

// ============================ shared bits ============================
const loadDrafts = (u) => { const out = []; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith(`draft_${u.uid}_`)) { const o = JSON.parse(localStorage.getItem(k)); delete o.idDoc; delete o.incomeDoc; out.push({ listingId: k.slice(`draft_${u.uid}_`.length), draft: true, ...o, status: "Draft" }); } } } catch {} return out; };
const ACTIVE = (s) => /approved|active/i.test(s);
const addYear = (isoStr) => { const d = new Date(isoStr + "T00:00:00"); if (isNaN(d)) return null; const e = new Date(d); e.setFullYear(e.getFullYear() + 1); e.setDate(e.getDate() - 1); return [d, e]; };
const dlong = (d) => d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
const dshort = (d) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
async function tenancy(ctx) {
  const [apps, listings] = await Promise.all([st.myApplications(ctx.S.user), st.getListings()]);
  const act = apps.find((a) => ACTIVE(a.status)) || null, l = (act && listings.find((x) => x.id === act.listingId)) || null;
  return { apps, listings, act, l };
}

// ============================ payments ============================
// Bank-transfer payments live in paymentspage.js (loaded on demand).
export const paymentsPage = (ctx) => import("./paymentspage.js").then((m) => m.paymentsPage(ctx, rentalsNav));

// ============================ applications ============================
export async function applicationsPage(ctx) {
  const [apps, listings] = await Promise.all([st.myApplications(ctx.S.user), st.getListings()]);
  const items = [...loadDrafts(ctx.S.user).filter((d) => !apps.some((a) => a.listingId === d.listingId && !/withdr/i.test(a.status))), ...apps].map((a) => ({ ...a, l: listings.find((x) => x.id === a.listingId) })).filter((a) => a.l);
  const key = (a) => (a.draft ? a.listingId + "_d" : a.id), inProg = (s) => /review|draft|awaiting/i.test(s), closedS = (s) => /withdr|reject|declin/i.test(s);
  let tab = "all", sel = items[0] ? key(items[0]) : null;
  const match = (a, t) => t === "all" || (t === "prog" && inProg(a.status)) || (t === "ok" && ACTIVE(a.status)) || (t === "closed" && closedS(a.status));
  const list = () => items.filter((a) => match(a, tab)), cnt = (t) => items.filter((a) => match(a, t)).length;
  const mobile = () => matchMedia("(max-width:900px)").matches;
  return { title: "My applications", html: `<div class="rf">${rentalsNav("/applications")}${pageHead("My rentals", "My applications", "Follow each application from sent to decided.", `<a class="btn primary" href="#/search">${icon("search", 18)} Find a home</a>`)}<div class="rf-grid wide-side"><div><div class="rf-seg" id="at" role="tablist" style="margin-bottom:12px"></div><div id="al" class="rf-col"></div></div><aside class="rf-card rf-app-side" id="as"></aside></div></div>`,
    mount(root) {
      const detail = (a) => {
        const st1 = a.status, bad = closedS(st1), steps = [["Sent", "Your application reached the agent."], ["Details checked", "The agent looks at your ID and details."], ["Agent review", "The agent is considering your application."], ["Decision", "You’ll be told as soon as there’s a decision."]];
        const done = a.draft ? 0 : bad ? 3 : ACTIVE(st1) ? 4 : 2;
        return `<div class="rf-card-h"><div><h2>${esc(a.l.title)}</h2><p class="rf-loc">${icon("pin", 15)} ${esc(locOf(a.l))}</p></div>${statusPill(st1)}</div><img class="rf-app-img" src="${esc(a.l.images?.[0] || a.l.thumb || "")}" alt="">
          <p class="rf-facts"><span>${icon("bed", 17)}${bedsLabel(a.l.beds)}</span><span>${icon("bath", 17)}${a.l.baths} baths</span>${a.l.sqm ? `<span>${icon("area", 17)}${a.l.sqm} m²</span>` : ""}</p>
          ${a.draft ? `<div class="rf-note">${icon("info", 20)}<div><b>This is a draft</b><p>It’s saved on this device and hasn’t been sent. Pick up where you left off.</p></div></div>` : `<h3 class="rf-h3">Progress</h3><ol class="rf-tl">${steps.map(([t, d], i) => `<li class="${bad && i === 3 ? "bad" : i < done ? "ok" : i === done ? "cur" : ""}"><i>${bad && i === 3 ? icon("x", 12, 3.2) : i < done ? icon("check", 12, 3.2) : ""}</i><div><b>${bad && i === 3 ? (/withdr/i.test(st1) ? "Withdrawn" : "Not successful") : t}</b><p>${bad && i === 3 ? (/withdr/i.test(st1) ? "You withdrew this application." : "The agent chose another applicant. Don’t be discouraged, there are more homes.") : d}</p></div><span>${i === 0 ? esc(fmtDay(a.createdAt)) : ""}</span></li>`).join("")}</ol>`}
          <h3 class="rf-h3">Cost to move in</h3>${costRows(a.l, a.rent || a.l.price, ACTIVE(st1) ? "Total due on signing" : "Total if approved")}
          <div class="rf-btns" style="margin-top:14px"><button class="btn" data-ma>${icon("msg", 18)} Message agent</button>${a.draft ? `<a class="btn primary" href="#/apply/${esc(a.listingId)}">${icon("edit", 18)} Continue</a>` : `<button class="btn primary" data-va>${icon("doc", 18)} View application</button>`}</div>
          ${a.draft ? `<button class="btn red-o block" style="margin-top:8px" data-dd>${icon("trash", 17)} Delete draft</button>` : /review|awaiting/i.test(st1) ? `<button class="btn red-o block" style="margin-top:8px" data-wd>${xicon("undo", 17)} Withdraw application</button>` : ACTIVE(st1) ? `<a class="btn primary block" style="margin-top:8px" href="#/payments">${icon("wallet", 18)} Go to payments</a>` : ""}`;
      };
      const wireDetail = (c, a, close) => {
        const ma = $("[data-ma]", c); if (ma) ma.onclick = async () => { try { const cid = await st.ensureConversation(ctx.S.user, a.l); close?.(); ctx.go("#/messages/" + cid); } catch (e) { toast(fxErr(e)); } };
        const va = $("[data-va]", c); if (va) va.onclick = () => { const d = a.details || {}; close?.(); modal(`<div class="rf-dlg"><h2>Your application</h2><p class="rf-dlg-p">${esc(a.l.title)}</p><div class="rf-kv">${[["Name", d.name], ["Phone", d.phone], ["Move-in date", a.moveIn ? longDay(a.moveIn) : ""], ["Occupants", d.occupants], ["Employment", d.employment], ["Employer", d.employer], ["Monthly income", d.income], ["Current address", d.address || "Not provided"], ["ID document", d.idFile], ["Proof of income", d.incomeFile]].filter((r) => r[1]).map(([k, v2]) => `<div><span>${k}</span><b>${esc(v2)}</b></div>`).join("")}</div>${d.note ? `<p class="rf-dlg-p">“${esc(d.note)}”</p>` : ""}</div>`); };
        const wd = $("[data-wd]", c); if (wd) wd.onclick = async () => { close?.(); if (!(await ask({ title: "Withdraw this application?", body: "The agent will see that you’ve withdrawn. You can apply again later.", ok: "Withdraw", tone: "danger" }))) return; try { await updateDoc(doc(db, "applications", a.id), { status: "Withdrawn", withdrawnAt: Date.now() }); a.status = "Withdrawn"; toast("Application withdrawn."); draw(); } catch (e) { toast(fxErr(e)); } };
        const dd = $("[data-dd]", c); if (dd) dd.onclick = async () => { close?.(); if (!(await ask({ title: "Delete this draft?", body: "It’s only saved on this device.", ok: "Delete", tone: "danger" }))) return; try { localStorage.removeItem(DKEY(ctx.S.user, a.listingId)); } catch {} items.splice(items.indexOf(a), 1); sel = items[0] ? key(items[0]) : null; draw(); toast("Draft deleted."); };
      };
      const draw = () => {
        $("#at", root).innerHTML = [["all", "All"], ["prog", "In progress"], ["ok", "Approved"], ["closed", "Closed"]].map(([k, t]) => `<button type="button" role="tab" aria-selected="${tab === k}" class="${tab === k ? "on" : ""}" data-tab="${k}">${t} <b>${cnt(k)}</b></button>`).join("");
        const L = list(); if (!L.some((a) => key(a) === sel)) sel = L[0] ? key(L[0]) : null;
        $("#al", root).innerHTML = L.length ? L.map((a) => `<article class="rf-app ${key(a) === sel ? "on" : ""}" data-sel="${esc(key(a))}" tabindex="0" role="button" aria-label="${esc(a.l.title)}, ${esc(a.status)}"><img src="${esc(a.l.thumb || a.l.images?.[0] || "")}" alt=""><div class="rf-app-main"><h3>${esc(a.l.title)}</h3><p class="rf-loc">${icon("pin", 14)} ${esc(locOf(a.l))}</p><b class="num">${naira(a.l.price)}<small> / year</small></b></div><div class="rf-app-st">${statusPill(a.status)}<small>${a.draft ? "Saved draft" : "Applied " + esc(fmtDay(a.createdAt))}</small></div></article>`).join("")
          : `<div class="rf-card">${empty({ ic: "doc", title: items.length ? "Nothing in this view" : "No applications yet", hint: items.length ? "Try another tab." : "When you apply for a home, you can follow it here.", action: items.length ? "" : `<a class="btn primary" href="#/search">Find a home</a>` })}</div>`;
        const a = items.find((x) => key(x) === sel), s = $("#as", root);
        s.hidden = mobile() || !a; if (a && !mobile()) { s.innerHTML = detail(a); wireDetail(s, a); }
        $$("[data-tab]", root).forEach((b) => (b.onclick = () => { tab = b.dataset.tab; draw(); }));
        $$("[data-sel]", root).forEach((c) => { const go = () => { sel = c.dataset.sel; if (mobile()) { const a2 = items.find((x) => key(x) === sel), m = modal(`<div class="rf-dlg big">${detail(a2)}</div>`); wireDetail(m.el, a2, m.close); } else draw(); }; c.onclick = go; c.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } }; });
      };
      draw();
    } };
}

// ============================ my rental (overview) ============================
export async function rentalPage(ctx) {
  const { apps, act, l } = await tenancy(ctx), [ds, de] = (act && addYear(act.moveIn)) || [], [docs, proofs] = await Promise.all([st.myDocs(ctx.S.user), PAY.myProofs(ctx.S.user.uid)]);
  const first = (ctx.S.user.displayName || "").split(" ")[0], paid = proofs.filter((p) => p.status === "Confirmed").reduce((s, p) => s + (+p.amount || 0), 0), lastPaid = proofs.find((p) => p.status === "Confirmed");
  const quick = [["#/documents", "pdf", "Documents", "Agreements, receipts and ID"], ["#/payments", "wallet", "Payments", "Pay by bank transfer, get receipts"], ["#/bookings", "cal", "Viewings", "Upcoming and past viewings"], ["#/messages", "msg", l ? "Message agent" : "Messages", l ? "Chat with your agent" : "Chat with agents"]];
  const recent = [...apps.map((a) => ({ t: a.createdAt, i: "doc", h: "Application " + (/review/i.test(a.status) ? "sent" : a.status.toLowerCase()), p: a.title })), ...docs.map((d) => ({ t: d.createdAt, i: "pdf", h: "Document added", p: d.name })), ...proofs.map((p) => ({ t: p.reviewedAt || p.decidedAt || p.createdAt, i: "wallet", h: p.status === "Confirmed" ? "Payment confirmed" : p.status === "Rejected" ? "Payment not matched" : "Payment sent", p: `${naira(p.amount)} · ${p.forLabel || p.title}` }))].sort((x, y) => tsMs(y.t) - tsMs(x.t)).slice(0, 5);
  const hero = act && l ? `<section class="rf-card rf-hero"><img src="${esc(l.images?.[0] || l.thumb || "")}" alt=""><div class="rf-hero-in"><span class="rf-pill ok"><i></i>Active tenancy</span><h2>${esc(l.title)}</h2><p class="rf-loc">${icon("pin", 16)} ${esc(locOf(l))}</p>
      <div class="rf-hero-kv"><div><small>Tenancy term</small><b>${ds ? dshort(ds) + " to " + dshort(de) : "—"}</b></div><div><small>Annual rent</small><b>${naira(act.rent || l.price)}</b></div><div><small>Service charge</small><b>${naira(l.service)} / year</b></div><div><small>Refundable deposit</small><b>${naira(l.deposit)}</b></div></div><a class="rf-card-link" href="#/myhome" style="margin-top:12px">Open My Home ${chevRight(14)}</a></div></section>`
    : `<section class="rf-card">${empty({ ic: "home", title: `${first ? esc(first) + ", you" : "You"} don’t have an active rental yet`, hint: "Once an application is approved, your tenancy, payments and documents appear here.", action: `<div class="rf-btns"><a class="btn primary" href="#/search">Find a home</a><a class="btn" href="#/applications">My applications</a></div>` })}</section>`;
  const a0 = l?.agent || null;
  const checklist = act ? [["Application approved", true], ["Tenancy agreement added", docs.some((d) => d.type === "Agreement")], ["First payment confirmed", paid > 0], ["Moved in", false], ["Renewal reminder set", false]] : [["Find a home", true], ["Apply for a home", apps.length > 0], ["Application approved", false], ["Sign the tenancy agreement", false], ["Move in", false]];
  const open = apps.filter((a) => /review|awaiting/i.test(a.status)).length, renew = de ? new Date(de.getTime() + 864e5) : null;
  return { title: "My rental", html: `<div class="rf">${rentalsNav("/rentals")}${pageHead("My rentals", "Overview", "Your tenancy, payments and requests in one place.")}
    <div class="rf-stats"><div class="rf-stat"><span>${icon("wallet", 20)}</span><div><small>Rent and fees paid</small><b>${naira(paid)}</b><p>${lastPaid ? "Latest: " + esc(fmtDay(lastPaid.reviewedAt || lastPaid.createdAt)) : "No confirmed payments yet"}</p></div></div>
      <div class="rf-stat"><span>${icon("cal", 20)}</span><div><small>Renewal date</small><b>${renew ? dshort(renew) : "—"}</b><p>${de ? Math.max(0, Math.round((de - new Date()) / 2.63e9)) + " months remaining" : "Starts once a rental is active"}</p></div></div>
      <div class="rf-stat"><span>${icon("doc", 20)}</span><div><small>Applications in review</small><b>${open}</b><p>${open ? "Waiting for the agent" : "None right now"}</p></div></div></div>
    <div class="rf-grid">${hero}<section class="rf-card"><div class="rf-card-h"><h2>Quick actions</h2></div><div class="rf-qa">${quick.map(([h, ic, t, d]) => `<a href="${h}"><span>${icon(ic, 20)}</span><div><b>${t}</b><small>${d}</small></div>${chevRight(16)}</a>`).join("")}</div></section></div>
    <div class="rf-grid3 rf-trio" style="margin-top:16px"><section class="rf-card"><div class="rf-card-h"><h2>Checklist</h2><span class="rf-meta">${checklist.filter((c) => c[1]).length} of ${checklist.length}</span></div><ol class="rf-tl">${checklist.map(([t, ok]) => `<li class="${ok ? "ok" : ""}"><i>${ok ? icon("check", 12, 3.2) : ""}</i><div><b>${t}</b></div><span></span></li>`).join("")}</ol></section>
      <section class="rf-card"><div class="rf-card-h"><h2>Recent activity</h2><a class="rf-card-link" href="#/applications">View all</a></div>${recent.length ? recent.map((r) => `<div class="rf-act-row"><span>${icon(r.i, 18)}</span><div><b>${esc(r.h)}</b><small>${esc(r.p)}</small></div><em>${esc(fmtDay(r.t))}</em></div>`).join("") : `<p class="rf-muted">Nothing yet. Your activity shows up here.</p>`}</section>
      <section class="rf-card"><div class="rf-card-h"><h2>Your agent</h2></div>${a0 ? `<div class="rf-person" style="margin-top:0"><img src="${esc(a0.photo || a0.avatar)}" alt=""><div><b>${esc(a0.name)}</b><small>Property agent</small></div></div><a class="btn block" style="margin-top:12px" href="#/agent/${esc(a0.id)}">View profile</a>` : `<p class="rf-muted">Your agent appears here once you apply.</p>`}</section></div></div>` };
}

// ============================ saved homes ============================
// The page itself lives in home.js (it shares the listing card with the home and search pages).
export const savedPage = (ctx) => import("./home.js").then((m) => m.savedPage(ctx));

// ============================ help centre ============================
const FAQ = [
  ["How do I book a viewing?", "Open a home and choose “Book a viewing”. Pick a date and time, add your phone number, and send it. The agent confirms in Messages and you’ll see the status on your Viewings page.", "rent"],
  ["Can I cancel or move a viewing?", "Yes. On your Viewings page, a viewing that’s still “Requested” can be cancelled. For a confirmed one, choose “Ask to move it” and the agent will agree a new time with you in Messages.", "rent"],
  ["How do I apply, and can I take it back?", "Choose “Apply to rent” on a home and complete the four steps. No payment is taken. While it’s under review you can withdraw it from My rentals, then Applications.", "rent"],
  ["How do I pay my rent?", "By bank transfer. Open Payments to see the account to pay into, send the money from your bank app, then tap “I’ve paid” with your bank reference. We confirm it and you get a receipt. Card payments are coming later.", "pay"],
  ["Where is my receipt?", "Once a payment is confirmed it shows a Receipt button on the Payments page and in Documents. You can print it or save it as a PDF.", "pay"],
  ["What is the service charge?", "It covers the upkeep of shared areas such as security, water supply and estate maintenance. It’s listed on every home.", "pay"],
  ["Can I get my deposit back?", "The caution deposit is refundable at the end of your tenancy once the home has been checked and any outstanding charges are settled. Ask for it from My Home, then Move out.", "pay"],
  ["Who sees my documents?", "Files you add under Documents are private to your account. An ID you attach to an application is seen only by that home’s agent or owner and the Faxton team.", "acct"],
  ["How do I change my password?", "Go to Settings, then Account and security, and choose “Send password reset email”. The email has a secure link to pick a new one.", "acct"],
  ["How do I delete my account?", "Go to Settings, then Account and security, then Delete my account. Our team reviews every request, and you can cancel before it’s approved.", "acct"],
];
export async function helpPage(ctx) {
  const tickets = await st.myTickets(ctx.S.user); let open = -1, q = "", cat = "";
  const cats = [["rent", "home", "Renting a home", "Viewings, applications and moving in."], ["pay", "wallet", "Payments and receipts", "Bank transfers, receipts and deposits."], ["acct", "user", "Your account", "Sign-in, security and your details."]];
  const t0 = tickets[0];
  return { title: "Help centre", html: `<div class="rf">${pageHead("Help centre", "How can we help?", "Find a quick answer, or message our team.")}
    <label class="rf-search">${icon("search", 20)}<input id="hq" type="search" placeholder="Search for help, like “receipt” or “viewing”" aria-label="Search for help"></label>
    <div class="rf-seg" role="tablist" id="hpTabs" style="margin:14px 0 16px"><button type="button" role="tab" class="on" aria-selected="true" data-hp="help">Help and FAQ</button><button type="button" role="tab" aria-selected="false" data-hp="sug">${icon("chatlines", 16)} Send a suggestion</button></div>
    <section class="rf-card" id="hpSug" hidden><div class="rf-card-h"><div><h2>Send us a suggestion</h2><p>Got an idea that would make Faxton Rentals better? Every suggestion is read by the team.</p></div></div>
      <form class="rf-form" id="sf" novalidate><label class="rf-fl">Topic<select id="sgt"><option>New feature</option><option>Design and layout</option><option>Listings and search</option><option>Payments</option><option>Something else</option></select></label>
      <label class="rf-fl">Your suggestion<textarea id="sgx" rows="5" maxlength="2000" placeholder="Describe your idea…"></textarea></label><p class="rf-err" id="sge" role="alert"></p><div class="rf-actions" style="margin:0"><button class="btn primary" type="submit">${icon("send", 18)} Send suggestion</button></div></form></section>
    <div id="hpMain"><div class="rf-cats">${cats.map(([k, ic, t, d]) => `<button type="button" class="rf-cat" data-cat="${k}"><span>${icon(ic, 22)}</span><div><b>${t}</b><small>${d}</small></div></button>`).join("")}</div>
    <div class="rf-grid"><section class="rf-card"><div class="rf-card-h"><div><h2>Frequently asked questions</h2><p>Quick answers for renters.</p></div></div><div id="faq"></div></section>
      <aside class="rf-card"><div class="rf-card-h"><div><h2>Talk to us</h2><p>Still stuck? Our team replies by email.</p></div></div><button class="btn primary block" id="nt">${icon("mail", 18)} New support request</button><button class="btn block" id="vt" style="margin-top:8px">My tickets (${tickets.length})</button><hr><h3 class="rf-h3" style="margin-top:0">Latest ticket</h3>
      ${t0 ? `<div class="rf-ticket"><div><small class="num">#${esc(t0.ref)}</small>${statusPill(t0.status)}</div><b>${esc(t0.subject)}</b><p>${esc(t0.message.slice(0, 120))}</p><small class="rf-muted">Opened ${esc(fmtDay(t0.createdAt))}</small></div>` : `<p class="rf-muted">You haven’t opened a ticket yet.</p>`}<p class="rf-meta" style="margin-top:12px">${esc(supportLine())}</p></aside></div></div></div>`,
    mount(root) {
      const draw = () => {
        const L = FAQ.filter((f) => (!cat || f[2] === cat) && (!q || (f[0] + f[1]).toLowerCase().includes(q)));
        $("#faq", root).innerHTML = L.length ? L.map((f, i) => `<div class="rf-fq ${open === i ? "on" : ""}"><button type="button" data-i="${i}" aria-expanded="${open === i}"><span>${esc(f[0])}</span>${icon("chev", 18)}</button><div class="rf-fa"><div><p>${esc(f[1])}</p></div></div></div>`).join("") : `<p class="rf-muted" style="padding:14px 0">No answers match. Try a support request.</p>`;
        $$("[data-i]", root).forEach((b) => (b.onclick = () => { const i = +b.dataset.i; open = open === i ? -1 : i; $$(".rf-fq", root).forEach((el, k) => { el.classList.toggle("on", k === open); el.querySelector("button").setAttribute("aria-expanded", String(k === open)); }); }));
        $$("[data-cat]", root).forEach((b) => b.classList.toggle("on", b.dataset.cat === cat));
      };
      $("#hq", root).oninput = (e) => { q = e.target.value.trim().toLowerCase(); open = q ? 0 : -1; draw(); };
      $$("[data-cat]", root).forEach((b) => (b.onclick = () => { cat = cat === b.dataset.cat ? "" : b.dataset.cat; open = -1; draw(); $("#faq", root).scrollIntoView({ behavior: "smooth", block: "center" }); }));
      const form = () => { const m = modal(`<div class="rf-dlg"><h2>New support request</h2><p class="rf-dlg-p">Tell us what you need help with.</p><form class="rf-form" id="tf2"><label class="rf-fl">Topic<select id="ts"><option>Viewing or booking</option><option>Application</option><option>Payments</option><option>Account</option><option>Something else</option></select></label><label class="rf-fl">Message<textarea id="tm" rows="5" maxlength="2000" placeholder="Describe your issue…"></textarea></label><p class="rf-err" id="te2" role="alert"></p><div class="rf-dlg-act"><button type="button" class="btn" data-x>Cancel</button><button class="btn primary">Send request</button></div></form></div>`);
        $("[data-x]", m.el).onclick = m.close;
        $("#tf2", m.el).onsubmit = async (e) => { e.preventDefault(); const msg = $("#tm", m.el).value.trim(); if (msg.length < 10) return ($("#te2", m.el).textContent = "Please add a little more detail."); const b = e.target.querySelector("button.primary"); b.disabled = true;
          try { await st.addTicket(ctx.S.user, { subject: $("#ts", m.el).value, message: msg }); m.close(); toast("Request sent. We’ll reply by email."); ctx.render(); } catch (x) { $("#te2", m.el).textContent = fxErr(x); b.disabled = false; } }; };
      $("#nt", root).onclick = form;
      $("#vt", root).onclick = () => { if (!tickets.length) return toast("You haven’t opened a ticket yet."); modal(`<div class="rf-dlg"><h2>My tickets</h2>${tickets.map((t) => `<div class="rf-ticket"><div><small class="num">#${esc(t.ref)}</small>${statusPill(t.status)}</div><b>${esc(t.subject)}</b><p>${esc(t.message)}</p><small class="rf-muted">Opened ${esc(fmtDay(t.createdAt))}</small></div>`).join("")}</div>`); };
      $$("[data-hp]", root).forEach((b) => (b.onclick = () => { const sug = b.dataset.hp === "sug"; $$("[data-hp]", root).forEach((x) => { x.classList.toggle("on", x === b); x.setAttribute("aria-selected", x === b); }); $("#hpSug", root).hidden = !sug; $("#hpMain", root).hidden = sug; }));
      $("#sf", root).onsubmit = async (e) => { e.preventDefault(); const text = $("#sgx", root).value.trim(), err = $("#sge", root); err.textContent = ""; if (text.length < 5) return (err.textContent = "Please write a little more."); const btn = e.target.querySelector("button"); btn.disabled = true;
        try { await st.addSuggestion(ctx.S.user, { topic: $("#sgt", root).value, text }); $("#sgx", root).value = ""; toast("Thank you! Your suggestion has been sent."); } catch (x) { err.textContent = fxErr(x); } finally { btn.disabled = false; } };
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
    const err = $("#fg-err", root), send = async (em, btn) => { err.textContent = ""; btn.disabled = true; try { await ctx.resetPassword(em); return true; } catch (e) { err.textContent = fxErr(e); return false; } finally { btn.disabled = false; } };
    const f = $("#fg", root);
    if (f) f.onsubmit = async (e) => { e.preventDefault(); const em = $("#fge", root).value.trim(); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) return (err.textContent = "Enter a valid email address."); if (await send(em, f.querySelector("button"))) ctx.go("#/forgot?sent=1&email=" + encodeURIComponent(em)); };
    const r = $("#fg-resend", root); if (r) r.onclick = async () => { if (await send(pre, r)) toast("Reset email sent again."); };
  } };
}
