// The profile card that opens when you tap someone's picture: a person or a business, with a green tick when verified.
import { $, $$, esc, icon, modal, toast, initials, verifiedBadge } from "./ui.js";
import * as st from "./store.js";
import { saveFile } from "./safety.js";

const PUSH = '<svg class="ic" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/></svg>';
const fsize = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round((n || 0) / 1024)) + " KB");
const TEAM = { about: "Your trusted partner for premium homes, short lets and real estate solutions.", city: "Lagos, Nigeria", hours: "Open now", site: "https://faxton-rentals.web.app" };
const ROLE = { agent: "Property agent", agency: "Business", landlord: "Property owner", team: "Business account", user: "Faxton Rentals member", renter: "Faxton Rentals member" };

// p: { uid, name, avatar, role, verified, listingId, area, media[], pinned, onMessage, onCall(kind), onSearch, onMedia, onPinned, onBlock, onReport, blocked }
export async function openProfile(ctx, p) {
  const biz = ["agent", "agency", "landlord", "team"].includes(p.role);
  const pub = p.uid && p.role !== "team" ? await st.getPublic(p.uid) : null;
  const verified = p.role === "team" ? true : !!(p.verified ?? pub?.verified);
  const name = pub?.name || p.name || "Faxton user", photo = p.avatar || pub?.photo || "";
  const about = pub?.about || (p.role === "team" ? TEAM.about : biz ? "Helping people find and rent homes on Faxton Rentals." : "Hey there! I’m using Faxton Rentals.");
  const all = biz && p.role !== "team" && p.uid ? (await st.getListings().catch(() => [])).filter((l) => l.ownerUid === p.uid || l.agent?.id === p.uid).slice(0, 6) : p.role === "team" ? (await st.getListings().catch(() => [])).slice(0, 6) : [];
  const cover = all[0]?.thumb || all[0]?.images?.[0] || "";
  const av = photo ? `<img src="${esc(photo)}" alt="" referrerpolicy="no-referrer">` : `<span>${esc(initials(name))}</span>`;
  const tile = (k, ic, l) => `<button type="button" class="pf-t" data-k="${k}">${icon(ic, 22)}<span>${l}</span></button>`;
  const row = (k, ic, t, sub, right, flat) => `<${flat ? "div" : "button type=\"button\""} class="pf-r ${flat ? "flat" : ""}" data-k="${k}"><span class="pf-ri">${ic === "pushpin" ? PUSH : icon(ic, 20)}</span><span class="pf-rt"><b>${t}</b>${sub ? `<small>${sub}</small>` : ""}</span>${right ? `<em>${right}</em>` : ""}${flat ? "" : icon("chev", 16)}</${flat ? "div" : "button"}>`;
  const tiles = biz ? [p.onMessage && tile("msg", "msg", "Message"), p.onCall && tile("call", "phone", "Call"), tile("share", "share", "Share"), (all.length || p.role === "agent") && tile("store", "building", "Listings")] : [p.onMessage && tile("msg", "msg", "Message"), p.onCall && tile("call", "phone", "Audio Call"), p.onCall && tile("video", "video", "Video Call"), p.onSearch && tile("find", "search", "Search")];
  const nMedia = (p.media || []).length, nLinks = (p.links || []).length;
  const html = `<div class="pf-sheet ${biz ? "biz" : ""}" role="dialog" aria-modal="true" aria-label="${esc(name)}">
    <div class="pf-cover" ${cover ? `style="background-image:linear-gradient(rgba(4,14,11,.55),rgba(4,14,11,.7)),url('${esc(cover)}')"` : ""}><button type="button" class="pf-x" data-k="close" aria-label="Back">${icon("left", 22)}</button>${p.onBlock || p.onReport ? `<span class="pf-more"><button type="button" class="pf-m" aria-label="More">${icon("dots", 20)}</button><div class="menu pf-menu" hidden>${p.onBlock ? `<button type="button" data-k="block">${icon("shield", 16)} ${p.blocked ? "Unblock user" : "Block user"}</button>` : ""}${p.onReport ? `<button type="button" data-k="report" class="danger-i">${icon("flag", 16)} Report user</button>` : ""}</div></span>` : ""}</div>
    <div class="pf-body"><div class="pf-av ${biz ? "sq" : ""}">${av}${verified ? `<span class="pf-vb">${verifiedBadge(30)}</span>` : ""}</div>
      <h2>${esc(name)} ${verified && !biz ? verifiedBadge(20) : ""}</h2><p class="pf-role">${esc(ROLE[p.role] || ROLE.user)}${verified && ["agent", "agency", "landlord"].includes(p.role) ? " · Verified" : ""}</p><p class="pf-about">${esc(about)}</p>
      <div class="pf-tiles">${tiles.filter(Boolean).join("")}</div>
      ${(p.area || pub?.city || p.role === "team") ? `<div class="pf-card">${row("loc", "pin", esc(p.role === "team" ? TEAM.city : [p.area, pub?.city].filter(Boolean)[0] || ""), "", "", true)}${p.role === "team" ? row("hours", "clock", `<span style="color:var(--brand)">${TEAM.hours}</span>`, "", "9:00 AM – 8:00 PM", true) : ""}</div>` : ""}
      ${all.length ? `<div class="pf-card pf-prod"><button type="button" class="pf-r" data-k="store"><span class="pf-ri">${icon("home", 20)}</span><span class="pf-rt"><b>Properties</b></span><em>View all</em>${icon("chev", 16)}</button><div class="pf-thumbs">${all.map((l) => `<a href="#/home/${esc(l.id)}" data-k="close" title="${esc(l.title)}"><img src="${esc(l.thumb || l.images?.[0] || "")}" alt="${esc(l.title)}" loading="lazy"></a>`).join("")}</div></div>` : ""}
      ${nMedia || nLinks || p.pinned ? `<div class="pf-card">${nMedia || nLinks ? row("media", "img", "Media, docs and links", "", (nMedia + nLinks) + " item" + (nMedia + nLinks > 1 ? "s" : "")) : ""}${p.pinned ? row("pinned", "pushpin", "Pinned message", "", "1 item") : ""}</div>` : ""}
      ${p.role === "team" ? `<div class="pf-card">${row("site", "globe", "Website", esc(TEAM.site.replace("https://", "")), "")}</div>` : pub?.website ? `<div class="pf-card">${row("site", "globe", "Website", esc(pub.website.replace(/^https?:\/\//, "")), "")}</div>` : ""}
    </div></div>`;
  const ov = document.createElement("div"); ov.className = "pf-ov"; ov.innerHTML = html; document.body.append(ov); document.documentElement.classList.add("dlx-lock");
  const prevFocus = document.activeElement, focusFirst = () => { try { const sh = $(".pf-sheet", ov) || ov; sh.tabIndex = -1; sh.focus({ preventScroll: true }); } catch {} }; focusFirst();
  // Media, documents and links shared in this chat.
  const showMedia = (tab = "media") => {
    const onTab = !!document.activeElement?.matches?.("[data-tab]");
    const imgs = (p.media || []).filter((m) => m.image), docs = (p.media || []).filter((m) => m.file), links = p.links || [];
    const tabs = [["media", "Media", imgs.length], ["docs", "Docs", docs.length], ["links", "Links", links.length]];
    const body = tab === "media" ? (imgs.length ? `<div class="pf-mg">${imgs.map((m, i) => `<button type="button" class="pf-mi" data-i="${i}" aria-label="Open photo ${i + 1}"><img src="${esc(m.image)}" alt="" loading="lazy"></button>`).join("")}</div>` : `<p class="pf-none">No photos yet.</p>`)
      : tab === "docs" ? (docs.length ? `<div class="pf-card">${docs.map((m, i) => `<a class="pf-r" href="${esc(m.file)}" download="${esc(m.fname || "file")}" data-dl="${i}"><span class="pf-ri">${icon("doc", 18)}</span><span class="pf-rt"><b>${esc(m.fname || "File")}</b><small>${fsize(m.fsize)} · ${esc((String(m.fname || "").split(".").pop() || "file").toUpperCase())}</small></span>${icon("download", 18)}</a>`).join("")}</div>` : `<p class="pf-none">No documents yet.</p>`)
      : (links.length ? `<div class="pf-card">${links.map((u) => `<a class="pf-r" href="${esc(u)}" target="_blank" rel="noopener noreferrer"><span class="pf-ri">${icon("globe", 18)}</span><span class="pf-rt"><b>${esc(u.replace(/^https?:\/\//, "").slice(0, 60))}</b></span>${icon("share", 16)}</a>`).join("")}</div>` : `<p class="pf-none">No links yet.</p>`);
    ov.innerHTML = `<div class="pf-sheet pf-media" role="dialog" aria-modal="true" aria-label="Media, docs and links"><div class="pf-mh"><button type="button" class="pf-bk" data-k="back" aria-label="Back">${icon("left", 22)}</button><b>Media, docs and links</b></div>
      <div class="pf-seg" role="tablist">${tabs.map(([k, l, n]) => `<button type="button" role="tab" class="${k === tab ? "on" : ""}" aria-selected="${k === tab}" data-tab="${k}">${l} <span>${n}</span></button>`).join("")}</div><div class="pf-mb">${body}</div></div>`;
    $$("[data-tab]", ov).forEach((b) => (b.onclick = () => showMedia(b.dataset.tab)));
    $$("[data-dl]", ov).forEach((a) => (a.onclick = (e) => { e.preventDefault(); const m = docs[+a.dataset.dl]; if (m) saveFile(m.file, m.fname || "file"); }));
    $$(".pf-mi", ov).forEach((b) => (b.onclick = () => { close(); p.onImage?.(+b.dataset.i); }));
    const bk = $("[data-k=back]", ov); if (bk) bk.onclick = (e) => { e.stopPropagation(); ov.innerHTML = html; focusFirst(); };
    const tb = $(`[data-tab="${tab}"]`, ov); if (tb && onTab) tb.focus(); else focusFirst();
  };
  const close = () => { ov.remove(); document.documentElement.classList.remove("dlx-lock"); document.removeEventListener("keydown", key); try { prevFocus?.isConnected && prevFocus.focus({ preventScroll: true }); } catch {} };
  const key = (e) => {
    if (e.key === "Escape") return close();
    if (e.key !== "Tab") return; const f = $$("button:not([disabled]),a[href]", ov).filter((x) => x.offsetParent !== null && !x.closest("[hidden]")); if (!f.length) return;
    const first = f[0], last = f[f.length - 1]; if (!ov.contains(document.activeElement)) { e.preventDefault(); first.focus(); } else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }; document.addEventListener("keydown", key);
  ov.addEventListener("click", (e) => {
    if (e.target === ov) return close();
    const menuBtn = e.target.closest(".pf-m"); if (menuBtn) { const m = $(".pf-menu", ov); m.hidden = !m.hidden; return; }
    const b = e.target.closest("[data-k]"); if (!b) return; const k = b.dataset.k; if (k !== "block" && k !== "report") $(".pf-menu", ov) && ($(".pf-menu", ov).hidden = true);
    if (k === "close") return close();
    if (k === "msg") { close(); return p.onMessage?.(); }
    if (k === "call") { close(); return p.onCall?.("voice"); }
    if (k === "video") { close(); return p.onCall?.("video"); }
    if (k === "find") { close(); return p.onSearch?.(); }
    if (k === "media") { if (nMedia || nLinks || !p.onMedia) return showMedia(); close(); return p.onMedia?.(); }
    if (k === "pinned") { close(); return p.onPinned?.(); }
    if (k === "block") { close(); return p.onBlock?.(); }
    if (k === "report") { close(); return p.onReport?.(); }
    if (k === "store") { close(); return ctx.go("#/agent/" + (p.uid || "")); }
    if (k === "site") { return window.open(p.role === "team" ? TEAM.site : pub?.website, "_blank", "noopener"); }
    if (k === "share") { const url = location.origin + "/#/agent/" + (p.uid || ""); try { navigator.share ? navigator.share({ title: name, url }) : navigator.clipboard.writeText(url).then(() => toast("Link copied.")); } catch {} }
  });
  return { close };
}
