// App releases: the admin "Installations" page, the "new version" notification shown inside the installed apps,
// and the automatic-update helper used by Settings.
import { $, $$, esc, icon, toast, modal, friendlyErr } from "./ui.js";
import * as st from "./store.js";
import { app } from "./firebase.js";

const REPO = "musazaneerah4-crypto/Faxton-Rentals";
export const PLATFORMS = [
  ["android", "Android", "phone", "Faxton-Rentals-Android.apk", "Open the file on your phone and allow “install unknown apps” when asked."],
  ["iphone", "iPhone", "phone", "Faxton-Rentals-iPhone-unsigned.ipa", "Apple only installs apps signed by a developer. Sign this file with AltStore or Sideloadly, then install it."],
  ["windows", "Windows (.exe)", "monitor", "Faxton-Rentals-Windows.exe", "Run the installer. After this the app updates itself."],
  ["mac_arm64", "MacBook · Apple Silicon", "monitor", "Faxton-Rentals-Mac-arm64.dmg", "M1, M2, M3 and M4 Macs. Open the .dmg, drag the app to Applications, then right-click it and choose Open the first time."],
  ["mac_x64", "MacBook · Intel", "monitor", "Faxton-Rentals-Mac-x64.dmg", "Older Intel Macs. Same steps as Apple Silicon."],
];
const mb = (n) => (n ? (n / 1048576).toFixed(n < 10485760 ? 1 : 0) + " MB" : "");
const vparts = (v) => String(v || "0").split(".").map((x) => parseInt(x, 10) || 0);
export const newer = (a, b) => { const x = vparts(a), y = vparts(b); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; };

// Which installed app are we running in? (null in a normal browser)
export function shellInfo() {
  const ua = navigator.userAgent, m = /FaxtonApp\/([a-z-]+)(?:\/([\d.]+))?/.exec(ua);
  if (!m) return null;
  const kind = m[1];
  const platform = kind === "desktop-win" ? "windows" : kind === "desktop-mac" ? (/arch\/arm64/.test(ua) ? "mac_arm64" : "mac_x64") : /Android/i.test(ua) ? "android" : "iphone";
  return { kind, platform, version: m[2] || "0.0.0" };
}
export const latestFor = (list, platform) => [...list].filter((r) => r.published && r.files?.[platform]?.url).sort((a, b) => (newer(a.version, b.version) ? -1 : newer(b.version, a.version) ? 1 : 0))[0] || null;

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
  const file = rel.files[info.platform], key = "upd:" + rel.version;
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
const fmtDate = (t) => { const s = t?.seconds; return s ? new Date(s * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"; };
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
  let releases = await st.adminAll("appReleases");
  releases.sort((a, b) => (newer(a.version, b.version) ? -1 : newer(b.version, a.version) ? 1 : 0));
  const live = releases.find((r) => r.published);
  const html = `<div class="page-head"><div><h1>Installations</h1><p>Upload app versions, edit their names, and publish them. Installed apps are notified automatically.</p></div><button class="btn primary" id="newRel">${icon("plus", 18)} New release</button></div>
  <section class="panel ga-live"><h3>Latest published${live ? ` · v${esc(live.version)}` : ""}</h3>${live ? `<div class="ga-grid">${PLATFORMS.map(([k, name, ic, , tip]) => { const f = live.files?.[k]; return `<div class="ga-card2"><span class="ga-ic">${icon(ic, 22)}</span><div><b>${esc(name)}</b><small>${f ? esc(mb(f.size) || "Ready") : "Not uploaded"}</small></div>${f ? `<a class="btn sm primary" href="${esc(f.url)}" rel="noopener">${icon("download", 16)} Download</a>` : `<span class="muted">—</span>`}</div>`; }).join("")}</div>` : `<p class="muted">Nothing is published yet. Create a release, add the files, and tick “Publish”.</p>`}</section>
  <section class="panel" style="margin-top:16px"><div class="panel-head"><h3>All releases</h3></div><div class="tbl-wrap"><table><thead><tr><th>Version</th><th>Name</th><th>Files</th><th>Status</th><th>Date</th><th></th></tr></thead><tbody>${releases.map((r) => `<tr><td><b>${esc(r.version)}</b></td><td>${esc(r.name)}</td><td>${Object.keys(r.files || {}).length}/5</td><td><span class="pill ${r.published ? "" : "warn"}">${r.published ? "Published" : "Draft"}</span>${r.mandatory ? ' <span class="pill bad">Required</span>' : ""}</td><td>${fmtDate(r.createdAt)}</td><td class="act-cell"><button class="btn sm" data-edit="${esc(r.id)}">Edit</button> <button class="btn sm" data-pub="${esc(r.id)}">${r.published ? "Unpublish" : "Publish"}</button> <button class="btn sm" data-del="${esc(r.id)}" aria-label="Delete">${icon("x", 14)}</button></td></tr>`).join("") || `<tr><td colspan="6" class="muted">No releases yet.</td></tr>`}</tbody></table></div></section>
  <p class="muted" style="margin-top:14px">Files can be uploaded here (needs Firebase Storage) or linked by URL. “Import latest build” fills the links from the newest GitHub build. Windows installs also update themselves from GitHub.</p>`;

  const form = (r) => {
    const files = { ...(r?.files || {}) };
    const m = modal(`<h2>${r ? "Edit release" : "New release"}</h2><form id="rf" class="ins-form">
      <div class="f2"><div class="field"><label for="rv">Version</label><input id="rv" required pattern="\\d+\\.\\d+\\.\\d+" placeholder="1.0.1" value="${esc(r?.version || "")}"></div><div class="field"><label for="rn">Release name</label><input id="rn" required maxlength="120" placeholder="Faxton Rentals 1.0.1" value="${esc(r?.name || "")}"></div></div>
      <div class="field"><label for="rt">What’s new (one line each: Title – description)</label><textarea id="rt" rows="4" maxlength="3000" placeholder="Improved home search – Find the right home faster.">${esc(r?.notes || "")}</textarea></div>
      <div class="ins-files">${PLATFORMS.map(([k, name]) => `<div class="ins-row" data-k="${k}"><b>${esc(name)}</b><input type="url" class="u" placeholder="https://… download link" value="${esc(files[k]?.url || "")}"><label class="btn sm up">${icon("upload", 16)} Upload<input type="file" hidden></label><i class="pg"></i></div>`).join("")}</div>
      <label class="chk"><input id="rm" type="checkbox" ${r?.mandatory ? "checked" : ""}> Required update (users can’t dismiss it)</label>
      <label class="chk"><input id="rp" type="checkbox" ${r ? (r.published ? "checked" : "") : "checked"}> Publish now (sends the update notification)</label>
      <p class="err" id="re" role="alert"></p>
      <div class="a2-act"><button type="button" class="btn" id="imp">Import latest build</button><button class="btn primary" type="submit">Save release</button></div></form>`);
    m.el.classList.add("ins-modal");
    const err = $("#re", m.el);
    $("#imp", m.el).onclick = async (e) => { e.target.disabled = true; try { const g = await githubLatest(); $("#rv", m.el).value ||= g.version; $("#rn", m.el).value ||= `Faxton Rentals ${g.version}`; if (!$("#rt", m.el).value) $("#rt", m.el).value = g.notes.split("\n").filter((l) => /^[-*]/.test(l)).join("\n"); Object.assign(files, g.files); $$(".ins-row", m.el).forEach((row) => { const f = files[row.dataset.k]; if (f) $(".u", row).value = f.url; }); toast("Imported the latest GitHub build."); } catch (x) { err.textContent = "Couldn’t import: " + (x.message || x); } e.target.disabled = false; };
    $$(".ins-row", m.el).forEach((row) => {
      const k = row.dataset.k, pg = $(".pg", row), inp = $("input[type=file]", row);
      $(".u", row).oninput = (e) => { const v = e.target.value.trim(); if (v) files[k] = { ...(files[k] || {}), url: v, source: "link" }; else delete files[k]; };
      inp.onchange = async () => {
        const f = inp.files[0]; if (!f) return; const ver = $("#rv", m.el).value.trim();
        if (!/^\d+\.\d+\.\d+$/.test(ver)) { err.textContent = "Enter the version number first."; return; }
        err.textContent = ""; pg.textContent = "0%";
        try { files[k] = await uploadInstaller(f, ver, (p) => (pg.textContent = Math.round(p * 100) + "%")); $(".u", row).value = files[k].url; pg.textContent = "Uploaded ✓"; }
        catch (x) { pg.textContent = ""; err.textContent = /storage|unauthor|permission|404|bucket/i.test(String(x?.code || x)) ? "Upload isn’t available yet. Turn on Firebase Storage for this project, or paste a download link instead." : friendlyErr(x); }
      };
    });
    $("#rf", m.el).onsubmit = async (e) => {
      e.preventDefault(); err.textContent = "";
      const data = { version: $("#rv", m.el).value.trim(), name: $("#rn", m.el).value.trim(), notes: $("#rt", m.el).value.trim(), mandatory: $("#rm", m.el).checked, published: $("#rp", m.el).checked, files: Object.fromEntries(Object.entries(files).filter(([, v]) => v?.url && /^https:\/\//.test(v.url))) };
      if (!/^\d+\.\d+\.\d+$/.test(data.version)) return (err.textContent = "Version must look like 1.2.3.");
      if (data.published && !Object.keys(data.files).length) return (err.textContent = "Add at least one file before publishing.");
      try { await st.saveRelease(r?.id, data); m.close(); toast(data.published ? "Release published. Apps will be notified." : "Release saved."); ctx.render(); } catch (x) { err.textContent = friendlyErr(x); }
    };
  };
  return { title: "Installations", admin: true, html, mount(root) {
    $("#newRel", root).onclick = () => form(null);
    $$("[data-edit]", root).forEach((b) => (b.onclick = () => form(releases.find((x) => x.id === b.dataset.edit))));
    $$("[data-pub]", root).forEach((b) => (b.onclick = async () => { const r = releases.find((x) => x.id === b.dataset.pub); try { await st.saveRelease(r.id, { ...strip(r), published: !r.published }); toast(r.published ? "Unpublished." : "Published. Apps will be notified."); ctx.render(); } catch (x) { toast(friendlyErr(x)); } }));
    $$("[data-del]", root).forEach((b) => (b.onclick = async () => { const r = releases.find((x) => x.id === b.dataset.del); if (!confirm(`Delete version ${r.version}? This can’t be undone.`)) return; try { await st.removeRelease(r.id); toast("Release deleted."); ctx.render(); } catch (x) { toast(friendlyErr(x)); } }));
  } };
}
const strip = ({ id, createdAt, updatedAt, ...rest }) => rest;
