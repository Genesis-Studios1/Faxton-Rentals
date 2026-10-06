export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const naira = (n) => "₦" + Number(n || 0).toLocaleString("en-NG");
export const short = (n) => "₦" + (n / 1e6).toFixed(1).replace(/\.0$/, "") + "m";
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const initials = (n) => (n || "?").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

const P = {
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z"/>',
  msg: '<path d="M4 5h16v11H9l-5 4z"/>',
  cal: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M8 3v4M16 3v4M3.5 10h17"/>',
  doc: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
  bell: '<path d="M6 17V11a6 6 0 0112 0v6l1.5 2h-15z"/><path d="M10 21h4"/>',
  pin: '<path d="M12 21s-7-6-7-11a7 7 0 0114 0c0 5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  bed: '<path d="M3 18V7M3 14h18v4M21 14v-2a3 3 0 00-3-3h-7v5"/><circle cx="7" cy="11" r="1.6"/>',
  bath: '<path d="M4 12h16v2a5 5 0 01-5 5H9a5 5 0 01-5-5z"/><path d="M6 12V6a2 2 0 013.5-1.3M7 19l-1 2M17 19l1 2"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  left: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  chev: '<path d="M6 9l6 6 6-6"/>',
  dchev: '<path d="M11 6l-6 6 6 6M18 6l-6 6 6 6"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5 6.5-5s5.700 1.500 6.500 5M16 5a3.500 3.500 0 010 7M18 15c2 .6 3 2.200 3.500 5"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  wallet: '<path d="M4 7h15a1 1 0 011 1v11H5a1 1 0 01-1-1z"/><path d="M4 7l2-3h11M16 13h2"/>',
  sliders: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M6 14v6"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',
  map: '<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>',
  share: '<circle cx="6" cy="12" r="2.500"/><circle cx="18" cy="6" r="2.500"/><circle cx="18" cy="18" r="2.500"/><path d="M8.200 11l7.600-4M8.200 13l7.600 4"/>',
  send: '<path d="M3 11l18-8-8 18-2-8z"/>',
  clip: '<path d="M20 11l-8 8a5 5 0 01-7-7l9-9a3.500 3.500 0 015 5l-9 9a2 2 0 01-3-3l8-8"/>',
  phone: '<path d="M5 4h4l2 5-2.500 1.500a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A15 15 0 013 6a2 2 0 012-2z"/>',
  video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3z"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  list: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 9h6M9 13h6M9 17h3"/>',
  chart: '<path d="M5 20V10M12 20V4M19 20v-7"/>',
  headset: '<path d="M4 14v-2a8 8 0 0116 0v2"/><rect x="3" y="14" width="4" height="6" rx="1.500"/><rect x="17" y="14" width="4" height="6" rx="1.500"/>',
  car: '<path d="M4 16V11l2-5h12l2 5v5M4 16h16M4 16v3h3v-3M17 16v3h3v-3"/>',
  drop: '<path d="M12 3s6 6.500 6 11a6 6 0 01-12 0c0-4.500 6-11 6-11z"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.500 8-8 9-4.500-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  building: '<rect x="5" y="3" width="14" height="18" rx="1"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/>',
  flag: '<path d="M5 21V4h12l-2 4 2 4H5"/>',
  dl: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
  moon: '<path d="M20 14.500A8 8 0 019.500 4 8 8 0 1020 14.500z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.500 1.500M17.500 17.500L19 19M5 19l1.500-1.500M17.500 6.500L19 5"/>',
  mic: '<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>',
  smile: '<circle cx="12" cy="12" r="9"/><path d="M8 14s1.500 2.500 4 2.500S16 14 16 14M9 9.500h.01M15 9.500h.01"/>',
  img: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.500"/><path d="M4 18l5-5 4 4 3-3 4 4"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  area: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  sliders3: '<path d="M3 6h8M17 6h4M3 12h3M12 12h9M3 18h9M18 18h3"/><circle cx="14" cy="6" r="2.600"/><circle cx="9" cy="12" r="2.600"/><circle cx="15" cy="18" r="2.600"/>',
  chatdots: '<path d="M21 11.500a8.500 8.500 0 01-12.300 7.600L3.500 20.500l1.400-4.800A8.500 8.500 0 1121 11.500z"/><path d="M8.500 11.500h.01M12.500 11.500h.01M16.500 11.500h.01" stroke-width="2.800"/>',
  doccheck: '<path d="M13 21H6V3h8l4 4v5"/><path d="M14 3v4h4M9 11h6M9 15h3"/><circle cx="17.500" cy="17.500" r="4.200" fill="currentColor" stroke="none"/><path d="M15.600 17.600l1.400 1.400 2.400-2.600" stroke="#fff" stroke-width="1.800"/>',
  chatlines: '<path d="M4 4.500h16v12H11.500L7 20.500v-4H4z"/><path d="M8 9h8M8 12.500h5"/>',
  folder: '<path d="M3 7a2 2 0 012-2h4l2 2.500h8a2 2 0 012 2V18a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>',
  monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.500 9.500a2.500 2.500 0 015 .5c0 1.500-2.500 2-2.500 3.500M12 17h.01"/>',
  camera: '<path d="M4 8h3l2-2.500h6L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.500"/>',
  coins: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.700 3.100 3 7 3s7-1.300 7-3V6M5 12v6c0 1.700 3.100 3 7 3s7-1.300 7-3v-6"/>',
  logout: '<path d="M10 4H5v16h5M15 8l4 4-4 4M19 12H9"/>',
};
export const icon = (n, s = 22, sw = 1.7) => `<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ""}</svg>`;

export const logoMark = (cls = "") => `<svg class="logo-svg ${cls}" viewBox="570 235 415 355" aria-hidden="true"><path class="lg-a" d="M576 242H803L745 316H651V377H775V411L651 455V581H576Z"/><path class="lg-b" d="M702 455L775 429V581H702Z"/><path class="lg-b" d="M825 242H860C915 242 958 290 958 346C958 395 925 430 884 441L977 581H885L793 443V377H847C865 377 878 363 878 346C878 329 865 316 847 316H766Z"/></svg>`;
export const logo = (sub = "") => `<a class="logo" href="#/">${logoMark()}<span class="logo-word"><b>Faxton</b> Rentals${sub ? `<small>${sub}</small>` : ""}</span></a>`;

let toastT;
export function toast(msg) {
  let t = $("#toast"); if (!t) { t = document.createElement("div"); t.id = "toast"; t.setAttribute("role", "status"); document.body.append(t); }
  t.textContent = msg; t.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 3200);
}
export function modal(html) {
  const d = document.createElement("dialog"); d.className = "modal";
  d.innerHTML = `<button class="icon-btn close" aria-label="Close">${icon("x", 18)}</button>${html}`;
  document.body.append(d); d.showModal();
  const close = () => { d.close(); d.remove(); };
  $(".close", d).onclick = close; d.addEventListener("click", (e) => { if (e.target === d) close(); }); d.addEventListener("cancel", () => setTimeout(() => d.remove()));
  return { el: d, close };
}
export const friendlyErr = (e) => ({
  "auth/invalid-credential": "Incorrect email or password.", "auth/user-not-found": "No account found with that email.",
  "auth/wrong-password": "Incorrect email or password.", "auth/email-already-in-use": "An account with this email already exists.",
  "auth/weak-password": "Password must be at least 8 characters.", "auth/invalid-email": "Enter a valid email address.",
  "auth/popup-closed-by-user": "Sign-in was cancelled.", "auth/operation-not-allowed": "This sign-in method isn't enabled yet in Firebase Authentication.",
  "auth/unauthorized-domain": "This domain isn't authorised in Firebase Authentication yet.", "auth/too-many-requests": "Too many attempts. Try again shortly.",
  "permission-denied": "You don't have permission to do that.", "unavailable": "Can't reach the server. Check your connection.",
}[e?.code?.replace("firestore/", "")] || "Something went wrong. Please try again.");

export const BUILD = "2026-10-06.17";
