// ax-sections.js: five console sections built to the owner's reference screenshots (dark and light):
// Feedback, Agents, Team access, Ticket center and Users. Each one has a big title and a page search in the top bar
// (see BAR in ax-shell.js), rounded cards, pill filters with counts and roomy rows. Phones get the same content in cards.
import { db } from "./firebase.js";
import { doc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import * as CALLS from "./calls.js";
import * as st from "./store.js";
import { friendlyErr } from "./ui.js";
import * as AX from "./ax.js";
import { createList } from "./ax-list.js";
import * as A2 from "./admin2.js";

const { $, $$, esc, I, btn, chip, chipFor, avatar, fmt, toast, dialog, confirm, reason, drawer, data, empty, tabs, mountTabs, hq, setQ, changed, pageView, ms, csv, dl } = AX;
const fe = (e) => friendlyErr(e).replace(/\s*\([^)]*\)\s*$/, "");
const bad = (e) => toast(fe(e), { tone: "bad" });
const meName = (ctx) => ctx.S.profile?.name || ctx.S.user.displayName || ctx.S.user.email || "Admin";
const busy = (b, on) => { if (!b) return; b.classList.toggle("is-busy", on); b.disabled = on; };
const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`;

// ---------- small shared pieces ----------
export const stars = (n, sz = 18) => `<span class="ax-stars" role="img" aria-label="${n} out of 5 stars">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= n ? "on" : ""}">${I(i <= n ? "starF" : "star", sz, 1.6)}</i>`).join("")}</span>`;
// "6d ago" inside a week, then "5 Oct".
const ago = (t) => { const m = ms(t); if (!m) return ""; const s = (Date.now() - m) / 1000; if (s < 60) return "just now"; if (s < 3600) return Math.floor(s / 60) + "m ago"; if (s < 86400) return Math.floor(s / 3600) + "h ago"; if (s < 7 * 86400) return Math.floor(s / 86400) + "d ago"; return new Date(m).toLocaleDateString("en-GB", { day: "numeric", month: "short" }); };
const mobSearch = (ph) => `<div class="ax-mps"><label class="ax-search">${I("search", 18)}<input type="search" placeholder="${esc(ph)}" aria-label="${esc(ph.replace("…", ""))}" autocomplete="off" spellcheck="false"></label></div>`;
// The top-bar search (desktop) and the in-page one (phones) drive the same filter.
function bindSearch(root, onQ) {
  const top = $("#axPS"), mob = $(".ax-mps input", root); let last = "";
  const apply = (v, src) => { v = v.trim().toLowerCase(); if (top && src !== top && top.value.trim().toLowerCase() !== v) top.value = v; if (mob && src !== mob && mob.value.trim().toLowerCase() !== v) mob.value = v; if (v === last) return; last = v; onQ(v); };
  [top, mob].forEach((i) => { if (i) i.oninput = () => apply(i.value, i); });
  if (top?.value) { last = top.value.trim().toLowerCase(); if (mob) mob.value = top.value; }
  return () => last;
}
const roleOf = (ctx, u) => A2.roleOf(ctx, u);
const hay = (...a) => a.filter(Boolean).join(" ").toLowerCase();
const skelCards = (n = 3) => `<div class="ax-fb-sum" aria-hidden="true">${Array.from({ length: n }, () => AX.skeleton.card(120)).join("")}</div>${AX.skeleton.rows(3)}`;

// =====================================================================================================================
// FEEDBACK
// =====================================================================================================================
const TOPICS = ["The app", "Realtors", "Listings", "Chat & calls", "Other"];
const FB_ROLE = { agent: ["Realtor", "realtor"], agency: ["Agency", "realtor"], landlord: ["Property owner", "realtor"], renter: ["Renter", "renter"], support: ["Team", "team"], admin: ["Team", "team"], owner: ["Team", "team"] };
const REPLY_PRESETS = ["Thank you for telling us. We’re looking into it.", "Sorry about that. We’ve passed it to the team and will fix it.", "Glad it went well. Thank you for rating us!"];
export function feedback(ctx) {
  return pageView(ctx, { title: "Feedback", head: false, cols: [["fb", () => data.get("feedback")], ["users", () => data.safe("users")]], what: "feedback", skeleton: skelCards(3),
    async render({ fb: rows, users }) {
      const byUid = new Map(users.map((u) => [u.id, u]));
      let tab = "all", q = "";
      const state = (f) => (f.status === "Answered" ? "answered" : "new");
      const sorted = () => [...rows].sort((a, b) => ms(b.createdAt) - ms(a.createdAt));
      const rated = () => rows.filter((f) => f.rating >= 1 && f.rating <= 5);
      const avgOf = (l) => (l.length ? l.reduce((a, f) => a + f.rating, 0) / l.length : 0);
      const summary = () => {
        const r = rated(), avg = avgOf(r), wk = r.filter((f) => Date.now() - ms(f.createdAt) < 7 * 864e5).length, max = Math.max(1, ...[5, 4, 3, 2, 1].map((n) => r.filter((f) => f.rating === n).length));
        return `<section class="ax-card ax-fbs"><h2>Average rating <i class="ax-ldot" aria-hidden="true"></i></h2><div class="ax-avg"><b class="num">${r.length ? avg.toFixed(1) : "—"}</b>${r.length ? stars(Math.round(avg), 22) : ""}</div><p class="ax-sub">${r.length ? `${plural(r.length, "response", "responses")} · ${wk} this week` : "No ratings yet. They appear here as people rate the app and their calls."}</p></section>
          <section class="ax-card ax-fbs"><h2>Ratings</h2><ul class="ax-dist">${[5, 4, 3, 2, 1].map((n) => { const c = r.filter((f) => f.rating === n).length; return `<li><span class="num">${n}</span><span class="ax-bar" role="img" aria-label="${plural(c, "rating", "ratings")} of ${n} stars"><i style="width:${c ? Math.max(4, (c / max) * 100) : 0}%"></i></span><b class="num ${c ? "" : "z"}">${c}</b></li>`; }).join("")}</ul></section>
          <section class="ax-card ax-fbs"><h2>By topic</h2><ul class="ax-topics">${TOPICS.map((t) => { const l = r.filter((f) => f.topic === t); return `<li><span>${esc(t)}</span><b class="num ${l.length ? "" : "z"}">${l.length}</b><em class="num">${l.length ? avgOf(l).toFixed(1) : "–"}</em></li>`; }).join("")}</ul></section>`;
      };
      const card = (f) => {
        const u = byUid.get(f.uid), nm = f.name || u?.name || f.email || "Someone", [rl, rk] = FB_ROLE[f.role] || [fmt.title(f.role || "User"), "renter"], isNew = state(f) === "new";
        return `<article class="ax-card ax-fbc" data-id="${esc(f.id)}" ${isNew ? 'data-new="1"' : ""}><header>${avatar(nm, f.uid, 54, u?.photo)}<div class="ax-fbc-who"><div><b>${esc(nm)}</b><span class="ax-rp" data-r="${rk}">${esc(rl)}</span></div><small>${esc(f.email || "")}${f.email ? " · " : ""}<time datetime="${f.createdAt ? new Date(ms(f.createdAt)).toISOString() : ""}">${esc(ago(f.createdAt))}</time></small></div>
          <div class="ax-fbc-rate">${stars(f.rating || 0)}<span class="ax-tp">${esc(f.topic || "Other")}</span></div></header>
          ${f.message ? `<p class="ax-fbc-msg">${esc(f.message)}</p>` : `<p class="ax-fbc-msg is-none">Rated without a note.</p>`}${f.peer ? `<p class="ax-fbc-meta">${I("phone", 14)} Call with ${esc(f.peer)}</p>` : ""}
          ${f.reply ? `<div class="ax-fbc-reply"><b>${I("reply", 14)} Our reply${f.repliedBy ? " · " + esc(f.repliedBy) : ""}</b><p>${esc(f.reply)}</p></div>` : ""}
          <footer><button type="button" class="ax-btn" data-v="soft" data-act="reply" data-id="${esc(f.id)}">${I("reply", 18)}<span>${f.reply ? "Reply again" : "Reply"}</span></button>${isNew ? `<button type="button" class="ax-btn" data-v="outline" data-act="done" data-id="${esc(f.id)}">${I("check", 18)}<span>Mark as handled</span></button>` : ""}<button type="button" class="ax-btn" data-v="ghost" data-act="del" data-id="${esc(f.id)}">${I("trash", 18)}<span>Delete</span></button></footer></article>`;
      };
      return { html: `${mobSearch("Search feedback…")}<div class="ax-fb-sum" id="fbSum"></div><div class="ax-pills" id="fbTabs"></div><div class="ax-fb-list" id="fbList" aria-live="polite"></div>`,
        mount(el) {
          const sum = $("#fbSum", el), list = $("#fbList", el), tb = $("#fbTabs", el);
          const items = () => [{ k: "all", label: "All", count: rows.length }, { k: "new", label: "New", count: rows.filter((f) => state(f) === "new").length }, { k: "answered", label: "Answered", count: rows.filter((f) => state(f) === "answered").length }];
          tb.innerHTML = tabs(items(), tab, { label: "Feedback status" }); mountTabs(tb, (k) => { tab = k; paintList(); });
          const paintTabs = () => items().forEach((it) => { const b = $(`.ax-tab[data-k="${it.k}"] b`, tb); if (b) b.textContent = it.count; });
          const visible = () => sorted().filter((f) => (tab === "all" || state(f) === tab) && (!q || hay(f.name, f.email, f.message, f.topic, f.reply, f.peer, FB_ROLE[f.role]?.[0]).includes(q)));
          const paintList = () => { const v = visible(); list.innerHTML = v.length ? v.map(card).join("") : empty({ icon: rows.length ? "search" : "star", title: rows.length ? "Nothing matches" : "No feedback yet", hint: rows.length ? "Try another word or switch the filter." : "Ratings from calls and the Help centre will show up here." }); };
          const paint = () => { sum.innerHTML = summary(); paintTabs(); paintList(); changed(); };
          bindSearch(el, (v) => { q = v; paintList(); });
          paint();
          const find = (id) => rows.find((f) => f.id === id);
          list.addEventListener("click", async (e) => {
            const b = e.target.closest("[data-act]"); if (!b) return; const f = find(b.dataset.id); if (!f) return;
            if (b.dataset.act === "done") { const prev = f.status; try { await st.patch("feedback", f.id, { status: "Answered" }); f.status = "Answered"; paint(); toast("Marked as handled.", { action: "Undo", onAction: async () => { try { await st.patch("feedback", f.id, { status: prev || "New" }); f.status = prev || "New"; paint(); } catch (x) { bad(x); } } }); } catch (x) { bad(x); } }
            else if (b.dataset.act === "del") {
              if (!(await confirm({ title: "Delete this feedback?", body: `${esc(f.name || "This person")}’s ${f.rating}-star rating will be removed for good.`, confirmLabel: "Delete", tone: "danger", icon: "trash" }))) return;
              try { await deleteDoc(doc(db, "feedback", f.id)); const i = rows.indexOf(f); if (i >= 0) rows.splice(i, 1); paint(); toast("Feedback deleted."); } catch (x) { bad(x); }
            } else if (b.dataset.act === "reply") {
              const text = await reason({ title: `Reply to ${f.name || "this person"}`, icon: "reply", label: "Your reply", presets: REPLY_PRESETS, helper: "They will see this in their notifications.", confirmLabel: "Send reply", value: f.reply || "" }); if (!text) return;
              try { const by = meName(ctx); await st.patch("feedback", f.id, { reply: text, status: "Answered", repliedAt: serverTimestamp(), repliedBy: by }); Object.assign(f, { reply: text, status: "Answered", repliedBy: by, repliedAt: Date.now() }); paint();
                if (f.uid) await st.notify(f.uid, { kind: "info", title: "We replied to your feedback", body: text.slice(0, 500) }).catch(() => {}); toast("Reply sent."); } catch (x) { bad(x); }
            }
          });
        } };
    } });
}

// =====================================================================================================================
// AGENTS
// =====================================================================================================================
const ONLINE_MS = 60 * 60 * 1000;
export function agents(ctx) {
  return pageView(ctx, { title: "Agents", head: false, cols: [["users", () => data.get("users")], ["ls", () => data.safe("listings")], ["fb", () => data.safe("feedback")]], what: "agents", skeleton: AX.skeleton.rows(4),
    async render({ users, ls, fb }) {
      const list = () => users.filter((u) => ["agent", "agency"].includes(roleOf(ctx, u))).sort((a, b) => String(a.agency?.business || a.name).localeCompare(String(b.agency?.business || b.name)));
      const nameOf = (u) => (roleOf(ctx, u) === "agency" && u.agency?.business) || u.name || u.email || "Agent";
      const listingsOf = (u) => ls.filter((l) => l.ownerUid === u.id && !l.archived).length;
      const ratingOf = (u) => { const nm = String(u.name || "").toLowerCase(), l = fb.filter((f) => f.rating && f.peer && (String(f.peer).toLowerCase() === nm || String(f.peer).toLowerCase() === String(nameOf(u)).toLowerCase())); return l.length ? { avg: l.reduce((a, f) => a + f.rating, 0) / l.length, n: l.length } : null; };
      const online = (u) => Date.now() - ms(u.lastActive) < ONLINE_MS;
      const role = (u) => (roleOf(ctx, u) === "agency" ? "Real estate company" : u.agentInfo?.company ? `Agent · ${u.agentInfo.company}` : "Independent agent");
      const area = (u) => u.location || [String(u.agentInfo?.areas || u.agency?.address || "").split(/[,;\n]/)[0].trim(), u.city].filter(Boolean).join(", ") || "Nigeria";
      const card = (u) => { const r = ratingOf(u), n = listingsOf(u), v = A2.userVerified(u);
        return `<article class="ax-card ax-ag" data-id="${esc(u.id)}"><span class="ax-agav ${v ? "is-v" : ""}">${avatar(nameOf(u), u.id, 84, u.photo)}${online(u) ? '<i class="ax-onl" title="Active in the last hour"></i>' : ""}</span>
          <h3>${esc(nameOf(u))}${v ? `<span class="ax-vt" title="Verified">${I("checkc", 16)}</span>` : ""}</h3><p class="ax-agr">${esc(role(u))}</p>
          <p class="ax-agm">${r ? `<span class="ax-agstar">${I("starF", 14)}<b class="num">${r.avg.toFixed(1)}</b></span><i>·</i>` : ""}<span class="num">${plural(n, "listing", "listings")}</span><i>·</i><span>${esc(area(u))}</span></p>
          ${u.banned ? `<p class="ax-agst">${chip("bad", "Suspended")}</p>` : u.verification?.status === "pending" ? `<p class="ax-agst">${chip("warn", "Awaiting verification")}</p>` : ""}
          <div class="ax-agb"><button type="button" class="ax-btn" data-v="outline" data-act="edit" data-id="${esc(u.id)}">${I("edit", 16)}<span>Edit</span></button><button type="button" class="ax-btn" data-v="danger-soft" data-act="rm" data-id="${esc(u.id)}">${I("trash", 16)}<span>Remove</span></button></div></article>`; };
      return { html: `${mobSearch("Search agents…")}<div class="ax-agtop"><p class="ax-count" id="agCount" aria-live="polite"></p>${btn("Add agent", { v: "primary", ic: "plus", cls: "ax-glow", attrs: "data-act=add" })}</div><div class="ax-aggrid" id="agGrid"></div>`,
        mount(el) {
          const grid = $("#agGrid", el); let q = "";
          const paint = () => { const all = list(), v = all.filter((u) => !q || hay(nameOf(u), u.name, u.email, u.agentInfo?.company, u.agentInfo?.areas, u.city, u.location).includes(q));
            $("#agCount", el).textContent = q ? `${v.length} of ${plural(all.length, "agent", "agents")}` : plural(all.length, "agent", "agents");
            grid.innerHTML = v.length ? v.map(card).join("") : `<div class="ax-card ax-span">${empty({ icon: "building", title: all.length ? "No agents match" : "No agents yet", hint: all.length ? "Try another name or area." : "Agents and agencies appear here once they sign up. Use Add agent to invite one.", action: all.length ? "" : btn("Add agent", { v: "primary", ic: "plus", attrs: "data-act=add" }) })}</div>`; };
          bindSearch(el, (v) => { q = v; paint(); }); paint();
          const api = { refresh: paint, close: () => drawer.close() };
          el.addEventListener("click", async (e) => {
            const b = e.target.closest("[data-act]"); if (!b) return;
            if (b.dataset.act === "add") return A2.inviteDialog("agent");
            const u = users.find((x) => x.id === b.dataset.id); if (!u) return;
            if (b.dataset.act === "edit") { drawer.open({ ...A2.userDrawer(ctx, u, api), onClose: () => paint() }); return; }
            if (b.dataset.act === "rm") await removeAgent(ctx, u, nameOf(u), paint);
          });
        } };
    } });
}
// Remove an agent. The owner sets roles, so the owner takes them back to a renter account; an admin suspends instead (the only thing the rules let them do).
async function removeAgent(ctx, u, name, done) {
  const asOwner = ctx.S.isOwner;
  if (!asOwner && !A2.canBan(ctx, u)) return toast("Only the owner can remove an agent.", { tone: "bad" });
  if (!(await confirm({ title: asOwner ? `Remove ${name} as an agent?` : `Suspend ${name}?`, body: asOwner ? "They go back to a regular renter account and their listings stay on the platform for you to review. You can make them an agent again later." : "They will be signed out and can’t sign back in until you lift the suspension.", confirmLabel: asOwner ? "Remove agent" : "Suspend", tone: "danger", icon: "alert" }))) return;
  const prev = u.role;
  try {
    if (asOwner) { await st.setRole(u.id, "renter"); u.role = "renter"; } else { await st.setBanned(u.id, true); u.banned = true; }
    changed(); done(); toast(asOwner ? `${name} is no longer an agent.` : `${name} suspended.`, { action: "Undo", onAction: async () => { try { if (asOwner) { await st.setRole(u.id, prev || "agent"); u.role = prev || "agent"; } else { await st.setBanned(u.id, false); u.banned = false; } changed(); done(); } catch (x) { bad(x); } } });
  } catch (x) { bad(x); }
}

// =====================================================================================================================
// TEAM ACCESS
// =====================================================================================================================
const SEAT = { owner: "Owner", admin: "Admin", support: "Support" }, SEAT_ORDER = { owner: 0, admin: 1, support: 2 };
export function team(ctx) {
  return pageView(ctx, { title: "Team access", head: false, cols: [["users", () => data.get("users")]], what: "team access", skeleton: AX.skeleton.card(160) + AX.skeleton.rows(4),
    async render({ users }) {
      const me = ctx.S.user.uid, isOwner = ctx.S.isOwner, R = (u) => roleOf(ctx, u);
      const members = () => users.filter((u) => R(u) in SEAT_ORDER).sort((a, b) => SEAT_ORDER[R(a)] - SEAT_ORDER[R(b)] || String(a.name || a.email).localeCompare(String(b.name || b.email)));
      const you = isOwner ? "You are the <b>Owner</b>, so you can hand out and take back Admin and Support seats." : `You are an <b>Admin</b>. You can see the team, but only the owner can change seats.`;
      const row = (u) => { const r = R(u), mine = u.id === me, owner = r === "owner", can = isOwner && !mine && !owner;
        return `<li class="ax-tm" data-id="${esc(u.id)}">${avatar(u.name || u.email, u.id, 48, u.photo)}<div class="ax-tm-w"><b>${esc(u.name || u.email || "—")}${mine ? ' <span class="ax-muted">(you)</span>' : ""}</b><small title="${esc(u.email || "")}">${esc(u.email || "")}</small></div>
          ${owner ? `<span class="ax-seat" data-r="owner">${I("crown", 16)}Owner</span>` : `<div class="ax-tm-c"><select class="ax-sel" data-seat aria-label="Role for ${esc(u.name || u.email)}" ${can ? "" : "disabled"} ${can ? "" : `title="${mine ? "You can’t change your own seat." : "Only the owner can change seats."}"`}>${[["admin", "Admin"], ["support", "Support"]].map(([v, l]) => `<option value="${v}" ${r === v ? "selected" : ""}>${l}</option>`).join("")}</select>
          ${mine ? "" : `<button type="button" class="ax-ib ax-tmb" data-tm="msg" aria-label="Message ${esc(u.name || u.email)}">${I("msg", 20)}</button>`}${can ? `<button type="button" class="ax-ib ax-tmb is-del" data-tm="rm" aria-label="Remove ${esc(u.name || u.email)} from the team">${I("trash", 20)}</button>` : mine ? "" : '<span class="ax-tmb-sp"></span>'}</div>`}</li>`; };
      return { html: `${mobSearch("Search team access…")}<section class="ax-card ax-coc"><h2>Chain of command</h2>
          <ol class="ax-chain" aria-label="Chain of command"><li data-r="owner"><span class="ax-cp">${I("crown", 16)}<b>Owner</b></span></li><li data-r="admin"><span class="ax-cp"><b>Admin</b></span></li><li data-r="support"><span class="ax-cp"><b>Support</b></span></li><li data-r="realtor"><span class="ax-cp"><b>Faxton realtors</b></span></li></ol>
          <p class="ax-coc-p">The owner can give out and change every seat, but only to <b>Admin</b> or <b>Support</b>. Admins run the console: listings, verifications and suspending people below them, but they can’t change roles. Support answers tickets and suggestions. ${you}</p>
          <div class="ax-add"><label class="ax-add-s">${I("search", 20)}<input id="tmSearch" type="search" placeholder="Search by name or email" aria-label="Search a user by name or email" autocomplete="off" spellcheck="false" ${isOwner ? "" : "disabled"}><div class="ax-ta" id="tmRes" role="listbox" hidden></div></label>
            <select class="ax-sel ax-add-r" id="tmRole" aria-label="Seat to give" ${isOwner ? "" : "disabled"}><option value="support">Support</option><option value="admin">Admin</option></select></div>${isOwner ? "" : `<p class="ax-help">Only the owner can add people to the team.</p>`}</section>
        <section class="ax-card ax-tml"><ul id="tmList"></ul></section>`,
        mount(el) {
          const ul = $("#tmList", el), inp = $("#tmSearch", el), res = $("#tmRes", el); let q = "";
          const paint = () => { const v = members().filter((u) => !q || hay(u.name, u.email, SEAT[R(u)]).includes(q)); ul.innerHTML = v.length ? v.map(row).join("") : `<li class="ax-tm-e">${empty({ icon: "users", title: "No team members match", hint: "Try another name or email." })}</li>`; };
          bindSearch(el, (v) => { q = v; paint(); }); paint();
          const setSeat = async (u, role, { msg, notify } = {}) => {
            const prev = u.role;
            try { await st.setRole(u.id, role); u.role = role; changed(); paint(); if (notify) st.notify(u.id, notify).catch(() => {});
              toast(msg, { action: "Undo", onAction: async () => { try { await st.setRole(u.id, prev || "renter"); u.role = prev || "renter"; changed(); paint(); } catch (x) { bad(x); } } }); return true;
            } catch (x) { bad(x); paint(); return false; }
          };
          ul.addEventListener("change", async (e) => { const s = e.target.closest("[data-seat]"); if (!s) return; const u = users.find((x) => x.id === s.closest(".ax-tm").dataset.id), role = s.value, was = R(u);
            if (!u || role === was) return;
            if (!(await confirm({ title: `Make ${u.name || u.email} ${role === "admin" ? "an Admin" : "Support"}?`, body: role === "admin" ? "Admins can run the console: listings, verifications and suspending people below them." : "Support can answer tickets and suggestions. They can’t change listings or roles.", confirmLabel: "Change seat", icon: "users" }))) { s.value = was; return; }
            await setSeat(u, role, { msg: `${u.name || u.email} is now ${SEAT[role]}.`, notify: { kind: "info", title: `You are now ${SEAT[role]}`, body: "Your seat on the Faxton team changed. Open the app to see your new tools." } }); });
          ul.addEventListener("click", async (e) => { const b = e.target.closest("[data-tm]"); if (!b) return; const u = users.find((x) => x.id === b.closest(".ax-tm").dataset.id); if (!u) return;
            if (b.dataset.tm === "msg") return A2.openChat(ctx, u);
            if (!(await confirm({ title: `Remove ${u.name || u.email} from the team?`, body: "They go back to a regular account and lose access to the console. You can add them again any time.", confirmLabel: "Remove from team", tone: "danger", icon: "alert" }))) return;
            await setSeat(u, "renter", { msg: `${u.name || u.email} removed from the team.` }); });
          const results = () => { const t = inp.value.trim().toLowerCase(); if (!t) { res.hidden = true; return; } const mem = new Set(members().map((u) => u.id));
            const v = users.filter((u) => !mem.has(u.id) && !u.banned && hay(u.name, u.email).includes(t)).slice(0, 6);
            res.innerHTML = v.length ? v.map((u) => `<button type="button" role="option" class="ax-tar" data-u="${esc(u.id)}">${avatar(u.name || u.email, u.id, 32, u.photo)}<span><b>${esc(u.name || "—")}</b><small>${esc(u.email || "")}</small></span><em>${esc(A2.ROLE_LABEL[R(u)] || "")}</em></button>`).join("") : `<p class="ax-tae">No one matches “${esc(inp.value.trim())}”.</p>`; res.hidden = false; };
          inp.addEventListener("input", results); inp.addEventListener("focus", results);
          inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); $(".ax-tar", res)?.click(); } else if (e.key === "Escape") res.hidden = true; });
          document.addEventListener("pointerdown", (e) => { if (!e.target.closest(".ax-add-s")) res.hidden = true; }, { capture: true });
          res.addEventListener("click", async (e) => { const b = e.target.closest("[data-u]"); if (!b) return; const u = users.find((x) => x.id === b.dataset.u), role = $("#tmRole", el).value; res.hidden = true; if (!u) return;
            const was = R(u), market = ["agent", "agency", "landlord"].includes(was);
            if (!(await confirm({ title: `Add ${u.name || u.email} as ${role === "admin" ? "an Admin" : "Support"}?`, body: `${market ? "This replaces their current " + (A2.ROLE_LABEL[was] || "role").toLowerCase() + " role. " : ""}${role === "admin" ? "Admins can run the console." : "Support can answer tickets and suggestions."} They get access straight away.`, confirmLabel: "Add to team", icon: "users" }))) return;
            if (await setSeat(u, role, { msg: `${u.name || u.email} added as ${SEAT[role]}.`, notify: { kind: "info", title: `You joined the Faxton team as ${SEAT[role]}`, body: "Open the app to see your new tools." } })) { inp.value = ""; } });
        } };
    } });
}

// =====================================================================================================================
// TICKET CENTER
// =====================================================================================================================
const isRes = (t) => /resolved|closed/i.test(t.status || "");
const groupOf = (t) => (isRes(t) ? "Resolved" : /progress/i.test(t.status || "") ? "In progress" : "Open");
const NEED = /\b(support agent|human|real person|live agent|customer (care|service)|speak (to|with)|talk to (a|an|some)|call me|representative)\b/i;
const needsAgent = (t) => !isRes(t) && (t.needsAgent === true || NEED.test(`${t.subject || ""} ${t.message || ""}`));
const isComplaint = (t) => !isRes(t) && /complain/i.test(`${t.subject || ""} ${t.category || ""}`);
const TC_TABS = [["open", "Open", (t) => !isRes(t)], ["agent", "Needs agent", needsAgent], ["complaints", "Complaints", isComplaint], ["resolved", "Resolved", isRes], ["all", "All", () => true]];
const shortDay = (t) => { const m = ms(t); return m ? new Date(m).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : ""; };
export function ticketCenter(ctx) {
  const base = ctx.S.isAdmin ? "/admin/support" : "/support/tickets";
  return pageView(ctx, { title: "Ticket center", head: false, cols: ["tickets"], what: "the ticket center", skeleton: `<div class="ax-card ax-tc is-skel" aria-hidden="true">${AX.skeleton.rows(5)}</div>`,
    async render({ tickets }) {
      const by = [...tickets].sort((a, b) => ms(b.createdAt) - ms(a.createdAt));
      return { html: `${mobSearch("Search ticket center…")}<div class="ax-card ax-tc" id="tc" data-view="list"></div>`, mount(el) {
        const box = $("#tc", el); let tab = "open", cur = hq().q.id || null, note = false, q = "", live = true; const mobile = () => matchMedia("(max-width:899px)").matches;
        const test = (k) => TC_TABS.find((x) => x[0] === k)[2];
        if (cur) { const t = by.find((x) => x.id === cur); if (t) tab = isRes(t) ? "resolved" : "open"; else cur = null; }
        const rows = () => by.filter((t) => test(tab)(t) && (!q || hay(t.subject, t.name, t.ref, t.message, t.email).includes(q)));
        const pick = (id, push = true) => { cur = id; if (push && mobile()) { if (!hq().q.id) setQ({ id }, "push"); } else setQ({ id }); paint(); };
        const rowHtml = (t) => `<button type="button" class="ax-tr" data-t="${esc(t.id)}" aria-current="${t.id === cur}"><span class="ax-tr-a"><b class="num">${esc(t.ref || "—")}</b><span class="ax-tsp" data-s="${groupOf(t) === "Resolved" ? "done" : groupOf(t) === "In progress" ? "prog" : "open"}">${esc(groupOf(t).toLowerCase())}</span>${t.priority === "High" && !isRes(t) ? '<span class="ax-tsp" data-s="high">high</span>' : ""}<time>${esc(shortDay(t.createdAt))}</time></span><span class="ax-tr-b"><span>${esc(t.name || "Customer")}</span> · ${esc(t.subject || "Ticket")}</span></button>`;
        const paint = () => {
          const rs = rows(); if (!cur && rs.length && !mobile()) cur = rs[0].id; if (cur && !by.some((t) => t.id === cur)) cur = null;
          const t = by.find((x) => x.id === cur);
          box.dataset.view = mobile() && t && hq().q.id ? "thread" : "list";
          box.innerHTML = `<section class="ax-tcl" aria-label="Tickets"><div class="ax-pills" id="tcTabs"></div><div class="ax-tcr" role="list">${rs.map(rowHtml).join("") || empty({ icon: "inbox", title: q ? "No tickets match" : `No ${TC_TABS.find((x) => x[0] === tab)[1].toLowerCase()} tickets`, hint: q ? "Try another word." : "Tickets from the Contact us page appear here." })}</div></section><section class="ax-tcp" aria-label="Conversation">${t ? thread(t) : `<div class="ax-pane-empty">${empty({ icon: "chatdots", title: "Select a ticket", hint: "Choose a ticket on the left to read the conversation." })}</div>`}</section>`;
          const tb = $("#tcTabs", box); tb.innerHTML = tabs(TC_TABS.map(([k, label, f]) => ({ k, label, count: by.filter(f).length })), tab, { label: "Ticket filters" }); mountTabs(tb, (k) => { tab = k; cur = null; setQ({ id: "" }); paint(); });
          if (t) wire(t);
        };
        const person = (t) => ({ id: t.uid, name: t.name || "Customer", email: t.email || "" });
        const thread = (t) => { const reps = t.replies || [], g = groupOf(t), who = t.name || "Customer";
          return `<header class="ax-tch"><div class="ax-tch-t"><button type="button" class="ax-ib back" data-back aria-label="Back to tickets">${I("left", 20)}</button><h2 class="num">${esc(t.ref || "Ticket")}</h2><span class="ax-tsp lg" data-s="${g === "Resolved" ? "done" : g === "In progress" ? "prog" : "open"}">${esc(g.toLowerCase())}</span><span class="ax-tch-who">${esc(who)}</span></div>
            <div class="ax-tch-a"><button type="button" class="ax-ib ax-oib" data-det aria-label="Ticket details" title="Ticket details">${I("eye", 20)}</button>${t.uid ? `<button type="button" class="ax-ib ax-oib" data-call aria-label="Call ${esc(who)}" title="Call">${I("phone", 20)}</button>` : ""}${t.uid ? btn("Open full chat", { v: "outline", cls: "ax-chat", attrs: "data-chat" }) : ""}</div>
            <div class="ax-tch-r">${btn(g === "Resolved" ? "Reopen" : "Resolve", { v: g === "Resolved" ? "outline" : "primary", ic: "check", cls: "ax-glow", attrs: "data-resolve" })}</div></header>
          <div class="ax-msgs" id="msgs" tabindex="0" aria-label="Conversation"><div class="ax-bub"><small>${esc(who)} · ${esc(fmt.dateTime(t.createdAt))}</small><p>${esc(t.message || "")}</p></div>${reps.map((r) => r.internal ? `<div class="ax-bub note"><small>${I("lock", 13)} Internal note · ${esc(r.by || "Support")} · ${esc(fmt.dateTime(r.at))}</small><p>${esc(r.text)}</p><em>Only your team sees this.</em></div>` : `<div class="ax-bub out"><small>${esc(r.by || "Faxton")} · ${esc(fmt.dateTime(r.at))}</small><p>${esc(r.text)}</p></div>`).join("")}</div>
          <form class="ax-comp" id="rf" data-note="${note}"><div class="ax-segs" role="group" aria-label="Message type"><button type="button" data-m="reply" aria-pressed="${!note}">Reply</button><button type="button" data-m="note" aria-pressed="${note}">${I("lock", 13)} Internal note</button></div>
            <div class="ax-comp-r"><textarea class="ax-input" id="rt" rows="1" maxlength="1500" placeholder="${note ? "Write a private note for your team…" : `Reply to ${esc(who)}…`}" aria-label="${note ? "Internal note" : "Reply"}"></textarea>${btn(note ? "Add note" : "Send", { v: "primary", ic: "send", type: "submit", cls: "ax-glow", attrs: "disabled id=sendb" })}</div><small id="cc" class="ax-help">Enter for a new line · Ctrl+Enter to send</small></form>`; };
        const details = (t) => `<div><label class="ax-lbl" for="ts">Status</label><select class="ax-input" id="ts">${["Open", "In progress", "Resolved"].map((s) => `<option ${groupOf(t) === s ? "selected" : ""}>${s}</option>`).join("")}</select></div><div style="margin-top:12px"><label class="ax-lbl" for="tp">Priority</label><select class="ax-input" id="tp">${["Low", "Medium", "High"].map((s) => `<option ${(t.priority || "Medium") === s ? "selected" : ""}>${s}</option>`).join("")}</select></div><div style="margin:12px 0"><label class="ax-lbl" for="ta">Assignee</label><select class="ax-input" id="ta"><option value="">Unassigned</option><option value="${esc(meName(ctx))}" ${t.assignee ? "selected" : ""}>${esc(meName(ctx))} (me)</option></select></div>${dl([["From", esc(t.name || "—")], ["Reference", esc(t.ref || "")], ["Opened", fmt.dateTime(t.createdAt)]])}`;
        const wire = (t) => {
          const save = async (p, msg) => { try { await st.patch("tickets", t.id, p); Object.assign(t, p); changed(); toast(msg); if (p.status) tab = isRes(t) ? (tab === "all" ? "all" : "resolved") : tab === "resolved" ? "open" : tab; paint(); } catch (e) { bad(e); } };
          $("[data-resolve]", box)?.addEventListener("click", () => save({ status: isRes(t) ? "Open" : "Resolved" }, isRes(t) ? "Ticket reopened." : "Ticket resolved."));
          $("[data-back]", box)?.addEventListener("click", () => { cur = null; if (hq().q.id && mobile()) history.back(); else { setQ({ id: "" }); paint(); } });
          $("[data-call]", box)?.addEventListener("click", () => CALLS.startCall(ctx, { to: t.uid, toName: t.name || "Customer", kind: "voice", title: "Faxton team" }));
          $("[data-chat]", box)?.addEventListener("click", async (e) => { const b = e.currentTarget; busy(b, true); try { const cid = await st.ensureDirectConversation(ctx.S.user, person(t)); try { sessionStorage.setItem("msgMode", "faxton"); } catch {} ctx.go("#/messages/" + cid); } catch (x) { busy(b, false); bad(x); } });
          $("[data-det]", box)?.addEventListener("click", () => { const d = dialog({ title: "Ticket details", sheet: mobile(), size: "sm", icon: "doc", body: details(t), onClose: () => paint() }); d.el.addEventListener("change", async (e) => { const m = { ts: { status: e.target.value }, tp: { priority: e.target.value }, ta: { assignee: e.target.value } }[e.target.id]; if (m) { try { await st.patch("tickets", t.id, m); Object.assign(t, m); changed(); toast("Updated."); } catch (x) { bad(x); } } }); });
          $$("[data-m]", box).forEach((b) => (b.onclick = () => { note = b.dataset.m === "note"; const v = $("#rt", box).value; paint(); $("#rt", box).value = v; $("#rt", box).dispatchEvent(new Event("input")); $("#rt", box).focus(); }));
          const ta = $("#rt", box), sb = $("#sendb", box), msgs = $("#msgs", box); if (msgs) msgs.scrollTop = msgs.scrollHeight;
          ta.oninput = () => { sb.disabled = !ta.value.trim(); ta.style.height = "auto"; ta.style.height = Math.min(160, ta.scrollHeight) + "px"; };
          ta.onkeydown = (e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); $("#rf", box).requestSubmit(); } };
          $("#rf", box).onsubmit = async (e) => { e.preventDefault(); const text = ta.value.trim(); if (!text) return; busy(sb, true); const next = [...(t.replies || []), { by: meName(ctx), text, internal: note, at: Date.now() }];
            try { const p = { replies: next, ...(note || /progress/i.test(t.status || "") ? {} : { status: "In progress" }) }; await st.patch("tickets", t.id, p); Object.assign(t, p); changed(); toast(note ? "Note added." : "Reply sent."); const keep = note; paint(); note = keep; } catch (x) { busy(sb, false); bad(x); } };
        };
        box.addEventListener("click", (e) => { const b = e.target.closest(".ax-tr"); if (b) pick(b.dataset.t); });
        bindSearch(el, (v) => { q = v; const host = $(".ax-tcr", box); if (host) { const rs = rows(); host.innerHTML = rs.map(rowHtml).join("") || empty({ icon: "search", title: "No tickets match", hint: "Try another word." }); } });
        const key = (e) => { if (!live || e.ctrlKey || e.metaKey || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.querySelector(".ax-ov")) return; const rs = rows(), i = rs.findIndex((x) => x.id === cur); if (e.key === "j" && rs[i + 1]) { e.preventDefault(); pick(rs[i + 1].id, false); } else if (e.key === "k" && rs[i - 1]) { e.preventDefault(); pick(rs[i - 1].id, false); } };
        document.addEventListener("keydown", key); ctx.S.cleanups.push(() => { live = false; document.removeEventListener("keydown", key); });
        AX.page.path = hq().path; AX.page.onSoft = (qq) => { if (qq.id) { cur = qq.id; const t = by.find((x) => x.id === cur); if (t && !test(tab)(t)) tab = isRes(t) ? "resolved" : "open"; } else if (mobile()) cur = null; paint(); };
        paint();
      } };
    } });
}

// =====================================================================================================================
// USERS
// =====================================================================================================================
const MARKET = [["renter", "Renter"], ["agent", "Realtor"], ["agency", "Company"], ["landlord", "Property owner"]];
const TEAM_SEAT = [["", "None"], ["support", "Support"], ["admin", "Admin"]];
const signIn = (u) => (u.provider === "google" || /googleusercontent\.com/.test(u.photo || "") ? "Google" : "Email");
export function usersPage(ctx) {
  return pageView(ctx, { title: "Users", head: false, cols: ["users"], what: "users", skeleton: AX.skeleton.rows(7),
    async render({ users: us }) {
      try { st.syncVerified(us); } catch {}
      const R = (u) => roleOf(ctx, u), me = ctx.S.user.uid, isOwner = ctx.S.isOwner, inTeam = (u) => ["owner", "admin", "support"].includes(R(u));
      const lock = (u) => !isOwner || u.id === me || R(u) === "owner";
      const roleCell = (u) => { const r = R(u); if (r === "owner") return `<span class="ax-seat" data-r="owner">${I("crown", 16)}Owner</span>`; if (inTeam(u)) return `<span class="ax-muted ax-dash" title="Team members don’t hold a marketplace role.">—</span>`;
        return `<select class="ax-sel" data-urole aria-label="Role for ${esc(u.name || u.email)}" ${lock(u) ? "disabled" : ""} ${lock(u) ? `title="${u.id === me ? "You can’t change your own role." : "Only the owner can change roles."}"` : ""}>${MARKET.map(([v, l]) => `<option value="${v}" ${r === v ? "selected" : ""}>${l}</option>`).join("")}</select>`; };
      const teamCell = (u) => { const r = R(u); if (r === "owner") return `<span class="ax-seat" data-r="owner">${I("crown", 16)}Owner</span>`;
        return `<select class="ax-sel" data-uteam aria-label="Team role for ${esc(u.name || u.email)}" ${lock(u) ? "disabled" : ""} ${lock(u) ? 'title="Only the owner can change team roles."' : ""}>${TEAM_SEAT.map(([v, l]) => `<option value="${v}" ${(inTeam(u) ? r : "") === v ? "selected" : ""}>${l}</option>`).join("")}</select>`; };
      const statusChip = (u) => { if (u.banned) return chip("bad", "Suspended"); if (A2.emailPending(u)) return chip("warn", "Pending"); if (["agent", "agency"].includes(R(u))) { const v = u.verification?.status; return A2.userVerified(u) ? chip("ok", "Verified") : v === "pending" ? chip("warn", "Pending") : v === "rejected" ? chip("bad", "Rejected") : chip("mute", "Unverified"); } return chip("ok", "Active"); };
      const lastOf = (u) => (u.lastActive ? ago(u.lastActive) : "—");
      return { html: `<div id="usr"></div>`, mount(el) {
        const root = $("#usr", el);
        const list = createList(root, { noun: "users", label: "Users", rows: us, pills: true, topSearch: true, density: "comfortable", noDensity: true, placeholder: "Search users…", filterExtra: btn("Invite user", { v: "primary", ic: "plus", cls: "ax-glow", attrs: "data-act=inv" }),
          tabs: [{ k: "all", label: "All" }, { k: "renter", label: "Renters", test: (u) => R(u) === "renter" }, { k: "agent", label: "Realtors", test: (u) => R(u) === "agent" }, { k: "agency", label: "Companies", test: (u) => R(u) === "agency" }, { k: "landlord", label: "Property owners", test: (u) => R(u) === "landlord" }, { k: "team", label: "Team", test: inTeam }, { k: "pending", label: "Pending", test: A2.emailPending }, { k: "suspended", label: "Suspended", test: (u) => !!u.banned }],
          sort: { k: "joined", dir: "desc" },
          facets: [{ k: "ver", label: "Verification", options: [["", "Any"], ["verified", "Verified"], ["pending", "Pending"], ["none", "Not requested"]], test: (u, v) => (v === "verified" ? A2.userVerified(u) : v === "pending" ? u.verification?.status === "pending" : !u.verification && !u.verified) }, { k: "country", label: "Country", options: (r) => [["", "Anywhere"], ...[...new Set(r.map((u) => u.country).filter(Boolean))].sort().map((c) => [c, c])], test: (u, v) => u.country === v }],
          search: (u) => `${u.name || ""} ${u.email || ""} ${u.phone || ""} ${u.agency?.business || ""}`,
          cols: [
            { k: "name", label: "User", role: "title", sort: (u) => String(u.name || u.email || "").toLowerCase(), cell: (u) => `<div class="ax-id">${avatar(u.name || u.email, u.id, 40, u.photo)}<div><b>${esc(u.name || "—")}${u.id === me ? ' <span class="ax-muted" style="font-weight:400">(you)</span>' : ""}</b><small title="${esc(u.email || "")}">${esc(u.email || "")}</small></div></div>` },
            { k: "role", label: "Role", cell: roleCell },
            { k: "team", label: "Team role", cell: teamCell },
            { k: "signin", label: "Sign-in", pri: 3, sort: (u) => signIn(u), cell: (u) => esc(signIn(u)) },
            { k: "joined", label: "Joined", pri: 2, sort: (u) => ms(u.createdAt), cell: (u) => fmt.date(u.createdAt) },
            { k: "last", label: "Last active", pri: 2, sort: (u) => ms(u.lastActive), cell: lastOf },
            { k: "status", label: "Status", role: "status", cell: statusChip },
          ],
          csv: { name: "faxton-users", head: ["Name", "Email", "Phone", "Role", "Sign-in", "Suspended", "Country", "City", "Joined", "Last active"], row: (u) => [u.name, u.email, u.phone, R(u), signIn(u), u.banned ? "yes" : "no", u.country, u.city, fmt.date(u.createdAt), u.lastActive ? fmt.date(u.lastActive) : ""] },
          quick: (u) => (u.id === me ? "" : `<button type="button" class="ax-ib ax-qm" data-qa="text" aria-label="Message ${esc(u.name || u.email)}" title="Message">${I("msg", 20)}</button>`), onQuick: (k, u) => A2.openChat(ctx, u),
          onQuery: (q) => { if (q.invite) { setQ({ invite: "" }); A2.inviteDialog(); } },
          drawer: (u, api) => A2.userDrawer(ctx, u, api), empty: { icon: "users", title: "No users yet", hint: "People appear here as soon as they sign up." } });
        // the top-bar search drives the list's own search box
        const top = $("#axPS"), qi = $("[data-q]", root);
        if (top && qi) { if (qi.value) top.value = qi.value; top.oninput = () => { qi.value = top.value; qi.dispatchEvent(new Event("input", { bubbles: true })); }; }
        const setRole = async (u, role, sel, msg) => { const prev = u.role; try { await st.setRole(u.id, role); u.role = role; changed(); list.repaint(); toast(msg, { action: "Undo", onAction: async () => { try { await st.setRole(u.id, prev || "renter"); u.role = prev || "renter"; changed(); list.repaint(); } catch (x) { bad(x); } } }); } catch (x) { bad(x); list.repaint(); } };
        root.addEventListener("change", async (e) => {
          const s = e.target.closest("select[data-urole],select[data-uteam]"); if (!s) return; const u = us.find((x) => x.id === s.closest("tr")?.dataset.id); if (!u) return; const was = R(u), nm = u.name || u.email;
          if (s.matches("[data-urole]")) { if (s.value === was) return; await setRole(u, s.value, s, `${nm} is now a ${MARKET.find((m) => m[0] === s.value)[1].toLowerCase()}.`); return; }
          const seat = s.value, cur = inTeam(u) ? was : ""; if (seat === cur) return;
          const market = ["agent", "agency", "landlord"].includes(was);
          const ok = await confirm({ title: seat ? `Give ${nm} ${seat === "admin" ? "Admin" : "Support"} access?` : `Remove ${nm} from the team?`, body: seat ? `${market ? "This replaces their current role. " : ""}They get access to the console straight away.` : "They go back to a regular renter account and lose access to the console.", confirmLabel: seat ? "Change team role" : "Remove from team", tone: seat ? "" : "danger", icon: "users" });
          if (!ok) { list.repaint(); return; }
          await setRole(u, seat || "renter", s, seat ? `${nm} is now ${seat === "admin" ? "an Admin" : "Support"}.` : `${nm} removed from the team.`);
        });
        $("[data-act=inv]", root)?.addEventListener("click", () => A2.inviteDialog());
        if (hq().q.invite) { setQ({ invite: "" }); A2.inviteDialog(); }
      } };
    } });
}
