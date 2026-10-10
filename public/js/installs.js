// Installations: the admin page for app releases (list, latest published, and a release editor in a right-hand drawer).
// Loaded for staff only. Data helpers (platform list, GitHub import, file upload) live in apps.js.
import { friendlyErr } from "./ui.js";
import * as st from "./store.js";
import * as AX from "./ax.js";
import { createList } from "./ax-list.js";

const { $, $$, esc, I, btn, chipFor, chip, fmt, toast, confirm, drawer, data, setQ, hq, changed, pageView, progress, empty, dl, section } = AX;
const fe = (e) => friendlyErr(e).replace(/\s*\([^)]*\)\s*$/, "");
const VER = /^\d+\.\d+\.\d+$/;

export function page(ctx, A) {
  const { PLATFORMS, newer, mb, githubLatest, uploadInstaller } = A, N = PLATFORMS.length;
  const strip = ({ id, createdAt, updatedAt, ...rest }) => rest;
  const sorted = (l) => [...l].sort((a, b) => (newer(a.version, b.version) ? -1 : newer(b.version, a.version) ? 1 : 0));
  const nFiles = (r) => Object.keys(r.files || {}).length;
  return pageView(ctx, { title: "Installations", eyebrow: "System", sub: "Upload app versions, name them and publish. Installed apps are told automatically.", cols: [["rels", "appReleases"]], what: "app releases",
    actions: btn("New release", { v: "primary", ic: "plus", attrs: "data-act=new" }),
    async render({ rels }, { root, reload }) {
      let rows = sorted(rels);
      const live = () => rows.find((r) => r.published);
      const latestHtml = () => { const l = live(); return `<section class="ax-card ax-live" aria-label="Latest published">
        <header class="ax-card-h"><h2>Latest published</h2>${l ? `${chip("ok", "v" + l.version)}${l.mandatory ? chipFor("release", "required") : ""}<span class="ax-sub">${esc(fmt.date(l.createdAt))}</span>` : ""}</header>
        ${l ? `<div class="ax-plat">${PLATFORMS.map(([k, name, ic]) => { const f = l.files?.[k] || (k === "windows_x64" ? l.files?.windows : null); return `<div class="ax-pl ${f ? "" : "is-off"}"><span class="ax-tile sm">${I(ic, 18)}</span><div><b>${esc(name)}</b><small>${f ? esc(mb(f.size) || "Ready") : "Not uploaded"}</small></div>${f ? `<a class="ax-btn" data-v="soft" data-size="sm" href="${esc(f.url)}" rel="noopener" aria-label="Download ${esc(name)}">${I("download", 16)}<span>Download</span></a>` : ""}</div>`; }).join("")}</div>`
        : empty({ icon: "download", title: "Nothing is published yet", hint: "Create a release, add the download links, and publish it so installed apps can update." })}</section>`; };

      // ----- release editor (right-hand drawer) -----
      const editor = (r, onDone) => {
        const files = { ...(r?.files || {}) };
        const body = `<form id="rf" class="ax-rform" novalidate>
          <div class="ax-two"><label class="ax-field"><span>Version</span><input class="ax-input" id="rv" inputmode="decimal" autocomplete="off" placeholder="1.0.1" value="${esc(r?.version || "")}" aria-describedby="rvE"><em class="ax-err" id="rvE" role="alert"></em></label>
          <label class="ax-field"><span>Release name</span><input class="ax-input" id="rn" maxlength="120" autocomplete="off" placeholder="Faxton Rentals 1.0.1" value="${esc(r?.name || "")}"></label></div>
          <label class="ax-field"><span>What’s new <small>one line each: Title – description</small></span><textarea class="ax-input" id="rt" rows="4" maxlength="3000" placeholder="Improved home search – Find the right home faster.">${esc(r?.notes || "")}</textarea></label>
          <div class="ax-rfiles"><div class="ax-rfiles-h"><b>Downloads</b><span class="ax-sub" id="rcnt"></span><button type="button" class="ax-btn" data-v="ghost" data-size="sm" id="imp">${I("download", 16)}<span>Import latest build</span></button></div>
          ${PLATFORMS.map(([k, name, ic]) => `<div class="ax-rrow" data-k="${k}"><span class="ax-tile sm">${I(ic, 16)}</span><label for="u_${k}">${esc(name)}</label><input class="ax-input u" id="u_${k}" type="url" inputmode="url" autocomplete="off" placeholder="https://… download link" value="${esc(files[k]?.url || "")}"><label class="ax-btn up" data-v="outline" data-size="sm" tabindex="0">${I("upload", 16)}<span>Upload</span><input type="file" hidden></label><span class="ax-pg" aria-live="polite"></span></div>`).join("")}</div>
          <label class="ax-switch"><input id="rm" type="checkbox" ${r?.mandatory ? "checked" : ""}><span>Required update <small>People can’t dismiss it.</small></span></label>
          <p class="ax-err" id="re" role="alert"></p></form>`;
        return { title: r ? "Edit release" : "New release", sub: r ? chipFor("release", r.published ? "published" : "draft") : "", w: "lg", body,
          footer: r?.published ? btn("Save changes", { v: "primary", attrs: "data-save=keep" }) : `${btn("Save draft", { attrs: "data-save=draft" })}${btn("Publish release", { v: "primary", attrs: "data-save=pub" })}`,
          mount(el, b, f) {
            const err = $("#re", b), vE = $("#rvE", b), cnt = () => { $("#rcnt", b).textContent = `${Object.keys(files).filter((k) => files[k]?.url).length} of ${N} added`; }; cnt();
            $("#imp", b).onclick = async (e) => { const t = e.currentTarget; t.disabled = true; try { const g = await githubLatest(); $("#rv", b).value ||= g.version; $("#rn", b).value ||= `Faxton Rentals ${g.version}`; if (!$("#rt", b).value) $("#rt", b).value = g.notes.split("\n").filter((l) => /^[-*]/.test(l)).join("\n"); Object.assign(files, g.files); $$(".ax-rrow", b).forEach((row) => { const x = files[row.dataset.k]; if (x) $(".u", row).value = x.url; }); cnt(); toast("Imported the latest GitHub build."); } catch (x) { err.textContent = "We couldn’t import the latest build. " + (/No GitHub release/.test(x?.message) ? "There is no GitHub release yet." : "Check your connection and try again."); } t.disabled = false; };
            $$(".ax-rrow", b).forEach((row) => {
              const k = row.dataset.k, pg = $(".ax-pg", row), inp = $("input[type=file]", row), u = $(".u", row), up = $(".up", row);
              u.oninput = () => { const v = u.value.trim(); if (v) files[k] = { ...(files[k] || {}), url: v, source: "link" }; else delete files[k]; u.removeAttribute("aria-invalid"); cnt(); };
              up.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); inp.click(); } };
              inp.onchange = async () => {
                const file = inp.files[0]; if (!file) return; const ver = $("#rv", b).value.trim();
                if (!VER.test(ver)) { vE.textContent = "Enter the version number first, like 1.2.3."; $("#rv", b).focus(); return; }
                err.textContent = ""; pg.textContent = "0%";
                try { files[k] = await uploadInstaller(file, ver, (p) => (pg.textContent = Math.round(p * 100) + "%")); u.value = files[k].url; pg.textContent = "Uploaded"; cnt(); }
                catch (x) { pg.textContent = ""; err.textContent = /storage|unauthor|permission|404|bucket/i.test(String(x?.code || x)) ? "Uploading isn’t available yet. Paste a download link instead." : fe(x); }
              };
            });
            $("#rv", b).oninput = () => (vE.textContent = "");
            f.onclick = async (e) => {
              const bt = e.target.closest("[data-save]"); if (!bt) return; const pub = bt.dataset.save !== "draft"; err.textContent = ""; vE.textContent = "";
              const d = { version: $("#rv", b).value.trim(), name: $("#rn", b).value.trim(), notes: $("#rt", b).value.trim(), mandatory: $("#rm", b).checked, published: pub, files: Object.fromEntries(Object.entries(files).filter(([, v]) => v?.url)) };
              if (!VER.test(d.version)) { vE.textContent = "Use three numbers with dots, like 1.2.3."; $("#rv", b).focus(); return; }
              if (!d.name) d.name = `Faxton Rentals ${d.version}`;
              const bad = Object.entries(d.files).find(([, v]) => !/^https:\/\//.test(v.url));
              if (bad) { const row = $(`.ax-rrow[data-k="${bad[0]}"] .u`, b); row?.setAttribute("aria-invalid", "true"); row?.focus(); err.textContent = "Download links must start with https://"; return; }
              if (pub && !Object.keys(d.files).length) { err.textContent = "Add at least one download before publishing."; return; }
              bt.disabled = true; bt.classList.add("is-busy");
              try { await st.saveRelease(r?.id, d); data.invalidate("appReleases"); changed(); drawer.close(); toast(bt.dataset.save === "pub" ? "Release published. Installed apps will be told." : bt.dataset.save === "keep" ? "Changes saved." : "Draft saved."); onDone(); }
              catch (x) { bt.disabled = false; bt.classList.remove("is-busy"); err.textContent = fe(x); }
            };
          } };
      };
      const toggle = async (r, api) => { try { await st.saveRelease(r.id, { ...strip(r), published: !r.published }); data.invalidate("appReleases"); r.published = !r.published; changed(); api.refresh(); paintLive(); toast(r.published ? "Published. Installed apps will be told." : "Unpublished."); } catch (x) { toast(fe(x), { tone: "bad" }); } };
      const del = async (r, api) => { if (!(await confirm({ title: `Delete version ${r.version}?`, body: "This can’t be undone. Installed apps will stop being offered this version.", confirmLabel: "Delete release", tone: "danger", icon: "trash" }))) return; try { await st.removeRelease(r.id); data.invalidate("appReleases"); rows = rows.filter((x) => x.id !== r.id); changed(); api.list.setRows(rows); paintLive(); toast("Release deleted."); } catch (x) { toast(fe(x), { tone: "bad" }); } };
      let host; const paintLive = () => { const h = $("#axLive", host); if (h) h.innerHTML = latestHtml(); };
      return { html: `<div id="axLive">${latestHtml()}</div><div id="axRel" style="margin-top:16px"></div><p class="ax-help" style="margin-top:12px">Uploads need Firebase Storage. Until it is switched on, paste links to the files instead. “Import latest build” fills the links from the newest GitHub build, and Windows installs also update themselves from GitHub.</p>`, mount(el) {
        host = el;
        const list = createList($("#axRel", el), { noun: "releases", label: "Releases", rows, placeholder: "Search versions…", sort: null, compare: (a, b) => (newer(a.version, b.version) ? -1 : newer(b.version, a.version) ? 1 : 0),
          cols: [
            { k: "v", label: "Version", role: "title", cell: (r) => `<div class="ax-id"><span class="ax-tile sm">${I("download", 16)}</span><div><b class="num">${esc(r.version)}</b><small>${esc(r.name || "")}</small></div></div>` },
            { k: "files", label: "Files", pri: 2, cell: (r) => `<div class="ax-fprog">${progress(nFiles(r), N)}<span class="num">${nFiles(r)}/${N}</span></div>` },
            { k: "status", label: "Status", role: "status", cell: (r) => `${chipFor("release", r.published ? "published" : "draft")}${r.mandatory ? " " + chipFor("release", "required") : ""}` },
            { k: "date", label: "Date", pri: 2, cell: (r) => esc(fmt.date(r.createdAt)) },
          ],
          menu: (r, api) => [{ label: "Edit", icon: "edit", act: api.open }, { label: r.published ? "Unpublish" : "Publish", icon: r.published ? "x" : "check", act: () => toggle(r, api) }, ...(r.published ? [] : [{ sep: 1 }, { label: "Delete draft", icon: "trash", tone: "danger", act: () => del(r, { ...api, list: list }) }])],
          drawer: (r) => editor(r, () => reload()),
          empty: { icon: "download", title: "No releases yet", hint: "Create the first release to let installed apps update.", action: btn("New release", { v: "primary", ic: "plus", attrs: "data-act=new2" }) } });
        const open = () => { drawer.open({ ...editor(null, () => reload()), onClose: () => setQ({ new: "" }) }); };
        root.querySelector("[data-act=new]")?.addEventListener("click", () => { setQ({ new: "1" }); open(); });
        el.addEventListener("click", (e) => e.target.closest("[data-act=new2]") && (setQ({ new: "1" }), open()));
        if (hq().q.new) open();
      } };
    } });
}
