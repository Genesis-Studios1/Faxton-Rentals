# Android signing keys

## Security incident: previous sideload key is compromised

The former repository included `apps/mobile/signing/faxton-android.jks` and its password in public Git history. Treat that signing key as compromised and do not use it for new releases.

The old certificate fingerprints are not passwords, but the private signing key itself must no longer be trusted. Removing the file from the latest commit does not remove it from earlier Git commits; repository history must be rewritten and old clones/tags cleaned up after coordinating with collaborators.

## Create a replacement key

Run this locally on a trusted computer. Do not upload the resulting file to GitHub as a repository file.

```sh
keytool -genkeypair -v -keystore faxton-release.jks -alias faxton-release -keyalg RSA -keysize 3072 -validity 10000
```

Create the base64 value:

- macOS/Linux: `base64 < faxton-release.jks | tr -d '\n'`
- Windows PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("faxton-release.jks"))`

In GitHub, open **Settings → Secrets and variables → Actions** and add:

- `ANDROID_KEYSTORE_BASE64` — base64 keystore content
- `ANDROID_KEYSTORE_PASSWORD` — store password
- `ANDROID_KEY_ALIAS` — `faxton-release`
- `ANDROID_KEY_PASSWORD` — key password

The release workflow now refuses to build Android artifacts if these secrets are missing.

## Firebase Google sign-in

A replacement signing certificate has a different SHA-1 and SHA-256. After creating the key, obtain its fingerprints:

```sh
keytool -list -v -keystore faxton-release.jks -alias faxton-release
```

Add the new SHA-1 and SHA-256 under Firebase Console → Project settings → Your apps → Android → SHA certificate fingerprints, then download an updated `google-services.json` if Firebase requests it.

## Existing sideloaded installations

Android normally refuses an in-place update when the signing certificate changes. Users with builds signed by the compromised key may need to uninstall that build and install a newly signed release. Back up any local-only data first.

If Google Play App Signing is enabled, distinguish the Play app-signing key from the upload key. Replacing an upload key is a separate Play Console procedure; do not replace the Play app-signing key based only on this sideload-key incident.
