// ax-web.js: console pages for what the public Faxton website collects: the Waitlist (owner and admins) and Website messages (owner, admins and support).
// The website writes both collections without signing in (see "Website forms" in firestore.rules); the console only reads, annotates and tidies them.
// Newest first, 100 at a time with "Load more" (single-field orderBy, no composite index). Totals come from the server's count, not from the loaded page.
import { friendlyErr } from "./ui.js";
import * as st from "./store.js";
import * as AX from "./ax.js";
import { createList } from "./ax-list.js";

const { $, $$, esc, I, btn, chip, chipFor, avatar, fmt, toast, confirm, menu, dl, section, changed, copy, pageView, csv, kpi, pctDelta, skeleton, ms } = AX;
const bad = (e) => toast(friendlyErr(e).replace(/\s*\([^)]*\)\s*$/, ""), { tone: "bad" });
const busy = (b, on) => { if (!b) return; b.classList.toggle("is-busy", on); b.disabled = on; };
const DAY = 864e5;

// ---------- shared: the "Showing 100 of 342 · Load more" bar under a list ----------
function moreBar(host, S, total, load) {
  const paint = () => {
    const t = Math.max(total ? total() : 0, S.rows.length);
    host.innerHTML = S.more ? `<span>${total ? `Showing the newest ${fmt.num(S.rows.length)} of ${fmt.num(t)}` : `Showing the newest ${fmt.num(S.rows.length)}`}</span>${btn("Load more", { attrs: "data-more", ic: "down" })}` : "";
  };
  host.onclick = async (e) => {
    const b = e.target.closest("[data-more]"); if (!b) return; busy(b, true);
    try { const r = await load(S.after); S.rows = [...S.rows, ...r.rows]; S.after = r.after; S.more = r.more; S.onRows?.(); } catch (x) { busy(b, false); bad(x); return; }
    paint();
  };
  S.repaintMore = paint; paint();
}

// ---------- waitlist ----------
const ROLES = [["renter", "Renter"], ["owner", "Property owner"], ["agency", "Agency"], ["agent", "Agent"]];
export const roleLabel = (r) => (ROLES.find((x) => x[0] === r) || [0, r || "—"])[1];
const cityOf = (x) => String(x.city || "").trim();
const cityKey = (x) => cityOf(x).toLowerCase().replace(/\s+/g, " ");
const pad = (n) => String(n).padStart(2, "0");
const localDay = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const isoOf = (t) => (ms(t) ? new Date(ms(t)).toISOString() : "");
export const WL_CSV_HEAD = ["Name", "Email", "Role", "City", "Signed up (UTC)", "Note"];
export const wlCsvRow = (x) => [x.name, x.email, roleLabel(x.role), cityOf(x), isoOf(x.createdAt), x.note];
// Counts worked out from the rows in hand (used when the server's count is not available).
const statsFrom = (rows) => { const now = Date.now(), t = (x) => ms(x.createdAt); return { total: rows.length, week: rows.filter((x) => t(x) >= now - 7 * DAY).length, prev: rows.filter((x) => t(x) < now - 7 * DAY && t(x) >= now - 14 * DAY).length, roles: Object.fromEntries(ROLES.map(([r]) => [r, rows.filter((x) => x.role === r).length])) }; };
const topCities = (rows, n = 4) => { const m = new Map(); rows.forEach((x) => { const k = cityKey(x); if (!k) return; const e = m.get(k) || { name: cityOf(x), n: 0 }; e.n++; m.set(k, e); }); return [...m.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name)); };
const bars = (items) => { const mx = Math.max(1, ...items.map((i) => i[1])); return `<ul class="ax-mbars">${items.map(([l, v]) => `<li><span title="${esc(l)}">${esc(l)}</span><i style="--w:${Math.round((v / mx) * 100)}%"></i><b class="num">${fmt.num(v)}</b></li>`).join("")}</ul>`; };
const tile = (label, ic, inner) => `<section class="ax-card ax-kpi"><div class="ax-kpi-h"><span class="ax-tile sm">${I(ic, 18)}</span><span class="ax-eyebrow">${esc(label)}</span></div>${inner}</section>`;

export function waitlist(ctx) {
  return pageView(ctx, { title: "Waitlist", eyebrow: "Insights", sub: "People who joined the waiting list on the Faxton website, newest first.", what: "the waitlist", skeleton: skeleton.kpis(4) + skeleton.rows(6),
    actions: `${btn("Copy all emails", { ic: "copy", attrs: 'data-wl="emails" disabled' })}${btn("Export CSV", { ic: "download", attrs: 'data-wl="csv" disabled' })}`,
    cols: [["wl", () => st.loadWaitlist()], ["stats", () => st.waitlistStats().catch(() => null)]],
    async render({ wl, stats }, { root }) {
      const S = { rows: wl.rows, after: wl.after, more: wl.more, stats, onRows: null }, uid = ctx.S.user.uid;
      const sNow = () => S.stats || statsFrom(S.rows);
      const kpis = () => {
        const s = sNow(), cities = topCities(S.rows).slice(0, 4), note = S.more ? `Newest ${fmt.num(S.rows.length)} of ${fmt.num(s.total)}` : "";
        return `<div class="ax-kpis scroll" data-t="kpis">${kpi({ label: "Total signups", value: fmt.num(s.total), count: s.total, sub: note, icon: "list" })}${kpi({ label: "Last 7 days", value: fmt.num(s.week), count: s.week, d: pctDelta(s.week, s.prev), vs: "vs previous 7 days", icon: "trend" })}${tile("By role", "users", bars(ROLES.map(([r, l]) => [l, s.roles?.[r] || 0])))}${tile("Top cities", "mapPin", cities.length ? bars(cities.map((c) => [c.name, c.n])) : `<p class="ax-muted" style="font-size:13px">No cities yet.</p>`)}</div>`;
      };
      return { html: `<div id="wlK">${kpis()}</div><div id="wlL" style="margin-top:16px"></div><div class="ax-more" id="wlMore"></div>`, mount(el) {
        const paintK = () => { $("#wlK", el).innerHTML = kpis(); AX.animateCounts($("#wlK", el)); };
        const emailLine = (x) => `<a class="ax-link" href="mailto:${esc(x.email || "")}">${esc(x.email || "—")}</a>`;
        const noteOf = (x) => x.note || "";
        const ctl = createList($("#wlL", el), { noun: "signups", label: "Waitlist signups", rows: S.rows, placeholder: "Search name, email or city…",
          tabs: [{ k: "all", label: "All" }, ...ROLES.map(([r, l]) => ({ k: r, label: l === "Agency" ? "Agencies" : l + "s", test: (x) => x.role === r }))], sort: { k: "date", dir: "desc" },
          search: (x) => `${x.name || ""} ${x.email || ""} ${cityOf(x)} ${roleLabel(x.role)} ${x.note || ""}`,
          facets: [{ k: "city", label: "City", options: (rows) => [["", "All cities"], ...topCities(rows, 60).map((c) => [c.name, `${c.name} (${c.n})`])], test: (x, v) => cityKey(x) === String(v).toLowerCase().replace(/\s+/g, " ") }],
          cols: [{ k: "name", label: "Name", role: "title", sort: (x) => String(x.name || "").toLowerCase(), cell: (x) => `<div class="ax-id">${avatar(x.name, x.id, 32)}<div><b>${esc(x.name || "—")}</b></div></div>` },
            { k: "email", label: "Email", cell: (x) => `<span class="ax-em">${esc(x.email || "—")}</span>` },
            { k: "role", label: "Role", sort: (x) => roleLabel(x.role), cell: (x) => chip("mute", roleLabel(x.role)) },
            { k: "city", label: "City", pri: 2, sort: (x) => cityKey(x), cell: (x) => esc(cityOf(x) || "—") },
            { k: "date", label: "Signed up", sort: (x) => ms(x.createdAt), cell: (x) => `<span title="${esc(fmt.dateTime(x.createdAt))}">${esc(fmt.date(x.createdAt))}</span>` }],
          quick: (x) => `<button type="button" class="ax-ib ax-qm" data-qa="copy" aria-label="Copy email of ${esc(x.name || x.email)}" title="Copy email">${I("copy", 18)}</button>`,
          onQuick: (k, x) => copy(x.email || "", "Email copied."),
          drawer: (x, api) => ({ title: x.name || "Signup", sub: `${chip("mute", roleLabel(x.role))}<span>${esc(fmt.dateTime(x.createdAt))}</span>`,
            body: `${section("Details", dl([["Name", esc(x.name || "—")], ["Email", `${emailLine(x)} <button type="button" class="ax-ib ax-qm" data-copy aria-label="Copy email" title="Copy email">${I("copy", 18)}</button>`], ["Role", esc(roleLabel(x.role))], ["City", esc(cityOf(x) || "—")], ["Joined from", esc(x.source || "website")], ["Signed up", esc(fmt.dateTime(x.createdAt))], ["Entry id", `<span class="num ax-brk">${esc(x.id)}</span>`]]))}${section("Internal note", `<textarea class="ax-input" id="wlNote" rows="3" maxlength="1000" aria-label="Internal note">${esc(noteOf(x))}</textarea><div style="margin-top:8px">${btn("Save note", { attrs: "data-wlsave" })}</div>`)}`,
            footer: `${x.email ? btn("Email", { v: "primary", ic: "mail", href: `mailto:${x.email}` }) : ""}${ctx.S.isAdmin ? btn("Remove", { v: "danger", ic: "trash", attrs: "data-wlrm" }) : ""}`,
            mount: (d) => {
              $("[data-copy]", d).onclick = () => copy(x.email || "", "Email copied.");
              $("[data-wlsave]", d).onclick = async (e) => { const b = e.currentTarget; busy(b, true); try { const note = $("#wlNote", d).value.trim().slice(0, 1000); await st.patch("waitlist", x.id, { note }); x.note = note; changed(); api.refresh(); toast("Note saved."); } catch (y) { bad(y); } busy(b, false); };
              const rm = $("[data-wlrm]", d); if (rm) rm.onclick = async () => {
                if (!(await confirm({ title: `Remove ${x.name || x.email}?`, body: "They are taken off the waiting list. If they sign up again on the website they will be added again.", confirmLabel: "Remove", tone: "danger", icon: "trash" }))) return;
                try { await st.removeWaitlist(x.id); } catch (y) { return bad(y); }
                S.rows = S.rows.filter((r) => r.id !== x.id);
                if (S.stats) { const s = S.stats, t = ms(x.createdAt), now = Date.now(); s.total = Math.max(0, s.total - 1); if (t >= now - 7 * DAY) s.week = Math.max(0, s.week - 1); else if (t >= now - 14 * DAY) s.prev = Math.max(0, s.prev - 1); if (s.roles && s.roles[x.role]) s.roles[x.role]--; }
                api.close(); ctl.setRows(S.rows); paintK(); S.repaintMore(); toast("Removed from the waitlist.");
              };
            } }),
          empty: { icon: "list", title: "No signups yet", hint: "When someone joins the waiting list on the Faxton website, they appear here." } });
        S.onRows = () => { ctl.setRows(S.rows); paintK(); };
        moreBar($("#wlMore", el), S, () => sNow().total, st.loadWaitlist);
        // Header buttons (they live in the page header, outside the body).
        const hb = (k) => $(`[data-wl=${k}]`, root), part = () => (S.more ? ` Only the newest ${fmt.num(S.rows.length)} of ${fmt.num(sNow().total)} are loaded; use Load more to include the rest.` : "");
        const csvB = hb("csv"), emB = hb("emails");
        if (csvB) { csvB.disabled = false; csvB.onclick = () => { if (!S.rows.length) return toast("Nothing to export yet."); csv("waitlist-" + localDay(), WL_CSV_HEAD, S.rows.map(wlCsvRow)); toast(`Exported ${fmt.num(S.rows.length)} signup${S.rows.length === 1 ? "" : "s"}.${part()}`, { ms: S.more ? 7000 : 3600 }); }; }
        if (emB) { emB.disabled = false; emB.onclick = () => { const list = [...new Set(S.rows.map((x) => String(x.email || "").trim()).filter(Boolean))]; if (!list.length) return toast("No emails to copy yet."); copy(list.join(", "), `Copied ${fmt.num(list.length)} email${list.length === 1 ? "" : "s"}.${part()}`); }; }
        st.markWebSeen(uid);
      } };
    } });
}

// ---------- website messages ----------
const SM = [["new", "New"], ["read", "Read"], ["replied", "Replied"], ["spam", "Spam"]];
const smSt = (x) => (SM.some((s) => s[0] === x.status) ? x.status : "new");
const mailtoFor = (x) => {
  const first = String(x.name || "").trim().split(/\s+/)[0], quoted = String(x.message || "").slice(0, 600).split("\n").map((l) => "> " + l).join("\n");
  return `mailto:${x.email}?subject=${encodeURIComponent("Re: " + (x.subject || "your message to Faxton Rentals"))}&body=${encodeURIComponent(`Hi ${first || "there"},\n\n\n\nOn ${fmt.date(x.createdAt)} you wrote:\n${quoted}`)}`;
};

export function siteMessages(ctx) {
  return pageView(ctx, { title: "Website messages", eyebrow: ctx.S.isAdmin ? "Support" : "Support console", sub: "Messages sent from the contact form on the Faxton website. Reply by email, then mark them replied.", what: "website messages",
    cols: [["sm", () => st.loadSiteMessages()]],
    async render({ sm }) {
      const S = { rows: sm.rows, after: sm.after, more: sm.more, onRows: null }, uid = ctx.S.user.uid, opened = new Set();
      const set = async (x, s, api, o = {}) => {
        const prev = { status: smSt(x) }, p = { status: s, by: uid };
        try { await st.patch("siteMessages", x.id, p); Object.assign(x, p); changed(); api.refresh(); if (!o.quiet) toast(`Marked ${s}.`, { action: "Undo", onAction: async () => { try { await st.patch("siteMessages", x.id, { status: prev.status, by: uid }); x.status = prev.status; changed(); api.refresh(); } catch (e) { bad(e); } } }); } catch (e) { if (!o.quiet) bad(e); }
      };
      return { html: `<div id="smL"></div><div class="ax-more" id="smMore"></div>`, mount(el) {
        const ctl = createList($("#smL", el), { noun: "messages", label: "Website messages", rows: S.rows, placeholder: "Search name, email, subject or message…",
          tabs: [...SM.map(([k, l]) => ({ k, label: l, test: (x) => smSt(x) === k, tone: k === "new" ? "warn" : "" })), { k: "all", label: "All" }], defaultTab: (rows) => (rows.some((x) => smSt(x) === "new") ? "new" : "all"), sort: { k: "date", dir: "desc" },
          search: (x) => `${x.name || ""} ${x.email || ""} ${x.subject || ""} ${x.message || ""} ${x.note || ""}`,
          cols: [{ k: "from", label: "From", role: "title", cell: (x) => `<div class="ax-id">${avatar(x.name, x.email || x.id, 32)}<div><b>${esc(x.name || "—")}</b><small>${esc(x.email || "")}</small></div></div>` },
            { k: "subject", label: "Subject", pri: 2, sort: (x) => String(x.subject || ""), cell: (x) => esc(x.subject || "—") },
            { k: "msg", label: "Message", cell: (x) => `<div class="ax-clamp" style="-webkit-line-clamp:2;max-width:420px">${esc(x.message || "")}</div>` },
            { k: "date", label: "Received", pri: 2, sort: (x) => ms(x.createdAt), cell: (x) => `<span title="${esc(fmt.dateTime(x.createdAt))}">${esc(fmt.rel(x.createdAt))}</span>` },
            { k: "status", label: "Status", role: "status", cell: (x) => `<button type="button" class="ax-chipbtn" data-cell="s" aria-haspopup="menu" aria-label="Change status, now ${esc(smSt(x))}">${chipFor("siteMsg", smSt(x))}${I("chevD", 14)}</button>` }],
          onCell: (k, x, b, api) => menu(b, SM.map(([v, l]) => ({ label: l, checked: v === smSt(x), act: () => v !== smSt(x) && set(x, v, api) })), { align: "left", label: "Status" }),
          rowTone: (x) => (smSt(x) === "new" ? "new" : ""),
          csv: { name: "faxton-website-messages", head: ["From", "Email", "Subject", "Message", "Status", "Received (UTC)", "Note"], row: (x) => [x.name, x.email, x.subject, x.message, smSt(x), isoOf(x.createdAt), x.note] },
          drawer: (x, api) => ({ title: x.name || "Message", sub: `${chipFor("siteMsg", smSt(x))}<span>${esc(x.subject || "")}</span>`,
            body: `<p class="ax-p ax-msgtext">${esc(x.message || "")}</p>${section("Sender", dl([["Name", esc(x.name || "—")], ["Email", `<a class="ax-link" href="mailto:${esc(x.email || "")}">${esc(x.email || "—")}</a> <button type="button" class="ax-ib ax-qm" data-copy aria-label="Copy email" title="Copy email">${I("copy", 18)}</button>`], ["Subject", esc(x.subject || "—")], ["Received", esc(fmt.dateTime(x.createdAt))]]))}${section("Status", `<div class="ax-seg2 ax-wf">${SM.map(([v, l]) => `<button type="button" class="ax-pre" data-s="${v}" aria-pressed="${smSt(x) === v}">${l}</button>`).join("")}</div>`)}${section("Internal note", `<textarea class="ax-input" id="smNote" rows="3" maxlength="1000" aria-label="Internal note">${esc(x.note || "")}</textarea><div style="margin-top:8px">${btn("Save note", { attrs: "data-smsave" })}</div>`)}`,
            footer: x.email ? btn("Reply by email", { v: "primary", ic: "mail", href: mailtoFor(x) }) : "",
            mount: (d) => {
              $("[data-copy]", d).onclick = () => copy(x.email || "", "Email copied.");
              $$("[data-s]", d).forEach((b) => (b.onclick = () => b.dataset.s !== smSt(x) && set(x, b.dataset.s, api)));
              $("[data-smsave]", d).onclick = async (e) => { const b = e.currentTarget; busy(b, true); try { const note = $("#smNote", d).value.trim().slice(0, 1000); await st.patch("siteMessages", x.id, { note, by: uid }); x.note = note; x.by = uid; changed(); api.refresh(); toast("Note saved."); } catch (y) { bad(y); } busy(b, false); };
              // Opening a new message marks it read once (set it back to New from the buttons above if you want to keep it unread).
              if (smSt(x) === "new" && !opened.has(x.id)) { opened.add(x.id); set(x, "read", api, { quiet: true }); }
            } }),
          empty: { icon: "inbox", title: "No website messages yet", hint: "Messages sent from the contact form on the Faxton website appear here." } });
        S.onRows = () => ctl.setRows(S.rows);
        moreBar($("#smMore", el), S, null, st.loadSiteMessages);
      } };
    } });
}
