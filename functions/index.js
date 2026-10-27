const crypto = require("node:crypto");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { logger } = require("firebase-functions");

initializeApp();
const db = getFirestore();

const CODE_PEPPER = defineSecret("UNLOCK_CODE_PEPPER");
const RESEND_API_KEY = defineSecret("RESEND_API_KEY");
const UNLOCK_FROM_EMAIL = defineSecret("UNLOCK_FROM_EMAIL");
const TWILIO_ACCOUNT_SID = defineSecret("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = defineSecret("TWILIO_AUTH_TOKEN");
const TWILIO_FROM_NUMBER = defineSecret("TWILIO_FROM_NUMBER");

const REGION = "us-central1";
const CODE_TTL_MS = 5 * 60 * 1000;
const SEND_COOLDOWN_MS = 60 * 1000;
const SEND_WINDOW_MS = 60 * 60 * 1000;
const SEND_WINDOW_LIMIT = 5;
const VERIFY_ATTEMPT_LIMIT = 5;

function requireAuth(request) {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Sign in again to use account recovery.");
  return request.auth.uid;
}
function codeHash(uid, code) {
  return crypto.createHmac("sha256", CODE_PEPPER.value()).update(uid + ":" + code).digest("hex");
}
function safeEqualHex(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== 64 || b.length !== 64) return false;
  return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}
function maskEmail(email) {
  const at = String(email || "").lastIndexOf("@");
  if (at < 1) return "your verified email";
  const name = email.slice(0, at), domain = email.slice(at + 1);
  return (name.slice(0, 1) || "*") + "•••@" + domain;
}
function maskPhone(phone) {
  const p = String(phone || "");
  return p.length > 4 ? "••••••" + p.slice(-4) : "your verified phone";
}
async function sendEmailCode(to, code) {
  const apiKey = RESEND_API_KEY.value(), from = UNLOCK_FROM_EMAIL.value();
  if (!apiKey || !from) throw new Error("Email delivery isn't configured.");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "Your Faxton Rentals recovery code",
      text: "Your Faxton Rentals recovery code is " + code + ". It expires in 5 minutes. If you did not request it, ignore this email.",
      html: '<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;color:#12382b"><h2>Faxton Rentals</h2><p>Use this one-time code to unlock your app:</p><p style="font-size:30px;letter-spacing:8px;font-weight:700">' + code + '</p><p>This code expires in 5 minutes and can only be used once. If you did not request it, ignore this email.</p></div>'
    })
  });
  if (!response.ok) throw new Error("Email provider returned HTTP " + response.status);
}
async function sendSmsCode(to, code) {
  const sid = TWILIO_ACCOUNT_SID.value(), token = TWILIO_AUTH_TOKEN.value(), from = TWILIO_FROM_NUMBER.value();
  if (!sid || !token || !from) throw new Error("SMS delivery isn't configured.");
  const params = new URLSearchParams({
    From: from,
    To: to,
    Body: "Faxton Rentals recovery code: " + code + ". Expires in 5 minutes. Do not share this code."
  });
  const authHeader = "Basic " + Buffer.from(sid + ":" + token).toString("base64");
  const response = await fetch("https://api.twilio.com/2010-04-01/Accounts/" + encodeURIComponent(sid) + "/Messages.json", {
    method: "POST",
    headers: { Authorization: authHeader, "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString()
  });
  if (!response.ok) throw new Error("SMS provider returned HTTP " + response.status);
}

exports.sendUnlockCode = onCall({
  region: REGION,
  timeoutSeconds: 20,
  maxInstances: 10,
  secrets: [CODE_PEPPER, RESEND_API_KEY, UNLOCK_FROM_EMAIL, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER]
}, async (request) => {
  const uid = requireAuth(request);
  const channel = request.data?.channel;
  if (channel !== "email" && channel !== "phone") throw new HttpsError("invalid-argument", "Choose email or SMS.");
  if (!CODE_PEPPER.value()) throw new HttpsError("failed-precondition", "Account recovery is not configured yet.");

  // Always use the contact methods recorded by Firebase Authentication, never an editable profile field.
  const account = await getAuth().getUser(uid);
  let destination = "";
  if (channel === "email") {
    if (!account.email || account.emailVerified !== true) throw new HttpsError("failed-precondition", "This account needs a verified email address before email recovery can be used.");
    destination = account.email;
  } else {
    if (!account.phoneNumber) throw new HttpsError("failed-precondition", "This account has no phone number verified by Firebase Authentication.");
    destination = account.phoneNumber;
  }

  const now = Date.now();
  const rateRef = db.collection("unlockCodeState").doc(uid);
  const limitResult = await db.runTransaction(async (tx) => {
    const snap = await tx.get(rateRef);
    const old = snap.exists ? snap.data() : {};
    if (Number.isFinite(old.lastSentAt) && now - old.lastSentAt < SEND_COOLDOWN_MS) return "cooldown";
    let windowStart = Number.isFinite(old.windowStart) ? old.windowStart : now;
    let count = Number.isFinite(old.windowCount) ? old.windowCount : 0;
    if (now - windowStart >= SEND_WINDOW_MS || now < windowStart) { windowStart = now; count = 0; }
    if (count >= SEND_WINDOW_LIMIT) return "limit";
    tx.set(rateRef, { lastSentAt: now, windowStart, windowCount: count + 1 }, { merge: true });
    return "ok";
  });
  if (limitResult === "cooldown") throw new HttpsError("resource-exhausted", "Wait 60 seconds before requesting another code.");
  if (limitResult === "limit") throw new HttpsError("resource-exhausted", "Too many codes were requested. Try again in about an hour.");

  const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
  const codeRef = db.collection("unlockCodes").doc(uid);
  await codeRef.set({ codeHash: codeHash(uid, code), channel, createdAt: now, expiresAt: now + CODE_TTL_MS, attempts: 0 });
  try {
    if (channel === "email") await sendEmailCode(destination, code);
    else await sendSmsCode(destination, code);
  } catch (error) {
    await codeRef.delete().catch(() => {});
    logger.error("Unlock-code delivery failed", { channel, providerStatus: error?.status || error?.code || "unknown" });
    throw new HttpsError("unavailable", "We couldn't send the code. Use the other recovery option or sign out and sign in again.");
  }

  return { sent: true, channel, destination: channel === "email" ? maskEmail(destination) : maskPhone(destination), expiresInSeconds: CODE_TTL_MS / 1000 };
});

exports.verifyUnlockCode = onCall({
  region: REGION,
  timeoutSeconds: 10,
  maxInstances: 10,
  secrets: [CODE_PEPPER]
}, async (request) => {
  const uid = requireAuth(request);
  const entered = String(request.data?.code || "");
  if (!/^\d{6}$/.test(entered)) throw new HttpsError("invalid-argument", "Enter the six-digit code.");
  if (!CODE_PEPPER.value()) throw new HttpsError("failed-precondition", "Account recovery is not configured yet.");

  const ref = db.collection("unlockCodes").doc(uid);
  const now = Date.now();
  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return "missing";
    const item = snap.data();
    if (!Number.isFinite(item.expiresAt) || now >= item.expiresAt) { tx.delete(ref); return "expired"; }
    if (!Number.isFinite(item.attempts) || item.attempts >= VERIFY_ATTEMPT_LIMIT) { tx.delete(ref); return "locked"; }
    const matched = safeEqualHex(item.codeHash, codeHash(uid, entered));
    if (!matched) {
      const tries = item.attempts + 1;
      if (tries >= VERIFY_ATTEMPT_LIMIT) tx.delete(ref);
      else tx.update(ref, { attempts: tries });
      return tries >= VERIFY_ATTEMPT_LIMIT ? "locked" : "wrong";
    }
    tx.delete(ref);
    tx.set(db.collection("unlockCodeState").doc(uid), { lastSuccessAt: now }, { merge: true });
    return "ok";
  });
  if (result === "expired") throw new HttpsError("deadline-exceeded", "That code has expired. Request a new one.");
  if (result === "locked") throw new HttpsError("resource-exhausted", "Too many incorrect attempts. Request a new code.");
  if (result === "missing") throw new HttpsError("failed-precondition", "Request a code first.");
  if (result === "wrong") throw new HttpsError("permission-denied", "That code is not correct.");
  return { verified: true };
});
