# Google sign-in in the Android app: what was wrong and what you must do

## Why it did not work

1. **Google did not know your app.** Android's native Google sign-in only works when the Google project contains an *Android OAuth client* for the
   package name `com.faxton.rentals` **and** the SHA-1 fingerprint of the key that signed the APK. Your `google-services.json` lists only the
   web client (`client_type 3`), so Google answered "No credentials available" (or error 10 / 28444, "Developer console is not set up correctly").
2. **The signing key changed on every build.** With no signing secrets, the build made a brand-new random debug key on every run, so the
   SHA-1 was different each time and could never be registered. This is fixed: every build now uses one fixed key (below).
3. The rest was checked and is correct: the Google libraries are switched on (`rgcfaIncludeGoogle`), the web client id
   `426381186757-t53dbg3io0h01d0rbpuo5g93qcl74f6r.apps.googleusercontent.com` reaches the app through the google-services Gradle plugin (the build now
   fails if it does not), and Capacitor registers the plugin automatically. The WebView can no longer be sent to accounts.google.com
   (Google blocks that with `403 disallowed_useragent`); inside the app the web pop-up is never used.
4. Error messages were raw plugin text. They are now precise, carry a short support code, and point the person to email sign-in.

## Signing key security update

The sideload signing key previously documented here was committed to public Git history together with its password. It is compromised and must not be used for new builds. The current release workflow now requires a replacement keystore supplied through GitHub Actions Secrets; it no longer falls back to a repository file.

Create a replacement key and configure the four secrets described in [signing/README.md](signing/README.md). Then read its SHA-1 and SHA-256 with `keytool -list -v`, register those new fingerprints in Firebase, and refresh `google-services.json` if required. Do not reuse the old certificate fingerprints as proof of the replacement key.

Existing APKs signed with the old sideload certificate will not accept in-place updates signed with the new certificate. Users may need to uninstall the old sideload build and install the new one. This does not mean the Google Play app-signing key should be changed; check Play Console first.

## Steps you must do (about 15 minutes)

Before building, generate a replacement keystore and configure `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` and `ANDROID_KEY_PASSWORD` as GitHub Actions Secrets. Follow [signing/README.md](signing/README.md). The release workflow now fails closed if any required signing secret is missing.

1. **Firebase console** > open project **faxton-rentals** > the gear icon > **Project settings** > **General** > scroll to **Your apps** > the
   **Android** app `com.faxton.rentals` > **SHA certificate fingerprints** > **Add fingerprint**. Paste the **SHA-1** above, save, then **Add
   fingerprint** again and paste the **SHA-256**. (If there is no Android app, click **Add app** > Android, package name `com.faxton.rentals`.)
2. **Firebase console** > **Authentication** > **Sign-in method** > **Google**: make sure it is **Enabled** and a **Project support email** is chosen.
3. **Google Cloud console** (console.cloud.google.com, same project) > **APIs & Services** > **OAuth consent screen** (newer UI: **Google Auth
   Platform** > **Audience**). Set **Publishing status** to **In production** (click **Publish app**). If it says *Testing*, only the test users you list
   can sign in and everyone else gets an error. User type **External**. Fill in app name, support email, developer contact email. Add a custom
   domain under **Authorised domains** only if you use one; `firebaseapp.com` is already covered. Google/email/profile need no review.
4. **Check the Android client exists**: Google Cloud > **APIs & Services** > **Credentials**. After step 1 you should see "Android client for
   com.faxton.rentals (auto created by Google Service)" with your SHA-1. It can take a few minutes to appear.
5. **Download the new `google-services.json`**: Firebase > Project settings > Your apps > Android app > **google-services.json**. Open it:
   it must now contain an `oauth_client` entry with `client_type: 1` whose `certificate_hash` matches the replacement keystore SHA-1 (lowercase, without colons).
   Replace `apps/mobile/google-services.json` in the repository with it and commit.
6. **Build**: GitHub > **Actions** > **Build and release apps** > **Run workflow**, version for example `1.0.1`. Open the **android** job > **Summary**:
   the table must say *Android OAuth client with this SHA-1 in google-services.json: **yes***. If it says *no*, repeat steps 1 and 5.
7. **Install**: on the phone **uninstall the old Faxton Rentals first** (the old APKs were signed with random keys, Android refuses to update them),
   then install `Faxton-Rentals-Android.apk` from the Release. Builds signed with the compromised old sideload key may need to be uninstalled first. The phone needs a Google account (Settings > Accounts) and an up-to-date Google Play services.
8. **Test** Sign in with Google. If something fails the message ends with a code; see the table below.

### Optional, for the Play Store

9. If publishing through Google Play, use a protected upload key in the same four GitHub Actions Secrets. With Play App Signing, copy the **App signing key** SHA-1 and SHA-256 from Play Console > Setup > App signing into Firebase as well, then refresh `google-services.json` and rebuild. Do not confuse the upload key with the Play app-signing key.

### Optional, so links to faxton-rentals.web.app open in the app

10. The app already declares the https link. To make Android open it without asking, host
    `https://faxton-rentals.web.app/.well-known/assetlinks.json` with this content (use the SHA-256 of whichever key signs the app, with Play App
    Signing that is the Play one). Firebase Hosting currently ignores dot-folders (`"**/.*"` in firebase.json), so that rule has to be narrowed first.
    ```json
    [{"relation":["delegate_permission/common.handle_all_urls"],"target":{"namespace":"android_app","package_name":"com.faxton.rentals","sha256_cert_fingerprints":["REPLACE_WITH_NEW_SIGNING_CERTIFICATE_SHA256"]}}]
    ```

### iPhone (separate; email sign-in works today)

11. The iPhone app needs its own Google client. Firebase > Project settings > **Add app** > iOS, bundle id `com.faxton.rentals`, download
    `GoogleService-Info.plist`. Commit it as `apps/mobile/GoogleService-Info.plist` (or store `base64 -i GoogleService-Info.plist` in the secret
    `IOS_GOOGLE_SERVICE_INFO_BASE64`). The workflow then adds the Google pod and the URL scheme (`REVERSED_CLIENT_ID`) automatically. Without that file the
    workflow builds an app that opens normally (before this change the Firebase iOS SDK would crash it on launch) and shows "Google sign-in isn't
    available in the iPhone app yet" with an email fallback.

## Codes shown to people (and what they mean)

| Code | Meaning | Fix |
|---|---|---|
| G-DEV/10 or G-DEV/28444 | Google does not recognise this app build | Steps 1, 5, 6, 7. Compare the APK's SHA-1 with Firebase. |
| G-NOCRED | No Google account on the phone, or Play services too old | Add a Google account, update Play services. If an account exists, treat like G-DEV. |
| G-NET | Phone cannot reach Google | Check internet. |
| G-FAIL/12500 | Google refused (often consent screen not complete) | Step 3. |
| G-AUD | Token is for a different OAuth client | `google-services.json` from another project; redo step 5. |
| G-PLAY | Google Play services missing/outdated | Update from Play Store. |
| G-PLUGIN, G-TOKEN | App build is missing the sign-in plugin / Google sent nothing | Rebuild and reinstall. |
| G-IOS | iPhone build without GoogleService-Info.plist | Step 11. |

To read the raw error on a phone: connect it, enable USB debugging, run `adb logcat | grep -i -E "FirebaseAuthentication|Credential"`.
