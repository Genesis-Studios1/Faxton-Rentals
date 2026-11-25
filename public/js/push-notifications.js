import { deleteToken, getMessaging, getToken, isSupported, onMessage } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging.js";
import { app, auth } from "./firebase.js";
import { PUSH_CONFIG } from "./push-config.js";

const DEVICE_KEY = "faxton_push_device_v1";
const DEVICE_ID_KEY = "faxton_push_client_id_v1";
let messagingReady = null;
let messageUnsubscribe = null;
let syncing = null;

const nativeShell = () => {
  try { return !!window.Capacitor?.isNativePlatform?.(); } catch { return false; }
};
const configured = () => !!(PUSH_CONFIG.apiBaseUrl && PUSH_CONFIG.vapidKey);
const read = (key) => { try { return localStorage.getItem(key) || ""; } catch { return ""; } };
const write = (key, value) => { try { value ? localStorage.setItem(key, value) : localStorage.removeItem(key); } catch {} };
const deviceId = () => {
  let id = read(DEVICE_ID_KEY);
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    id = crypto.randomUUID();
    write(DEVICE_ID_KEY, id);
  }
  return id;
};
const api = async (path, options = {}) => {
  const user = auth.currentUser;
  if (!user) throw new Error("Sign in is required.");
  const token = await user.getIdToken();
  const response = await fetch(new URL(path, PUSH_CONFIG.apiBaseUrl), {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Push service returned ${response.status}.`);
  return payload.data;
};

async function messaging() {
  if (!messagingReady) messagingReady = (async () => {
    if (!(await isSupported())) return null;
    return getMessaging(app);
  })().catch(() => null);
  return messagingReady;
}

async function serviceWorker() {
  if (!("serviceWorker" in navigator)) return null;
  return navigator.serviceWorker.register("/push/firebase-messaging-sw.js", { scope: "/push/" });
}

function listenForMessages(instance) {
  if (messageUnsubscribe) return;
  messageUnsubscribe = onMessage(instance, (payload) => {
    const title = payload.notification?.title || "Faxton Rentals";
    const body = payload.notification?.body || "You have a new notification.";
    window.dispatchEvent(new CustomEvent("faxton:push-message", { detail: { title, body } }));
    if (document.hidden && Notification.permission === "granted") {
      try { new Notification(title, { body, icon: "/assets/mark.svg", tag: "faxton-update" }); } catch {}
    }
  });
}

export async function syncPushDevice(user = auth.currentUser) {
  if (syncing) return syncing;
  syncing = (async () => {
    if (!user || auth.currentUser?.uid !== user.uid || nativeShell() || !configured()) return false;
    if (!("Notification" in window) || Notification.permission !== "granted") return false;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
    const instance = await messaging();
    if (!instance) return false;
    const registration = await serviceWorker();
    if (!registration) return false;
    const token = await getToken(instance, { vapidKey: PUSH_CONFIG.vapidKey, serviceWorkerRegistration: registration });
    if (!token) return false;
    const data = await api("/v1/me/push-devices", {
      method: "POST",
      body: JSON.stringify({ deviceId: deviceId(), platform: "web", token, appVersion: "web" })
    });
    write(DEVICE_KEY, JSON.stringify({ uid: user.uid, id: data.id }));
    listenForMessages(instance);
    return true;
  })().catch((error) => {
    console.warn("[Faxton] Push registration unavailable:", error?.message || error);
    return false;
  }).finally(() => { syncing = null; });
  return syncing;
}

export async function removePushDevice() {
  const saved = read(DEVICE_KEY);
  if (!saved) return false;
  let device;
  try { device = JSON.parse(saved); } catch { write(DEVICE_KEY, ""); return false; }
  if (!device?.id || device.uid !== auth.currentUser?.uid || !configured()) return false;
  try {
    await api(`/v1/me/push-devices/${encodeURIComponent(device.id)}`, { method: "DELETE" });
    const instance = await messaging();
    if (instance) { try { await deleteToken(instance); } catch {} }
    stopPushMessageListener();
    write(DEVICE_KEY, "");
    return true;
  } catch (error) {
    console.warn("[Faxton] Push device cleanup deferred:", error?.message || error);
    return false;
  }
}

export function stopPushMessageListener() {
  messageUnsubscribe?.();
  messageUnsubscribe = null;
}
