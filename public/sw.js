// Faxton Rentals service worker: makes the app installable and fast to reopen.
// Same-origin files are cached (network first for pages, cache first for assets). Firebase and map requests are never touched.
const CACHE = "faxton-v4";
const SHELL = ["./", "index.html", "css/app.css", "css/fonts.css", "manifest.webmanifest", "assets/mark.svg", "img/hero.webp"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((n) => n !== CACHE).map((n) => caches.delete(n)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== location.origin) return;
  if (r.mode === "navigate") { e.respondWith(fetch(r).catch(() => caches.match("index.html"))); return; }
  const net = fetch(r).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(r, copy)); } return res; });
  e.respondWith(/\.(js|css)$/.test(u.pathname) ? net.catch(() => caches.match(r)) : caches.match(r).then((hit) => hit || net));
});
