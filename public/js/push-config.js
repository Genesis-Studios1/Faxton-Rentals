// Public runtime configuration. The VAPID key is a public Firebase Web Push key, never a private credential.
// Keep these empty until the backend push routes are deployed and Firebase Web Push is configured.
export const PUSH_CONFIG = Object.freeze({
  apiBaseUrl: "",
  vapidKey: ""
});
