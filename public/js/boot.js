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
  d.innerHTML = '<button type="button" style="font:600 16px Inter,system-ui,sans-serif;padding:14px 22px;border-radius:12px;border:0;background:#13926f;color:#fff;box-shadow:0 8px 24px rgba(0,0,0,.3)">Taking long? Tap to refresh</button>';
  d.firstChild.onclick = function () {
    var done = function () { location.reload(); };
    Promise.all([
      navigator.serviceWorker ? navigator.serviceWorker.getRegistrations().then(function (r) { return Promise.all(r.map(function (x) { return x.unregister(); })); }) : 0,
      window.caches ? caches.keys().then(function (k) { return Promise.all(k.map(function (n) { return caches.delete(n); })); }) : 0
    ]).then(done, done);
  };
  document.body.appendChild(d);
}, 12000);
