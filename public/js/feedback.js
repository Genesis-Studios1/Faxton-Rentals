// Ratings and feedback, renter side: the "Rate this call" card shown after a call, and the "Rate Faxton" form in the Help centre.
// Everything lands in the Firestore "feedback" collection; the admin console reads it under Support > Feedback (ax-sections.js).
// Small and defensive on purpose: a rating must never get in the way of a call or a page.
import { auth, db } from "./firebase.js";
import { collection, addDoc, getDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { $, $$, esc, icon, toast, modal } from "./ui.js";

export const TOPICS = ["The app", "Realtors", "Listings", "Chat & calls", "Other"];
const WORDS = ["", "Not good", "Could be better", "It was fine", "Good", "Excellent"];

// Who is rating: the signed-in account plus its profile (role and name). No import of main.js on purpose (it would boot the app twice).
async function who() {
  const u = auth.currentUser;
  if (!u) throw new Error("Sign in to send a rating.");
  let p = {}; try { p = (await getDoc(doc(db, "users", u.uid))).data() || {}; } catch { /* the rating still goes through without a role */ }
  return { uid: u.uid, name: String(u.displayName || p.name || u.email || "Faxton user").slice(0, 120), email: String(u.email || "").slice(0, 160), role: String(p.role || "renter").slice(0, 20) };
}

export async function sendFeedback({ rating, topic, message = "", callId = "", peer = "" }) {
  rating = Math.round(+rating);
  if (!(rating >= 1 && rating <= 5)) throw new Error("Pick a star rating first.");
  if (!TOPICS.includes(topic)) topic = "Other";
  const me = await who();
  const doc = { ...me, rating, topic, message: String(message).trim().slice(0, 1000), status: "New", createdAt: serverTimestamp() };
  if (callId) doc.callId = String(callId).slice(0, 80);
  if (peer) doc.peer = String(peer).slice(0, 120);
  return addDoc(collection(db, "feedback"), doc);
}

// ---------- the star picker: a radio group, so it works with a keyboard and a screen reader ----------
const STAR = `<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path d="M12 3.4l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17.4 6.6 20.3l1-6.1L3.2 9.9l6.1-.9z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
export const pickerHtml = (name = "fbk") => `<div class="fbk-pick" role="radiogroup" aria-label="Your rating" data-pick="${name}">${[1, 2, 3, 4, 5].map((n) => `<button type="button" role="radio" aria-checked="false" aria-label="${n} star${n > 1 ? "s" : ""}, ${WORDS[n]}" class="fbk-s" data-n="${n}" tabindex="${n === 1 ? 0 : -1}">${STAR}</button>`).join("")}</div><p class="fbk-word" aria-live="polite"></p>`;
// Wires the picker; returns { get(): number }.
export function mountPicker(root, onChange) {
  const box = $("[data-pick]", root), word = $(".fbk-word", root); let val = 0;
  const paint = (hover = 0) => { const v = hover || val; $$(".fbk-s", box).forEach((b) => { const n = +b.dataset.n; b.classList.toggle("on", n <= v); b.setAttribute("aria-checked", String(n === val)); b.tabIndex = (val ? n === val : n === 1) ? 0 : -1; }); if (word) word.textContent = v ? WORDS[v] : ""; };
  const set = (n) => { val = n; paint(); onChange?.(n); };
  box.addEventListener("click", (e) => { const b = e.target.closest(".fbk-s"); if (b) set(+b.dataset.n); });
  box.addEventListener("pointerover", (e) => { const b = e.target.closest(".fbk-s"); if (b && e.pointerType === "mouse") paint(+b.dataset.n); });
  box.addEventListener("pointerleave", () => paint());
  box.addEventListener("keydown", (e) => { const d = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key]; if (!d) return; e.preventDefault(); const n = Math.max(1, Math.min(5, (val || 0) + d)); set(n); $(`.fbk-s[data-n="${n}"]`, box)?.focus(); });
  paint();
  return { get: () => val, reset: () => { val = 0; paint(); } };
}

// ---------- "Rate Faxton" in the Help centre ----------
export const formHtml = () => `<div class="rf-card-h"><div><h2>Rate Faxton</h2><p>Tell us how we’re doing. Every rating is read by the team, and we reply in your notifications.</p></div></div>
  <form class="rf-form fbk-form" id="fbForm" novalidate><div class="fbk-row"><span class="fbk-l">How would you rate us?</span>${pickerHtml("fb")}</div>
  <label class="rf-fl">What is it about?<select id="fbTopic">${TOPICS.map((t) => `<option>${esc(t)}</option>`).join("")}</select></label>
  <label class="rf-fl">Anything you’d like to add? <span class="rf-help">Optional</span><textarea id="fbMsg" rows="4" maxlength="1000" placeholder="What went well, or what should we fix?"></textarea></label>
  <p class="rf-err" id="fbErr" role="alert"></p><div class="rf-actions" style="margin:0"><button class="btn primary" type="submit">${icon("send", 18)} Send rating</button></div></form>`;
export function mountForm(root) {
  const f = $("#fbForm", root); if (!f) return;
  const pick = mountPicker(f), err = $("#fbErr", f);
  f.onsubmit = async (e) => {
    e.preventDefault(); err.textContent = ""; if (!pick.get()) return (err.textContent = "Tap a star to rate us first.");
    const b = f.querySelector("button[type=submit]"); b.disabled = true;
    try { await sendFeedback({ rating: pick.get(), topic: $("#fbTopic", f).value, message: $("#fbMsg", f).value }); $("#fbMsg", f).value = ""; pick.reset(); toast("Thank you! Your rating has been sent."); }
    catch (x) { err.textContent = /permission|insufficient/i.test(String(x?.code || x?.message)) ? "We couldn’t send that just now. Please try again in a moment." : x?.message && !/firebase|firestore/i.test(x.message) ? x.message : "We couldn’t send that. Check your connection and try again."; }
    finally { b.disabled = false; }
  };
}

// ---------- "Rate this call", shown once a connected call has ended ----------
let asked = new Set();
export async function rateCall({ callId, peer, seconds }) {
  try {
    if (!callId || asked.has(callId) || !(seconds >= 5)) return;
    const me = await who().catch(() => null); if (!me || ["owner", "admin", "support"].includes(me.role)) return; // staff are the ones reading ratings
    asked.add(callId);
    const m = modal(`<div class="rf-dlg fbk-dlg"><h2>How was your call${peer ? " with " + esc(peer) : ""}?</h2><p class="rf-dlg-p">A quick rating helps us keep calls clear.</p>${pickerHtml("call")}
      <label class="rf-fl">Anything we should know? <span class="rf-help">Optional</span><textarea id="fcMsg" rows="3" maxlength="500" placeholder="Echo, dropped audio, a bad connection…"></textarea></label><p class="rf-err" id="fcErr" role="alert"></p>
      <div class="rf-dlg-act"><button class="btn" type="button" id="fcNo">Not now</button><button class="btn primary" type="button" id="fcYes" disabled>Send rating</button></div></div>`);
    const pick = mountPicker(m.el, (n) => { $("#fcYes", m.el).disabled = !n; });
    $("#fcNo", m.el).onclick = m.close;
    $("#fcYes", m.el).onclick = async (ev) => {
      const b = ev.currentTarget; b.disabled = true;
      try { await sendFeedback({ rating: pick.get(), topic: "Chat & calls", message: $("#fcMsg", m.el).value, callId, peer }); m.close(); toast("Thanks for rating the call."); }
      catch { $("#fcErr", m.el).textContent = "We couldn’t send that. You can rate us any time from the Help centre."; b.disabled = false; }
    };
  } catch (e) { console.warn("[rate-call]", e?.message); /* a rating prompt must never break a call */ }
}
