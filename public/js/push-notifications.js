import { deleteToken, getMessaging, getToken, isSupported, onMessage } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging.js";
import { app, auth } from "./firebase.js";
import { PUSH_CONFIG } from "./push-config.js";
import { API_CONFIG } from "./api-config.js";

const DEVICE_KEY = "faxton_push_device_v1";
const DEVICE_ID_KEY = "faxton_push_client_id_v1";
const NATIVE_PLUGIN_URL = "https://esm.sh/@capacitor-firebase/messaging@7.5.0?bundle&deps=@capacitor/core@7.4.3";
let messagingReady = null;
let nativeMessagingReady = null;
let messageUnsubscribe = null;
let nativeListenersReady = false;
let syncing = null;

const nativeShell = () => {
  try { return !!window.Capacitor?.isNativePlatform?.(); } catch { return false; }
};
const nativePushEnabled = () => nativeShell() && navigator.userAgent.includes("FaxtonPushReady");
const apiBaseUrl = () => { const raw = String(PUSH_CONFIG.apiBaseUrl || API_CONFIG.baseUrl || "").trim(); try { const u = new URL(raw); return u.protocol === "https:" && u.pathname === "/" && !u.search && !u.hash && !u.username && !u.password ? u.origin : ""; } catch { return ""; } };
const apiConfigured = () => !!apiBaseUrl();
const webConfigured = () => apiConfigured() && !!PUSH_CONFIG.vapidKey;
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
  const response = await fetch(new URL(path, apiBaseUrl()), {
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

async function nativeMessaging() {
  if (!nativeMessagingReady) {
    nativeMessagingReady = import(NATIVE_PLUGIN_URL)
      .then((module) => module.FirebaseMessaging)
      .catch((error) => {
        nativeMessagingReady = null;
        throw error;
      });
  }
  return nativeMessagingReady;
}

async function saveDeviceToken(user, token, platform) {
  if (!user || auth.currentUser?.uid !== user.uid || !token || !apiConfigured()) return false;
  const data = await api("/v1/me/push-devices", {
    method: "POST",
    body: JSON.stringify({ deviceId: deviceId(), platform, token, appVersion: platform === "web" ? "web" : "native" })
  });
  write(DEVICE_KEY, JSON.stringify({ uid: user.uid, id: data.id, platform }));
  return true;
}

async function listenNative(plugin) {
  if (nativeListenersReady) return;
  nativeListenersReady = true;
  try {
    await plugin.addListener("tokenReceived", ({ token }) => {
      const user = auth.currentUser;
      const platform = window.Capacitor?.getPlatform?.();
      if (user && (platform === "android" || platform === "ios")) {
        void saveDeviceToken(user, token, platform).catch((error) => console.warn("[Faxton] Push token refresh failed:", error?.message || error));
      }
    });
    await plugin.addListener("notificationReceived", (event) => {
      const notification = event?.notification || {};
      window.dispatchEvent(new CustomEvent("faxton:push-message", {
        detail: {
          title: notification.title || "Faxton Rentals",
          body: notification.body || "You have a new notification."
        }
      }));
    });
    await plugin.addListener("notificationActionPerformed", (event) => {
      window.dispatchEvent(new CustomEvent("faxton:push-action", { detail: event || {} }));
    });
  } catch (error) {
    nativeListenersReady = false;
    throw error;
  }
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

export function pushAvailable() {
  return nativeShell() ? nativePushEnabled() && apiConfigured() : webConfigured();
}

export async function requestPushPermission() {
  if (nativeShell()) {
    if (!nativePushEnabled() || !apiConfigured()) return false;
    try {
      const plugin = await nativeMessaging();
      const status = await plugin.requestPermissions();
      if (status.receive !== "granted") return false;
      await syncPushDevice(auth.currentUser);
      return true;
    } catch (error) {
      console.warn("[Faxton] Native notification permission unavailable:", error?.message || error);
      return false;
    }
  }
  if (!webConfigured() || !("Notification" in window)) return false;
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return false;
    await syncPushDevice(auth.currentUser);
    return true;
  } catch {
    return false;
  }
}

export async function syncPushDevice(user = auth.currentUser) {
  if (syncing) return syncing;
  syncing = (async () => {
    if (!user || auth.currentUser?.uid !== user.uid || !apiConfigured()) return false;

    if (nativeShell()) {
      if (!nativePushEnabled()) return false;
      const platform = window.Capacitor?.getPlatform?.();
      if (platform !== "android" && platform !== "ios") return false;
      const plugin = await nativeMessaging();
      const permission = await plugin.checkPermissions();
      if (permission.receive !== "granted") return false;
      await listenNative(plugin);
      const result = await plugin.getToken();
      return saveDeviceToken(user, result?.token, platform);
    }

    if (!webConfigured() || !("Notification" in window) || Notification.permission !== "granted") return false;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
    const instance = await messaging();
    if (!instance) return false;
    const registration = await serviceWorker();
    if (!registration) return false;
    const token = await getToken(instance, { vapidKey: PUSH_CONFIG.vapidKey, serviceWorkerRegistration: registration });
    if (!token) return false;
    const saved = await saveDeviceToken(user, token, "web");
    if (saved) listenForMessages(instance);
    return saved;
  })().catch((error) => {
    console.warn("[Faxton] Push registration unavailable:", error?.message || error);
    return false;
  }).finally(() => { syncing = null; });
  return syncing;
}

export async function removePushDevice() {
  const saved = read(DEVICE_KEY);
  let device = null;
  if (saved) {
    try { device = JSON.parse(saved); } catch { write(DEVICE_KEY, ""); }
  }
  if (device?.id && device.uid === auth.currentUser?.uid && apiConfigured()) {
    try {
      await api(`/v1/me/push-devices/${encodeURIComponent(device.id)}`, { method: "DELETE" });
    } catch (error) {
      console.warn("[Faxton] Push device cleanup deferred:", error?.message || error);
      return false;
    }
  }

  try {
    if (nativeShell() && nativePushEnabled()) {
      const plugin = await nativeMessaging();
      await plugin.deleteToken();
    } else {
      const instance = await messaging();
      if (instance) await deleteToken(instance);
    }
  } catch (error) {
    console.warn("[Faxton] Local push token cleanup deferred:", error?.message || error);
  }
  stopPushMessageListener();
  write(DEVICE_KEY, "");
  return !!device?.id;
}

export function stopPushMessageListener() {
  messageUnsubscribe?.();
  messageUnsubscribe = null;
}
