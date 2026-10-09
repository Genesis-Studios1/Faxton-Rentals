// Faxton Rentals service worker: makes the app installable and fast to reopen.
// Same-origin files are cached (network first for pages, cache first for assets). Firebase and map requests are never touched.
const CACHE = "faxton-v95";
const SHELL = ["./", "index.html", "css/app.css", "css/fonts.css", "manifest.webmanifest", "assets/mark.svg", "img/hero-hd.webp", "img/splash-final.webp"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((n) => n !== CACHE).map((n) => caches.delete(n)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== location.origin || u.pathname.startsWith("/__/")) return;
  if (r.mode === "navigate") { e.respondWith(fetch(r).catch(() => caches.match("index.html"))); return; }
  // Images and fonts rarely change: serve them from the cache instantly.
  if (["image", "font"].includes(r.destination)) { e.respondWith(caches.match(r).then((hit) => hit || fetch(r).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(r, copy)); } return res; }))); return; }
  // Always try the network first so a new deploy shows immediately; fall back to the cache when offline.
  e.respondWith(fetch(r).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(r, copy)); } return res; }).catch(() => caches.match(r)));
});

// Incoming-call notifications: the Accept and Decline buttons are handled here and passed to the open app.
self.addEventListener("notificationclick", (e) => {
  const tag = e.notification.tag || ""; if (!tag.startsWith("call-")) return;
  e.notification.close();
  const id = (e.notification.data || {}).id, decline = e.action === "decline";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (cl) => {
    if (cl.length) { const c = cl.find((x) => x.visibilityState === "visible") || cl[0]; if (!decline) { try { await c.focus(); } catch {} } c.postMessage({ type: decline ? "call-decline" : "call-accept", id }); }
    else if (!decline) return self.clients.openWindow("/#/accept-call/" + id);
  }));
});
