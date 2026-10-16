// The "Confirm it's you" dialog for Settings > Account and security > Your data. Three steps: confirm, prepare, download.
// All rules (what counts as confirmed, lockout, hourly cap) live in mydata.js; this file only draws the steps and calls them.
import { $, esc, icon, modal, toast } from "./ui.js";
import * as D from "./mydata.js";

const native = () => { const ua = navigator.userAgent; return /FaxtonApp\/mobile/.test(ua) || window.Capacitor?.isNativePlatform?.() === true || /; wv\)/.test(ua); };
const STEPS = ["Confirm", "Prepare", "Download"];
const kb = (n) => (n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB");
const mins = (ms) => Math.max(1, Math.ceil(ms / 60000));
let noLink = false; // set when Firebase says Email link sign-in is not switched on; the dialog then uses the password for the rest of the session

export function openDataDialog(ctx, { returning = false, href = "" } = {}) {
  const user = ctx.S.user, profile = ctx.S.profile || {}, prov = D.providers(user);
  if (!user) return;
  const email = D.maskEmail(user.email);
  let step = 1, mode = "choose", busy = false, note = "", errMsg = "", res = null, stage = "", timers = [], gone = false, resultNote = "";
  const linkOk = () => prov.password && !noLink && !native() && !!user.email;
  const m = modal(`<div class="rf-dlg dm" role="group" aria-label="Download my data"></div>`);
  const root = $(".dm", m.el);
  const every = (fn, ms) => { const t = setInterval(() => { if (!m.el.isConnected) return stop(); fn(); }, ms); timers.push(t); };
  const stop = () => { timers.forEach(clearInterval); timers = []; gone = true; removeEventListener("storage", onStore); };
  m.el.addEventListener("close", stop);
  const close = () => { stop(); m.close(); };
  const onStore = (e) => { if (e.key === "fx_dm_pending") tryAdopt(); };
  addEventListener("storage", onStore);

  const steps = () => `<ol class="dm-steps" aria-label="Progress">${STEPS.map((s, i) => `<li class="${i + 1 < step ? "done" : i + 1 === step ? "on" : ""}" ${i + 1 === step ? 'aria-current="step"' : ""}><i>${i + 1 < step ? icon("check", 13, 3) : i + 1}</i><span>${s}</span></li>`).join("")}</ol>`;
  const head = (t, p) => `<h2>${t}</h2>${p ? `<p class="rf-dlg-p">${p}</p>` : ""}`;
  const errLine = () => `<p class="rf-err dm-err" role="alert">${esc(errMsg)}</p>`;
  const noteLine = () => (note ? `<p class="dm-note">${icon("info", 16)}<span>${esc(note)}</span></p>` : "");
  const paint = (html) => { root.innerHTML = steps() + html; wire(); const f = $("[autofocus]", root); if (f) f.focus({ preventScroll: true }); };

  // ---------- views
  function view() {
    timers.forEach(clearInterval); timers = [];
    const L = D.lockState(user.uid);
    if (L.locked) return paint(`<div class="dm-state bad"><span class="dm-ic">${icon("lock", 28)}</span>${head("Paused for your safety", `There were too many wrong attempts. You can try again in about <b data-left>${mins(L.until - Date.now())}</b> minute${mins(L.until - Date.now()) === 1 ? "" : "s"}.`)}</div><div class="rf-dlg-act"><button class="btn primary" data-close autofocus>Close</button></div>`),
      every(() => { const l = D.lockState(user.uid); if (!l.locked) { mode = "choose"; view(); } else { const n = $("[data-left]", root); if (n) n.textContent = mins(l.until - Date.now()); } }, 5000);
    if (step === 1 && D.exportsLeft(user.uid) <= 0 && !D.verifiedUntil()) return paint(`<div class="dm-state"><span class="dm-ic">${icon("info", 28)}</span>${head("That’s 3 downloads this hour", "To keep your data safe we allow 3 downloads an hour. Please try again a little later.")}</div><div class="rf-dlg-act"><button class="btn primary" data-close autofocus>Close</button></div>`);
    if (step === 2) return paint(`<div class="dm-state"><span class="dm-ic spin">${icon("refresh", 28)}</span>${head("Preparing your file", "Gathering your own information. This stays on your device.")}<p class="dm-stage" aria-live="polite">${esc(stage ? "Reading " + stage + "…" : "Starting…")}</p><div class="dm-bar" aria-hidden="true"><i></i></div></div>`);
    if (step === 3) return viewDone();
    if (mode === "wait") return viewWait();
    if (mode === "password") return viewPassword();
    if (mode === "returning") return paint(`<div class="dm-state"><span class="dm-ic spin">${icon("refresh", 28)}</span>${head("Confirming it’s you", "One moment while we check your link.")}</div>`);
    if (mode === "confirmed") return paint(`<div class="dm-state ok"><span class="dm-ic">${icon("check", 28)}</span>${head("You’re confirmed", "Thanks. You can prepare your file here, or go back to the first tab where you asked.")}</div><div class="rf-dlg-act"><button class="btn" data-close>Not now</button><button class="btn primary" data-go autofocus>${icon("download", 17)} Prepare my file</button></div>`);
    return viewChoose();
  }
  function viewChoose() {
    const opts = [];
    if (linkOk()) opts.push(`<button class="btn primary block" data-link ${busy ? "disabled" : ""} autofocus>${icon("mail", 18)} Email me a confirmation link</button><p class="dm-hint">We’ll send it to <b>${esc(email)}</b>.</p>`);
    if (prov.password && !linkOk()) opts.push(`<button class="btn primary block" data-pwmode autofocus>${icon("lock", 18)} Confirm with my password</button>`);
    if (prov.google) opts.push(`<button class="btn ${opts.length ? "block" : "primary block"}" data-google ${busy ? "disabled" : ""} ${opts.length ? "" : "autofocus"}>${icon("user", 18)} Continue with Google</button>`);
    if (linkOk()) opts.push(`<button class="btn ghost block" data-pwmode>Use my password instead</button>`);
    if (!opts.length) opts.push(`<p class="rf-dlg-p">We can’t check this account from here. Use “Ask us to email it” in Settings and our team will send your data.</p>`);
    paint(`${head("Confirm it’s you", "Your data includes private details, so we check it’s really you before making your file. It takes under a minute.")}${noteLine()}${errMsg ? errLine() : ""}<div class="dm-opts">${opts.join("")}</div><div class="rf-dlg-act"><button class="btn" data-close>Cancel</button></div>`);
  }
  function viewWait() {
    const w = D.resendWaitMs();
    paint(`<div class="dm-state"><span class="dm-ic pulse">${icon("mail", 28)}</span>${head("Check your email", `We sent a confirmation link to <b>${esc(email)}</b>. Open it on this device.`)}<p class="dm-hint" aria-live="polite"><span class="dm-dot"></span>Waiting for you to open the link. This page continues by itself.</p></div>${errMsg ? errLine() : ""}
      <div class="dm-opts"><button class="btn block" data-resend ${w > 0 || busy ? "disabled" : ""}>${w > 0 ? `Send again in ${Math.ceil(w / 1000)}s` : "Send the link again"}</button><button class="btn ghost block" data-pwmode>Use my password instead</button></div><div class="rf-dlg-act"><button class="btn" data-close>Cancel</button></div>`);
    every(() => { const b = $("[data-resend]", root); if (!b || mode !== "wait") return; const left = D.resendWaitMs(); b.disabled = left > 0 || busy; b.textContent = left > 0 ? `Send again in ${Math.ceil(left / 1000)}s` : "Send the link again"; }, 1000);
    every(tryAdopt, 2000);
  }
  function viewPassword() {
    paint(`${head("Confirm with your password", `Enter the password for <b>${esc(user.email || "")}</b>.`)}${noteLine()}
      <form class="rf-form dm-form" novalidate><label class="rf-fl">Password<input type="password" id="dmPw" autocomplete="current-password" required autofocus></label>${errMsg ? errLine() : `<p class="rf-err dm-err" role="alert"></p>`}
      <p class="dm-hint">${D.lockState(user.uid).left} attempt${D.lockState(user.uid).left === 1 ? "" : "s"} left before this pauses for 15 minutes.</p>
      <div class="rf-dlg-act"><button type="button" class="btn" data-close>Cancel</button><button type="submit" class="btn primary" ${busy ? "disabled" : ""}>Confirm</button></div></form>
      <div class="dm-opts">${linkOk() ? `<button class="btn ghost block" data-back>Email me a link instead</button>` : ""}${prov.google ? `<button class="btn ghost block" data-google>Continue with Google instead</button>` : ""}</div>`);
  }
  function viewDone() {
    const n = res.counts, items = ["viewings", "applications", "offers", "conversations", "supportTickets", "notifications"].filter((k) => n[k]).map((k) => `${n[k]} ${({ viewings: "viewing", applications: "application", offers: "offer", conversations: "chat", supportTickets: "ticket", notifications: "notification" })[k]}${n[k] === 1 ? "" : "s"}`);
    paint(`<div class="dm-state ok"><span class="dm-ic">${icon("check", 28)}</span>${head("Your file is ready", resultNote || "It should be in your downloads now.")}
      <div class="dm-file"><b>${esc(res.filename)}</b><small>${kb(res.size)}${items.length ? " · " + esc(items.join(", ")) : ""}</small></div>
      ${res.skipped.length ? `<p class="dm-note">${icon("info", 16)}<span>We couldn’t read: ${esc(res.skipped.join(", "))}. Try again later for a complete copy.</span></p>` : ""}
      <p class="dm-hint">Open <b>summary.html</b> inside the ZIP to read it, or <b>my-data.json</b> for the raw data. Keep the file private: it holds your personal details.</p></div>
      <div class="rf-dlg-act">${D.canShareFile(res.file) ? `<button class="btn" data-share>${icon("share", 17)} Share or save…</button>` : ""}<button class="btn" data-again>${icon("download", 17)} Download again</button><button class="btn primary" data-close autofocus>Done</button></div>`);
  }

  // ---------- actions
  const fail = (e) => { busy = false; errMsg = D.friendly(e); if (e?.code === "dm/locked") errMsg = ""; view(); };
  async function sendTheLink() {
    busy = true; errMsg = ""; view();
    try { await D.sendLink(user); busy = false; mode = "wait"; view(); }
    catch (e) {
      busy = false;
      if (e?.code === "auth/operation-not-allowed") { noLink = true; mode = "password"; note = "Confirming by email link isn’t switched on yet, so please use your password instead."; errMsg = ""; return view(); }
      if (e?.code === "dm/wait") { mode = "wait"; return view(); }
      fail(e);
    }
  }
  async function viaPassword(pw) {
    if (!pw) { errMsg = "Enter your password."; return view(); }
    busy = true; errMsg = ""; view();
    try { await D.verifyWithPassword(user, pw); busy = false; prepare(); } catch (e) { fail(e); }
  }
  async function viaGoogle() {
    busy = true; errMsg = ""; view();
    try { await D.verifyWithGoogle(user, ctx.reauthGoogle); busy = false; prepare(); } catch (e) { fail(e); }
  }
  let adopting = false;
  async function tryAdopt() {
    if (adopting || busy || step !== 1 || gone) return;
    const p = D.pending(); if (!p?.done || p.consumed) return;
    adopting = true;
    try { if (await D.adoptOtherTab(user)) prepare(); } finally { adopting = false; }
  }
  async function prepare() {
    step = 2; stage = ""; view();
    try {
      res = await D.buildExport(user, profile, (s) => { stage = s; const n = $(".dm-stage", root); if (n) n.textContent = "Reading " + s + "…"; });
    } catch (e) {
      step = 1; mode = "choose"; busy = false;
      errMsg = e?.code === "dm/rate-limit" || e?.code === "dm/locked" || e?.code === "dm/expired" || e?.code === "dm/not-verified" ? D.friendly(e) : "We couldn’t gather your data just now. Check your connection and try again.";
      return view();
    }
    const how = await D.deliver(res);
    resultNote = how === "shared" ? "Choose where to save it." : how === "failed" ? "Your device blocked the download. Use “Share or save…” or “Download again”." : "It should be in your downloads now.";
    await D.recordExport(user, profile);
    ctx.S.lastDataExport = Date.now(); onDone?.();
    toast(how === "failed" ? "Your file is ready. Tap Download again to save it." : "Your data was downloaded.");
    step = 3; view();
  }
  let onDone = null;

  function wire() {
    root.querySelectorAll("[data-close]").forEach((b) => (b.onclick = close));
    const q = (s, f) => { const b = $(s, root); if (b) b.onclick = f; };
    q("[data-link]", sendTheLink); q("[data-resend]", sendTheLink);
    q("[data-google]", viaGoogle);
    q("[data-pwmode]", () => { mode = "password"; errMsg = ""; view(); });
    q("[data-back]", () => { mode = D.pending() && !D.pending().done && D.resendWaitMs() > 0 ? "wait" : "choose"; errMsg = ""; view(); });
    q("[data-go]", prepare);
    q("[data-again]", async () => { const how = await D.deliver(res); toast(how === "downloaded" ? "Downloading again." : how === "shared" ? "Choose where to save it." : "Your device blocked the download. Try Share or save."); });
    q("[data-share]", async () => { const how = await D.deliver(res, { preferShare: true }); if (how === "failed") toast("Sharing isn’t available here."); });
    const f = $(".dm-form", root); if (f) f.onsubmit = (e) => { e.preventDefault(); viaPassword($("#dmPw", root).value); };
  }

  // ---------- start
  const api = { close, onDone: (fn) => (onDone = fn) };
  if (returning) {
    mode = "returning"; view();
    D.resumeFromLink(user, href).then(() => { mode = "confirmed"; view(); }).catch((e) => { mode = "choose"; errMsg = D.friendly(e); view(); });
  } else {
    mode = prov.password && !linkOk() && !prov.google ? "password" : "choose";
    if (D.pending() && !D.pending().done && Date.now() - D.pending().sentAt < 10 * 60000 && D.pending().uid === user.uid && linkOk()) mode = "wait";
    view();
  }
  return api;
}

// Settings calls this every time the Account page opens: if the person arrived through the emailed link, finish the check.
export function resumeIfLink(ctx) {
  if (!ctx.S.user || !D.hasLink()) return false;
  const href = location.href;
  try { history.replaceState(null, "", location.pathname + "#/settings/account"); } catch {}
  return openDataDialog(ctx, { returning: true, href });
}
