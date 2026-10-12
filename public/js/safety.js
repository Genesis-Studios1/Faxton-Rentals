// Reporting and blocking other people.
import { $, esc, icon, modal, toast, friendlyErr } from "./ui.js";
import * as st from "./store.js";

const REASONS = ["Spam or scam", "Harassment or abuse", "Fake or misleading listing", "Inappropriate content", "Pretending to be someone else", "Something else"];

// Opens the report window. Resolves true once the report is sent.
export function reportDialog(ctx, { targetUid = "", targetName = "this user", convId = "" }) {
  return new Promise((resolve) => {
    const m = modal(`<h2>Report ${esc(targetName)}</h2><p class="muted" style="margin:4px 0 12px">Tell us what happened. Our team reviews every report and the person won’t be told it was you.</p>
      <form id="rp" class="a2-form" novalidate><div class="field"><label for="rr">Reason</label><select id="rr" required>${REASONS.map((r) => `<option>${r}</option>`).join("")}</select></div>
      <div class="field"><label for="rd">Details</label><textarea id="rd" rows="4" maxlength="1500" placeholder="What happened? Add anything that helps us look into it."></textarea></div>
      <p class="err" id="rpe" role="alert"></p><div class="a2-act"><button type="button" class="btn" id="rpNo">Cancel</button><button class="btn red" type="submit">Send report</button></div></form>`);
    let sent = false; m.el.addEventListener("close", () => resolve(sent));
    $("#rpNo", m.el).onclick = () => m.close();
    $("#rp", m.el).onsubmit = async (e) => {
      e.preventDefault(); const b = e.submitter; if (b) b.disabled = true;
      try { await st.reportUser(ctx.S.user, { targetUid, targetName, convId, reason: $("#rr", m.el).value, details: $("#rd", m.el).value.trim() }); sent = true; m.close(); toast("Thanks. Your report was sent to the Faxton team."); }
      catch (x) { $("#rpe", m.el).textContent = friendlyErr(x); if (b) b.disabled = false; }
    };
  });
}

// Confirms before blocking. Resolves true once the person is blocked.
export function blockDialog(ctx, { uid, name = "this user" }) {
  return new Promise((resolve) => {
    const m = modal(`<div class="so-pop"><span class="vf-ic bad">${icon("shield", 30)}</span><h2>Block ${esc(name)}?</h2><p class="muted">They won’t be able to call you, and calls from them are declined without ringing. You can unblock them any time from the chat menu.</p><div class="so-act"><button class="btn" id="bkNo">Cancel</button><button class="btn red" id="bkYes">Block</button></div></div>`);
    let done = false; m.el.addEventListener("close", () => resolve(done));
    $("#bkNo", m.el).onclick = () => m.close();
    $("#bkYes", m.el).onclick = async () => { try { await st.blockUser(ctx.S.user, uid, name); done = true; m.close(); toast(`${name} is blocked.`); } catch (x) { toast(friendlyErr(x)); } };
  });
}

// ---------- saving a file that was sent in a chat ----------
// Files live inside the message as data URLs. Browsers and the desktop app save them with a download link; phone apps
// (Android and iOS web views) ignore download links, so there the phone's share sheet is used when it exists.
const toBlob = (url) => { const [h, b = ""] = String(url).split(","), mime = (h.match(/data:([^;]+)/) || [])[1] || "application/octet-stream"; const bin = /;base64/.test(h) ? atob(b) : decodeURIComponent(b), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); return new Blob([u8], { type: mime }); };
export async function saveFile(dataUrl, name = "file") {
  let blob; try { blob = toBlob(dataUrl); } catch { return toast("That file couldn’t be opened."); }
  const native = !!window.Capacitor?.isNativePlatform?.();
  try { const f = new File([blob], name, { type: blob.type }); if (native && navigator.canShare?.({ files: [f] })) { await navigator.share({ files: [f], title: name }); return; } } catch (e) { if (e?.name === "AbortError") return; }
  const a = document.createElement("a"), href = URL.createObjectURL(blob); a.href = href; a.download = name; a.rel = "noopener"; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(href), 8000);
  if (native) toast("If the file doesn’t open, sign in on faxton-rentals.web.app in your phone’s browser to save it.");
}
