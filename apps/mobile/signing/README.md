# Android signing key for sideloaded builds

`faxton-android.jks` is the key that signs every Android build made by `.github/workflows/release-apps.yml` **when you have not added your own
key** (the `ANDROID_KEYSTORE_*` repository secrets). It is committed on purpose so that the app's signing certificate never changes between
builds. Google only trusts "Sign in with Google" for a certificate fingerprint (SHA-1) that is registered in Firebase, so the fingerprint must be
the same every time.

| | |
|---|---|
| File | `apps/mobile/signing/faxton-android.jks` (PKCS12) |
| Alias | `faxton` |
| Store and key password | `faxton-sideload` |
| Package name | `com.faxton.rentals` |
| SHA-1 | `10:47:AB:78:A5:1F:8E:EE:B0:1B:43:9F:89:92:34:64:59:C5:08:D2` |
| SHA-256 | `0C:72:5F:9B:46:66:ED:B9:52:D7:AA:A9:EF:CB:07:7E:DF:F8:9F:A3:7E:7B:B4:8A:5D:11:DC:52:5A:97:D6:3A` |
| Valid until | 2056 |

The password is **not a secret** and the key is **not a Play Store key**. Anyone who can read this repository can sign an APK with it, so keep the
repository private, and do not publish to Google Play with it.

## Google Play

Create a separate upload key and store it as repository secrets; the workflow then uses it instead of this file:

```
keytool -genkeypair -v -keystore upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 upload.jks     # paste into the secret ANDROID_KEYSTORE_BASE64
```

Secrets: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`. With Play App Signing, Google
re-signs the app for users; copy the **App signing key** SHA-1 from Play Console > Setup > App signing into Firebase as well, because that is the
certificate users' phones will see.

## Replacing this key

Don't, once people have installed an APK signed with it: Android refuses to update an app signed with a different key (users would have to
uninstall first), and the new SHA-1 would have to be registered in Firebase again.
