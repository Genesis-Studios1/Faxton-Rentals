#!/usr/bin/env python3
"""Prepare the generated Capacitor iOS project for Firebase Cloud Messaging."""
from pathlib import Path
import re
import sys

root = Path(sys.argv[1]).resolve()
delegates = list(root.rglob("AppDelegate.swift"))
assert len(delegates) == 1, f"Expected one AppDelegate.swift, found {delegates}"
delegate = delegates[0]
source = delegate.read_text(encoding="utf-8")

if "capacitorDidRegisterForRemoteNotifications" not in source:
    if "import Capacitor" not in source:
        source = re.sub(r"^(import UIKit\\s*)$", r"\\1\\nimport Capacitor", source, count=1, flags=re.M)
        assert "import Capacitor" in source, "Could not add Capacitor import to AppDelegate.swift"
    methods = """
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }

    func application(_ application: UIApplication, didReceiveRemoteNotification userInfo: [AnyHashable: Any], fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
        NotificationCenter.default.post(name: Notification.Name("didReceiveRemoteNotification"), object: completionHandler, userInfo: userInfo)
    }
"""
    end = source.rfind("}")
    assert end >= 0, "AppDelegate.swift has no closing class brace"
    source = source[:end] + methods + source[end:]
    delegate.write_text(source, encoding="utf-8")

app_dir = delegate.parent
entitlements = app_dir / "App.entitlements"
entitlements.write_text("""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>aps-environment</key>
    <string>production</string>
</dict>
</plist>
""", encoding="utf-8")

projects = list(root.rglob("*.xcodeproj/project.pbxproj"))
assert len(projects) == 1, f"Expected one Xcode project, found {projects}"
pbx = projects[0]
project = pbx.read_text(encoding="utf-8")
if "CODE_SIGN_ENTITLEMENTS = App/App.entitlements;" not in project:
    pattern = r"(PRODUCT_BUNDLE_IDENTIFIER = com\\.faxton\\.rentals;)"
    project, count = re.subn(pattern, r"CODE_SIGN_ENTITLEMENTS = App/App.entitlements;\\n\\t\\t\\t\\t\\1", project)
    assert count >= 1, "Could not attach APNs entitlements to the Faxton app build settings"
    pbx.write_text(project, encoding="utf-8")

print("Configured Capacitor APNs callbacks and production push entitlements.")
