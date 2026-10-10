// Viewing safety: verified agent identity, share details with a trusted contact, check in and out, and an emergency button.
import { db } from "./firebase.js";
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { $, $$, esc, icon, toast, modal, friendlyErr, verifiedBadge } from "./ui.js";
import { fxErr, xicon, statusPill, ask } from "./fx.js";
import * as st from "./store.js";
import { reportDialog } from "./safety.js";

export const EMERGENCY_NUMBER = "112";
const OVERDUE_MIN = 90;
const fmtDate = (s) => { const d = new Date(s + "T00:00:00"); return isNaN(d) ? s : d.toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long" }); };
const clock = (ms) => new Date(ms).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
export const startOf = (v) => {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i.exec(String(v.slot || "10:00 AM").trim()); let h = m ? +m[1] : 10; const mi = m ? +m[2] : 0;
  if (m && /PM/i.test(m[3] || "") && h < 12) h += 12; if (m && /AM/i.test(m[3] || "") && h === 12) h = 0;
  const d = new Date(String(v.when).slice(0, 10) + "T00:00:00"); d.setHours(h, mi, 0, 0); return d;
};
const isPhysical = (v) => !/virtual/i.test(v.tour || "");
const phoneDigits = (p) => { let d = String(p || "").replace(/\D/g, ""); if (d.startsWith("00")) d = d.slice(2); if (d.startsWith("0")) d = "234" + d.slice(1); return d; };

// ---- trusted contact (kept on this device) ----
const TK = (uid) => "trusted_" + uid;
export const getTrusted = (uid) => { try { const t = JSON.parse(localStorage.getItem(TK(uid)) || "null"); return t && t.name && t.phone ? t : null; } catch { return null; } };
export const saveTrusted = (uid, t) => { try { localStorage.setItem(TK(uid), JSON.stringify(t)); } catch {} };
export const trustedFields = (t = {}) => `<div class="vs-trust"><h3>${icon("shield", 20)} Share this viewing with someone you trust</h3><p class="muted">Optional, but recommended. We’ll prepare a message with the property, time and agent for them, and you can check in and out so they know you’re safe.</p>
  <div class="f2"><label class="fl">Their name<input id="tcName" value="${esc(t.name || "")}" maxlength="60" placeholder="e.g. Ada (sister)" autocomplete="off"></label><label class="fl">Their phone number<input id="tcPhone" type="tel" value="${esc(t.phone || "")}" maxlength="30" placeholder="0803 000 0000" autocomplete="off"></label></div></div>`;
export const readTrusted = (root) => { const name = $("#tcName", root)?.value.trim() || "", phone = $("#tcPhone", root)?.value.trim() || ""; return name && phone ? { name, phone } : null; };
export const validTrusted = (root) => { const name = $("#tcName", root)?.value.trim() || "", phone = $("#tcPhone", root)?.value.trim() || ""; if (!name && !phone) return true; return !!name && /^[+\d][\d\s-]{6,}$/.test(phone); };

// ---- verified agent identity ----
export const identityHtml = (a, verified, compact = false) => `<div class="vs-id ${verified ? "ok" : "no"} ${compact ? "sm" : ""}"><img class="avatar" src="${esc(a.avatar || a.photo || "img/av-daniel.webp")}" alt=""><div><b>${esc(a.name)} ${verified ? verifiedBadge(16) : ""}</b><small>${verified ? "Verified by Faxton. Their identity and business were checked." : "Not verified yet. Take extra care: view in daytime and bring someone with you."}</small></div>${verified ? `<span class="vs-chip">${icon("shield", 14)} Verified agent</span>` : `<span class="vs-chip warn">Unverified</span>`}</div>`;

// ---- the message a trusted contact receives ----
const detailsText = (v, user, extra = "") => `Hi ${v.trusted?.name ? v.trusted.name.split(" ")[0] : "there"}, I'm viewing a property and wanted you to know where I'll be.\n\n🏠 ${v.title}\n📍 ${v.area}\n🗓 ${fmtDate(String(v.when).slice(0, 10))}, ${v.slot}\n👤 Agent: ${v.agentName || "Faxton agent"}${v.agentVerified ? " (verified on Faxton)" : " (not verified)"}${v.phone ? "" : ""}\n\nI'll message you when I'm done.${extra}\n— ${user.displayName || "Me"}, via Faxton Rentals`;
function sendTo(v, text) {
  const to = phoneDigits(v.trusted?.phone);
  if (to) { window.open(`https://wa.me/${to}?text=${encodeURIComponent(text)}`, "_blank", "noopener"); return true; }
  if (navigator.share) { navigator.share({ text }).catch(() => {}); return true; }
  navigator.clipboard?.writeText(text).then(() => toast("Message copied. Paste it to someone you trust.")).catch(() => {}); return false;
}
// The browser may wait forever on its permission prompt, so location is only ever waited for a few seconds.
const where = () => new Promise((res) => { if (!navigator.geolocation) return res(null); const t = setTimeout(() => res(null), 4000); navigator.geolocation.getCurrentPosition((p) => { clearTimeout(t); res({ lat: +p.coords.latitude.toFixed(5), lng: +p.coords.longitude.toFixed(5) }); }, () => { clearTimeout(t); res(null); }, { timeout: 4000, maximumAge: 60000 }); });
const mapLink = (loc) => (loc ? `\n📌 My location: https://www.google.com/maps?q=${loc.lat},${loc.lng}` : "");

const save = async (v, patch) => { await updateDoc(doc(db, "viewings", v.id), patch); Object.assign(v, patch); };

export const resolveSos = (v) => save(v, { sos: { ...v.sos, resolved: true } });

// ---- badge shown to agents, owners and admins ----
export const safeBadge = (v) => {
  if (v.sos && !v.sos.resolved) return `<span class="pill bad" title="The renter raised an emergency">SOS</span>`;
  if (v.checkIn && !v.checkOut) return `<span class="pill">In viewing</span>`;
  if (v.checkOut) return `<span class="pill">Completed</span>`;
  return "";
};

// ---- emergency sheet ----
export function emergency(ctx, v, redraw) {
  const t = v.trusted; let loc0 = null; where().then((l) => { loc0 = l; });
  const m = modal(`<div class="vs-sos"><span class="vs-sosi">${icon("sos", 30)}</span><h2>Do you need help?</h2><p class="muted">Choose what you need. Faxton is told about this viewing either way.</p>
    <a class="vs-act red" id="sosCall" href="tel:${EMERGENCY_NUMBER}"><span>${icon("phone", 22)}</span><div><b>Call ${EMERGENCY_NUMBER}</b><small>Nigeria’s national emergency number</small></div></a>
    <button class="vs-act" id="sosTrust"><span>${icon("users", 22)}</span><div><b>Alert ${t ? esc(t.name) : "someone I trust"}</b><small>Sends your viewing details and location</small></div></button>
    <button class="vs-act" id="sosFx"><span>${icon("shield", 22)}</span><div><b>Tell the Faxton team</b><small>We’ll see this at once and follow up</small></div></button>
    <button class="vs-act" id="sosRep"><span>${icon("flag", 22)}</span><div><b>Report ${esc(v.agentName || "the agent")}</b><small>Something felt wrong or unsafe</small></div></button>
    ${v.sos && !v.sos.resolved ? `<p class="vs-sent">${icon("checkc", 16)} Faxton was told at ${clock(v.sos.at)}.</p>` : ""}<div class="a2-act"><button class="btn" id="sosClose">Close</button></div></div>`);
  $("#sosClose", m.el).onclick = m.close;
  const raise = async (kind) => {
    const loc = loc0 || (await where());
    try {
      await save(v, { sos: { at: Date.now(), kind, ...(loc || {}) } });
      await st.reportUser(ctx.S.user, { targetUid: v.agentUid || "", targetName: v.agentName || "Agent", convId: "", reason: "Emergency during a viewing", details: `Viewing ${v.id} at ${v.title}, ${v.area} (${v.when} ${v.slot}). Raised: ${kind}.${loc ? ` Location: https://www.google.com/maps?q=${loc.lat},${loc.lng}` : ""}` }).catch(() => {});
    } catch (e) { toast(friendlyErr(e)); }
    return loc;
  };
  $("#sosCall", m.el).addEventListener("click", () => { raise("called emergency services"); });
  $("#sosTrust", m.el).onclick = () => { sendTo(v, `🚨 I need help.\n\n` + detailsText(v, ctx.S.user, mapLink(loc0))); raise("alerted trusted contact").then(() => redraw?.()); };
  $("#sosFx", m.el).onclick = async () => { await raise("asked Faxton for help"); toast("The Faxton team has been told."); m.close(); redraw?.(); };
  $("#sosRep", m.el).onclick = async () => { m.close(); await reportDialog(ctx, { targetUid: v.agentUid || "", targetName: v.agentName || "the agent" }); };
}

// ---- one viewing on the renter's Viewings page ----
const fmtV = (v) => `${fmtDate(String(v.when).slice(0, 10))}, ${v.slot}`;
const SLOTS = ["10:00 AM", "12:00 PM", "2:00 PM", "4:00 PM"];
export const isPast = (v, now = Date.now()) => !!v.checkOut || /declin|cancel/i.test(v.status) || startOf(v).getTime() + 5 * 36e5 < now;
const stars = (n) => `<span class="rf-stars" aria-label="${n} out of 5">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= n ? "on" : ""}">${xicon("star", 16, 1.5)}</i>`).join("")}</span>`;
export function viewingCard(v, now = Date.now()) {
  const phys = isPhysical(v), start = startOf(v).getTime(), live = v.status === "Confirmed", done = !!v.checkOut, off = /declin|cancel/i.test(v.status), asked = /request/i.test(v.status);
  const canIn = live && phys && !v.checkIn && now >= start - 60 * 6e4 && now <= start + 5 * 36e5;
  const late = v.checkIn && !v.checkOut && now - v.checkIn.at > OVERDUE_MIN * 6e4;
  const stepState = [!!v.sharedWith, !!v.checkIn, done];
  const hint = !live ? "Safety tools unlock once the agent confirms." : v.checkIn ? "" : now > start + 5 * 36e5 ? "This viewing has passed." : `Check-in opens at ${clock(start - 60 * 6e4)}.`;
  const past = isPast(v, now), r = v.reschedule, rated = v.rating;
  const acts = [
    asked && !past ? `<button type="button" class="btn red-o sm" data-act="cancel">${xicon("calx", 16)} Cancel request</button>` : "",
    (asked || live) && !past && !v.checkIn ? `<button type="button" class="btn sm" data-act="move">${xicon("undo", 16)} Ask to move it</button>` : "",
    live && !past ? `<button type="button" class="btn sm" data-act="ics">${icon("cal", 16)} Add to calendar</button>` : "",
    v.agentUid ? `<a class="btn sm" href="#/messages">${icon("msg", 16)} Message agent</a>` : "",
    done && !rated ? `<button type="button" class="btn sm primary" data-act="rate">${xicon("star", 16)} Rate your agent</button>` : "",
    past && !off ? `<a class="btn sm" href="#/home/${esc(v.listingId || "")}">View the home</a>` : "",
  ].filter(Boolean).join("");
  return `<article class="rf-vw ${off ? "off" : ""}" data-id="${esc(v.id)}"><header><img src="${esc(v.image)}" alt=""><div class="rf-vw-t"><h3>${esc(v.title)}</h3><p class="rf-loc">${icon("pin", 14)} ${esc(v.area)}</p><p class="rf-vw-when">${icon("cal", 15)} ${esc(fmtV(v))} · ${esc(v.tour || "In-person tour")}</p></div><div class="rf-vw-st">${statusPill(v.status)}${safeBadge(v)}</div></header>
    ${identityHtml({ name: v.agentName || "Faxton agent", avatar: v.agentPhoto }, !!v.agentVerified, true)}
    ${r && !off ? `<div class="rf-note info">${xicon("undo", 20)}<div><b>You asked to move this viewing</b><p>Preferred: ${esc(fmtDate(String(r.when).slice(0, 10)))}, ${esc(r.slot)}. Your agent will reply in Messages.</p></div></div>` : ""}
    ${rated ? `<div class="rf-vw-rated">${stars(rated.stars)}<span>${rated.text ? "“" + esc(rated.text) + "”" : "Thanks for rating your agent."}</span></div>` : ""}
    ${phys && !off ? `<section class="rf-vs"><div class="rf-vs-head"><h4>${icon("shield", 18)} Viewing safety</h4>${live && !done ? `<button class="vs-sosbtn" data-sos>${icon("sos", 16)} Emergency</button>` : ""}</div>
      ${late ? `<div class="vs-late">${icon("bell", 18)}<div><b>Are you OK?</b><small>You checked in at ${clock(v.checkIn.at)}. The viewing should be over by now.</small></div><button class="btn sm primary" data-act="out">I’m OK, check out</button><button class="btn sm red" data-sos>I need help</button></div>` : ""}
      <ol class="rf-vs-steps"><li class="${stepState[0] ? "ok" : ""}"><i>${stepState[0] ? icon("check", 13, 3) : 1}</i><div><b>Share the details</b><small>${v.sharedWith ? "Shared with " + esc(v.sharedWith) : v.trusted ? `Send to ${esc(v.trusted.name)} on WhatsApp` : "Pick someone who knows where you’ll be"}</small></div><button class="btn sm" data-act="share">${v.sharedWith ? "Send again" : v.trusted ? "Share" : "Add contact"}</button></li>
        <li class="${stepState[1] ? "ok" : ""}"><i>${stepState[1] ? icon("check", 13, 3) : 2}</i><div><b>Check in</b><small>${v.checkIn ? "Checked in at " + clock(v.checkIn.at) : esc(hint) || "When you arrive and meet the agent"}</small></div>${canIn ? `<button class="btn sm primary" data-act="in">Check in</button>` : ""}</li>
        <li class="${stepState[2] ? "ok" : ""}"><i>${stepState[2] ? icon("check", 13, 3) : 3}</i><div><b>Check out</b><small>${v.checkOut ? "Finished at " + clock(v.checkOut.at) : "Tell us you’re done and safe"}</small></div>${v.checkIn && !v.checkOut ? `<button class="btn sm primary" data-act="out">Check out</button>` : ""}</li></ol></section>` : ""}
    ${acts ? `<footer class="rf-vw-act">${acts}</footer>` : ""}</article>`;
}

// the .ics file for "Add to calendar"
function icsFile(v) {
  const s = startOf(v), e = new Date(s.getTime() + 36e5), f = (d) => d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0") + "T" + String(d.getHours()).padStart(2, "0") + String(d.getMinutes()).padStart(2, "0") + "00";
  const txt = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Faxton Rentals//EN\r\nBEGIN:VEVENT\r\nUID:${v.id}@faxton\r\nDTSTAMP:${f(new Date())}\r\nDTSTART:${f(s)}\r\nDTEND:${f(e)}\r\nSUMMARY:Viewing: ${String(v.title).replace(/[,;\n]/g, " ")}\r\nLOCATION:${String(v.area).replace(/[,;\n]/g, " ")}\r\nDESCRIPTION:Viewing booked on Faxton Rentals with ${String(v.agentName || "the agent").replace(/[,;\n]/g, " ")}.\r\nBEGIN:VALARM\r\nTRIGGER:-PT1H\r\nACTION:DISPLAY\r\nDESCRIPTION:Viewing in one hour\r\nEND:VALARM\r\nEND:VEVENT\r\nEND:VCALENDAR`;
  const url = URL.createObjectURL(new Blob([txt], { type: "text/calendar" })), a = document.createElement("a"); a.href = url; a.download = "faxton-viewing.ics"; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
}
// tell the agent in the chat (best effort: the page works even if this fails)
async function tellAgent(ctx, v, text) { try { const l = await st.getListing(v.listingId); if (!l) return; const cid = await st.ensureConversation(ctx.S.user, l); await st.sendMessage(ctx.S.user, cid, text); } catch {} }

export function mountViewings(root, ctx, list, redraw) {
  const find = (el) => list.find((x) => x.id === el.closest(".rf-vw, .vw-card").dataset.id);
  $$("[data-sos]", root).forEach((b) => (b.onclick = () => emergency(ctx, find(b), redraw)));
  $$("[data-act]", root).forEach((b) => (b.onclick = async () => {
    const v = find(b), a = b.dataset.act; b.disabled = true;
    try {
      if (a === "share") {
        let t = v.trusted || getTrusted(ctx.S.user.uid);
        if (!t) { t = await askContact(ctx); if (!t) { b.disabled = false; return; } }
        const vt = { ...v, trusted: t }; sendTo(vt, detailsText(vt, ctx.S.user));
        saveTrusted(ctx.S.user.uid, t); await save(v, { trusted: t, sharedWith: t.name }); toast(`Details ready to send to ${t.name}.`);
      } else if (a === "in") {
        const loc = await where(); await save(v, { checkIn: { at: Date.now(), ...(loc || {}) } });
        toast("You’re checked in. Stay safe."); if (v.trusted) tell(v, `✅ I've arrived for the viewing and checked in.\n\n` + detailsText(v, ctx.S.user, mapLink(loc)), "Let " + v.trusted.name + " know you’ve arrived?");
      } else if (a === "out") {
        await save(v, { checkOut: { at: Date.now() } }); toast("Checked out. Glad you’re safe."); if (v.trusted) tell(v, `✅ I'm done with the viewing at ${v.title} and I'm safe. Thanks for looking out for me.`, "Let " + v.trusted.name + " know you’re safe?");
      } else if (a === "cancel") {
        if (await ask({ title: "Cancel this viewing request?", body: `${esc(v.title)} on ${esc(fmtV(v))}. The agent will be told.`, ok: "Cancel request", no: "Keep it", tone: "danger" })) { await save(v, { status: "Cancelled", cancelledAt: Date.now() }); tellAgent(ctx, v, `I’ve cancelled my viewing request for ${fmtV(v)}. Thank you.`); toast("Viewing request cancelled."); }
      } else if (a === "move") { await moveDialog(ctx, v); }
      else if (a === "rate") { await rateDialog(ctx, v); }
      else if (a === "ics") icsFile(v);
    } catch (e) { toast(fxErr(e)); }
    redraw?.();
  }));
}
function moveDialog(ctx, v) {
  return new Promise((resolve) => {
    const nd = new Date(Date.now() + 864e5); const min = nd.toISOString().slice(0, 10); while (nd.getDay() === 0) nd.setDate(nd.getDate() + 1); const first = nd.toISOString().slice(0, 10);
    const m = modal(`<div class="rf-dlg"><h2>Ask to move your viewing</h2><p class="rf-dlg-p">Currently ${esc(fmtV(v))}. Tell the agent what suits you better. They’ll confirm in Messages.</p><form class="rf-form" id="mvF"><div class="rf-grid2"><label class="rf-fl">New day<input id="mvD" type="date" min="${min}" value="${first}"></label><label class="rf-fl">Time<select id="mvT">${SLOTS.map((t) => `<option>${t}</option>`).join("")}</select></label></div>
      <label class="rf-fl"><span>Reason <span class="rf-optl">(optional)</span></span><textarea id="mvN" rows="2" maxlength="200" placeholder="e.g. I’m at work that morning."></textarea></label><p class="rf-err" id="mvE" role="alert"></p><div class="rf-dlg-act"><button type="button" class="btn" data-x>Cancel</button><button class="btn primary" type="submit">Send request</button></div></form></div>`);
    m.el.addEventListener("close", () => resolve());
    $("[data-x]", m.el).onclick = m.close;
    $("#mvF", m.el).onsubmit = async (e) => {
      e.preventDefault(); const d = $("#mvD", m.el).value, t = $("#mvT", m.el).value, n = $("#mvN", m.el).value.trim(), err = $("#mvE", m.el); err.textContent = "";
      if (!d || d < min) return (err.textContent = "Choose a day from tomorrow onwards.");
      if (new Date(d + "T00:00:00").getDay() === 0) return (err.textContent = "Viewings aren’t available on Sundays. Please pick another day.");
      const b = e.target.querySelector("button[type=submit]"); b.disabled = true;
      try { await save(v, { reschedule: { when: d, slot: t, ...(n ? { note: n } : {}), at: Date.now() } }); tellAgent(ctx, v, `Could we move my viewing from ${fmtV(v)} to ${fmtDate(d)}, ${t}?${n ? " " + n : ""}`); toast("Sent. Your agent will reply in Messages."); m.close(); }
      catch (x) { err.textContent = fxErr(x); b.disabled = false; }
    };
  });
}
function rateDialog(ctx, v) {
  return new Promise((resolve) => {
    let n = 0;
    const m = modal(`<div class="rf-dlg"><h2>How was ${esc(v.agentName || "your agent")}?</h2><p class="rf-dlg-p">Your rating helps other renters. It’s shared with the Faxton team and the agent.</p><div class="rf-rate" role="radiogroup" aria-label="Rating">${[1, 2, 3, 4, 5].map((i) => `<button type="button" role="radio" aria-checked="false" data-n="${i}" aria-label="${i} star${i > 1 ? "s" : ""}">${xicon("star", 30, 1.4)}</button>`).join("")}</div>
      <label class="rf-fl"><span>Anything to add? <span class="rf-optl">(optional)</span></span><textarea id="rtN" rows="2" maxlength="300" placeholder="Was the agent on time, honest and helpful?"></textarea></label><p class="rf-err" id="rtE" role="alert"></p><div class="rf-dlg-act"><button type="button" class="btn" data-x>Not now</button><button class="btn primary" data-go>Send rating</button></div></div>`);
    m.el.addEventListener("close", () => resolve());
    const paint = () => $$("[data-n]", m.el).forEach((b) => { const on = +b.dataset.n <= n; b.classList.toggle("on", on); b.setAttribute("aria-checked", +b.dataset.n === n); });
    $$("[data-n]", m.el).forEach((b) => (b.onclick = () => { n = +b.dataset.n; paint(); }));
    $("[data-x]", m.el).onclick = m.close;
    $("[data-go]", m.el).onclick = async (e) => { if (!n) return ($("#rtE", m.el).textContent = "Tap a star to rate."); e.currentTarget.disabled = true; const t = $("#rtN", m.el).value.trim(); try { await save(v, { rating: { stars: n, ...(t ? { text: t } : {}), at: Date.now() } }); toast("Thank you for rating your agent."); m.close(); } catch (x) { $("#rtE", m.el).textContent = fxErr(x); e.currentTarget.disabled = false; } };
  });
}
// A fresh tap is needed to open WhatsApp, so the message is offered in a small window.
function tell(v, text, title) {
  const m = modal(`<div class="so-pop"><span class="vf-ic">${icon("send", 28)}</span><h2>${esc(title)}</h2><p class="muted">We’ll open WhatsApp with the message ready to send.</p><div class="so-act"><button class="btn" id="tlNo">Not now</button><button class="btn primary" id="tlYes">Send message</button></div></div>`);
  $("#tlNo", m.el).onclick = m.close; $("#tlYes", m.el).onclick = () => { sendTo(v, text); m.close(); };
}
function askContact(ctx) {
  return new Promise((resolve) => {
    const m = modal(`<h2>Add a trusted contact</h2><p class="muted" style="margin-bottom:10px">Someone who’ll know where you are during viewings.</p>${trustedFields()}<p class="err" id="tcErr" role="alert"></p><div class="a2-act"><button class="btn" id="tcNo">Cancel</button><button class="btn primary" id="tcGo">Save and continue</button></div>`);
    let out = null; m.el.addEventListener("close", () => resolve(out));
    $("#tcNo", m.el).onclick = m.close;
    $("#tcGo", m.el).onclick = () => { const t = readTrusted(m.el); if (!t || !validTrusted(m.el)) return ($("#tcErr", m.el).textContent = "Enter their name and a valid phone number."); out = t; m.close(); };
  });
}

// An overdue check-in is also announced in a toast when the page is open.
export function watchOverdue(ctx, getList, redraw) {
  const id = setInterval(() => { const l = getList().find((v) => v.checkIn && !v.checkOut && Date.now() - v.checkIn.at > OVERDUE_MIN * 6e4 && !v._warned); if (l) { l._warned = true; toast("You’re still checked in. Are you OK?"); redraw(); } }, 60000);
  ctx.S.cleanups.push(() => clearInterval(id));
}
