// Firebase Cloud Messaging worker for Faxton Rentals web/PWA.
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyBraCvOGzGiEfmOZPmmi1ceVtkipJeATeE",
  authDomain: "faxton-rentals.firebaseapp.com",
  projectId: "faxton-rentals",
  storageBucket: "faxton-rentals.firebasestorage.app",
  messagingSenderId: "426381186757",
  appId: "1:426381186757:web:d543f2b40df35a9dddc2ac"
});

const messaging = firebase.messaging();
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || "Faxton Rentals";
  const options = {
    body: payload.notification?.body || "You have a new notification.",
    icon: "/assets/mark.svg",
    badge: "/icons/icon-192.png",
    tag: "faxton-update",
    data: { url: "/app/" }
  };
  return self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/app/", self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
    const existing = clients.find((client) => client.url.startsWith(self.location.origin));
    if (existing) {
      await existing.focus();
      if ("navigate" in existing) await existing.navigate(target);
    } else {
      await self.clients.openWindow(target);
    }
  }));
});
