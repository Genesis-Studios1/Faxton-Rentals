// Small shared helpers for the renter flow pages (booking, apply, payments, settings, My Home, offers, legal).
// Everything here is plain DOM + strings so any page can import it without pulling in Firebase.
import { esc, icon, modal, $, friendlyErr } from "./ui.js";

// ---- support contact: one place to change it (also used by legal.js and the help page) ----
export const SUPPORT_EMAIL = "{SUPPORT_EMAIL}";
export const supportLink = () => (SUPPORT_EMAIL.startsWith("{") ? "the Help centre in the app" : SUPPORT_EMAIL);
export const supportLine = () => (SUPPORT_EMAIL.startsWith("{") ? "Questions? Open the Help centre in the app." : `Questions? Email ${SUPPORT_EMAIL}.`);

// ---- human error text: never show raw codes to renters ----
const CODE_TAIL = /\s*\((?:code\s+)?[^()]{2,140}\)\s*$/;
export const fxErr = (e) => {
  const code = String(e?.code || "").replace("firestore/", "");
  if (code === "permission-denied") return "That didn’t go through. Please sign in again and retry. If it keeps happening, tell us in the Help centre.";
  if (code === "unavailable" || code === "auth/network-request-failed" || /offline|network/i.test(String(e?.message || ""))) return "We couldn’t connect. Check your internet and try again.";
  if (code === "auth/requires-recent-login") return "For your security, please sign out and sign in again, then retry.";
  if (code === "auth/too-many-requests") return "Too many attempts. Please wait a few minutes and try again.";
  if (e?.userMessage) return e.userMessage;
  const known = friendlyErr(e);
  if (!/^Something went wrong/.test(known)) return stripCode(known);
  return "Something went wrong on our side. Please try again in a moment.";
};
// For text that already came from friendlyErr (it appends a code in brackets).
export const stripCode = (s) => String(s || "").replace(CODE_TAIL, "");

// ---- dates ----
export const tsMs = (t) => (t?.seconds ? t.seconds * 1000 : t?.toMillis ? t.toMillis() : typeof t === "number" ? t : 0);
export const fmtDay = (t) => { const m = tsMs(t); return m ? new Date(m).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "Just now"; };
export const fmtClock = (t) => { const m = tsMs(t); return m ? new Date(m).toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" }) : ""; };
export const fmtStamp = (t) => { const m = tsMs(t); return m ? `${fmtDay(t)}, ${fmtClock(t)}` : "Just now"; };
export const isoDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const longDay = (iso) => { const d = new Date(String(iso).slice(0, 10) + "T00:00:00"); return isNaN(d) ? String(iso || "") : d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }); };

// ---- extra icons the shared set does not have (same 24px outline style) ----
const X = {
  copy: '<rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H15"/>',
  print: '<path d="M7 9V4h10v5"/><rect x="4" y="9" width="16" height="8" rx="2"/><path d="M7 14h10v6H7z"/>',
  receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  star: '<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.8 6.8 19.6l1-5.8L3.5 9.7l5.9-.9z"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  bank: '<path d="m3 9 9-5 9 5"/><path d="M5 9v9M9.5 9v9M14.5 9v9M19 9v9"/><path d="M3 20h18"/>',
  xcircle: '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/>',
  calx: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M8 3v4M16 3v4M3.5 10h17M10 13.5l4 4M14 13.5l-4 4"/>',
  image: '<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="m4.5 18 5-5 3.5 3.5 2.5-2.5 4 4"/>',
};
export const xicon = (n, s = 20, sw = 1.7, cls = "") => (X[n] ? `<svg class="ic ${cls}" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${X[n]}</svg>` : icon(n, s, sw));
export const starFill = (s = 22) => `<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" aria-hidden="true">${X.star}</svg>`;

// ---- small UI helpers ----
export const pill = (label, tone = "") => `<span class="rf-pill ${tone}"><i></i>${esc(label)}</span>`;
export const toneFor = (s) => (/confirm|approv|active|paid|signed|complete|available|accepted|verified/i.test(s) ? "ok" : /reject|declin|cancel|withdr|overdue|fail/i.test(s) ? "bad" : /review|pending|submitted|requested|awaiting|due|draft|counter|need/i.test(s) ? "warn" : "info");
export const statusPill = (s) => pill(s, toneFor(s));
export const empty = ({ ic = "home", title, hint = "", action = "" }) => `<div class="rf-empty"><span class="rf-empty-ic">${xicon(ic, 28, 1.5)}</span><h3>${esc(title)}</h3>${hint ? `<p>${esc(hint)}</p>` : ""}${action}</div>`;
export const copyText = async (text, msg = "Copied.") => {
  try { await navigator.clipboard.writeText(text); } catch { const t = document.createElement("textarea"); t.value = text; t.style.cssText = "position:fixed;opacity:0"; document.body.append(t); t.select(); try { document.execCommand("copy"); } catch {} t.remove(); }
  return msg;
};

// A friendly yes/no window. Resolves true or false.
export function ask({ title, body = "", ok = "Yes", no = "Cancel", tone = "" }) {
  return new Promise((resolve) => {
    let out = false;
    const m = modal(`<div class="rf-dlg"><h2>${esc(title)}</h2>${body ? `<p class="rf-dlg-p">${body}</p>` : ""}<div class="rf-dlg-act"><button type="button" class="btn" data-no>${esc(no)}</button><button type="button" class="btn ${tone === "danger" ? "red" : "primary"}" data-ok>${esc(ok)}</button></div></div>`);
    m.el.addEventListener("close", () => resolve(out));
    $("[data-no]", m.el).onclick = () => m.close();
    $("[data-ok]", m.el).onclick = () => { out = true; m.close(); };
  });
}

// ---- images: shrink to a JPEG data URL small enough to live inside a Firestore document ----
export function shrinkImage(file, { max = 1400, bytes = 280000, square = 0 } = {}) {
  return new Promise((res, rej) => {
    if (!/^image\//.test(file.type)) return rej(Object.assign(new Error("type"), { userMessage: "Please choose a photo or screenshot (JPG, PNG or WebP)." }));
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      let w = img.naturalWidth || img.width, h = img.naturalHeight || img.height, sx = 0, sy = 0, sw = w, sh = h;
      if (square) { const s = Math.min(w, h); sx = (w - s) / 2; sy = (h - s) / 2; sw = sh = s; w = h = s; }
      const k = Math.min(1, (square || max) / Math.max(w, h)), c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
      const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      let q = 0.82, out = c.toDataURL("image/jpeg", q);
      while (out.length > bytes && q > 0.35) { q -= 0.08; out = c.toDataURL("image/jpeg", q); }
      // Still too big: scale down once more.
      if (out.length > bytes) { const c2 = document.createElement("canvas"); c2.width = Math.round(c.width * 0.7); c2.height = Math.round(c.height * 0.7); c2.getContext("2d").drawImage(c, 0, 0, c2.width, c2.height); out = c2.toDataURL("image/jpeg", 0.6); }
      out.length > bytes * 1.35 ? rej(Object.assign(new Error("big"), { userMessage: "That picture is too large to attach. Try a smaller one." })) : res(out);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(Object.assign(new Error("read"), { userMessage: "We couldn’t read that picture. Try another one." })); };
    img.src = url;
  });
}
// Read a small PDF as a data URL (limit in bytes of the original file).
export const readSmallFile = (file, limit = 280000) => new Promise((res, rej) => {
  if (file.size > limit) return rej(Object.assign(new Error("big"), { userMessage: `That file is over ${Math.round(limit / 1000)} KB. Please choose a smaller one.` }));
  const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(Object.assign(new Error("read"), { userMessage: "We couldn’t read that file." })); r.readAsDataURL(file);
});

// ---- open or download a stored data URL (browsers block top-level data: links, so go through a Blob) ----
export function dataToBlobUrl(dataUrl) {
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl || ""); if (!m) return "";
  const bin = m[2] ? atob(m[3]) : decodeURIComponent(m[3]), a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
  return URL.createObjectURL(new Blob([a], { type: m[1] || "application/octet-stream" }));
}
export function openStored(dataUrl, name = "file", download = false) {
  const url = dataToBlobUrl(dataUrl); if (!url) return false;
  const a = document.createElement("a"); a.href = url; if (download) a.download = name; else { a.target = "_blank"; a.rel = "noopener"; }
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000); return true;
}

// ---- print only a given element (used for receipts): the page shows just the dialog while printing ----
export function printDialog(dlg) {
  document.body.classList.add("fx-printing"); dlg.classList.add("fx-print-me");
  const done = () => { document.body.classList.remove("fx-printing"); dlg.classList.remove("fx-print-me"); window.removeEventListener("afterprint", done); };
  window.addEventListener("afterprint", done); setTimeout(() => { try { window.print(); } catch { done(); } }, 50); setTimeout(done, 60000);
}

// ---- money field: groups digits with commas as you type ----
export const digits = (v) => +String(v || "").replace(/\D/g, "") || 0;
export const moneyInput = (el) => { el.addEventListener("input", () => { const v = digits(el.value); el.value = v ? v.toLocaleString("en-NG") : ""; }); };
