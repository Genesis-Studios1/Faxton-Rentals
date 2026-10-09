// Terms of Use and Privacy Policy, readable by anyone (also from the sign-up page).
import { icon } from "./ui.js";

const UPDATED = "9 October 2026";
const TERMS = [
  ["About Faxton Rentals", "Faxton Rentals is an online marketplace that helps people find homes to rent, book viewings, message and call agents and landlords, and apply to rent. We connect renters with property owners, agencies and agents. Unless a listing says otherwise, we are not the landlord and we do not own the homes listed."],
  ["Your account", "You must give accurate details, including your area of residence, and keep your password private. You are responsible for what happens under your account. You must be at least 18 years old. Agencies and agents must pass our verification checks before they can list properties. We may suspend or ban accounts that break these terms."],
  ["Listings and viewings", "Owners, agencies and agents are responsible for the accuracy of their listings, photos, videos and prices. Listings are reviewed before they go live, but we cannot guarantee that every detail is correct. Always inspect a home before you pay. Never pay anyone outside the arrangements agreed on the platform, and report anything that looks suspicious."],
  ["Applications and payments", "An application is a request to rent and is not a tenancy agreement. A tenancy begins only when the owner or agent accepts you and the agreement is signed. Rent, service charges and deposits are agreed between you and the owner. Estimates shown on a property page are for guidance only."],
  ["Messages and calls", "You may message and call other users about homes on the platform. Be respectful. Do not harass, threaten or spam anyone. If you record a call, everyone on the call is shown that recording is on, and the recording is saved only on your device. You are responsible for following the recording laws where you live."],
  ["What you must not do", "Do not post false, misleading or illegal content; impersonate others; scrape or copy the service; try to break or bypass its security; or use it to commit fraud."],
  ["Deleting your account", "You can ask to delete your account in Settings. Requests are reviewed by our team, which takes about a day. You can cancel before the request is approved."],
  ["Changes and liability", "We may update the service and these terms. If you keep using Faxton Rentals after a change, you accept the new terms. To the extent the law allows, we are not liable for losses that arise from dealings between users, including rent paid to others, or from the service being unavailable."],
  ["Contact us", "Questions about these terms? Use the Contact us page in the app and choose “New support request”."],
];
const PRIVACY = [
  ["What we collect", "Your name, email address, area of residence (country and city), phone number and profile photo if you add them; your saved homes, viewing requests, applications, messages and call history; and, for agencies and agents, the business details you give us to be verified (such as company name, registration number, support email and the registrar’s date of birth). We never see or store your password, because sign-in is handled by Google’s Firebase Authentication."],
  ["How we use it", "To run your account, show you relevant homes, connect you with owners and agents, verify agencies and agents, keep the platform safe, answer support requests, and send you notifications you have switched on."],
  ["Who can see it", "Other users see only what is needed for a conversation or a listing, such as your name and photo. Verification details are visible only to the Faxton team. We do not sell your personal information."],
  ["Calls and recordings", "Calls are sent directly between the people on the call. Our servers handle only the connection details. If you record a call, the file is saved on your own device and is not uploaded to us."],
  ["Location, camera and microphone", "We ask for these permissions only when you use a feature that needs them: location when you set a property’s position on the map, and the camera, microphone and screen when you make a call. You can turn them off in your browser or phone settings."],
  ["Where it is kept", "Your data is stored with Google Firebase (Authentication and Firestore). It is protected by access rules so people can read only the information they are allowed to see."],
  ["Your choices", "You can edit your profile and notification settings at any time. You can ask to delete your account in Settings, and we will review the request within about a day."],
  ["Children", "Faxton Rentals is not meant for anyone under 18."],
  ["Changes and contact", "We will update this page if our practices change. For privacy questions, use the Contact us page in the app."],
];

const LICENSE = [
  ["Copyright", "© 2026 Faxton Rentals Inc. All rights reserved. The Faxton Rentals name, logo, design, text, photos and software are owned by Faxton Rentals Inc. or used with permission."],
  ["Your licence to use the service", "We give you a personal, non-exclusive, non-transferable licence to use the Faxton Rentals website and apps to find homes, book viewings and talk to owners and agents. You may not copy, sell, rent out, reverse engineer or build a competing service from it."],
  ["Content you add", "You keep ownership of the photos, videos, descriptions and messages you add. By posting a listing you let Faxton Rentals show it on the platform and in our apps so that renters can find it. You promise you have the right to share it."],
  ["Open-source software", "Faxton Rentals is built with open-source software, each under its own licence: Firebase (Apache 2.0), Leaflet (BSD 2-Clause), Capacitor (MIT) and Electron (MIT)."],
  ["Maps", "Map data © OpenStreetMap contributors, available under the Open Database Licence (ODbL)."],
  ["Trademarks", "Other names and logos, including Google, Apple, Windows and Android, belong to their owners and are used only to describe where the app runs."],
  ["Contact", "For licensing or copyright questions, use the Contact us page in the app."],
];
export function legalPage(ctx, which) {
  const isT = which === "terms", isL = which === "license", secs = isL ? LICENSE : isT ? TERMS : PRIVACY, title = isL ? "License" : isT ? "Terms of Use" : "Privacy Policy";
  const html = `<main class="lg-page"><header class="lg-head"><a class="ob-logo" href="#/" aria-label="Faxton Rentals"><span><b>Faxton</b> Rentals</span></a><button type="button" class="btn sm" id="lgBack">${icon("left", 18)} Back</button></header>
    <div class="lg-in"><div class="lg-tabs"><a class="${isT ? "on" : ""}" href="#/terms">Terms of Use</a><a class="${which === "privacy" ? "on" : ""}" href="#/privacy">Privacy Policy</a><a class="${isL ? "on" : ""}" href="#/license">License</a></div>
      <h1>${title}</h1><p class="lg-up">Last updated ${UPDATED}</p>
      ${secs.map(([h, t], i) => `<h2>${i + 1}. ${h}</h2><p>${t}</p>`).join("")}</div></main>`;
  return { full: true, title, html, mount(root) { const b = root.querySelector("#lgBack"); if (b) b.onclick = () => (history.length > 1 ? history.back() : ctx.go("#/")); } };
}
