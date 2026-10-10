// ax-list.js: the one list pattern used by every console page: tabs with counts, search, facets, sortable table that becomes cards
// on phones, bulk actions, pagination, and a right-hand drawer for the open record. State lives in the hash query.
import { $, $$, esc, I, btn, tabs, mountTabs, menu, drawer, dialog, hq, setQ, page, empty, csv, bulkRun, toast, phone, changed } from "./ax.js";

let current = null;
export function createList(root, cfg) {
  current?.destroy();
  const cols = cfg.cols, bulk = cfg.bulk || null, hasAct = !!(cfg.menu || cfg.quick), noun = cfg.noun || "items", CAP = 50;
  const tabList = cfg.tabs || null, defTab = tabList ? tabList[0].k : "";
  let density = "compact"; try { density = localStorage.getItem("axDensity") || "compact"; } catch {}
  const S = { tab: defTab, q: "", f: {}, sort: cfg.sort ? { ...cfg.sort } : null, page: 1, per: 25, sel: new Set(), id: null, selmode: false };
  let rows = cfg.rows || [], view = [], pushed = false, lastSel = null, alive = true;
  const facets = cfg.facets || [];
  const fopts = (f) => (typeof f.options === "function" ? f.options(rows) : f.options);
  const fLabel = (f, v) => (fopts(f).find((o) => String(o[0]) === String(v)) || [v, v])[1];

  root.innerHTML = `<div class="ax-list" data-noun="${esc(noun)}">
    ${tabList ? `<div class="ax-tabbar" data-tabs></div>` : ""}
    <div class="ax-filters"><label class="ax-search">${I("search", 18)}<input type="search" data-q placeholder="${esc(cfg.placeholder || "Search " + noun + "…")}" aria-label="Search ${esc(noun)}" autocomplete="off" spellcheck="false"><button type="button" class="ax-sx" data-qx aria-label="Clear search" hidden>${I("x", 14)}</button></label>
      <div class="ax-facets" data-facets></div>
      ${facets.length ? `<button type="button" class="ax-btn ax-fbtn" data-v="outline" data-fsheet>${I("filter", 18)}<span>Filters</span><b data-fcount hidden></b></button>` : ""}
      ${bulk ? `<button type="button" class="ax-btn ax-selbtn" data-v="outline" data-selmode>${I("check", 18)}<span>Select</span></button>` : ""}
      <span class="ax-grow"></span>
      ${cfg.filterExtra || ""}
      <span class="ax-dens" role="group" aria-label="Row density"><button type="button" class="ax-ib" data-dens="compact" aria-label="Compact rows" aria-pressed="${density === "compact"}">${I("rows", 18)}</button><button type="button" class="ax-ib" data-dens="comfortable" aria-label="Comfortable rows" aria-pressed="${density === "comfortable"}">${I("rowsLg", 18)}</button></span>
      ${cfg.csv ? `<button type="button" class="ax-btn ax-expbtn" data-v="ghost" data-csv>${I("download", 18)}<span>Export CSV</span></button>` : ""}</div>
    <div class="ax-fchips" data-chips></div>
    <div class="ax-card ax-tablecard"><div class="ax-bulk" data-bulk hidden></div>
      <div class="ax-scroll"><table class="ax-table" data-density="${density}" ${bulk ? "" : 'data-nosel=""'} aria-label="${esc(cfg.label || noun)}"><thead></thead><tbody></tbody></table></div>
      <div data-state></div><footer class="ax-pager" data-pager></footer></div>
    <div class="ax-sr" aria-live="polite" data-live></div></div>`;
  const q$ = (s) => $(s, root), tbody = q$("tbody"), thead = q$("thead"), tbl = q$("table"), card = q$(".ax-tablecard");

  const passTab = (r, k) => { const t = tabList?.find((x) => x.k === k); return !t || !t.test || t.test(r); };
  const passF = (r) => facets.every((f) => !S.f[f.k] || f.test(r, S.f[f.k]));
  const passQ = (r) => { if (!S.q) return true; const h = (cfg.search ? cfg.search(r) : JSON.stringify(r)).toLowerCase(); return S.q.toLowerCase().split(/\s+/).every((w) => h.includes(w)); };
  function compute() {
    view = rows.filter((r) => passTab(r, S.tab) && passF(r) && passQ(r));
    if (S.sort && cols.find((c) => c.k === S.sort.k)?.sort) { const g = cols.find((c) => c.k === S.sort.k).sort, d = S.sort.dir === "desc" ? -1 : 1; view.sort((a, b) => { const x = g(a), y = g(b); return (x > y ? 1 : x < y ? -1 : 0) * d; }); }
    else if (cfg.compare) view.sort(cfg.compare);
    if (cfg.pin) { const p = view.filter(cfg.pin), o = view.filter((r) => !cfg.pin(r)); view = [...p, ...o]; }
    const pages = Math.max(1, Math.ceil(view.length / S.per)); if (S.page > pages) S.page = pages;
    S.sel.forEach((id) => { if (!view.some((r) => r.id === id)) S.sel.delete(id); });
  }
  const pageRows = () => view.slice((S.page - 1) * S.per, S.page * S.per);

  // ----- painting -----
  function paintTabs() {
    if (!tabList) return; const host = q$("[data-tabs]");
    const items = tabList.map((t) => ({ k: t.k, label: t.label, count: rows.filter((r) => !t.test || t.test(r)).length, tone: t.tone && rows.some((r) => !t.test || t.test(r)) ? t.tone : "" }));
    if (!host.firstChild) { host.innerHTML = tabs(items, S.tab, { label: noun }); mountTabs(host, (k) => { S.tab = k; S.page = 1; S.sel.clear(); compute(); paint(); syncUrl(); }); }
    else $$(".ax-tab", host).forEach((b) => { const it = items.find((x) => x.k === b.dataset.k); b.setAttribute("aria-selected", b.dataset.k === S.tab); b.tabIndex = b.dataset.k === S.tab ? 0 : -1; let c = $("b", b); if (it.count != null) { if (!c) { c = document.createElement("b"); b.append(c); } c.textContent = it.count > 99 ? "99+" : it.count; } if (it.tone) b.dataset.t = it.tone; else delete b.dataset.t; });
  }
  function paintFacets() {
    q$("[data-facets]").innerHTML = facets.map((f) => { const v = S.f[f.k]; return `<span class="ax-facetw ${v ? "is-set" : ""}"><button type="button" class="ax-facet" data-fbtn="${f.k}" aria-haspopup="menu" aria-expanded="false">${esc(f.label)}${v ? `<span class="ax-fval">${esc(fLabel(f, v))}</span>` : ""}${v ? "" : I("chevD", 14)}</button>${v ? `<button type="button" class="ax-fx" data-fclear="${f.k}" aria-label="Clear ${esc(f.label)} filter">${I("x", 12, 2.2)}</button>` : ""}</span>`; }).join("");
    const n = facets.filter((f) => S.f[f.k]).length, c = q$("[data-fcount]"); if (c) { c.hidden = !n; c.textContent = n; }
    q$("[data-chips]").innerHTML = [S.q ? `<button type="button" class="ax-fchip" data-rm="q">“${esc(S.q)}” ${I("x", 12, 2.2)}</button>` : "", ...facets.filter((f) => S.f[f.k]).map((f) => `<button type="button" class="ax-fchip" data-rm="${f.k}">${esc(f.label)}: ${esc(fLabel(f, S.f[f.k]))} ${I("x", 12, 2.2)}</button>`)].join("");
    const qi = q$("[data-q]"); q$("[data-qx]").hidden = !S.q; if (document.activeElement !== qi && qi.value !== S.q) qi.value = S.q;
  }
  function thHtml() {
    return `<tr>${bulk ? `<th class="sel" scope="col"><input type="checkbox" data-selall aria-label="Select all on this page"></th>` : ""}${cols.map((c) => { const on = S.sort?.k === c.k; return `<th scope="col" ${c.align ? `class="al-${c.align}"` : ""} ${c.pri ? `data-priority="${c.pri}"` : ""} ${c.sort ? `aria-sort="${on ? (S.sort.dir === "desc" ? "descending" : "ascending") : "none"}"` : ""}>${c.sort ? `<button type="button" class="ax-sortb" data-sort="${c.k}">${esc(c.label)}<span class="ax-caret" data-on="${on}">${on && S.sort.dir === "desc" ? I("sortDn", 14) : I("sortUp", 14)}</span></button>` : esc(c.label)}</th>`; }).join("")}${hasAct ? `<th scope="col" class="al-right"><span class="ax-sr">Actions</span></th>` : ""}</tr>`;
  }
  const rowHtml = (r) => `<tr data-id="${esc(r.id)}" tabindex="0" ${S.sel.has(r.id) ? 'data-sel="1"' : ""} ${S.id === r.id ? 'aria-selected="true"' : ""} ${cfg.rowTone?.(r) ? `data-tone="${cfg.rowTone(r)}"` : ""}>${bulk ? `<td data-role="select" class="sel"><input type="checkbox" data-sel ${S.sel.has(r.id) ? "checked" : ""} aria-label="Select row"></td>` : ""}${cols.map((c) => `<td data-label="${esc(c.label)}" ${c.role ? `data-role="${c.role}"` : ""} ${c.pri ? `data-priority="${c.pri}"` : ""} ${c.align ? `class="al-${c.align}"` : ""}>${c.cell(r)}</td>`).join("")}${hasAct ? `<td data-role="actions" class="al-right"><div class="ax-ra">${cfg.quick ? cfg.quick(r) : ""}${cfg.menu ? `<button type="button" class="ax-ib ax-kebab" data-kebab aria-label="More actions" aria-haspopup="menu" aria-expanded="false">${I("more", 18)}</button>` : ""}</div></td>` : ""}</tr>`;
  function paintBody() {
    const pr = pageRows(); thead.innerHTML = thHtml(); tbody.innerHTML = pr.map(rowHtml).join("");
    const sa = q$("[data-selall]"); if (sa) { const n = pr.filter((r) => S.sel.has(r.id)).length; sa.checked = !!pr.length && n === pr.length; sa.indeterminate = n > 0 && n < pr.length; }
    const none = !view.length, st = q$("[data-state]"); card.classList.toggle("is-empty", none);
    st.innerHTML = !none ? "" : !rows.length ? empty(cfg.empty || { title: `No ${noun} yet` }) : empty({ icon: "search", title: `No ${noun} match`, hint: "Try a different word or clear the filters.", action: btn("Clear filters", { attrs: "data-clear" }) });
    const n = view.length, from = n ? (S.page - 1) * S.per + 1 : 0, to = Math.min(n, S.page * S.per), pages = Math.max(1, Math.ceil(n / S.per));
    q$("[data-pager]").hidden = !n; q$("[data-pager]").innerHTML = `<span class="ax-pn">${from}–${to} of ${n}</span><span class="ax-grow"></span><label class="ax-per">Rows <select data-per aria-label="Rows per page">${[25, 50, 100].map((x) => `<option ${x === S.per ? "selected" : ""}>${x}</option>`).join("")}</select></label><button type="button" class="ax-ib" data-pg="-1" aria-label="Previous page" ${S.page <= 1 ? "disabled" : ""}>${I("chevL", 18)}</button><button type="button" class="ax-ib" data-pg="1" aria-label="Next page" ${S.page >= pages ? "disabled" : ""}>${I("chevR", 18)}</button>`;
    const b = q$("[data-bulk]"); b.hidden = !bulk || !S.sel.size; tbl.toggleAttribute("data-selmode", !!bulk && (S.sel.size > 0 || S.selmode));
    if (bulk && S.sel.size) b.innerHTML = `<b class="num">${S.sel.size} selected</b>${S.sel.size > CAP ? `<span class="ax-warnt">Select up to ${CAP} at a time</span>` : ""}<span class="ax-bulk-a">${bulk.map((x, i) => `<button type="button" class="ax-btn" data-v="${x.tone === "danger" ? "danger" : "outline"}" data-size="sm" data-bulk="${i}" ${S.sel.size > CAP && !x.free ? "disabled" : ""}>${x.icon ? I(x.icon, 16) : ""}<span>${esc(x.label)}</span></button>`).join("")}</span><button type="button" class="ax-btn" data-v="ghost" data-size="sm" data-bulkclear>Clear</button>`;
    const lv = q$("[data-live]"); lv.textContent = bulk && S.sel.size ? `${S.sel.size} selected` : "";
  }
  function paint() { paintTabs(); paintFacets(); paintBody(); }
  function paintRowSel() { $$("tbody tr", root).forEach((tr) => (tr.dataset.id === S.id ? tr.setAttribute("aria-selected", "true") : tr.removeAttribute("aria-selected"))); }

  // ----- url state -----
  function syncUrl() {
    const o = { tab: S.tab === defTab ? "" : S.tab, q: S.q, page: S.page > 1 ? S.page : "", sort: S.sort && (!cfg.sort || S.sort.k !== cfg.sort.k || S.sort.dir !== cfg.sort.dir) ? (S.sort.dir === "desc" ? "-" : "") + S.sort.k : "" };
    facets.forEach((f) => (o[f.k] = S.f[f.k] || "")); setQ(o);
  }
  function applyQuery(q, init) {
    const t = tabList?.find((x) => x.k.toLowerCase() === String(q.tab || "").toLowerCase() || x.label.toLowerCase() === String(q.tab || "").toLowerCase()); S.tab = t ? t.k : (init && cfg.defaultTab?.(rows)) || defTab;
    S.q = q.q || ""; S.page = Math.max(1, +q.page || 1); facets.forEach((f) => (S.f[f.k] = q[f.k] || ""));
    if (q.sort) { const d = q.sort[0] === "-"; S.sort = { k: q.sort.replace(/^-/, ""), dir: d ? "desc" : "asc" }; } else S.sort = cfg.sort ? { ...cfg.sort } : null;
    S.sel.clear(); compute(); paint();
    if (q.id) { if (S.id !== q.id) openRow(q.id, { push: false, fromUrl: true }); } else if (S.id) { drawer.close({ silent: true }); S.id = null; pushed = false; paintRowSel(); }    if (!init) cfg.onQuery?.(q);
  }

  // ----- drawer -----
  function openRow(id, o = {}) {
    const r = rows.find((x) => x.id === id); if (!r) { if (o.fromUrl) setQ({ id: "" }); return; }
    const was = S.id; S.id = id;
    if (o.push !== false) { if (!hq().q.id) { setQ({ id }, "push"); pushed = true; } else setQ({ id }); } else if (!o.fromUrl) setQ({ id });
    renderDrawer(r, !!was && was === id); paintRowSel();
  }
  function renderDrawer(r, keep) {
    const i = view.findIndex((x) => x.id === r.id), api = { row: r, list: ctl, refresh: () => refresh(r.id), close: () => closeRow(), update: (p) => { Object.assign(r, p); changed(); refresh(r.id); } };
    const d = cfg.drawer(r, api);
    drawer.open({ ...d, keepScroll: keep, prev: i > 0 ? () => openRow(view[i - 1].id, { push: false }) : null, next: i >= 0 && i < view.length - 1 ? () => openRow(view[i + 1].id, { push: false }) : null, onClose: () => { S.id = null; paintRowSel(); if (pushed) { pushed = false; history.back(); } else setQ({ id: "" }); } });
  }
  function closeRow() { drawer.close(); }
  function refresh(id) { compute(); paint(); if (S.id && (!id || id === S.id)) { const r = rows.find((x) => x.id === S.id); if (r && drawer.isOpen) renderDrawer(r, true); } }

  // ----- events -----
  const sel = (id, on) => { on ? S.sel.add(id) : S.sel.delete(id); };
  root.addEventListener("click", (e) => {
    const t = e.target, $c = (s) => t.closest(s);
    let b;
    if ((b = $c("[data-sort]"))) { const k = b.dataset.sort; S.sort = S.sort?.k === k ? (S.sort.dir === "asc" ? { k, dir: "desc" } : null) : { k, dir: "asc" }; if (!S.sort && cfg.sort) S.sort = { ...cfg.sort }; S.page = 1; compute(); paint(); syncUrl(); return; }
    if ((b = $c("[data-pg]"))) { S.page += +b.dataset.pg; compute(); paintBody(); syncUrl(); card.scrollIntoView?.({ block: "nearest" }); return; }
    if ($c("[data-clear]")) { S.q = ""; facets.forEach((f) => (S.f[f.k] = "")); S.page = 1; compute(); paint(); syncUrl(); return; }
    if ((b = $c("[data-rm]"))) { if (b.dataset.rm === "q") S.q = ""; else S.f[b.dataset.rm] = ""; S.page = 1; compute(); paint(); syncUrl(); return; }
    if ((b = $c("[data-fclear]"))) { S.f[b.dataset.fclear] = ""; S.page = 1; compute(); paint(); syncUrl(); return; }
    if ((b = $c("[data-fbtn]"))) { const f = facets.find((x) => x.k === b.dataset.fbtn); menu(b, fopts(f).map(([v, l]) => ({ label: l, checked: String(S.f[f.k] || "") === String(v), act: () => { S.f[f.k] = v; S.page = 1; compute(); paint(); syncUrl(); } })), { align: "left", label: f.label }); return; }
    if ($c("[data-fsheet]")) return filterSheet();
    if ($c("[data-qx]")) { S.q = ""; compute(); paint(); syncUrl(); q$("[data-q]").focus(); return; }
    if ((b = $c("[data-dens]"))) { density = b.dataset.dens; try { localStorage.setItem("axDensity", density); } catch {} tbl.dataset.density = density; $$("[data-dens]", root).forEach((x) => x.setAttribute("aria-pressed", x === b)); return; }
    if ($c("[data-csv]")) { if (!view.length) return toast("Nothing to export yet."); csv(cfg.csv.name, cfg.csv.head, view.map(cfg.csv.row)); return; }
    if ($c("[data-selmode]")) { S.selmode = !S.selmode; if (!S.selmode) S.sel.clear(); paintBody(); return; }
    if ((b = $c("[data-bulkclear]"))) { S.sel.clear(); S.selmode = false; paintBody(); return; }
    if ((b = $c("[data-bulk]"))) { const x = bulk[+b.dataset.bulk], rs = [...S.sel].map((id) => rows.find((r) => r.id === id)).filter(Boolean); Promise.resolve(x.run(rs, { list: ctl, clear: () => { S.sel.clear(); S.selmode = false; refresh(); } })); return; }
    const tr = t.closest("tbody tr[data-id]"); if (!tr) return;
    const r = rows.find((x) => x.id === tr.dataset.id); if (!r) return;
    if (t.matches("input[data-sel]")) { const ids = pageRows().map((x) => x.id); if (e.shiftKey && lastSel && ids.includes(lastSel)) { const a = ids.indexOf(lastSel), z = ids.indexOf(r.id); ids.slice(Math.min(a, z), Math.max(a, z) + 1).forEach((id) => sel(id, t.checked)); } else sel(r.id, t.checked); lastSel = r.id; paintBody(); return; }
    if ((b = $c("[data-kebab]"))) { menu(b, cfg.menu(r, { row: r, list: ctl, refresh: () => refresh(r.id), update: (p) => { Object.assign(r, p); changed(); refresh(r.id); }, open: () => openRow(r.id) }), { label: "Actions" }); return; }
    if ((b = $c("[data-qa]"))) { cfg.onQuick?.(b.dataset.qa, r, b, { list: ctl, refresh: () => refresh(r.id), update: (p) => { Object.assign(r, p); changed(); refresh(r.id); } }); return; }
    if ((b = $c("[data-cell]"))) { cfg.onCell?.(b.dataset.cell, r, b, { list: ctl, refresh: () => refresh(r.id), update: (p) => { Object.assign(r, p); changed(); refresh(r.id); } }); return; }
    if (t.closest("a,button,input,label,select,textarea,[data-no-open]")) return;
    openRow(r.id);
  });
  root.addEventListener("change", (e) => {
    if (e.target.matches("[data-selall]")) { pageRows().forEach((r) => sel(r.id, e.target.checked)); paintBody(); }
    else if (e.target.matches("[data-per]")) { S.per = +e.target.value; S.page = 1; compute(); paintBody(); }
  });
  let qt; root.addEventListener("input", (e) => { if (!e.target.matches("[data-q]")) return; clearTimeout(qt); qt = setTimeout(() => { S.q = e.target.value.trim(); S.page = 1; compute(); paintTabs(); paintBody(); q$("[data-qx]").hidden = !S.q; q$("[data-chips]").innerHTML = ""; paintFacets(); syncUrl(); }, 120); });
  root.addEventListener("keydown", (e) => {
    const tr = e.target.closest?.("tbody tr[data-id]"); if (!tr || e.target !== tr) return;
    if (e.key === "Enter") { e.preventDefault(); openRow(tr.dataset.id); }
    else if (e.key === "x" && bulk && !e.ctrlKey && !e.metaKey) { e.preventDefault(); sel(tr.dataset.id, !S.sel.has(tr.dataset.id)); paintBody(); $(`tr[data-id="${CSS.escape(tr.dataset.id)}"]`, root)?.focus(); }
    else if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); (e.key === "ArrowDown" ? tr.nextElementSibling : tr.previousElementSibling)?.focus(); }
  });
  const gkey = (e) => {
    if (!alive || e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable) return;
    if ((e.key === "j" || e.key === "k") && drawer.isOpen && S.id) { const i = view.findIndex((x) => x.id === S.id), n = view[i + (e.key === "j" ? 1 : -1)]; if (n) { e.preventDefault(); openRow(n.id, { push: false }); } }
    else if (e.key === "/" ) { e.preventDefault(); q$("[data-q]")?.focus(); }
  };
  document.addEventListener("keydown", gkey);

  function filterSheet() {
    const body = () => facets.map((f) => `<fieldset class="ax-fs"><legend>${esc(f.label)}</legend>${fopts(f).map(([v, l]) => `<label class="ax-radio"><input type="radio" name="f_${f.k}" value="${esc(v)}" ${String(S.f[f.k] || "") === String(v) ? "checked" : ""}><span>${esc(l)}</span></label>`).join("")}</fieldset>`).join("");
    const d = dialog({ title: "Filters", sheet: true, size: "sheet", body: body(), footer: `${btn("Reset", { v: "ghost", attrs: "data-reset" })}${btn(`Show ${view.length} result${view.length === 1 ? "" : "s"}`, { v: "primary", attrs: "data-ok" })}` });
    const upd = () => { compute(); paint(); $("[data-ok] span", d.el).textContent = `Show ${view.length} result${view.length === 1 ? "" : "s"}`; };
    d.el.addEventListener("change", (e) => { if (e.target.name?.startsWith("f_")) { S.f[e.target.name.slice(2)] = e.target.value; S.page = 1; upd(); } });
    $("[data-reset]", d.el).onclick = () => { facets.forEach((f) => (S.f[f.k] = "")); S.page = 1; d.body.innerHTML = body(); upd(); };
    $("[data-ok]", d.el).onclick = () => { d.close(); syncUrl(); };
  }

  const ctl = {
    get rows() { return rows; }, get view() { return view; }, state: S,
    setRows(r) { rows = r; refresh(); },
    repaint: () => refresh(),
    open: (id) => openRow(id), close: closeRow,
    update(row, p) { Object.assign(row, p); changed(); refresh(row.id); },
    destroy() { alive = false; document.removeEventListener("keydown", gkey); if (current === ctl) current = null; },
  };
  current = ctl; page.path = hq().path; page.onSoft = (q) => applyQuery(q);
  applyQuery(hq().q, true);
  return ctl;
}
