// "Use your Google photo?": offered once to people who signed in with Google and have no picture in their Faxton profile.
// The picture comes from the sign-in account itself (no extra Google permission); nothing is saved unless the person says yes.
import { $, esc, icon, toast, modal } from "./ui.js";
import { saveProfile, syncPublic } from "./store.js";
import { shrinkImage } from "./fx.js";

const KEY = (uid) => "gphoto_" + uid, WEEK = 7 * 864e5, MAX = 40000;
export const googlePhotoUrl = (u) => { const g = u?.providerData?.find((x) => x.providerId === "google.com"); return g ? g.photoURL || u.photoURL || "" : ""; };
const sized = (url) => (/googleusercontent\.com\//.test(url) ? url.replace(/=s\d+(-c)?$/, "") + "=s256-c" : url);
const snoozed = (uid) => { try { const v = localStorage.getItem(KEY(uid)); return v === "never" || (!!v && Date.now() < +v); } catch { return false; } };
const remember = (uid, v) => { try { localStorage.setItem(KEY(uid), v); } catch {} };
export const shouldOffer = (u, profile) => !!(u && profile && !profile.photo && googlePhotoUrl(u) && !snoozed(u.uid));

const load = (src) => new Promise((res, rej) => { const i = new Image(); i.crossOrigin = "anonymous"; i.referrerPolicy = "no-referrer"; i.onload = () => res(i); i.onerror = () => rej(new Error("load")); i.src = src; });
// A small square JPEG (256px, about 40 KB at most) as a data URL.
async function squareData(url) {
  try {
    const img = await load(url), w = img.naturalWidth, h = img.naturalHeight, s = Math.min(w, h), c = document.createElement("canvas"); c.width = c.height = 256;
    const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, 256, 256); g.drawImage(img, (w - s) / 2, (h - s) / 2, s, s, 0, 0, 256, 256);
    let q = 0.85, out = c.toDataURL("image/jpeg", q); while (out.length > MAX && q > 0.35) { q -= 0.1; out = c.toDataURL("image/jpeg", q); }
    return out;
  } catch {}
  const r = await fetch(url, { mode: "cors", referrerPolicy: "no-referrer" }); if (!r.ok) throw new Error("fetch");
  const b = await r.blob(); return shrinkImage(new File([b], "photo", { type: b.type || "image/jpeg" }), { square: 256, bytes: MAX });
}
// Save the Google picture as the profile photo (same fields as an uploaded photo, plus the public card the chat and call lists read).
export async function useGooglePhoto(S) {
  const u = S.user, raw = googlePhotoUrl(u); if (!raw) throw Object.assign(new Error("none"), { userMessage: "We couldn’t find a Google photo on this account." });
  let data = ""; try { data = await squareData(sized(raw)); } catch { try { data = await squareData(raw); } catch {} }
  // Last resort: keep the Google link itself (the page may show https pictures).
  if (!data) data = sized(raw);
  await saveProfile(u.uid, { photo: data }); S.profile = { ...(S.profile || {}), photo: data }; await syncPublic(u.uid, { photo: data });
  return data;
}
export function askGooglePhoto(S, onDone) {
  const u = S.user, url = googlePhotoUrl(u); if (!url) return null;
  const m = modal(`<div class="so-pop gp-pop"><span class="gp-pv"><img src="${esc(sized(url))}" alt="Your Google photo" referrerpolicy="no-referrer"></span><h2>Use your Google photo?</h2><p class="muted">Agents, owners and the Faxton team will see it next to your name in chats and calls. You can change it any time in Settings.</p>
    <div class="so-act"><button type="button" class="btn" id="gpNo">Not now</button><button type="button" class="btn primary" id="gpYes">Use this photo</button></div><button type="button" class="btn ghost sm" id="gpNever">Don’t ask again</button></div>`);
  const close = () => { m.close(); onDone?.(); };
  $("#gpNo", m.el).onclick = () => { remember(u.uid, String(Date.now() + WEEK)); close(); };
  $("#gpNever", m.el).onclick = () => { remember(u.uid, "never"); close(); };
  $("#gpYes", m.el).onclick = async (e) => { const b = e.currentTarget; b.disabled = true; b.textContent = "Saving…";
    try { await useGooglePhoto(S); remember(u.uid, "never"); toast("Your photo is saved."); close(); document.dispatchEvent(new CustomEvent("profile-photo")); }
    catch (x) { b.disabled = false; b.textContent = "Use this photo"; toast(x.userMessage || "We couldn’t save that photo. Try again, or choose one from Settings."); } };
  m.el.addEventListener("close", () => onDone?.(), { once: true });
  return m;
}
