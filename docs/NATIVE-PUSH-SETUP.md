# Native push notifications setup

This guide covers the Android and iPhone clients. The web/PWA setup remains in [WEB-PUSH-SETUP.md](./WEB-PUSH-SETUP.md).

## Implementation

- Capacitor 7 uses `@capacitor-firebase/messaging` 7.5.x.
- The native plugin obtains Firebase Cloud Messaging (FCM) registration tokens on both Android and iOS. The API stores encrypted tokens and their SHA-256 hashes; the browser never writes raw tokens to local storage.
- Native registration is enabled only when the app build adds the `FaxtonPushReady` user-agent marker. iPhone builds without a real iOS Firebase configuration receive `FaxtonNoPush` and do not request push permissions.
- The hosted app loads the pinned plugin bridge from esm.sh. The Hosting Content-Security-Policy explicitly allows that module origin. Keep the plugin URL version-pinned and review upgrades.

## Android requirements

1. The Firebase Android app must use package ID `com.faxton.rentals`.
2. The release workflow copies `apps/mobile/google-services.json` into the generated Android project before Capacitor sync.
3. The native plugin is installed by npm and registered during `npx cap sync android`.
4. Android 13 and later ask for notification permission. Android 12 and earlier do not show the runtime permission prompt.
5. The Android release workflow adds `FaxtonPushReady` to the WebView user agent after confirming the Firebase configuration is present.

## iPhone requirements

1. Register an iOS app in the same Firebase project with bundle ID `com.faxton.rentals`.
2. Supply its genuine `GoogleService-Info.plist` using the protected GitHub Actions secret `IOS_GOOGLE_SERVICE_INFO_BASE64` or the documented repository-local configuration file. Do not use the generated placeholder for push: the build deliberately disables native push unless the real plist contains the matching bundle ID, Firebase app ID, project ID and sender ID.
3. Enable the Push Notifications capability for the iOS app in the Apple developer configuration and create a provisioning profile that includes it.
4. Create an APNs authentication key in the Apple developer account and upload it to Firebase Console > Project settings > Cloud Messaging > Apple app configuration. Keep the private key out of GitHub source and chat.
5. The iOS build patch adds the Capacitor APNs callbacks and the `aps-environment` entitlement. A provisioning profile and valid app signature are still required for actual APNs delivery. The current release workflow produces an unsigned IPA, so that file is not a ready-to-run APNs distribution build.
6. An adult who is legally able to manage the organisation's Apple developer account must handle membership, signing and provisioning where required.

## Backend configuration and rollout

Push delivery remains disabled until all of the following are completed:

1. Set `PUSH_CONFIG.apiBaseUrl` in `public/js/push-config.js` to the deployed backend API origin. Set `PUSH_CONFIG.vapidKey` as well for web/PWA push.
2. Allow the Hosting origin in backend CORS and add the API origin to the relevant CSP `connect-src` directives.
3. Configure `FCM_DEVICE_TOKEN_ENCRYPTION_KEY` as a protected Render environment variable. It must decode from base64 to exactly 32 bytes. Never commit or paste it into chat.
4. Configure Firebase Admin Application Default Credentials for the backend worker using the approved service identity.
5. Apply backend migration 018 and deploy the push-device routes and worker only after reviewing their stacked pull requests.
6. Configure a Render scheduled job to run `npm run push:worker` at a suitable interval. The worker is one-shot and is not started automatically by the API server.
7. Test registration, token refresh, logout cleanup, foreground delivery, background delivery and notification taps on real Android and iPhone devices before enabling users broadly.

## Current limitations

- The native code and build workflow are prepared in the feature branch, but no app has been released or deployed from it.
- iPhone push cannot be validated on real devices until a real iOS Firebase plist, APNs key, signing identity and matching provisioning profile are configured.
- The backend PRs for device registration and the FCM worker remain separate draft PRs. No live delivery is possible until those are reviewed, merged and deployed.
- The worker sends privacy-preserving generic notifications. It does not include private message text or property details in notification content.
