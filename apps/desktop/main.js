// Faxton Rentals desktop shell (Windows + macOS). It opens the live site in a locked-down window,
// so the app is always the latest deployed version. The shell itself updates through GitHub Releases.
const { app, BrowserWindow, Menu, shell, session, dialog, ipcMain } = require("electron");
const path = require("path");
const { pathToFileURL } = require("url");

const SITE = "https://faxton-rentals.web.app";
const HOST = new URL(SITE).host;
const OFFLINE_URL = pathToFileURL(path.join(__dirname, "offline.html")).href;
// Hosts allowed to open as in-app windows (Firebase + Google sign-in popups). Everything else opens in the system browser.
const POPUP_OK = [/^accounts\.google\.com$/, /^faxton-rentals\.firebaseapp\.com$/, /^faxton-rentals\.web\.app$/];
const isHttps = (u) => { try { return new URL(u).protocol === "https:"; } catch { return false; } };
const hostOf = (u) => { try { return new URL(u).host; } catch { return ""; } };
const platform = process.platform === "darwin" ? "mac" : process.platform === "win32" ? "win" : "linux";
// Google refuses sign-in from browsers that call themselves "Electron", so present a plain Chrome user agent plus our app tag.
let UA = "";
const makeUA = () => `${session.defaultSession.getUserAgent().replace(/ Electron\/[\d.]+/, "").replace(/ faxton-rentals-desktop\/[\d.]+/i, "").replace(/ Faxton Rentals\/[\d.]+/i, "")} FaxtonApp/desktop-${platform}/${app.getVersion()} arch/${process.arch}`;

if (!app.requestSingleInstanceLock()) app.quit();

let win;
function create() {
  win = new BrowserWindow({
    width: 1280, height: 820, minWidth: 420, minHeight: 640, show: false, backgroundColor: "#0a4a3a",
    title: "Faxton Rentals", autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, preload: path.join(__dirname, "preload.js"),
      allowRunningInsecureContent: false, experimentalFeatures: false, spellcheck: true, devTools: !app.isPackaged,
    },
  });
  win.webContents.setUserAgent(UA);
  win.once("ready-to-show", () => win.show());
  win.loadURL(SITE);
  win.webContents.on("did-fail-load", (_e, code, _d, url, isMain) => { if (isMain && code !== -3 && hostOf(url) === HOST) win.loadFile(path.join(__dirname, "offline.html")); });
  // Never navigate the main window away from our own site.
  const guardNavigation = (e, url) => { if (hostOf(url) !== HOST && url !== OFFLINE_URL) { e.preventDefault(); if (isHttps(url)) shell.openExternal(url); } };
  win.webContents.on("will-navigate", guardNavigation);
  win.webContents.on("will-redirect", guardNavigation);
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isHttps(url) && POPUP_OK.some((r) => r.test(hostOf(url)))) return { action: "allow", overrideBrowserWindowOptions: { width: 520, height: 720, autoHideMenuBar: true, webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true } } };
    if (isHttps(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.on("closed", () => (win = null));
}

app.on("web-contents-created", (_e, contents) => {
  contents.on("will-attach-webview", (e) => e.preventDefault());
  contents.setUserAgent(UA);
});

app.whenReady().then(() => {
  UA = makeUA();
  // Only the camera, microphone, screen sharing, notifications and location are allowed, and only for the Faxton site itself.
  const OK = new Set(["media", "mediaKeySystem", "display-capture", "notifications", "geolocation", "clipboard-sanitized-write"]);
  const mine = (url) => { try { return new URL(url).hostname === "faxton-rentals.web.app" || new URL(url).hostname === "faxton-rentals.firebaseapp.com"; } catch { return false; } };
  session.defaultSession.setPermissionRequestHandler((wc, perm, cb) => cb(OK.has(perm) && mine(wc.getURL())));
  session.defaultSession.setPermissionCheckHandler((wc, perm, origin) => OK.has(perm) && mine(origin || (wc && wc.getURL())));
  // Screen sharing in a call: share the first screen (the browser picker isn't available in Electron).
  session.defaultSession.setDisplayMediaRequestHandler((_req, cb) => { require("electron").desktopCapturer.getSources({ types: ["screen", "window"] }).then((src) => cb(src[0] ? { video: src[0] } : {})).catch(() => cb({})); });
  Menu.setApplicationMenu(process.platform === "darwin" ? Menu.buildFromTemplate([{ role: "appMenu" }, { role: "editMenu" }, { role: "windowMenu" }]) : null);
  create();
  app.on("activate", () => { if (!BrowserWindow.getAllWindows().length) create(); });
  checkForUpdates();
});
app.on("second-instance", () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });

// Windows installs updates automatically. macOS builds are unsigned, so Mac users are pointed at the download page instead.
let autoUpdateOn = true;
ipcMain.on("faxton:auto-update", (event, on) => {
  // Only our own site may change this, never another page loaded in the window.
  if (hostOf(event.senderFrame?.url || "") !== HOST) return;
  autoUpdateOn = !!on;
  try { require("electron-updater").autoUpdater.autoDownload = autoUpdateOn; } catch {}
});
function checkForUpdates() {
  if (!app.isPackaged) return;
  try {
    const { autoUpdater } = require("electron-updater");
    autoUpdater.autoDownload = autoUpdateOn;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.on("error", () => {});
    if (process.platform === "win32") {
      autoUpdater.on("update-downloaded", () => {
        dialog.showMessageBox(win, { type: "info", buttons: ["Restart now", "Later"], defaultId: 0, title: "Update ready", message: "A new version of Faxton Rentals is ready.", detail: "Restart to finish updating." })
          .then((r) => { if (r.response === 0) autoUpdater.quitAndInstall(); });
      });
      autoUpdater.checkForUpdates().catch(() => {});
      setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 6 * 60 * 60 * 1000);
    }
  } catch { /* updater unavailable: the site itself still updates */ }
}
