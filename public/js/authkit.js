// Shared bits for the sign-up / log-in / forgot-password / verification screens:
// human error messages (never raw codes), the password strength meter and the form-field markup.
import { esc, icon, friendlyErr } from "./ui.js";

export const GOOGLE = `<svg class="gicon" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.500c3.500 0 6.600 1.200 9.100 3.600l6.800-6.800C35.800 2.400 30.300 0 24 0 14.600 0 6.500 5.400 2.600 13.200l7.900 6.100C12.400 13.600 17.700 9.500 24 9.500z"/><path fill="#4285F4" d="M46.500 24.500c0-1.600-.1-3.100-.4-4.500H24v9h12.700c-.6 3-2.300 5.500-4.800 7.200l7.500 5.800c4.400-4.100 7.100-10.100 7.100-17.500z"/><path fill="#FBBC05" d="M10.500 28.700A14.500 14.500 0 019.500 24c0-1.600.3-3.200.8-4.700l-7.900-6.100A24 24 0 000 24c0 3.900.9 7.500 2.600 10.800l7.900-6.100z"/><path fill="#34A853" d="M24 48c6.500 0 11.900-2.100 15.900-5.800l-7.500-5.800c-2.100 1.400-4.800 2.300-8.400 2.300-6.300 0-11.600-4.100-13.500-9.800l-7.900 6.100C6.500 42.600 14.600 48 24 48z"/></svg>`;

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;

// ---------- error messages ----------
// Firebase hides whether an email has an account (on purpose), so a wrong password and a missing account read the same.
const CREDS = "That email and password don’t match. Check them and try again, or reset your password. New here? Create an account.";
const NET = "We couldn’t connect. Check your internet and try again.";
const CANCEL = "Sign-in was cancelled. Try again whenever you’re ready.";
const MAP = {
  "auth/invalid-credential": CREDS, "auth/invalid-login-credentials": CREDS, "auth/wrong-password": CREDS, "auth/user-not-found": CREDS, "app/no-account": CREDS,
  "auth/invalid-email": "That email address doesn’t look right. Check it and try again.",
  "auth/email-already-in-use": ["There’s already an account with that email. Sign in instead, or reset your password if you’ve forgotten it.", { label: "Sign in instead", href: "#/login" }],
  "auth/weak-password": "That password is too easy to guess. Use at least 8 characters.",
  "auth/too-many-requests": "Too many attempts for now. For your security, wait a few minutes and try again, or reset your password.",
  "auth/network-request-failed": NET, "unavailable": NET, "network": NET,
  "auth/popup-closed-by-user": CANCEL, "auth/cancelled-popup-request": CANCEL, "google/cancelled": CANCEL,
  "auth/popup-blocked": "Your browser blocked the Google window. Allow pop-ups for this site and try again.",
  "auth/operation-not-allowed": "That way of signing in isn’t available yet. Please use your email and password.",
  "auth/unauthorized-domain": "Google sign-in isn’t available from this web address. Please use your email and password instead.",
  "auth/user-disabled": "This account has been switched off. Please contact support if you think that’s a mistake.",
  "app/banned": "This account has been banned. If you think that’s a mistake, please contact support.",
  "auth/account-exists-with-different-credential": "An account with this email already exists. Sign in with your email and password instead.",
  "auth/requires-recent-login": "For your security, please sign in again and then retry.",
  "permission-denied": "We couldn’t save your account details. Please try again in a moment.",
};
// Returns { msg, act?, tech? }. tech is a short reference for support staff only (shown folded away), never the headline.
export function authErr(e) {
  const code = String(e?.code || "").replace("firestore/", "");
  const m = MAP[code];
  if (m) return Array.isArray(m) ? { msg: m[0], act: m[1] } : { msg: m, tech: e?.gcode };
  if (/^(network-request-failed|network)\b/.test(code)) return { msg: NET, tech: code || undefined };
  if (/^(google|app)\//.test(code)) { const t = friendlyErr(e).replace(/\s*\((?:code )?[^)]*\)\s*$/, "").replace(/email and password below/g, "email and password above"); return { msg: t, tech: e?.gcode }; }
  if (e?.message === "Failed to fetch" || (typeof navigator !== "undefined" && navigator.onLine === false)) return { msg: NET };
  return { msg: "We couldn’t finish that just now. Please try again in a moment.", tech: String(code || e?.message || "").slice(0, 120) || undefined };
}
export const errText = (e) => authErr(e).msg;

// ---------- password strength ----------
const COMMON = ["password", "password1", "passw0rd", "12345678", "123456789", "1234567890", "qwertyui", "qwerty123", "iloveyou", "11111111", "00000000", "abcd1234", "admin123", "welcome1", "faxton123", "lagos1234", "nigeria123", "asdfghjk"];
export function strength(pw, who = {}) {
  const len = pw.length, num = /\d/.test(pw), sym = /[^A-Za-z0-9\s]/.test(pw), mix = /[a-z]/.test(pw) && /[A-Z]/.test(pw);
  const checks = { len: len >= 8, num: num || sym, mix };
  if (!len) return { score: 0, label: "", checks };
  if (len < 8) return { score: 1, label: "Too short", checks };
  const low = pw.toLowerCase(), local = String(who.email || "").split("@")[0].toLowerCase();
  if (COMMON.includes(low) || /^(.)\1+$/.test(pw) || (local.length >= 4 && low.includes(local)) || /^(0123|1234|abcd|qwer)/.test(low) && len < 12) return { score: 1, label: "Too easy to guess", checks, weak: true };
  let s = 2; if ((num || sym) && mix) s = 3; else if ((num ? 1 : 0) + (sym ? 1 : 0) + (mix ? 1 : 0) >= 1 && len >= 10) s = 3; if (s === 3 && len >= 12 && (sym || (num && mix))) s = 4;
  return { score: s, label: ["", "Too short", "Okay", "Good", "Strong"][s], checks };
}

// ---------- form field markup ----------
// A labelled field with an icon, optional right-hand button and its own inline error line. Ids stay stable (name = id).
export function fieldHtml(id, label, { ic = "", type = "text", ph = "", hint = "", req = true, attrs = "", eye = false, cls = "" } = {}) {
  const d = [hint ? `${id}-h` : "", `${id}-e`].filter(Boolean).join(" ");
  return `<div class="au-f ${cls}" data-f="${id}"><label for="${id}">${label}${req ? "" : ` <span class="au-opt">(optional)</span>`}</label>
    <div class="au-in ${ic ? "has-ic" : ""}">${ic ? icon(ic, 20, 1.6) : ""}<input id="${id}" name="${id}" type="${type}" placeholder="${esc(ph)}" aria-describedby="${d}" ${req ? "required" : ""} ${attrs}>${eye ? `<button type="button" class="au-eye" aria-label="Show password" aria-pressed="false" data-eye="${id}">${icon("eye", 20, 1.6)}</button>` : ""}</div>
    ${hint ? `<p class="au-h" id="${id}-h">${hint}</p>` : ""}<p class="au-fe" id="${id}-e" hidden></p></div>`;
}
// Shows or clears the inline error under a field.
export function fieldError(root, id, msg) {
  const inp = root.querySelector("#" + id), e = root.querySelector("#" + id + "-e"); if (!inp || !e) return;
  e.textContent = msg || ""; e.hidden = !msg; inp.toggleAttribute("aria-invalid", !!msg); if (!msg) inp.removeAttribute("aria-invalid");
  inp.closest(".au-f")?.classList.toggle("bad", !!msg);
}
