// Runs before first paint. Light mode is the default; dark mode only if the user chose it.
try { document.documentElement.dataset.theme = localStorage.getItem("theme") === "dark" ? "dark" : "light"; } catch { document.documentElement.dataset.theme = "light"; }
