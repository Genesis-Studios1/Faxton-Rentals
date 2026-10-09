// The profile card that opens when you tap someone's picture: a person or a business, with a green tick when verified.
import { $, $$, esc, icon, modal, toast, initials, verifiedBadge } from "./ui.js";
import * as st from "./store.js";

const TEAM = { about: "Your trusted partner for premium homes, short lets and real estate solutions.", city: "Lagos, Nigeria", hours: "Open now", site: "https://faxton-rentals.web.app" };
const ROLE = { agent: "Property agent", agency: "Agency", landlord: "Property owner", team: "Business account", user: "Faxton Rentals member", renter: "Faxton Rentals member" };

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
  const row = (k, ic, t, sub, right, flat) => `<${flat ? "div" : "button type=\"button\""} class="pf-r ${flat ? "flat" : ""}" data-k="${k}"><span class="pf-ri">${icon(ic, 20)}</span><span class="pf-rt"><b>${t}</b>${sub ? `<small>${sub}</small>` : ""}</span>${right ? `<em>${right}</em>` : ""}${flat ? "" : icon("chev", 16)}</${flat ? "div" : "button"}>`;
  const tiles = biz ? [p.onMessage && tile("msg", "msg", "Message"), p.onCall && tile("call", "phone", "Call"), tile("share", "share", "Share"), (all.length || p.role === "agent") && tile("store", "building", "Listings")] : [p.onMessage && tile("msg", "msg", "Message"), p.onCall && tile("call", "phone", "Audio Call"), p.onCall && tile("video", "video", "Video Call"), p.onSearch && tile("find", "search", "Search")];
  const nMedia = (p.media || []).length;
  const html = `<div class="pf-sheet ${biz ? "biz" : ""}" role="dialog" aria-modal="true" aria-label="${esc(name)}">
    <div class="pf-cover" ${cover ? `style="background-image:linear-gradient(rgba(4,14,11,.55),rgba(4,14,11,.7)),url('${esc(cover)}')"` : ""}><button type="button" class="pf-x" data-k="close" aria-label="Back">${icon("left", 22)}</button>${p.onBlock || p.onReport ? `<span class="pf-more"><button type="button" class="pf-m" aria-label="More">${icon("dots", 20)}</button><div class="menu pf-menu" hidden>${p.onBlock ? `<button type="button" data-k="block">${icon("shield", 16)} ${p.blocked ? "Unblock user" : "Block user"}</button>` : ""}${p.onReport ? `<button type="button" data-k="report" class="danger-i">${icon("flag", 16)} Report user</button>` : ""}</div></span>` : ""}</div>
    <div class="pf-body"><div class="pf-av ${biz ? "sq" : ""}">${av}${verified ? `<span class="pf-vb">${verifiedBadge(30)}</span>` : ""}</div>
      <h2>${esc(name)} ${verified && !biz ? verifiedBadge(20) : ""}</h2><p class="pf-role">${esc(ROLE[p.role] || ROLE.user)}${verified && ["agent", "agency", "landlord"].includes(p.role) ? " · Verified" : ""}</p><p class="pf-about">${esc(about)}</p>
      <div class="pf-tiles">${tiles.filter(Boolean).join("")}</div>
      ${(p.area || pub?.city || p.role === "team") ? `<div class="pf-card">${row("loc", "pin", esc(p.role === "team" ? TEAM.city : [p.area, pub?.city].filter(Boolean)[0] || ""), "", "", true)}${p.role === "team" ? row("hours", "clock", `<span style="color:var(--brand)">${TEAM.hours}</span>`, "", "9:00 AM – 8:00 PM", true) : ""}</div>` : ""}
      ${all.length ? `<div class="pf-card pf-prod"><button type="button" class="pf-r" data-k="store"><span class="pf-ri">${icon("home", 20)}</span><span class="pf-rt"><b>Properties</b></span><em>View all</em>${icon("chev", 16)}</button><div class="pf-thumbs">${all.map((l) => `<a href="#/home/${esc(l.id)}" data-k="close" title="${esc(l.title)}"><img src="${esc(l.thumb || l.images?.[0] || "")}" alt="${esc(l.title)}" loading="lazy"></a>`).join("")}</div></div>` : ""}
      ${nMedia || p.pinned ? `<div class="pf-card">${nMedia ? row("media", "img", "Media and documents", "", nMedia + " item" + (nMedia > 1 ? "s" : "")) : ""}${p.pinned ? row("pinned", "pin", "Pinned message", "", "1 item") : ""}</div>` : ""}
      ${p.role === "team" ? `<div class="pf-card">${row("site", "globe", "Website", esc(TEAM.site.replace("https://", "")), "")}</div>` : pub?.website ? `<div class="pf-card">${row("site", "globe", "Website", esc(pub.website.replace(/^https?:\/\//, "")), "")}</div>` : ""}
    </div></div>`;
  const ov = document.createElement("div"); ov.className = "pf-ov"; ov.innerHTML = html; document.body.append(ov); document.documentElement.classList.add("dlx-lock");
  const close = () => { ov.remove(); document.documentElement.classList.remove("dlx-lock"); document.removeEventListener("keydown", key); };
  const key = (e) => { if (e.key === "Escape") close(); }; document.addEventListener("keydown", key);
  ov.addEventListener("click", (e) => {
    if (e.target === ov) return close();
    const menuBtn = e.target.closest(".pf-m"); if (menuBtn) { const m = $(".pf-menu", ov); m.hidden = !m.hidden; return; }
    const b = e.target.closest("[data-k]"); if (!b) return; const k = b.dataset.k; if (k !== "block" && k !== "report") $(".pf-menu", ov) && ($(".pf-menu", ov).hidden = true);
    if (k === "close") return close();
    if (k === "msg") { close(); return p.onMessage?.(); }
    if (k === "call") { close(); return p.onCall?.("voice"); }
    if (k === "video") { close(); return p.onCall?.("video"); }
    if (k === "find") { close(); return p.onSearch?.(); }
    if (k === "media") { close(); return p.onMedia?.(); }
    if (k === "pinned") { close(); return p.onPinned?.(); }
    if (k === "block") { close(); return p.onBlock?.(); }
    if (k === "report") { close(); return p.onReport?.(); }
    if (k === "store") { close(); return ctx.go("#/agent/" + (p.uid || "")); }
    if (k === "site") { return window.open(p.role === "team" ? TEAM.site : pub?.website, "_blank", "noopener"); }
    if (k === "share") { const url = location.origin + "/#/agent/" + (p.uid || ""); try { navigator.share ? navigator.share({ title: name, url }) : navigator.clipboard.writeText(url).then(() => toast("Link copied.")); } catch {} }
  });
  return { close };
}
