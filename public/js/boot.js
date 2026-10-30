// Safety nets that must run before anything else.
// 1) Some browsers (private windows, locked-down WebViews) throw when the page even touches localStorage/sessionStorage.
//    If that happens, swap in an in-memory copy so the app keeps working (nothing is saved for later in that case).
(function () {
  ["localStorage", "sessionStorage"].forEach(function (n) {
    try { window[n].getItem("__t"); return; } catch (e) {}
    var m = {}, st = { getItem: function (k) { return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null; }, setItem: function (k, v) { m[k] = String(v); }, removeItem: function (k) { delete m[k]; }, clear: function () { m = {}; }, key: function (i) { return Object.keys(m)[i] || null; } };
    Object.defineProperty(st, "length", { get: function () { return Object.keys(m).length; } });
    try { Object.defineProperty(window, n, { value: st, configurable: true }); } catch (e) {}
  });
})();
// Keep in-app hash routes on the app document. The root base URL is used for shared assets,
// but native anchor resolution would otherwise send href="#/login" to the public homepage.
document.addEventListener("click", function (event) {
  var link = event.target && event.target.closest ? event.target.closest('a[href^="#/"]') : null;
  if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  var href = link.getAttribute("href");
  if (!href) return;
  event.preventDefault();
  if (location.hash === href) window.dispatchEvent(new HashChangeEvent("hashchange"));
  else location.hash = href.slice(1);
}, true);

// 2) Uncaught errors and unhandled promise rejections are queued here; js/robust.js turns them into a calm, friendly message.
(function () {
  var q = (window.__fxq = []), add = function (k, e) { if (window.__fxReport) window.__fxReport(k, e); else if (q.length < 20) q.push([k, e]); };
  addEventListener("error", function (e) { if (e.error || e.message) add("error", e.error || e.message); });
  addEventListener("unhandledrejection", function (e) { add("rejection", e.reason); });
})();

// Runs before first paint. Light is the default; "dark" and "system" apply only if the user chose them.
try {
  const p = localStorage.getItem("theme");
  document.documentElement.dataset.theme = p === "dark" || (p === "system" && matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light";
} catch { document.documentElement.dataset.theme = "light"; }

// Safety net: if the app hasn't started within 12s (stale cache, flaky network), offer a clean reload instead of a blank screen.
setTimeout(function () {
  if (document.documentElement.classList.contains("ready")) return;
  var d = document.createElement("div");
  d.style.cssText = "position:fixed;left:0;right:0;bottom:24px;z-index:2000;display:flex;justify-content:center;padding:0 16px";
  d.innerHTML = '<button type="button" style="font:600 16px var(--font-body,system-ui),system-ui,sans-serif;padding:14px 22px;border-radius:12px;border:0;background:#13926f;color:#fff;box-shadow:0 8px 24px rgba(0,0,0,.3)">Taking long? Tap to refresh</button>';
  d.firstChild.onclick = function () {
    var done = function () { location.reload(); };
    Promise.all([
      navigator.serviceWorker ? navigator.serviceWorker.getRegistrations().then(function (r) { return Promise.all(r.map(function (x) { return x.unregister(); })); }) : 0,
      window.caches ? caches.keys().then(function (k) { return Promise.all(k.map(function (n) { return caches.delete(n); })); }) : 0
    ]).then(done, done);
  };
  document.body.appendChild(d);
}, 12000);

// The splash plays once per browser session. A reload (or coming back to the tab) goes straight to the app instead of replaying it.
// Exception: when someone has app lock on, the splash always plays on open, and the lock screen follows it (see js/applock.js).
try {
  var lockOn = false;
  try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf("applock_") === 0 && /"on"\s*:\s*1/.test(localStorage.getItem(k) || "")) { lockOn = true; break; } } } catch (e) {}
  if (!lockOn && sessionStorage.getItem("splashed") === "1") document.documentElement.classList.add("no-splash", "ready");
} catch (e) {}
