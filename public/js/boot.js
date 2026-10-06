// Runs before first paint. Light is the default; "dark" and "system" apply only if the user chose them.
try {
  const p = localStorage.getItem("theme");
  document.documentElement.dataset.theme = p === "dark" || (p === "system" && matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light";
} catch { document.documentElement.dataset.theme = "light"; }
