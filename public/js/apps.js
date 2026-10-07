// Native app releases: the "Get the app" page (admins only) and the update check used inside the installed apps.
import { $, esc, icon } from "./ui.js";

const REPO = "musazaneerah4-crypto/Faxton-Rentals";
export const shellInfo = () => { const m = /FaxtonApp\/([a-z-]+)(?:\/([\d.]+))?/.exec(navigator.userAgent); return m ? { kind: m[1], version: m[2] || "0.0.0" } : null; };
const newer = (a, b) => { const x = a.split(".").map(Number), y = b.split(".").map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; };
export async function latestRelease() {
  const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: "application/vnd.github+json" } });
  if (!r.ok) throw new Error("No release yet");
  const j = await r.json();
  return { version: String(j.tag_name || "").replace(/^v/, ""), date: j.published_at, notes: j.body || "", assets: Object.fromEntries((j.assets || []).map((a) => [a.name, { url: a.browser_download_url, size: a.size }])) };
}
const mb = (n) => (n / 1048576).toFixed(0) + " MB";
const OPTIONS = [
  ["android", "Android", "phone", [["Faxton-Rentals-Android.apk", "Download APK"]], "Open the file on your phone and allow “install unknown apps” when asked."],
  ["iphone", "iPhone", "phone", [["Faxton-Rentals-iPhone-unsigned.ipa", "Download IPA"]], "Apple only installs apps signed by a developer. Open this file with AltStore or Sideloadly on your computer to sign it with your Apple ID and install it."],
  ["windows", "Windows (.exe)", "monitor", [["Faxton-Rentals-Windows.exe", "Download installer"]], "Run the installer. After this the app updates itself."],
  ["mac", "MacBook", "monitor", [["Faxton-Rentals-Mac-arm64.dmg", "Apple Silicon (M1–M4)"], ["Faxton-Rentals-Mac-x64.dmg", "Intel"]], "Open the .dmg and drag the app to Applications. First launch: right-click the app and choose Open."],
];
export async function getAppPage(ctx) {
  let rel = null, err = "";
  try { rel = await latestRelease(); } catch (e) { err = "No app has been built yet. Run “Build and release apps” in GitHub Actions, then refresh this page."; }
  const cur = shellInfo();
  const html = `<div class="page-head"><div><h1>Get the app</h1><p>Download or update the Faxton Rentals app on any device. This page is only visible to admins.</p></div></div>
  ${rel ? `<div class="ga-ver"><b>Latest version ${esc(rel.version)}</b><span>${rel.date ? new Date(rel.date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : ""}</span>${cur ? `<span class="pill ${newer(rel.version, cur.version) ? "warn" : ""}">${newer(rel.version, cur.version) ? `Update available (you have ${esc(cur.version)})` : "You’re up to date"}</span>` : ""}</div>` : `<div class="panel pad"><p class="muted">${esc(err)}</p></div>`}
  <div class="ga-grid">${OPTIONS.map(([k, name, ic, files, tip]) => `<section class="panel ga-card"><span class="ga-ic">${icon(ic, 26)}</span><h3>${name}</h3><p class="muted">${esc(tip)}</p><div class="ga-btns">${files.map(([f, label]) => { const a = rel?.assets[f]; return a ? `<a class="btn primary" href="${esc(a.url)}" rel="noopener">${icon("download", 18)} ${esc(label)} <small>${mb(a.size)}</small></a>` : `<span class="btn" aria-disabled="true" style="opacity:.5;cursor:default">${esc(label)} · not built yet</span>`; }).join("")}</div></section>`).join("")}</div>
  <p class="muted" style="margin-top:18px">The apps open the live site, so content updates reach everyone automatically. You only need a new download when the app shell itself changes. To build a new version, open GitHub → Actions → “Build and release apps” → Run workflow.</p>`;
  return { title: "Get the app", admin: true, html };
}
// Inside an installed app: tell admins when a newer shell exists.
export async function checkShellUpdate(ctx, toast) {
  const cur = shellInfo(); if (!cur || !ctx.S.isAdmin || sessionStorage.getItem("upd")) return;
  try { const rel = await latestRelease(); if (newer(rel.version, cur.version)) { sessionStorage.setItem("upd", "1"); toast(`App update ${rel.version} is available.`, { action: "Get it", href: "#/admin/get-app" }); } } catch {}
}
