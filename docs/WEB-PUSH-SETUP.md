# Web push notifications

This change adds the browser/PWA side of Firebase Cloud Messaging. It is deliberately disabled until the backend is deployed and the public web-push configuration is filled in.

## Enable web/PWA push

1. In Firebase Console, open **Project settings → Cloud Messaging → Web configuration** and create/retrieve the Web Push certificate key pair. The public VAPID key is safe to expose in browser code; never put a service-account private key here.
2. Once the Faxton backend push-device routes are deployed, edit `public/js/push-config.js`:
   - `apiBaseUrl`: the HTTPS origin of the deployed Faxton API, without a trailing path (for example, the Render service origin).
   - `vapidKey`: the public Web Push certificate key from Firebase.
3. Add the API origin to the app's Content Security Policy `connect-src` in `firebase.json`.
4. Set the exact web-app origins in the backend's `CORS_ORIGINS`. Do not use a wildcard.
5. On the backend runtime, configure `FCM_DEVICE_TOKEN_ENCRYPTION_KEY` as a base64-encoded, randomly generated 32-byte key. Keep it in Render's secret environment settings; do not commit it or paste it into chat. Firebase Admin must also have Application Default Credentials for the same Firebase project.
6. Deploy the backend migrations and API only after the backend PR stack has been reviewed and explicitly approved for deployment. The delivery worker also needs a scheduled Render job running `npm run push:worker`; it is intentionally not started by the API server.
7. Build and deploy the web app, then test permission grant, device registration, a server-created notification, background delivery, notification click-through, logout cleanup, and denied-permission behaviour.

## Current behaviour and boundaries

- Browser/PWA push is opt-in. The app requests permission from its existing notification prompt and registers only when permission is granted and both config values are present.
- Firebase ID tokens authenticate device registration and removal. Device tokens are sent only to the backend over HTTPS; the backend encrypts them at rest.
- The browser stores only a random client device ID and the backend's device-record ID, not the FCM token.
- Foreground messages dispatch a `faxton:push-message` event; background messages use the generic notification supplied by the backend.
- Push payloads do not include message text or sensitive rental details.
- Registration is skipped inside the Capacitor native shell. Android and iOS require a native Firebase Messaging bridge and separate platform testing; this web integration does not claim native push support.
- If the API is offline during logout, server-side device removal can be deferred. The client never blocks sign-out on a push cleanup failure.
- No push token, VAPID key, service-account credential, encryption key, or production API origin is committed in this change.
