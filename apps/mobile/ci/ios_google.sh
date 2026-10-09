#!/usr/bin/env bash
# iPhone Google sign-in helper for the release workflow (macOS runner, run from apps/mobile).
#
#   ios_google.sh detect   pick or build GoogleService-Info.plist -> $RUNNER_TEMP/GoogleService-Info.plist, sets IOS_GOOGLE=yes|no
#   ios_google.sh enable   (only when IOS_GOOGLE=yes) Podfile subspec "Google" + URL scheme in Info.plist
#
# Firebase's iOS SDK refuses to start without a GoogleService-Info.plist, and the Capacitor Firebase plugin starts it on launch, so the app
# would crash on open. When the owner has not added a real plist (one that contains CLIENT_ID and REVERSED_CLIENT_ID, created by registering an
# iOS app in the Firebase console), a minimal plist is generated so the app opens and Google sign-in is switched off with a clear message.
set -euo pipefail
TMP="${RUNNER_TEMP:-/tmp}"
PLIST="$TMP/GoogleService-Info.plist"
PB=/usr/libexec/PlistBuddy
BUNDLE="com.faxton.rentals"

pb_get() { "$PB" -c "Print :$2" "$1" 2>/dev/null || true; }

case "${1:-}" in
detect)
  SRC=""
  if [ -f GoogleService-Info.plist ]; then cp GoogleService-Info.plist "$PLIST"; SRC="apps/mobile/GoogleService-Info.plist"
  elif [ -n "${IOS_PLIST_B64:-}" ]; then echo "$IOS_PLIST_B64" | base64 -d > "$PLIST"; SRC="secret IOS_GOOGLE_SERVICE_INFO_BASE64"
  fi
  GOOGLE=no
  if [ -n "$SRC" ]; then
    if [ -n "$(pb_get "$PLIST" CLIENT_ID)" ] && [ -n "$(pb_get "$PLIST" REVERSED_CLIENT_ID)" ] && [ "$(pb_get "$PLIST" BUNDLE_ID)" = "$BUNDLE" ]; then
      GOOGLE=yes
    else
      echo "::warning::$SRC is missing CLIENT_ID / REVERSED_CLIENT_ID or its BUNDLE_ID is not $BUNDLE. Download it again from Firebase > Project settings > your iOS app ($BUNDLE)."
    fi
  fi
  if [ "$GOOGLE" = no ]; then
    # Minimal plist so FirebaseApp.configure() does not crash. Values come from the Android google-services.json of the same project.
    rm -f "$PLIST"
    read -r KEY SENDER PROJECT BUCKET < <(node -e '
      const j = require("./google-services.json"), c = j.client[0];
      console.log(c.api_key[0].current_key, j.project_info.project_number, j.project_info.project_id, j.project_info.storage_bucket);')
    "$PB" -c "Add :API_KEY string $KEY" -c "Add :GCM_SENDER_ID string $SENDER" -c "Add :BUNDLE_ID string $BUNDLE" \
      -c "Add :PROJECT_ID string $PROJECT" -c "Add :STORAGE_BUCKET string $BUCKET" \
      -c "Add :GOOGLE_APP_ID string 1:$SENDER:ios:0000000000000000" "$PLIST" >/dev/null
    echo "::warning::iPhone: no valid GoogleService-Info.plist, so Google sign-in is disabled in the iPhone app (email sign-in works). See apps/mobile/ANDROID-GOOGLE-SIGNIN.md, section iPhone."
  fi
  echo "IOS_GOOGLE=$GOOGLE" >> "${GITHUB_ENV:-/dev/null}"
  echo "iPhone Google sign-in: $GOOGLE"
  ;;
enable)
  REVERSED="$(pb_get "$PLIST" REVERSED_CLIENT_ID)"
  [ -n "$REVERSED" ] || { echo "::error::REVERSED_CLIENT_ID missing"; exit 1; }
  # CocoaPods subspec that compiles the plugin with Google Sign-In (the plugin's default subspec leaves it out)
  python3 - <<'PY'
import re, pathlib
p = pathlib.Path("ios/App/Podfile")
s = p.read_text()
line = "  pod 'CapacitorFirebaseAuthentication/Google', :path => '../../node_modules/@capacitor-firebase/authentication'"
assert "CapacitorFirebaseAuthentication/Google" not in s
t, n = re.subn(r"^(\s*)capacitor_pods\s*$", lambda m: m.group(0) + "\n" + line, s, count=1, flags=re.M)
assert n == 1, "Podfile has no 'capacitor_pods' call inside target 'App'"
p.write_text(t)
PY
  # URL scheme Google redirects back to
  I=ios/App/App/Info.plist
  "$PB" -c "Add :CFBundleURLTypes array" "$I" 2>/dev/null || true
  N=$("$PB" -c "Print :CFBundleURLTypes" "$I" | grep -c '^    Dict {' || true)
  "$PB" -c "Add :CFBundleURLTypes:$N dict" -c "Add :CFBundleURLTypes:$N:CFBundleURLSchemes array" -c "Add :CFBundleURLTypes:$N:CFBundleURLSchemes:0 string $REVERSED" "$I"
  echo "iPhone Google sign-in enabled (URL scheme $REVERSED)"
  ;;
*) echo "usage: $0 detect|enable"; exit 2 ;;
esac
