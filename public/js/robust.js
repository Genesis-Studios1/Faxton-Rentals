// Robustness layer. Friendly errors (never raw codes), offline banner, "new version" prompt, service worker upkeep.
// Deliberately has no imports, so it still works when the main app fails to load. Styles: css/robust.css.
const $ = (s, r = document) => r.querySelector(s);
const el = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstChild; };

// ---------- tiny toast stack (separate from the app toast so it can carry a button and never collides) ----------
let host = null, offlineBar = null;
function getHost() {
  if (host && host.isConnected) return host;
  host = el('<div class="fxr-host" role="status" aria-live="polite" aria-atomic="false"></div>'); document.body.append(host); return host;
}
export function say(text, { action = "", onAction = null, kind = "info", ms = 6000, key = "" } = {}) {
  const h = getHost();
  if (key) h.querySelectorAll(`[data-key="${key}"]`).forEach((n) => n.remove());
  const t = el(`<div class="fxr-toast" data-kind="${kind}" ${key ? `data-key="${key}"` : ""}><span class="fxr-dot" aria-hidden="true"></span><span class="fxr-msg"></span>${action ? '<button type="button" class="fxr-act"></button>' : ""}<button type="button" class="fxr-x" aria-label="Dismiss">×</button></div>`);
  $(".fxr-msg", t).textContent = text;
  if (action) { const b = $(".fxr-act", t); b.textContent = action; b.onclick = () => { try { onAction && onAction(); } finally { t.remove(); } }; }
  $(".fxr-x", t).onclick = () => t.remove();
  h.append(t); while (h.children.length > 3) h.firstChild.remove();
  if (ms) setTimeout(() => t.remove(), ms);
  return t;
}
window.__fxSay = say;

// ---------- global error boundary: report quietly, tell the person something friendly ----------
let lastToast = 0, shown = 0;
const CALM = /^(permission-denied|unauthenticated|cancelled|aborted|auth\/(popup-closed-by-user|cancelled-popup-request|user-cancelled|web-storage-unsupported|network-request-failed)|resource-exhausted)$/;
const CHUNK = /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS|ChunkLoadError/i;
const NET = /Failed to fetch|NetworkError|Load failed|network-request-failed|ERR_INTERNET_DISCONNECTED|\bunavailable\b/i;
const IGNORE = /ResizeObserver|^Script error\.?$|AbortError|The operation was aborted|play\(\) request was interrupted|The play\(\) request|NotAllowedError|Non-Error promise rejection/i;
export function report(kind, err) {
  const msg = String((err && (err.message || err.code)) || err || ""), code = (err && err.code) || "";
  try { window.__fxLast = { kind, msg: msg.slice(0, 200), at: Date.now(), route: location.hash }; console.warn("[Faxton]", kind, msg.slice(0, 200)); } catch {}
  if (IGNORE.test(msg) || CALM.test(code)) return;
  const now = Date.now(); if (now - lastToast < 8000 || shown >= 4) return; lastToast = now; shown++;
  if (CHUNK.test(msg)) return say("Faxton was just updated. Reload to continue.", { action: "Reload", onAction: () => location.reload(), kind: "warn", ms: 0, key: "chunk" });
  if (NET.test(msg) || navigator.onLine === false) return say("We couldn’t connect. Check your internet and try again.", { action: "Try again", onAction: () => location.reload(), kind: "warn", key: "net" });
  say("Something went wrong. Please try again in a moment.", { kind: "error", key: "err" });
}
window.__fxReport = report;
try { (window.__fxq || []).splice(0).forEach(([k, e]) => report(k, e)); } catch {}

// ---------- offline banner ----------
function setOffline(off) {
  document.documentElement.classList.toggle("is-offline", off);
  if (off) {
    if (!offlineBar) { offlineBar = el('<div class="fxr-offline" role="status"><span>You’re offline. Saved pages still open, but some things won’t load.</span><button type="button" class="fxr-retry">Retry</button></div>'); document.body.append(offlineBar); $(".fxr-retry", offlineBar).onclick = probe; }
    offlineBar.hidden = false;
  } else if (offlineBar && !offlineBar.hidden) { offlineBar.hidden = true; say("You’re back online.", { kind: "ok", ms: 3000, key: "net" }); }
}
async function probe() {
  try { const r = await fetch("manifest.webmanifest?ping=" + Date.now(), { cache: "no-store" }); if (r.ok) return setOffline(false); } catch {}
  say("Still offline. We’ll reconnect as soon as we can.", { kind: "warn", ms: 3000, key: "net" });
}
addEventListener("offline", () => setOffline(true));
addEventListener("online", () => setOffline(false));
if (navigator.onLine === false) addEventListener("DOMContentLoaded", () => setOffline(true), { once: true });

// ---------- "Try again" buttons on failure screens ----------
document.addEventListener("click", (e) => { if (e.target.closest?.("[data-fx-retry]")) { e.preventDefault(); location.reload(); } });

// ---------- service worker: register, look for updates, offer "A new version is ready" ----------
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  let reloading = false, prompted = false;
  const offer = (reg) => {
    if (prompted || !reg.waiting) return; prompted = true;
    say("A new version is ready.", { action: "Reload", kind: "ok", ms: 0, key: "update", onAction: () => { reloading = true; reg.waiting.postMessage({ type: "SKIP_WAITING" }); setTimeout(() => location.reload(), 1500); } });
  };
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (reloading) location.reload(); });
  const start = async () => {
    let reg; try { reg = await navigator.serviceWorker.register("sw.js"); } catch { return; }
    if (!reg) return;
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg);
    reg.addEventListener("updatefound", () => { const w = reg.installing; if (!w) return; w.addEventListener("statechange", () => { if (w.state === "installed" && navigator.serviceWorker.controller) offer(reg); }); });
    const check = () => { try { reg.update().catch(() => {}); } catch {} };
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") check(); });
    setInterval(check, 30 * 60 * 1000);
  };
  // Keep a copy of the Firebase SDK scripts the page just loaded (static code, never user data), so the app can also start with no signal.
  const warm = async () => {
    try {
      await navigator.serviceWorker.ready; const c = await caches.open("faxton-rt");
      const urls = performance.getEntriesByType("resource").map((r) => r.name).filter((u) => /^https:\/\/www\.gstatic\.com\/firebasejs\/[\d.]+\/.+\.js$/.test(u));
      for (const u of [...new Set(urls)]) { if (!(await c.match(u))) { const r = await fetch(u, { mode: "cors" }); if (r.ok) await c.put(u, r); } }
    } catch { /* offline start just needs the browser's own copy */ }
  };
  const after = () => { start().then(() => setTimeout(warm, 4000)); };
  if (document.readyState === "complete") after(); else addEventListener("load", after, { once: true });
}
