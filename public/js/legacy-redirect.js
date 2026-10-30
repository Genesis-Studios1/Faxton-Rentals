(() => {
  const hash = window.location.hash || "";
  const standalone = window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;
  if (!hash.startsWith("#/") && !standalone) return;
  const target = new URL("/app/", window.location.origin);
  if (hash.startsWith("#/")) target.hash = hash;
  window.location.replace(target.href);
})();