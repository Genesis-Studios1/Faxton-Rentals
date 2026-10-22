// App lock: open the app with a fingerprint, face or the phone's screen lock.
// Android and iPhone apps use the system biometric prompt (Capacitor plugin). On the web the browser's platform authenticator (WebAuthn) is used.
import { $, esc, icon, toast, logoMark } from "./ui.js";

const KEY = (uid) => "applock_" + uid;
// When the lock asks again: "open" = every time you come back to the app, "after" = once you have been away for a chosen time, "session" = once per launch (until the app is closed and opened again).
export const MODES = { open: "Every time I open the app", after: "After I leave the app for a while", session: "Only once, until I close the app" };
export const AFTER_CHOICES = [[30, "30 seconds"], [60, "1 minute"], [120, "2 minutes"], [300, "5 minutes"], [900, "15 minutes"], [1800, "30 minutes"]];
export const settings = (uid) => { const v = read(uid) || {}; return { mode: MODES[v.mode] ? v.mode : "after", secs: AFTER_CHOICES.some((c) => c[0] === v.secs) ? v.secs : 30 }; };
const setSettings = (uid, patch) => { const v = read(uid); if (v) write(uid, { ...v, ...patch }); };
const SKEY = (uid) => "applock_s_" + uid;
const unlockedThisLaunch = (uid) => { try { return sessionStorage.getItem(SKEY(uid)) === "1"; } catch { return false; } };
const isApp = () => /FaxtonApp\/mobile/.test(navigator.userAgent) && !!window.Capacitor?.registerPlugin;
let native = null;
const plugin = () => (native ||= window.Capacitor.registerPlugin("BiometricAuthNative"));
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64 = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
const read = (uid) => { try { return JSON.parse(localStorage.getItem(KEY(uid)) || "null"); } catch { return null; } };
const write = (uid, v) => { try { v ? localStorage.setItem(KEY(uid), JSON.stringify(v)) : localStorage.removeItem(KEY(uid)); } catch {} };
export const enabled = (uid) => !!read(uid)?.on;

export async function available() {
  if (isApp()) { try { const r = await plugin().checkBiometry(); return !!(r.isAvailable || r.deviceIsSecure); } catch { return false; } }
  try { return !!(window.PublicKeyCredential && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())); } catch { return false; }
}
// Asks the person to prove it is them. Resolves true or throws with a readable message.
async function challenge(user, why) {
  if (isApp()) {
    try { await plugin().internalAuthenticate({ reason: why, cancelTitle: "Cancel", allowDeviceCredential: true, androidTitle: "Faxton Rentals", androidSubtitle: why }); return true; }
    catch (e) { throw Object.assign(new Error(/cancel|user/i.test(e?.code + " " + e?.message) ? "cancelled" : e?.message || "Couldn’t verify you."), { code: e?.code }); }
  }
  const v = read(user.uid);
  if (!v?.cred) throw new Error("This device isn’t set up for unlock.");
  try { await navigator.credentials.get({ publicKey: { challenge: crypto.getRandomValues(new Uint8Array(32)), allowCredentials: [{ type: "public-key", id: unb64(v.cred) }], userVerification: "required", timeout: 60000 } }); return true; }
  catch (e) { throw new Error(e?.name === "NotAllowedError" ? "cancelled" : "Couldn’t verify you."); }
}
export async function enable(user) {
  if (!(await available())) throw new Error("This device has no fingerprint, face or screen lock set up. Add one in your phone’s settings first.");
  if (isApp()) { await challenge(user, "Turn on unlock"); write(user.uid, { on: 1 }); return; }
  let cred;
  try { cred = await navigator.credentials.create({ publicKey: { challenge: crypto.getRandomValues(new Uint8Array(32)), rp: { name: "Faxton Rentals", id: location.hostname }, user: { id: new TextEncoder().encode(user.uid).slice(0, 64), name: user.email || user.uid, displayName: user.displayName || user.email || "Faxton user" }, pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }], authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "discouraged" }, timeout: 60000 } }); }
  catch (e) { throw new Error(e?.name === "NotAllowedError" ? "cancelled" : "Couldn’t set up unlock on this device."); }
  write(user.uid, { on: 1, cred: b64(cred.rawId) });
}
export const disable = (uid) => write(uid, null);

// ---- the lock screen ----
let armed = null, hiddenAt = 0, showing = false, unlockedAt = 0;
function lockScreen(user, logout, reauth) {
  if (showing) return; showing = true;
  // Opening the app: the Faxton splash plays first, and the lock waits underneath it (so nothing of the app shows when the splash leaves).
  const sp = document.getElementById("splash"), waitSplash = !!sp && sp.isConnected && !document.documentElement.classList.contains("no-splash");
  const el = document.createElement("div"); el.className = "lk-ov" + (waitSplash ? " lk-wait" : " lk-fade"); el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "Locked");
  el.innerHTML = `<div class="lk-card"><span class="lk-logo">${logoMark()}</span><h1>Faxton Rentals is locked</h1><p>Use your fingerprint, face or screen lock to continue.</p><button type="button" class="btn primary lk-go" id="lkGo">${icon("lock", 20)} Unlock</button><p class="lk-err" id="lkErr" role="alert"></p><button type="button" class="lk-alt" id="lkAlt" hidden></button><form class="lk-pw" id="lkPwForm" hidden autocomplete="off"><label for="lkPw">Your Faxton password</label><input id="lkPw" type="password" autocomplete="current-password" enterkeyhint="go" placeholder="Password"><button type="submit" class="btn primary lk-go" id="lkPwGo">Unlock with password</button><button type="button" class="lk-alt" id="lkPwBack">Use fingerprint instead</button></form><button type="button" class="lk-out" id="lkOut">Sign out instead</button></div>`;
  document.querySelectorAll("dialog[open]").forEach((d) => { try { d.close(); } catch {} }); // an open dialog would make the lock screen unclickable
  document.body.append(el); document.documentElement.classList.add("locked");
  const done = () => { el.remove(); showing = false; unlockedAt = Date.now(); hiddenAt = 0; try { sessionStorage.setItem(SKEY(user.uid), "1"); } catch {} document.documentElement.classList.remove("locked"); document.dispatchEvent(new Event("applock-open")); };
  const go = async () => { $("#lkErr", el).textContent = ""; try { await challenge(user, "Unlock Faxton Rentals"); done(); } catch (e) { if (e.message !== "cancelled") { $("#lkErr", el).textContent = e.message; if (hasPw) showPw(true); } } };
  // If the fingerprint will not work (no sensor, too many tries, a dirty finger), the account password or Google sign-in opens the app instead.
  const provs = (user.providerData || []).map((x) => x.providerId), hasPw = provs.includes("password") && !!user.email && !!reauth?.password, hasG = !hasPw && provs.includes("google.com") && !!reauth?.google;
  const alt = $("#lkAlt", el), form = $("#lkPwForm", el), err = $("#lkErr", el), goBtn = $("#lkGo", el);
  const showPw = (on) => { form.hidden = !on; goBtn.hidden = on; alt.hidden = on || !(hasPw || hasG); if (on) setTimeout(() => $("#lkPw", el).focus(), 50); };
  if (hasPw || hasG) { alt.hidden = false; alt.textContent = hasPw ? "Use my password instead" : "Use Google instead"; }
  const FK = "applock_f_" + user.uid, fails = () => { try { return JSON.parse(localStorage.getItem(FK) || "{}"); } catch { return {}; } };
  alt.onclick = async () => {
    err.textContent = "";
    if (hasPw) return showPw(true);
    alt.disabled = true; try { await reauth.google(); done(); } catch (e) { err.textContent = /cancel|closed|popup/i.test(e?.code + " " + e?.message) ? "" : "Couldn’t verify with Google. Try again."; } alt.disabled = false;
  };
  $("#lkPwBack", el).onclick = () => { err.textContent = ""; showPw(false); };
  form.onsubmit = async (e) => {
    e.preventDefault(); err.textContent = "";
    const f = fails(); if (f.until && f.until > Date.now()) { err.textContent = `Too many wrong tries. Try again in ${Math.ceil((f.until - Date.now()) / 60000)} min, or sign out.`; return; }
    const pw = $("#lkPw", el).value; if (!pw) { err.textContent = "Enter your password."; return; }
    const b = $("#lkPwGo", el); b.disabled = true;
    try { await reauth.password(pw); try { localStorage.removeItem(FK); } catch {} done(); }
    catch (x) {
      const n = (f.n || 0) + 1, lock = n >= 5; try { localStorage.setItem(FK, JSON.stringify({ n: lock ? 0 : n, until: lock ? Date.now() + 15 * 60000 : 0 })); } catch {}
      err.textContent = lock ? "Too many wrong tries. Try again in 15 minutes, or sign out." : /network/i.test(x?.code) ? "No connection. Check your internet and try again." : /too-many/i.test(x?.code) ? "Too many tries. Wait a few minutes and try again." : "That password isn’t right.";
      $("#lkPw", el).select();
    }
    b.disabled = false;
  };
  $("#lkGo", el).onclick = go; $("#lkOut", el).onclick = async () => { disable(user.uid); done(); await logout(); };
  if (!waitSplash) return void setTimeout(go, 250);
  let freed = false;
  const free = () => { if (freed || !el.isConnected) return; freed = true; el.classList.remove("lk-wait"); setTimeout(go, 300); };
  if (sp.classList.contains("leave")) setTimeout(free, 1000);
  else { document.addEventListener("splash-done", () => setTimeout(free, 1000), { once: true }); setTimeout(free, 12000); }
}
// Call after sign-in: locks now (the app was just opened), then again as the chosen option says.
export function arm(user, logout, reauth) {
  armed = enabled(user?.uid) ? { user, logout, reauth } : null;
  if (armed && !(settings(user.uid).mode === "session" && unlockedThisLaunch(user.uid))) lockScreen(user, logout, reauth);
  if (!arm.wired) {
    arm.wired = true;
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) { if (!showing) hiddenAt = Date.now(); return; }
      if (!armed || !hiddenAt || showing) return;
      const away = Date.now() - hiddenAt, st = settings(armed.user.uid); hiddenAt = 0;
      if (Date.now() - unlockedAt < 2000) return; // the system fingerprint prompt itself briefly hides the page
      if (st.mode === "open" || (st.mode === "after" && away > st.secs * 1000)) lockScreen(armed.user, armed.logout, armed.reauth);
    });
  }
}
export const refreshArm = (user, logout, reauth) => { armed = enabled(user?.uid) ? { user, logout, reauth } : null; };

// ---- the switch in Settings > Account & security ----
export async function mountCard(box, user, logout) {
  const ok = await available(), on = enabled(user.uid);
  box.innerHTML = `<section class="set-card"><h3>App lock</h3><p class="sub">Ask for your fingerprint, face or screen lock when the app opens or you come back to it.</p>
    <div class="sw-row"><span class="sw-ic">${icon("lock", 26, 1.7)}</span><div><b>Unlock with fingerprint</b><p>${ok ? (isApp() ? "Uses your phone’s fingerprint, face or screen lock." : "Uses this device’s fingerprint, face or screen lock.") : "Not available on this device. Set up a fingerprint or screen lock in your phone’s settings."}</p></div><button type="button" class="switch ${on ? "on" : ""}" id="lockSw" role="switch" aria-checked="${on}" aria-label="Unlock with fingerprint" ${ok ? "" : "disabled"}><i></i></button></div>
    <div class="lk-opts" id="lkOpts" ${on ? "" : "hidden"}><b>Ask me to unlock</b>${Object.entries(MODES).map(([k, v]) => `<label class="lk-opt"><input type="radio" name="lkMode" value="${k}" ${settings(user.uid).mode === k ? "checked" : ""}><span>${v}</span></label>`).join("")}
      <label class="lk-after" id="lkAfterRow" ${settings(user.uid).mode === "after" ? "" : "hidden"}>Leave for <select id="lkAfter" aria-label="Lock after being away for">${AFTER_CHOICES.map(([n, t]) => `<option value="${n}" ${settings(user.uid).secs === n ? "selected" : ""}>${t}</option>`).join("")}</select> or more</label></div></section>`;
  const sw = $("#lockSw", box), opts = $("#lkOpts", box), afterRow = $("#lkAfterRow", box);
  box.querySelectorAll("input[name=lkMode]").forEach((r) => (r.onchange = () => { setSettings(user.uid, { mode: r.value }); afterRow.hidden = r.value !== "after"; toast("Saved."); }));
  $("#lkAfter", box).onchange = (e) => { setSettings(user.uid, { secs: +e.target.value }); toast("Saved."); };
  sw.onclick = async () => {
    sw.disabled = true;
    try {
      if (enabled(user.uid)) { await challenge(user, "Turn off unlock"); disable(user.uid); refreshArm(user, logout); toast("App lock is off."); }
      else { await enable(user); refreshArm(user, logout); toast("App lock is on. You’ll be asked to unlock when you open the app."); }
    } catch (e) { if (e.message !== "cancelled") toast(e.message); }
    sw.disabled = false; const now = enabled(user.uid); opts.hidden = !now; sw.classList.toggle("on", now); sw.setAttribute("aria-checked", now);
  };
}
