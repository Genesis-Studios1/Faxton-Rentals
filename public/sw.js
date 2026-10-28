// Faxton Rentals service worker.
//
// What it does, in plain words:
//  - Saves the app's own files so Faxton opens fast and still opens with no signal.
//  - Pages, scripts and styles: ask the network first (so a new release shows at once), use the saved copy only when offline or very slow.
//  - Files whose address carries ?v=<build> never change, so they come straight from the saved copy.
//  - Fonts and the map library: saved forever (their names never change).
//  - Pictures: shown instantly from the saved copy and quietly refreshed in the background, so a replaced picture appears on the next visit.
//  - Firestore, sign-in, maps tiles and every other website are NEVER touched: this file only handles Faxton's own files and the Firebase SDK scripts.
//  - A new release waits until the person taps "Reload" in the "A new version is ready" message (see js/robust.js).
//
// RELEASE: BUILD below must equal BUILD in js/ui.js and the ?v= in index.html. Run `node scripts/check-release.mjs` before deploying.
const BUILD = "2026-10-28.02";
const PRE = "faxton-" + BUILD;   // saved on install, thrown away on the next release
const RT = "faxton-rt";          // pictures, fonts, SDK scripts picked up while browsing (size-capped, survives releases)
const RT_MAX = 160;
const V = "?v=" + BUILD;

// Must work or the worker does not install.
const OFFLINE = "offline"; // offline.html, served without the .html because Firebase cleanUrls redirects the long form (a redirected page cannot be used as a navigation answer)
const CORE = ["./", OFFLINE, "manifest.webmanifest", "css/fonts.css" + V, "css/theme.css" + V, "css/app.css" + V, "css/shell.css" + V, "css/home.css" + V, "css/flow.css" + V, "css/admin.css" + V, "css/chat.css" + V, "css/auth.css" + V, "css/robust.css" + V, "js/boot.js" + V, "js/robust.js" + V, "js/main.js" + V, "js/lightbox.js" + V];
// Nice to have offline: the rest of the app's modules and the first screens' pictures. A missing one never breaks the install.
const EXTRA = [
  "assets/mark.svg", "img/splash-final.webp", "icons/icon-192.png", "icons/favicon.svg?v=2",
  "fonts/inter-latin-400-normal.woff2", "fonts/inter-latin-500-normal.woff2", "fonts/inter-latin-600-normal.woff2", "fonts/inter-latin-700-normal.woff2",
  "fonts/inter-tight-latin-600-normal.woff2", "fonts/inter-tight-latin-700-normal.woff2", "fonts/inter-tight-latin-800-normal.woff2",
  ...["admin2", "applock", "receipts", "presence", "mydata", "mydata-ui", "ax-list", "ax-sections", "ax-shell", "dash", "installs", "paymentspage", "apps", "area", "authkit", "authviews", "calls", "cards", "countries", "dd", "feedback", "firebase", "footer", "fx", "gate", "sound", "home", "legal", "loc", "maps", "match", "ng-lga", "myhome", "offers", "onboard", "onboarding-setup", "pages", "paymentinfo", "pdp", "profile", "safety", "services", "store", "tenants", "tour", "ui", "views", "viewsafe"].map((n) => "js/" + n + ".js"),
];

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(PRE);
    await c.addAll(CORE);
    await Promise.allSettled(EXTRA.map((u) => c.add(u)));
    // First install: take over now. Later releases wait for the person to tap "Reload".
    if (!self.registration.active) self.skipWaiting();
  })());
});
self.addEventListener("message", (e) => { if (e.data && e.data.type === "SKIP_WAITING") self.skipWaiting(); });
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== PRE && k !== RT) await caches.delete(k);
    if (self.registration.navigationPreload) { try { await self.registration.navigationPreload.disable(); } catch {} }
    await self.clients.claim();
  })());
});

const SDK = /^https:\/\/www\.gstatic\.com\/firebasejs\/[\d.]+\//;
async function trim(name, max) {
  const c = await caches.open(name), keys = await c.keys();
  for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i]);
}
async function put(name, req, res, max) {
  try { const c = await caches.open(name); await c.put(req, res); if (max) trim(name, max); } catch { /* storage full or response not cacheable: ignore */ }
}
// Network first. If the network fails, or is slower than `wait` ms, use the saved copy (the request keeps running and refreshes it).
function networkFirst(e, req, name, wait) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (r) => { if (!done) { done = true; resolve(r); } };
    const net = fetch(req).then((res) => { if (res.ok) put(name, req, res.clone()); return res; });
    const timer = wait ? setTimeout(async () => { const hit = await caches.match(req); if (hit) finish(hit); }, wait) : 0;
    net.then((res) => { clearTimeout(timer); finish(res); }, async () => { clearTimeout(timer); finish((await caches.match(req)) || Response.error()); });
    e.waitUntil(net.catch(() => {}));
  });
}
const cacheFirst = async (req, name, max) => {
  const hit = await caches.match(req); if (hit) return hit;
  const res = await fetch(req); if (res.ok) put(name, req, res.clone(), max); return res;
};
// Show the saved picture now, refresh it in the background (asking the server whether it changed, ignoring the browser's own copy).
function staleWhileRevalidate(e, req) {
  const refresh = fetch(req, { cache: "no-cache" }).then((res) => { if (res.ok) put(RT, req, res.clone(), RT_MAX); return res; });
  e.waitUntil(refresh.catch(() => {}));
  return caches.match(req).then((hit) => hit || refresh);
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || req.headers.has("range")) return;
  const u = new URL(req.url);
  if (u.origin !== location.origin) {
    // Only the pinned Firebase SDK scripts (static code, never user data). Everything else goes straight to the network.
    if (SDK.test(req.url)) e.respondWith(cacheFirst(req, RT, RT_MAX).catch(() => Response.error()));
    return;
  }
  const p = u.pathname;
  if (p.startsWith("/__/") || p === "/sw.js") return; // Firebase auth helper pages and this file itself
  if (req.mode === "navigate") {
    if (p === "/" || p === "/index.html") {
      e.respondWith((async () => {
        const res = await networkFirst(e, new Request("./", { credentials: "same-origin" }), PRE, 5000);
        if (res && res.ok) return res;
        return (await caches.match("./")) || (await caches.match(OFFLINE)) || res;
      })());
    } else {
      e.respondWith(fetch(req).catch(async () => (await caches.match(OFFLINE)) || Response.error()));
    }
    return;
  }
  if (u.search.startsWith("?v=") || p.startsWith("/fonts/") || p.startsWith("/vendor/")) { e.respondWith(cacheFirst(req, PRE).catch(() => caches.match(req).then((h) => h || Response.error()))); return; }
  if (req.destination === "image" || p.startsWith("/img/") || p.startsWith("/assets/") || p.startsWith("/icons/")) { e.respondWith(staleWhileRevalidate(e, req)); return; }
  if (p.startsWith("/js/") || p.startsWith("/css/") || p.endsWith(".webmanifest") || p.endsWith(".json")) { e.respondWith(networkFirst(e, req, PRE, 6000)); return; }
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
