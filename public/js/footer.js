// The footer shown at the bottom of the site: social links, legal links, privacy choices and the brand.
import { $, esc, icon, modal, toast, logoMark, BUILD } from "./ui.js";

// Add the real page address for each network here and its icon opens it; until then it shows "coming soon".
const SOCIALS = [
  ["Instagram", "", '<rect x="3.5" y="3.5" width="17" height="17" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.2" cy="6.8" r="1.2" fill="currentColor"/>'],
  ["LinkedIn", "", '<circle cx="5.2" cy="5" r="2" fill="currentColor"/><rect x="3.4" y="8.6" width="3.6" height="11.4" rx=".6" fill="currentColor"/><path fill="currentColor" d="M9.6 8.6h3.4v1.6c.6-1.1 1.9-1.9 3.6-1.9 3.1 0 3.9 2 3.9 4.7V20h-3.6v-6.2c0-1.4-.3-2.4-1.7-2.4-1.6 0-2 1.1-2 2.5V20H9.6V8.6z"/>'],
  ["X", "", '<path fill="currentColor" d="M17.8 3h3L14.2 10.5 22 21h-6.1l-4.8-6.3L5.6 21h-3l7.1-8.1L2.2 3h6.3l4.3 5.8L17.8 3zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5z"/>'],
  ["YouTube", "", '<path fill="currentColor" d="M21.6 7.2a2.6 2.6 0 00-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.6 2.6 0 002.4 7.2C2 8.8 2 12 2 12s0 3.2.4 4.8a2.6 2.6 0 001.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.6 2.6 0 001.8-1.8c.4-1.6.4-4.8.4-4.8s0-3.2-.4-4.8zM10 15V9l5.2 3L10 15z"/>'],
  ["TikTok", "", '<path fill="currentColor" d="M16.6 2h-3.2v13.2a2.8 2.8 0 11-2-2.7V9.2a6 6 0 105.2 5.9V8.6a7 7 0 004 1.3V6.7a4.1 4.1 0 01-4-4.7z"/>'],
  ["Pinterest", "", '<path fill="currentColor" d="M12 2a10 10 0 00-3.6 19.3c-.1-.8-.2-2 0-2.9l1.2-5s-.3-.6-.3-1.5c0-1.4.8-2.4 1.8-2.4.9 0 1.300.6 1.300 1.400 0 .9-.5 2.100-.8 3.300-.2 1 .5 1.800 1.500 1.800 1.800 0 3.200-1.900 3.200-4.600 0-2.400-1.700-4.100-4.200-4.100-2.900 0-4.600 2.200-4.600 4.400 0 .9.300 1.800.8 2.300.1.100.1.200.1.300l-.3 1.100c0 .2-.2.200-.4.100-1.300-.6-2.100-2.500-2.100-4 0-3.300 2.400-6.300 6.900-6.300 3.600 0 6.400 2.600 6.400 6 0 3.600-2.300 6.500-5.400 6.500-1.100 0-2.100-.6-2.400-1.200l-.7 2.500c-.2.900-.9 2.100-1.300 2.800A10 10 0 1012 2z"/>'],
];
const ext = `<svg class="sf-ext" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5"/></svg>`;

export function siteFooter() {
  const year = new Date().getFullYear();
  return `<footer class="site-foot" aria-label="Site footer"><div class="sf-in">
    <div class="sf-main">
      <ul class="sf-social" aria-label="Follow us">${SOCIALS.map(([n, url, p]) => `<li><a href="${esc(url || "#")}" ${url ? 'target="_blank" rel="noopener"' : ""} data-social="${esc(n)}" aria-label="${esc(n)}"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">${p}</svg></a></li>`).join("")}</ul>
      <nav class="sf-links" aria-label="Legal and help"><a href="#/help">Support ${ext}</a><a href="#/privacy">Privacy ${ext}</a><a href="#/terms">Terms of Use ${ext}</a><a href="#/license">License ${ext}</a></nav>
      <nav class="sf-links sf-links2" aria-label="Privacy"><button type="button" class="sf-choices" data-choices><span class="sf-tog" aria-hidden="true"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"/></svg><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></span>Your Privacy Choices ${ext}</button><a href="#/?to=app">Get the app ${ext}</a></nav>
    </div>
    <div class="sf-brand"><span class="sf-mark">${logoMark()}</span><b>FAXTON <span>RENTALS</span></b><small>© ${year} Faxton Rentals Inc. All rights reserved. <span class="sf-ver">Version ${esc(BUILD)}</span></small></div>
  </div></footer>`;
}

// Opens the privacy choices window. The notification switch reflects the browser's real permission.
function privacyChoices() {
  const can = "Notification" in window, perm = can ? Notification.permission : "denied";
  const m = modal(`<h2>Your privacy choices</h2><p class="muted" style="margin:4px 0 14px">Faxton Rentals doesn’t show ads and doesn’t use advertising or tracking cookies. We store only what is needed to keep you signed in and to remember your theme. <b>We don’t run any analytics today</b>, so there is nothing to switch off; if that ever changes, the choice will appear here first.</p>
    <label class="pc-row"><span><b>Device notifications</b><small>${can ? (perm === "granted" ? "On for this browser. Turn them off in your browser’s site settings." : perm === "denied" ? "Blocked in this browser. Change it in the browser’s site settings." : "Alerts for new messages, viewings and account updates.") : "Not supported on this device."}</small></span><input type="checkbox" role="switch" id="pcN" ${perm === "granted" ? "checked" : ""} ${!can || perm !== "default" ? "disabled" : ""}></label>
    <div class="pc-links"><a class="link" href="#/privacy">Read the Privacy Policy</a><a class="link" href="#/settings">Edit my profile or delete my account</a></div><div class="a2-act"><button class="btn primary" id="pcOk">Done</button></div>`);
  const n = $("#pcN", m.el); if (n) n.onchange = async () => { try { const r = await Notification.requestPermission(); n.checked = r === "granted"; n.disabled = r !== "default"; toast(r === "granted" ? "Notifications are on." : "Notifications stay off."); } catch {} };
  $("#pcOk", m.el).onclick = () => m.close(); m.el.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => m.close()));
}

let wired = false;
export function wireFooter() {
  if (wired) return; wired = true;
  document.addEventListener("click", (e) => {
    const c = e.target.closest?.("[data-choices]"); if (c) { e.preventDefault(); return privacyChoices(); }
    const s = e.target.closest?.("a[data-social]"); if (s && s.getAttribute("href") === "#") { e.preventDefault(); toast(`Our ${s.dataset.social} page is coming soon.`); }
  });
}
