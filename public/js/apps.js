// App releases: the admin "Installations" page, the "new version" notification shown inside the installed apps,
// and the automatic-update helper used by Settings.
import { $, $$, esc, icon, toast, modal, friendlyErr, logo } from "./ui.js";
import * as st from "./store.js";
import { app } from "./firebase.js";

const REPO = "musazaneerah4-crypto/Faxton-Rentals-Downloads";
export const PLATFORMS = [
  ["android", "Android · APK", "phone", "Faxton-Rentals-Android.apk", "Open the file on your phone and allow “install unknown apps” when asked."],
  ["android_x64", "Android · APK x64", "phone", "Faxton-Rentals-Android-x64.apk", "For Intel/x86 Android devices, Chromebooks and emulators."],
  ["android_aab", "Android · AAB", "phone", "Faxton-Rentals-Android.aab", "App bundle for the Google Play Store (for developers)."],
  ["iphone", "iPhone · IPA", "phone", "Faxton-Rentals-iPhone-unsigned.ipa", "Apple only installs apps signed by a developer. Sign this file with AltStore or Sideloadly, then install it."],
  ["windows_x64", "Windows · x64", "monitor", "Faxton-Rentals-Windows-x64.exe", "Intel and AMD PCs (most computers). After installing, the app updates itself."],
  ["windows_arm64", "Windows · ARM64", "monitor", "Faxton-Rentals-Windows-arm64.exe", "Snapdragon and other ARM-based Windows PCs."],
  ["mac_arm64", "MacBook · Apple Silicon", "monitor", "Faxton-Rentals-Mac-arm64.dmg", "M1, M2, M3 and M4 Macs. Open the .dmg, drag the app to Applications, then right-click it and choose Open the first time."],
  ["mac_x64", "MacBook · Intel", "monitor", "Faxton-Rentals-Mac-x64.dmg", "Older Intel Macs. Same steps as Apple Silicon."],
  ["linux_x64", "Linux · x64 AppImage", "monitor", "Faxton-Rentals-Linux-x64.AppImage", "Make it executable (chmod +x) and run it."],
  ["linux_arm64", "Linux · ARM64 AppImage", "monitor", "Faxton-Rentals-Linux-arm64.AppImage", "For ARM64 computers such as Raspberry Pi 4/5."],
  ["linux_x64_deb", "Linux · x64 .deb", "monitor", "Faxton-Rentals-Linux-x64.deb", "For Debian, Ubuntu and Mint (sudo apt install ./file.deb)."],
  ["linux_arm64_deb", "Linux · ARM64 .deb", "monitor", "Faxton-Rentals-Linux-arm64.deb", "Debian-family systems on ARM64."],
];
// Installed apps built before these names existed reported the older keys; accept those too.
const LEGACY = { windows_x64: "windows" };
const mb = (n) => (n ? (n / 1048576).toFixed(n < 10485760 ? 1 : 0) + " MB" : "");
const vparts = (v) => String(v || "0").split(".").map((x) => parseInt(x, 10) || 0);
export const newer = (a, b) => { const x = vparts(a), y = vparts(b); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; };

// Which installed app are we running in? (null in a normal browser)
export function shellInfo() {
  const ua = navigator.userAgent, m = /FaxtonApp\/([a-z-]+)(?:\/([\d.]+))?/.exec(ua);
  if (!m) return null;
  const kind = m[1];
  const arm = /arch\/arm64/.test(ua);
  const platform = kind === "desktop-win" ? (arm ? "windows_arm64" : "windows_x64") : kind === "desktop-mac" ? (arm ? "mac_arm64" : "mac_x64") : kind === "desktop-linux" ? (arm ? "linux_arm64" : "linux_x64") : /Android/i.test(ua) ? "android" : "iphone";
  return { kind, platform, version: m[2] || "0.0.0" };
}
const fileOf = (r, platform) => r.files?.[platform]?.url ? r.files[platform] : r.files?.[LEGACY[platform]]?.url ? r.files[LEGACY[platform]] : null;
export const latestFor = (list, platform) => [...list].filter((r) => r.published && fileOf(r, platform)).sort((a, b) => (newer(a.version, b.version) ? -1 : newer(b.version, a.version) ? 1 : 0))[0] || null;

// ---------- the "new version" notification ----------
const FEATURES = [["search", "Improved home search", "Find the right home faster."], ["home", "A cleaner, more modern design", "Easier to use and navigate."], ["gear", "Bug fixes & performance updates", "A more reliable experience."]];
const parseNotes = (notes) => {
  const rows = String(notes || "").split("\n").map((l) => l.replace(/^[-*•\s]+/, "").trim()).filter(Boolean).slice(0, 4);
  if (!rows.length) return FEATURES;
  return rows.map((r, i) => { const [t, d] = r.split(/\s[–—-]\s|:\s/); return [["search", "home", "gear", "check"][i % 4], t, d || ""]; });
};
const art = `<svg viewBox="0 0 200 200" width="170" height="170" aria-hidden="true"><circle cx="100" cy="104" r="88" fill="#f8e4d0"/><g transform="rotate(-12 100 104)"><rect x="62" y="38" width="76" height="132" rx="14" fill="#fffaf4" stroke="#12382c" stroke-width="7"/><rect x="76" y="68" width="48" height="48" rx="12" fill="#12382c"/><path d="M88 99v-9l12-9 12 9v9h-7v-6h-10v6z" fill="#f8e4d0"/></g><circle cx="132" cy="62" r="19" fill="#fffaf4" stroke="#12382c" stroke-width="4"/><path d="M132 71V54m-8 8l8-8 8 8" fill="none" stroke="#12382c" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M158 42l6-9m4 20l10-3" stroke="#e7b98f" stroke-width="3" stroke-linecap="round"/></svg>`;
export function showUpdateModal(rel, file, { mandatory = false, onUpdate } = {}) {
  const m = modal(`<div class="upd"><div class="upd-art">${art}</div><h2>A new version is available</h2>
    <p class="upd-sub">We’ve made improvements and new features to give you a faster, smoother and better renting experience.</p>
    <ul class="upd-list">${parseNotes(rel.notes).map(([ic, t, d]) => `<li><span>${icon(ic, 22, 1.7)}</span><div><b>${esc(t)}</b>${d ? `<small>${esc(d)}</small>` : ""}</div></li>`).join("")}</ul>
    <button class="upd-go" id="updGo">Update Now</button>${mandatory ? "" : `<button class="upd-later" id="updLater">Maybe Later</button>`}
    <p class="upd-ver">Version ${esc(rel.version)}${file?.size ? " · " + mb(file.size) : ""}</p></div>`);
  m.el.classList.add("upd-modal");
  if (mandatory) { m.el.addEventListener("cancel", (e) => e.preventDefault()); $(".close", m.el)?.remove(); }
  $("#updGo", m.el).onclick = () => { onUpdate?.(); location.href = file.url; };
  const later = $("#updLater", m.el); if (later) later.onclick = () => m.close();
  return m;
}

let watching = false, unsub = null, latestList = [];
export function startUpdateWatch(S) {
  const info = shellInfo();
  if (!info || !S.user || watching) return;
  watching = true;
  unsub = st.watchReleases((list) => { latestList = list; evaluate(S, info); });
}
export function stopUpdateWatch() { unsub?.(); unsub = null; watching = false; }
function evaluate(S, info = shellInfo(), manual = false) {
  if (!info) return null;
  const rel = latestFor(latestList, info.platform);
  if (!rel || !newer(rel.version, info.version)) return null;
  const file = fileOf(rel, info.platform), key = "upd:" + rel.version;
  if (S.profile?.prefs?.autoUpdate && !manual) {
    if (!sessionStorage.getItem("auto:" + key)) { sessionStorage.setItem("auto:" + key, "1"); toast(`Updating to version ${rel.version}…`); setTimeout(() => (location.href = file.url), 1600); }
    return rel;
  }
  if (!manual && !rel.mandatory && sessionStorage.getItem(key)) return rel;
  if (document.querySelector(".upd-modal")) return rel;
  showUpdateModal(rel, file, { mandatory: !!rel.mandatory, onUpdate: () => {} }).el.addEventListener("close", () => { try { sessionStorage.setItem(key, "1"); } catch {} });
  return rel;
}
// Used by Settings > "Check for updates"
export function checkNow(S) {
  const info = shellInfo();
  if (!info) return "web";
  return evaluate(S, info, true) ? "available" : "current";
}
// Tell the desktop shell whether to download updates by itself (Windows).
export function syncShellAutoUpdate(on) { try { window.faxtonShell?.setAutoUpdate?.(!!on); } catch {} }

// ---------- admin: Installations ----------
async function githubLatest() {
  const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: "application/vnd.github+json" } });
  if (!r.ok) throw new Error("No GitHub release yet");
  const j = await r.json();
  return { version: String(j.tag_name || "").replace(/^v/, ""), notes: j.body || "", files: Object.fromEntries(PLATFORMS.map(([k, , , name]) => { const a = (j.assets || []).find((x) => x.name === name); return [k, a ? { url: a.browser_download_url, name: a.name, size: a.size, source: "github" } : null]; }).filter(([, v]) => v)) };
}
async function uploadInstaller(file, version, onProgress) {
  const { getStorage, ref, uploadBytesResumable, getDownloadURL } = await import("https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js");
  const safe = file.name.replace(/[^\w.\-]+/g, "_").slice(0, 100);
  const r = ref(getStorage(app), `installers/${version.replace(/[^\w.\-]+/g, "_")}/${Date.now()}-${safe}`);
  const task = uploadBytesResumable(r, file);
  await new Promise((res, rej) => task.on("state_changed", (s) => onProgress?.(s.bytesTransferred / s.totalBytes), rej, res));
  return { url: await getDownloadURL(r), name: file.name, size: file.size, source: "upload" };
}

export async function installationsPage(ctx) {
  return (await import("./installs.js")).page(ctx, { PLATFORMS, newer, mb, githubLatest, uploadInstaller });
}


// ---------- public downloads: the "Download now" window and the #/download page ----------
const GROUPS = [
  { id: "android", name: "Android", sub: "Get the app", img: "os-android.webp", title: "Choose Android package", opts: [["android", "APK", "Download .APK", "For direct installation"], ["android_x64", "APK", "Download .APK · x64", "For Intel/x86 devices and emulators"], ["android_aab", "AAB", "Download .AAB", "For developers (Play Store)"]] },
  { id: "ios", name: "iOS", sub: "Get the app", img: "os-apple.webp", title: "Install on iPhone", opts: [["#safari", "WEB", "Add to Home Screen", "Easiest: open this site in Safari"], ["iphone", "IPA", "Download .IPA", "Sideload with AltStore or Sideloadly"]] },
  { id: "windows", name: "Windows", sub: "Use on desktop", img: "os-windows.webp", title: "Choose Windows package", opts: [["windows_x64", "EXE", "Windows x64", "Intel and AMD PCs (most computers)"], ["windows_arm64", "EXE", "Windows ARM64", "Snapdragon and other ARM PCs"]] },
  { id: "mac", name: "macOS", sub: "Use on MacBook", title: "Choose Mac package", opts: [["mac_arm64", "DMG", "Apple Silicon (arm64)", "M1, M2, M3 and M4 MacBooks"], ["mac_x64", "DMG", "Intel (x64)", "Older Intel MacBooks"]] },
  { id: "linux", name: "Linux", sub: "Use on desktop", title: "Choose Linux package", opts: [["linux_x64", "APPIMG", "AppImage · x64", "Runs on most distributions"], ["linux_arm64", "APPIMG", "AppImage · ARM64", "Raspberry Pi and other ARM64"], ["linux_x64_deb", "DEB", "Debian/Ubuntu · x64", "Install with apt"], ["linux_arm64_deb", "DEB", "Debian/Ubuntu · ARM64", "Install with apt"]] },
];
const gIcon = (g) => g.img ? `<img src="img/${g.img}" alt="" width="40" height="40">` : g.id === "mac" ? `<span class="dlx-tile mac">${icon("download", 22)}</span>` : `<span class="dlx-tile tux"><svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true"><ellipse cx="16" cy="19" rx="9" ry="10" fill="#1b1b1f"/><ellipse cx="16" cy="21.5" rx="5.5" ry="6.5" fill="#f4f1ea"/><circle cx="12.6" cy="12.5" r="1.5" fill="#fff"/><circle cx="19.4" cy="12.5" r="1.5" fill="#fff"/><circle cx="12.8" cy="12.7" r=".7" fill="#111"/><circle cx="19.2" cy="12.7" r=".7" fill="#111"/><path d="M14 15.2h4l-2 2.2z" fill="#f2b233"/><ellipse cx="11.5" cy="29" rx="4" ry="1.8" fill="#f2b233"/><ellipse cx="20.5" cy="29" rx="4" ry="1.8" fill="#f2b233"/></svg></span>`;
let relP = null;
const loadRelease = () => (relP ||= githubLatest().catch(() => null));
function detectGroup() {
  const ua = navigator.userAgent;
  return /Android/i.test(ua) ? "android" : /iPhone|iPad|iPod/i.test(ua) ? "ios" : /Windows/i.test(ua) ? "windows" : /Mac/i.test(ua) ? "mac" : /Linux|X11/i.test(ua) ? "linux" : "";
}
const cardsHtml = (hot) => GROUPS.map((g) => `<article class="dlx-card ${g.id === hot ? "hot" : ""}" data-g="${g.id}"><button type="button" class="dlx-head" aria-expanded="false" aria-label="${esc(g.name)} downloads">${gIcon(g)}<span class="dlx-t"><b>${esc(g.name)}</b><small>${esc(g.sub)}</small></span><span class="dlx-btn">${icon("download", 16)} ${g.id === "ios" ? "Install" : "Download"}</span><span class="dlx-chev">${icon("chev", 18)}</span></button></article>`).join("");
function websiteInstallGuide() {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) {
    return "On your iPhone or iPad, open this site in Safari, tap Share, then choose Add to Home Screen.";
  }
  if (/Android/i.test(ua)) {
    return "On Android, open this site in Chrome, tap the three-dot menu, then choose Install app or Add to Home Screen.";
  }
  return "On your computer, look for the install icon in your browser's address bar or open the browser menu and choose Install Faxton Rentals. If that option is unavailable, bookmark the website for quick access.";
}
function websiteOptionHtml(ctx) {
  const canInstall = Boolean(ctx?.canInstall?.());
  return `<section class="dlx-webcard" aria-label="Main Faxton Rentals website">
    <div class="dlx-web-main">
      <span class="dlx-web-icon">${icon("monitor", 22)}</span>
      <div class="dlx-web-copy">
        <span class="dlx-web-eyebrow">MAIN WEBSITE</span>
        <b>Use Faxton Rentals in your browser</b>
        <p>Browse homes on the full website, or add a quick-access icon to your device.</p>
      </div>
      <div class="dlx-web-actions">
        ${canInstall ? `<button type="button" class="dlx-web-install" data-install-website>${icon("download", 16)}<span>Install website</span></button>` : ""}
        <a class="dlx-web-open" href="https://faxton-rentals.web.app/" target="_blank" rel="noopener">${icon("arrow", 16)}<span>Open website</span></a>
      </div>
    </div>
    <div class="dlx-web-guidance">
      <button type="button" class="dlx-web-how" data-web-how aria-expanded="false">${icon("info", 15)} How to add the website to your device</button>
      <p class="dlx-web-guide" data-web-guide hidden>${websiteInstallGuide()}</p>
    </div>
  </section>`;
}
const sheetHtml = (g, rel) => `<div class="dlx-sheet" role="group" aria-label="${esc(g.title)}"><header><b>${esc(g.title)}</b><button type="button" class="dlx-x" aria-label="Close">${icon("x", 16)}</button></header>${g.opts.map(([k, tag, name, sub]) => {
  const f = k.startsWith("#") ? { url: "#" } : rel?.files?.[k];
  const inner = `<span class="dlx-file">${tag}</span><span class="dlx-ot"><b>${esc(name)}</b><small>${esc(f ? sub : rel ? "Not available yet" : "Couldn’t reach the download server")}</small></span>${f ? icon("chev", 16) : ""}`;
  return k === "#safari" ? `<button type="button" class="dlx-opt" data-safari>${inner}</button>` : f ? `<a class="dlx-opt" href="${esc(f.url)}" rel="noopener" download>${inner}</a>` : `<div class="dlx-opt off">${inner}</div>`;
}).join("")}</div>`;
function wirePicker(root, get) {
  const mobile = () => matchMedia("(max-width: 700px)").matches;
  const close = () => { $$(".dlx-sheet", root).forEach((x) => x.remove()); $$(".dlx-card", root).forEach((c) => { c.classList.remove("open"); c.querySelector(".dlx-head").setAttribute("aria-expanded", "false"); }); };
  $$(".dlx-card", root).forEach((card) => {
    const g = GROUPS.find((x) => x.id === card.dataset.g), head = card.querySelector(".dlx-head");
    head.onclick = () => {
      const was = card.classList.contains("open"); close(); if (was) return;
      card.classList.add("open"); head.setAttribute("aria-expanded", "true");
      const wrap = document.createElement("div"); wrap.innerHTML = sheetHtml(g, get()); const sh = wrap.firstElementChild;
      if (mobile()) card.append(sh); else { const slot = $(".dlx-slot", root); slot.append(sh); sh.style.marginLeft = Math.max(0, Math.min(card.offsetLeft, slot.clientWidth - 330)) + "px"; }
      $(".dlx-x", sh).onclick = close;
      const sf = $("[data-safari]", sh); if (sf) sf.onclick = () => { sh.innerHTML = `<header><b>Add to Home Screen</b><button type="button" class="dlx-x" aria-label="Close">${icon("x", 16)}</button></header><p class="dlx-how">On your iPhone, open <b>faxton-rentals.web.app</b> in <b>Safari</b>, tap the <b>Share</b> button, then choose <b>Add to Home Screen</b>.</p>`; $(".dlx-x", sh).onclick = close; };
      sh.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
    };
  });
  return close;
}
export async function openDownloadModal(ctx = {}) {
  if ($(".dlx-ov")) return;
  const ov = document.createElement("div"); ov.className = "dlx-ov"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true"); ov.setAttribute("aria-label", "Get Faxton Rentals app or website");
  ov.innerHTML = `<div class="dlx-box"><button type="button" class="dlx-close" aria-label="Close">${icon("x", 20)}</button>
    <div class="dlx-top"><div class="dlx-copy"><div class="dlx-brand"><img src="assets/mark.svg" alt="" width="34" height="30"><span><b>Faxton</b> Rentals</span></div><div class="dlx-eye">Get Faxton Rentals everywhere</div><h2>Start exploring on your device.</h2><p>Get the Faxton Rentals app, or install the main website for quick browser access.</p></div><img class="dlx-art" src="img/app-devices.webp" alt="Faxton Rentals on phone and laptop"></div>
    <div class="dlx-panel"><div class="dlx-grid">${cardsHtml(detectGroup())}</div><div class="dlx-slot"></div>${websiteOptionHtml(ctx)}</div></div>`;
  document.body.append(ov); document.documentElement.classList.add("dlx-lock");
  let rel;
  loadRelease().then((r) => { rel = r || undefined; if (!r) relP = null; });
  const closeSheet = wirePicker(ov, () => rel);
  const installWeb = $("[data-install-website]", ov);
  const webGuide = $("[data-web-guide]", ov);
  const webHow = $("[data-web-how]", ov);
  if (webHow && webGuide) webHow.onclick = () => {
    webGuide.hidden = !webGuide.hidden;
    webHow.setAttribute("aria-expanded", String(!webGuide.hidden));
    if (!webGuide.hidden) webGuide.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  };
  if (installWeb) installWeb.onclick = async () => {
    installWeb.disabled = true;
    try {
      const opened = await ctx.installApp?.();
      if (opened) toast("Your browser's website-install prompt opened. Follow it to finish.");
      else {
        if (webGuide) webGuide.hidden = false;
        if (webHow) webHow.setAttribute("aria-expanded", "true");
        toast("One-tap install is unavailable here. Use the instructions below.");
      }
    } catch {
      if (webGuide) webGuide.hidden = false;
      if (webHow) webHow?.setAttribute("aria-expanded", "true");
      toast("Use the instructions below to add the website.", { tone: "bad" });
    } finally {
      installWeb.disabled = false;
    }
  };
  const shut = () => { ov.classList.add("out"); document.documentElement.classList.remove("dlx-lock"); document.removeEventListener("keydown", key); setTimeout(() => ov.remove(), 180); };
  const key = (e) => { if (e.key === "Escape") { if ($(".dlx-sheet", ov)) closeSheet(); else shut(); } };
  document.addEventListener("keydown", key);
  $(".dlx-close", ov).onclick = shut; ov.addEventListener("click", (e) => { if (e.target === ov) shut(); });
  requestAnimationFrame(() => ov.classList.add("in")); $(".dlx-close", ov).focus();
}

export async function downloadPage(ctx) {
  const rel = await Promise.race([loadRelease(), new Promise((r) => setTimeout(() => r(null), 3000))]).catch(() => null);
  const canPwa = ctx.canInstall?.();
  const how = [["Android", "download", "Get the app, open it, and allow “install unknown apps” for your browser when Android asks. It takes a minute."], ["iPhone", "share", "Open this site in Safari, tap Share, then choose Add to Home Screen. You get the full app, no store needed."], ["Windows and Mac", "monitor", "Download the installer, open it and follow the steps. The app updates itself when a new version is ready."]];
  const html = `<main class="rf-dl"><header class="rf-dl-head"><div class="rf-dl-in">${logo()}<a class="btn sm" href="#/">${icon("left", 16)} Back to site</a></div></header>
    <div class="rf-dl-in"><section class="rf-dl-hero"><div class="rf-dl-copy"><span class="rf-eyebrow">Get Faxton Rentals everywhere</span><h1>Start exploring on your device.</h1><p>Search homes, book viewings, chat with agents and keep your rental papers in one place, on your phone or computer.${rel ? ` Latest version ${esc(rel.version)}.` : ""}</p>
      <div class="rf-dl-act">${canPwa ? `<button class="btn primary" id="pwa">${icon("download", 18)} Install from this browser</button>` : ""}<a class="btn ${canPwa ? "" : "primary"}" href="#/signup">Continue on the web ${icon("arrow", 16)}</a></div>
      ${rel ? "" : `<div class="rf-dl-warn" role="status">${icon("info", 18)}<span>We couldn’t reach the download server just now. You can still use the web version, or <button type="button" class="rf-link" id="dlRetry">try again</button>.</span></div>`}</div>
      <img class="rf-dl-art" src="img/app-devices.webp" alt="Faxton Rentals on a phone and a laptop" width="640" height="440"></section>
    <section class="dlx-panel dlx-page"><div class="dlx-grid">${cardsHtml(detectGroup())}</div><div class="dlx-slot"></div></section>
    <section class="rf-dl-how"><h2>How to install</h2><div>${how.map(([t, ic, d]) => `<article><span>${icon(ic, 20)}</span><b>${t}</b><p>${d}</p></article>`).join("")}</div></section></div></main>`;
  return { full: true, title: "Get the app", html, mount(root) { const b = $("#pwa", root); if (b) b.onclick = () => ctx.installApp(); const rt = $("#dlRetry", root); if (rt) rt.onclick = () => { relP = null; ctx.render(); }; wirePicker(root, () => rel || undefined); } };
}
