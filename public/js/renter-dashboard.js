import * as st from "./store.js";
import { $, esc, icon } from "./ui.js";
import { statusPill } from "./fx.js";
import { listingCard, bindCards } from "./cards.js";

const dateValue = (value) => {
  if (!value) return 0;
  const d = new Date(String(value).slice(0, 10) + "T00:00:00");
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
};
const appliedLabel = (value) => { const ms = value?.seconds ? value.seconds * 1000 : value?.toMillis ? value.toMillis() : typeof value === "number" ? value : Date.parse(value || ""); return Number.isFinite(ms) && ms > 0 ? new Date(ms).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }) : "recently"; };
const dateLabel = (value) => value ? new Date(String(value).slice(0, 10) + "T00:00:00").toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }) : "Date not set";
const isOpenViewing = (v) => !/cancel|declin|complete/i.test(String(v.status || ""));
const firstName = (ctx) => String(ctx.S.profile?.name || ctx.S.user?.displayName || "there").trim().split(/\s+/)[0];

export async function renterDashboard(ctx) {
  if (ctx.S.role !== "renter" && !ctx.S.tenant) {
    ctx.go("#" + (ctx.dashHome() || "/"));
    return { title: "Renter dashboard", html: "" };
  }
  const [appsResult, viewingsResult, listingsResult, savedResult] = await Promise.allSettled([
    st.myApplications(ctx.S.user),
    st.myViewings(ctx.S.user),
    st.getListings(),
    st.getSaved(ctx.S.user)
  ]);
  const apps = appsResult.status === "fulfilled" ? appsResult.value : [];
  const viewings = viewingsResult.status === "fulfilled" ? viewingsResult.value : [];
  const listings = listingsResult.status === "fulfilled" ? listingsResult.value : [];
  const savedSet = savedResult.status === "fulfilled" ? new Set(savedResult.value || []) : (ctx.S.saved instanceof Set ? ctx.S.saved : new Set());
  if (savedResult.status === "fulfilled") ctx.S.saved = savedSet;
  const savedIds = [...savedSet];
  const saved = listings.filter((listing) => savedIds.includes(listing.id)).slice(0, 3);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const upcoming = viewings.filter((v) => isOpenViewing(v) && dateValue(v.when) >= today.getTime()).sort((a, b) => dateValue(a.when) - dateValue(b.when));
  const activeApps = apps.filter((a) => !/withdrawn|rejected/i.test(String(a.status || "")));
  const approved = apps.filter((a) => /approved/i.test(String(a.status || "")));
  const nextViewing = upcoming[0];
  const tenancy = ctx.S.tenant;
  const metric = (label, value, note, ic) => `<article class="rd-stat"><span class="rd-stat-ic">${icon(ic, 20)}</span><div><small>${label}</small><b>${value}</b><p>${note}</p></div></article>`;
  const appRows = activeApps.slice(0, 4).map((a) => `<a class="rd-row" href="#/applications"><img src="${esc(a.image || "img/palm-court.webp")}" alt="" loading="lazy"><span class="rd-row-main"><b>${esc(a.title || "Rental property")}</b><small>${esc(a.area || "Location not listed")} · Applied ${esc(appliedLabel(a.createdAt))}</small></span>${statusPill(a.status || "Submitted")}</a>`).join("");
  const viewingRows = upcoming.slice(0, 3).map((v) => `<a class="rd-row" href="#/bookings"><span class="rd-row-ic">${icon("cal", 20)}</span><span class="rd-row-main"><b>${esc(v.title || "Property viewing")}</b><small>${esc(dateLabel(v.when))} · ${esc(v.slot || "Time to be confirmed")}</small></span>${statusPill(v.status || "Requested")}</a>`).join("");
  const savedRows = saved.map((l) => listingCard(l, savedSet, { i: 0 })).join("");
  const failed = [
    appsResult.status === "rejected" ? "applications" : "",
    viewingsResult.status === "rejected" ? "viewings" : "",
    listingsResult.status === "rejected" ? "saved homes" : ""
  ].filter(Boolean);
  const html = `<div class="wrap rd">
    <header class="rd-head"><div><span class="rd-eyebrow">Your rental space</span><h1>Welcome back, ${esc(firstName(ctx))}</h1><p>Keep track of your applications, viewings and saved homes.</p></div><a class="btn primary" href="#/search">${icon("search", 17)} Find a home</a></header>
    <section class="rd-stats" aria-label="Rental activity">
      ${metric("Applications", activeApps.length, activeApps.length ? "Your active applications" : "Start with a home you love", "doc")}
      ${metric("Upcoming viewings", upcoming.length, nextViewing ? `Next: ${dateLabel(nextViewing.when)}` : "No viewings scheduled", "cal")}
      ${metric("Saved homes", savedIds.length, savedIds.length ? "Homes on your shortlist" : "Save homes to compare later", "heart")}
      ${metric("Approved", approved.length, approved.length ? "Application approved" : "No approvals yet", "check")}
    </section>
    ${failed.length ? `<div class="rd-alert" role="status">Some information couldn’t load (${esc(failed.join(", "))}). Other sections are still available. <button type="button" id="rdRetry">Try again</button></div>` : ""}
    <section class="rd-grid">
      <article class="rd-panel"><div class="rd-panel-head"><div><h2>My applications</h2><p>Updates from properties you’ve applied for.</p></div><a href="#/applications">View all ${icon("arrow", 15)}</a></div>
        ${appRows || `<div class="rd-empty">${icon("doc", 25)}<b>No applications yet</b><p>When you apply for a property, its progress will appear here.</p><a class="btn sm" href="#/search">Browse homes</a></div>`}
      </article>
      <article class="rd-panel"><div class="rd-panel-head"><div><h2>Upcoming viewings</h2><p>Your scheduled property visits.</p></div><a href="#/bookings">View all ${icon("arrow", 15)}</a></div>
        ${viewingRows || `<div class="rd-empty">${icon("cal", 25)}<b>No upcoming viewings</b><p>Book a viewing from any property you’re interested in.</p><a class="btn sm" href="#/search">Find a home</a></div>`}
      </article>
      <article class="rd-panel rd-wide"><div class="rd-panel-head"><div><h2>Saved homes</h2><p>Your shortlist for the next move.</p></div><a href="#/saved">View all ${icon("arrow", 15)}</a></div>
        ${savedRows ? `<div class="hx-grid rd-saved-grid" id="rdSaved">${savedRows}</div>` : `<div class="rd-empty">${icon("heart", 25)}<b>No saved homes yet</b><p>Tap the heart on a listing to keep it on your shortlist.</p><a class="btn sm" href="#/search">Explore homes</a></div>`}
      </article>
      <article class="rd-panel rd-next"><div class="rd-panel-head"><div><h2>My rental</h2><p>Your tenancy and agreements.</p></div></div>
        ${tenancy ? `<div class="rd-tenancy"><span class="rd-row-ic">${icon("home", 22)}</span><div><b>${esc(tenancy.l?.title || "Active tenancy")}</b><small>${esc(tenancy.l?.area || "Your current home")}</small></div></div><a class="btn sm primary" href="#/myhome">Open My Home</a>` : `<div class="rd-empty compact"><b>Not renting through Faxton yet</b><p>Once your rental agreement is active, your tenancy tools will appear here.</p><a href="#/agreements">View agreements</a></div>`}
      </article>
    </section>
  </div>`;
  return { title: "Renter dashboard", html, mount(root) {
    const retry = $("#rdRetry", root);
    if (retry) retry.onclick = () => ctx.render();
    const grid = $("#rdSaved", root);
    if (grid) bindCards(grid, ctx);
  } };
}
