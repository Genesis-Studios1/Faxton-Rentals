#!/usr/bin/env bash
# Signs and builds the Android app. Run from apps/mobile/android (the generated project) after ci/patch_android.py.
#
# Signing key: the ANDROID_KEYSTORE_* repository secrets when they exist (your own Play upload key), otherwise the sideload key committed at
# apps/mobile/signing/faxton-android.jks. Either way the key is the SAME on every run, so the SHA-1 printed below can be registered
# once in Firebase and "Sign in with Google" keeps working in every build.
#
# Inputs (environment): KS_B64, KS_PASS, KEY_ALIAS, KEY_PASS (optional secrets), GITHUB_WORKSPACE, RUNNER_TEMP, GITHUB_STEP_SUMMARY (all set by GitHub Actions).
set -euo pipefail

ROOT="${GITHUB_WORKSPACE:-$(cd ../../.. && pwd)}"
SUMMARY="${GITHUB_STEP_SUMMARY:-/dev/null}"
TMP="${RUNNER_TEMP:-/tmp}"
SERVICES=app/google-services.json
SIDELOAD_KS="$ROOT/apps/mobile/signing/faxton-android.jks"

# ---------------------------------------------------------------- 1. choose the key
if [ -n "${KS_B64:-}" ]; then
  echo "$KS_B64" | base64 -d > "$TMP/release.jks"
  KS_FILE="$TMP/release.jks"; KS_PASS_V="${KS_PASS:?ANDROID_KEYSTORE_PASSWORD secret is missing}"
  ALIAS="${KEY_ALIAS:?ANDROID_KEY_ALIAS secret is missing}"; KEY_PASS_V="${KEY_PASS:-$KS_PASS_V}"
  KEY_SOURCE="your own keystore (repository secrets ANDROID_KEYSTORE_*)"
else
  [ -f "$SIDELOAD_KS" ] || { echo "::error::$SIDELOAD_KS is missing from the repository"; exit 1; }
  KS_FILE="$SIDELOAD_KS"; KS_PASS_V="faxton-sideload"; ALIAS="faxton"; KEY_PASS_V="faxton-sideload"
  KEY_SOURCE="the sideload key committed at apps/mobile/signing/faxton-android.jks (stable; not a Play Store key)"
fi
export FAXTON_KS_FILE="$KS_FILE" FAXTON_KS_PASS="$KS_PASS_V" FAXTON_KEY_ALIAS="$ALIAS" FAXTON_KEY_PASS="$KEY_PASS_V"

# ---------------------------------------------------------------- 2. fingerprints of that key
KT="$(keytool -list -v -keystore "$KS_FILE" -storepass "$KS_PASS_V" -alias "$ALIAS" 2>&1)" || { echo "$KT"; echo "::error::Could not open the keystore or alias '$ALIAS'. Check the ANDROID_KEYSTORE_* secrets."; exit 1; }
SHA1="$(printf '%s\n' "$KT" | awk '/^[[:space:]]*SHA1:/{print $2; exit}')"
SHA256="$(printf '%s\n' "$KT" | awk '/^[[:space:]]*SHA256:/{print $2; exit}')"
[ -n "$SHA1" ] && [ -n "$SHA256" ] || { echo "::error::Could not read the key fingerprints"; exit 1; }
SHA1_HEX="$(printf '%s' "$SHA1" | tr -d ':' | tr 'A-Z' 'a-z')"

# ---------------------------------------------------------------- 3. what Google already knows about this app
read -r WEB_ID PKG ANDROID_HASHES < <(node -e '
const j = require("./" + process.argv[1]);
const c = (j.client || []).find((x) => x.client_info?.android_client_info?.package_name === "com.faxton.rentals") || (j.client || [])[0] || {};
const o = c.oauth_client || [];
const web = (o.find((x) => x.client_type === 3) || {}).client_id || "NONE";
const hashes = o.filter((x) => x.client_type === 1 && x.android_info?.certificate_hash).map((x) => x.android_info.certificate_hash.toLowerCase());
console.log(web, c.client_info?.android_client_info?.package_name || "NONE", hashes.join(",") || "NONE");
' "$SERVICES")
if [ "$WEB_ID" = "NONE" ]; then echo "::error::google-services.json has no web OAuth client (client_type 3). Enable Google in Firebase Authentication, then download a fresh google-services.json."; exit 1; fi
case ",$ANDROID_HASHES," in
  *",$SHA1_HEX,"*) REGISTERED=yes ;;
  *) REGISTERED=no ;;
esac

{
  echo "## Android signing key"
  echo
  echo "Signed with ${KEY_SOURCE}."
  echo
  echo "| | |"
  echo "|---|---|"
  echo "| Package name | \`$PKG\` |"
  echo "| SHA-1 | \`$SHA1\` |"
  echo "| SHA-256 | \`$SHA256\` |"
  echo "| Web client id (serverClientId) | \`$WEB_ID\` |"
  echo "| Android OAuth client with this SHA-1 in google-services.json | **$REGISTERED** |"
  echo
  if [ "$REGISTERED" = no ]; then
    echo "> **Google sign-in will not work in this APK yet.** In the Firebase console open Project settings > Your apps > Android app (\`$PKG\`) > **Add fingerprint**, paste the SHA-1 and the SHA-256 above, then download the new google-services.json, replace \`apps/mobile/google-services.json\` and run this workflow again. Full steps: apps/mobile/ANDROID-GOOGLE-SIGNIN.md"
  else
    echo "> This key is registered in google-services.json. Google sign-in is ready."
  fi
} | tee -a "$SUMMARY" | sed 's/^/  /'
[ "$REGISTERED" = yes ] || echo "::warning::Google sign-in needs the SHA-1 $SHA1 added to the Android app in Firebase (Project settings > Add fingerprint). See the job summary."

# ---------------------------------------------------------------- 4. build
chmod +x gradlew
echo "::group::Build x64 APK"
FAXTON_ABI=x86_64 ./gradlew --no-daemon assembleRelease
cp app/build/outputs/apk/release/app-release.apk "$ROOT/Faxton-Rentals-Android-x64.apk"
echo "::endgroup::"
echo "::group::Build universal APK and Play Store bundle"
./gradlew --no-daemon clean assembleRelease bundleRelease
cp app/build/outputs/apk/release/app-release.apk "$ROOT/Faxton-Rentals-Android.apk"
cp app/build/outputs/bundle/release/app-release.aab "$ROOT/Faxton-Rentals-Android.aab"
echo "::endgroup::"
[ "$KS_FILE" = "$SIDELOAD_KS" ] || rm -f "$KS_FILE"

# ---------------------------------------------------------------- 5. verify what was built
# 5a. the web client id must have been generated into the app resources (otherwise native Google sign-in has no serverClientId)
GEN=""
while IFS= read -r f; do
  if grep 'default_web_client_id' "$f" 2>/dev/null | grep -F "$WEB_ID" >/dev/null; then GEN="$f"; break; fi
done < <(find app/build -path '*google-services*' -name '*.xml' 2>/dev/null)
if [ -z "$GEN" ]; then
  echo "::error::default_web_client_id was not generated from google-services.json. The google-services Gradle plugin did not run, so Google sign-in cannot work."; exit 1
fi
echo "default_web_client_id = $WEB_ID  (generated into $GEN)"
unzip -p "$ROOT/Faxton-Rentals-Android.apk" resources.arsc > "$TMP/resources.arsc" 2>/dev/null || true
PLACEHOLDER="$( { strings -a "$TMP/resources.arsc"; strings -a -el "$TMP/resources.arsc"; } 2>/dev/null | grep -c 'WILL_BE_OVERRIDDEN' || true)"
if [ "${PLACEHOLDER:-0}" -gt 0 ] 2>/dev/null; then
  echo "::warning::The plugin placeholder client id WILL_BE_OVERRIDDEN is still present in the APK resources. Google sign-in may fail with error 10."
fi

# 5b. every file must carry the fingerprint we printed
APKSIGNER="$(find "${ANDROID_HOME:-${ANDROID_SDK_ROOT:-/nonexistent}}/build-tools" -name apksigner 2>/dev/null | sort | tail -1 || true)"
signer_sha1() {
  local f="$1" out=""
  if [ -n "$APKSIGNER" ] && [[ "$f" == *.apk ]]; then
    out="$("$APKSIGNER" verify --print-certs "$f" 2>/dev/null | awk '/certificate SHA-1 digest:/{print $NF; exit}')" || out=""
  fi
  if [ -z "$out" ]; then
    out="$(keytool -printcert -jarfile "$f" 2>/dev/null | awk '/^[[:space:]]*SHA1:/{print $2; exit}' | tr -d ':' | tr 'A-Z' 'a-z')" || out=""
  fi
  printf '%s' "$out"
}
{
  echo
  echo "## Android files"
  echo
  echo "| File | Size | Signed with SHA-1 |"
  echo "|---|---|---|"
} >> "$SUMMARY"
for f in Faxton-Rentals-Android.apk Faxton-Rentals-Android-x64.apk Faxton-Rentals-Android.aab; do
  got="$(signer_sha1 "$ROOT/$f")"
  size="$(du -h "$ROOT/$f" | cut -f1)"
  echo "$f  $size  signed with ${got:-unknown}"
  echo "| $f | $size | \`${got:-unknown}\` |" >> "$SUMMARY"
  if [ -n "$got" ] && [ "$got" != "$SHA1_HEX" ]; then echo "::error::$f is signed with $got, expected $SHA1_HEX"; exit 1; fi
  [ -n "$got" ] || echo "::warning::Could not read the signature of $f"
done
if [ -z "${KS_B64:-}" ]; then
  echo "" >> "$SUMMARY"
  echo "> The .aab in this run is signed with the sideload key, so Google Play will not accept it as an upload. For the Play Store add the ANDROID_KEYSTORE_* secrets (see apps/mobile/ANDROID-GOOGLE-SIGNIN.md)." >> "$SUMMARY"
fi
