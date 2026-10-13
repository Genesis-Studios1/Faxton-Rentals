#!/usr/bin/env python3
"""Patch the Capacitor Android project generated in CI (apps/mobile/android).

usage: patch_android.py <android_dir> <versionName> <versionCode>

Every edit is asserted, so a template change in a new Capacitor version fails the build loudly instead of shipping a half-patched app.
"""
import pathlib
import re
import shutil
import sys

android = pathlib.Path(sys.argv[1]).resolve()
version_name, version_code = sys.argv[2], sys.argv[3]
ci = pathlib.Path(__file__).resolve().parent
assert re.fullmatch(r"\d+\.\d+\.\d+", version_name), version_name
assert re.fullmatch(r"\d+", version_code), version_code


def rw(path, fn):
    p = android / path
    s = p.read_text(encoding="utf-8")
    t = fn(s)
    assert t != s, f"{path}: nothing changed (template differs from what this script expects)"
    p.write_text(t, encoding="utf-8")


def sub1(s, old, new, what):
    assert s.count(old) == 1, f"{what}: expected exactly one '{old}', found {s.count(old)}"
    return s.replace(old, new)


# 1) Google sign-in: the plugin ships the Google libraries (Credential Manager, play-services-auth, googleid) only when this flag is set.
rw("variables.gradle", lambda s: sub1(s, "ext {", "ext {\n    rgcfaIncludeGoogle = true", "variables.gradle") if "rgcfaIncludeGoogle" not in s else s + "\n")

# 2) Manifest: no backups, no clear text, permissions, https links
PERMS = [
    "android.permission.CAMERA", "android.permission.RECORD_AUDIO", "android.permission.MODIFY_AUDIO_SETTINGS",
    "android.permission.ACCESS_FINE_LOCATION", "android.permission.ACCESS_COARSE_LOCATION",
    "android.permission.ACCESS_NETWORK_STATE", "android.permission.POST_NOTIFICATIONS", "android.permission.USE_BIOMETRIC",
]
LINKS = (
    '<intent-filter android:autoVerify="true">'
    '<action android:name="android.intent.action.VIEW" />'
    '<category android:name="android.intent.category.DEFAULT" />'
    '<category android:name="android.intent.category.BROWSABLE" />'
    '<data android:scheme="https" android:host="faxton-rentals.web.app" />'
    '</intent-filter>'
)


def manifest(s):
    s = sub1(s, 'android:allowBackup="true"', 'android:allowBackup="false"', "allowBackup")
    uses = "".join(f'<uses-permission android:name="{p}" />\n    ' for p in PERMS if p not in s)
    uses += ('<uses-feature android:name="android.hardware.camera" android:required="false" />\n    '
             '<uses-feature android:name="android.hardware.microphone" android:required="false" />\n    '
             '<uses-feature android:name="android.hardware.location.gps" android:required="false" />\n    ')
    s = sub1(s, "<application", uses + '<application android:usesCleartextTraffic="false"', "<application")
    return sub1(s, "</activity>", LINKS + "\n        </activity>", "</activity>")


rw("app/src/main/AndroidManifest.xml", manifest)

# 3) Version
def gradle_version(s):
    s = sub1(s, "versionCode 1\n", f"versionCode {version_code}\n", "versionCode")
    return sub1(s, 'versionName "1.0"', f'versionName "{version_name}"', "versionName")


rw("app/build.gradle", gradle_version)

# 4) One stable signing key for every build type (see faxton-signing.gradle)
shutil.copy(ci / "faxton-signing.gradle", android / "app" / "faxton-signing.gradle")
rw("app/build.gradle", lambda s: s.rstrip("\n") + "\n\napply from: 'faxton-signing.gradle'\n")

# 5) Keep the Google sign-in and Capacitor classes if anybody turns minification on later
rules = android / "app" / "proguard-rules.pro"
extra = """
# Faxton: sign-in and bridge classes are looked up by reflection / manifest.
-keep class io.capawesome.capacitorjs.plugins.firebase.authentication.** { *; }
-keep class com.getcapacitor.** { *; }
-keep class androidx.credentials.** { *; }
-keep class com.google.android.libraries.identity.googleid.** { *; }
-keepattributes *Annotation*, Signature, InnerClasses, EnclosingMethod
"""
rules.write_text((rules.read_text(encoding="utf-8") if rules.exists() else "") + extra, encoding="utf-8")

# 6) MainActivity: system bar padding + https deep links
java = list((android / "app" / "src" / "main" / "java").rglob("MainActivity.java"))
assert len(java) == 1, java
src = (ci / "MainActivity.java").read_text(encoding="utf-8")
pkg = re.search(r"^package\s+([\w.]+);", java[0].read_text(encoding="utf-8"), re.M).group(1)
java[0].write_text(re.sub(r"^package\s+[\w.]+;", f"package {pkg};", src, count=1, flags=re.M), encoding="utf-8")

print(f"patched {android}: versionName {version_name}, versionCode {version_code}, package {pkg}")
