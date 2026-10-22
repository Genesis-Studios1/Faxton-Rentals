export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const naira = (n) => "₦" + Number(n || 0).toLocaleString("en-NG");
export const short = (n) => "₦" + (n / 1e6).toFixed(1).replace(/\.0$/, "") + "m";
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const initials = (n) => (n || "?").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

const P = {
  cart: '<path d="M3 4h2l2.4 11h10.200L20 8H6"/><circle cx="9" cy="19.500" r="1.400"/><circle cx="17" cy="19.500" r="1.400"/>',
  cap: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11.500V16c0 1.500 2.700 3 6 3s6-1.500 6-3v-4.500M22 9v6"/>',
  cross: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v8M8 12h8"/>',
  fork: '<path d="M7 3v8M4 3v5a3 3 0 006 0V3M7 11v10M17 21V3c-2.500 1.500-3 5-3 8h3"/>',
  dumbbell: '<path d="M6.500 6.500v11M17.500 6.500v11M3.500 9v6M20.500 9v6M6.500 12h11"/>',
  route: '<circle cx="6" cy="18" r="2.500"/><circle cx="18" cy="6" r="2.500"/><path d="M8.500 18H15a3 3 0 000-6H9a3 3 0 010-6h6.500"/>',
  sos: '<path d="M12 3.500L2.500 20h19z"/><path d="M12 10v4.500M12 17.500h.01"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.500" cy="8.500" r="1.200"/>',
  wrench: '<path d="M14.700 6.300a4 4 0 00-5.400 5.100L3 17.700 6.300 21l6.300-6.300a4 4 0 005.100-5.400l-2.500 2.500-2.300-.4-.4-2.300z"/>',
  handshake: '<path d="M2 12l4-4 4 1 3-2 4 3 5-1M2 12l5 6 3-1 2 2 3-1 1.500 1.500L22 12M9 14l3 3"/>',
  calc: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8.500 7h7M8.500 12h.01M12 12h.01M15.500 12h.01M8.500 16h.01M12 16h.01M15.500 16h.01" stroke-width="2"/>',
  sparkle: '<path d="M12 3l1.800 5.200L19 10l-5.200 1.800L12 17l-1.800-5.200L5 10l5.200-1.800zM19 16l.8 2.200L22 19l-2.200.8L19 22l-.8-2.200L16 19l2.200-.8z"/>',
  refresh: '<path d="M20 11a8 8 0 00-14-4L4 9M4 4v5h5M4 13a8 8 0 0014 4l2-2M20 20v-5h-5"/>',
  checkc: '<circle cx="12" cy="12" r="9"/><path d="M8 12.500l3 3 5-6"/>',
  tiles: '<rect x="3.500" y="3.500" width="7" height="7" rx="1"/><rect x="13.500" y="3.500" width="7" height="7" rx="1"/><rect x="3.500" y="13.500" width="7" height="7" rx="1"/><rect x="13.500" y="13.500" width="7" height="7" rx="1"/>',
  paint: '<rect x="4" y="3.500" width="13" height="5.500" rx="1.500"/><path d="M17 6h2.500a1 1 0 011 1v3.500a1 1 0 01-1 1H12v3"/><rect x="10.500" y="14.500" width="3" height="6.500" rx="1"/>',
  hammer: '<path d="M13 6l5-3 3 3-2.500 4.500-2-1.500M13 6l-1.500 2.500L14 11M12.500 10L4 18.500a1.800 1.800 0 002.500 2.500L15 12.500"/>',
  roof: '<path d="M2.500 12.500L12 4.500l9.500 8M5.500 10.500V20h13v-9.500M3 16h18M9 20v-4M15 20v-4"/>',
  bolt: '<path d="M13 2L4.500 13.500H11L10 22l8.500-11.500H12z"/>',
  chip: '<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9.500" y="9.500" width="5" height="5" rx=".8"/><path d="M9 2.500v3M15 2.500v3M9 18.500v3M15 18.500v3M2.500 9h3M2.500 15h3M18.500 9h3M18.500 15h3"/>',
  tree: '<path d="M12 21v-5M12 3l5 6h-2.500l3.500 5H6l3.500-5H7z"/><path d="M8 21h8"/>',
  waves: '<path d="M3 8c2 0 2-1.500 4.500-1.500S10 8 12 8s2.500-1.500 4.500-1.500S19 8 21 8M3 13c2 0 2-1.500 4.500-1.500S10 13 12 13s2.500-1.500 4.500-1.500S19 13 21 13M3 18c2 0 2-1.500 4.500-1.500S10 18 12 18s2.500-1.500 4.500-1.500S19 18 21 18"/>',
  clipList: '<rect x="4.5" y="3.5" width="15" height="17" rx="2.5"/><path d="M8.5 9h.01M8.5 12.5h.01M8.5 16h.01M11.5 9h4M11.5 12.5h4M11.5 16h4" stroke-width="2"/>',
  calDots: '<rect x="3.5" y="5" width="17" height="15.500" rx="2.500"/><path d="M8 3v4M16 3v4M3.500 10h17"/><path d="M8 13.500h.01M12 13.500h.01M16 13.500h.01M8 17h.01M12 17h.01" stroke-width="2.200"/>',
  card: '<rect x="3" y="5.500" width="18" height="13" rx="2.500"/><path d="M3 10h18M7 15h3"/>',
  bars3: '<path d="M6 20v-6M12 20V5M18 20v-9" stroke-width="3"/>',
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z"/>',
  star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8 6.8 19.6l1-5.8L3.5 9.7l5.9-.8z"/>',
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
  upload: '<path d="M12 16V5M7 9l5-5 5 5M5 20h14"/>',
  download: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
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
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.800 2.500 4 5.500 4 9s-1.200 6.500-4 9c-2.800-2.500-4-5.500-4-9s1.200-6.500 4-9z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>',
  pdf: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path d="M9 14h6M9 17h4"/>',
  dots: '<circle cx="12" cy="5" r="1.300" fill="currentColor"/><circle cx="12" cy="12" r="1.300" fill="currentColor"/><circle cx="12" cy="19" r="1.300" fill="currentColor"/>',
  save: '<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>',
  ver: '<path d="M12 3l8 3v6c0 5-3.500 8-8 9-4.500-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  play: '<path d="M8 5v14l11-7z" fill="currentColor"/>',
  trash: '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>',
  eyeo: '<path d="M2 12s4-7 10 -7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  logout: '<path d="M10 4H5v16h5M15 8l4 4-4 4M19 12H9"/>',
  // shell additions: a proper cog, a right chevron and "solid" twins used for active tabs (the owner asked for filled active icons)
  cog: '<path d="M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z"/><circle cx="12" cy="12" r="3"/>',
  chevR: '<path d="M9 6l6 6-6 6"/>',
  homeFill: '<path fill="currentColor" d="M12 3L3.200 10.600V20.200c0 .4.4.8.8.8H9.500v-5.600h5V21H20c.4 0 .8-.4.8-.8V10.600z"/>',
  searchFill: '<circle cx="11" cy="11" r="7" fill="currentColor" fill-opacity=".22"/><path d="M20 20l-3.500-3.500"/>',
  msgFill: '<path fill="currentColor" d="M4 5h16v11H9l-5 4z"/>',
  userFill: '<circle cx="12" cy="8" r="4.200" fill="currentColor"/><path fill="currentColor" d="M4.200 21c.9-4 4-6 7.800-6s6.900 2 7.800 6z"/>',
  bellFill: '<path fill="currentColor" d="M6 17V11a6 6 0 0112 0v6l1.500 2h-15z"/><path d="M10 21h4"/>',
};
export const icon = (n, s = 22, sw = 1.7) => `<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ""}</svg>`;

export const logoMark = (cls = "") => `<svg class="logo-svg ${cls}" viewBox="570 235 415 355" aria-hidden="true"><path class="lg-a" d="M576 242H803L745 316H651V377H775V411L651 455V581H576Z"/><path class="lg-b" d="M702 455L775 429V581H702Z"/><path class="lg-b" d="M825 242H860C915 242 958 290 958 346C958 395 925 430 884 441L977 581H885L793 443V377H847C865 377 878 363 878 346C878 329 865 316 847 316H766Z"/></svg>`;
export const verifiedBadge = (px = 18) => `<svg class="vseal" viewBox="0 0 24 24" width="${px}" height="${px}" role="img" aria-label="Verified"><title>Verified</title><path fill="#22c55e" stroke="#22c55e" stroke-width=".6" stroke-linejoin="round" d="M12.00 0.65 L12.30 0.69 L12.59 0.82 L12.86 1.02 L13.13 1.28 L13.37 1.59 L13.60 1.93 L13.80 2.26 L14.00 2.59 L14.19 2.87 L14.38 3.11 L14.58 3.29 L14.80 3.39 L15.03 3.43 L15.30 3.41 L15.59 3.33 L15.91 3.21 L16.26 3.06 L16.63 2.91 L17.01 2.77 L17.39 2.67 L17.75 2.61 L18.10 2.61 L18.41 2.68 L18.67 2.82 L18.89 3.03 L19.05 3.30 L19.15 3.63 L19.21 3.99 L19.23 4.39 L19.21 4.79 L19.18 5.18 L19.15 5.56 L19.14 5.90 L19.15 6.21 L19.21 6.47 L19.32 6.68 L19.49 6.85 L19.72 6.99 L20.00 7.10 L20.34 7.19 L20.70 7.28 L21.09 7.37 L21.48 7.48 L21.84 7.62 L22.17 7.79 L22.45 7.99 L22.66 8.22 L22.79 8.49 L22.85 8.79 L22.81 9.10 L22.71 9.43 L22.54 9.76 L22.32 10.09 L22.07 10.40 L21.82 10.71 L21.57 10.99 L21.36 11.26 L21.19 11.52 L21.09 11.76 L21.05 12.00 L21.09 12.24 L21.19 12.48 L21.36 12.74 L21.57 13.01 L21.82 13.29 L22.07 13.60 L22.32 13.91 L22.54 14.24 L22.71 14.57 L22.81 14.90 L22.85 15.21 L22.79 15.51 L22.66 15.78 L22.45 16.01 L22.17 16.21 L21.84 16.38 L21.48 16.52 L21.09 16.63 L20.70 16.72 L20.34 16.81 L20.00 16.90 L19.72 17.01 L19.49 17.15 L19.32 17.32 L19.21 17.53 L19.15 17.79 L19.14 18.10 L19.15 18.44 L19.18 18.82 L19.21 19.21 L19.23 19.61 L19.21 20.01 L19.15 20.37 L19.05 20.70 L18.89 20.97 L18.67 21.18 L18.41 21.32 L18.10 21.39 L17.75 21.39 L17.39 21.33 L17.01 21.23 L16.63 21.09 L16.26 20.94 L15.91 20.79 L15.59 20.67 L15.30 20.59 L15.03 20.57 L14.80 20.61 L14.58 20.71 L14.38 20.89 L14.19 21.13 L14.00 21.41 L13.80 21.74 L13.60 22.07 L13.37 22.41 L13.13 22.72 L12.86 22.98 L12.59 23.18 L12.30 23.31 L12.00 23.35 L11.70 23.31 L11.41 23.18 L11.14 22.98 L10.87 22.72 L10.63 22.41 L10.40 22.07 L10.20 21.74 L10.00 21.41 L9.81 21.13 L9.62 20.89 L9.42 20.71 L9.20 20.61 L8.97 20.57 L8.70 20.59 L8.41 20.67 L8.09 20.79 L7.74 20.94 L7.37 21.09 L6.99 21.23 L6.61 21.33 L6.25 21.39 L5.90 21.39 L5.59 21.32 L5.33 21.18 L5.11 20.97 L4.95 20.70 L4.85 20.37 L4.79 20.01 L4.77 19.61 L4.79 19.21 L4.82 18.82 L4.85 18.44 L4.86 18.10 L4.85 17.79 L4.79 17.53 L4.68 17.32 L4.51 17.15 L4.28 17.01 L4.00 16.90 L3.66 16.81 L3.30 16.72 L2.91 16.63 L2.52 16.52 L2.16 16.38 L1.83 16.21 L1.55 16.01 L1.34 15.78 L1.21 15.51 L1.15 15.21 L1.19 14.90 L1.29 14.57 L1.46 14.24 L1.68 13.91 L1.93 13.60 L2.18 13.29 L2.43 13.01 L2.64 12.74 L2.81 12.48 L2.91 12.24 L2.95 12.00 L2.91 11.76 L2.81 11.52 L2.64 11.26 L2.43 10.99 L2.18 10.71 L1.93 10.40 L1.68 10.09 L1.46 9.76 L1.29 9.43 L1.19 9.10 L1.15 8.79 L1.21 8.49 L1.34 8.22 L1.55 7.99 L1.83 7.79 L2.16 7.62 L2.52 7.48 L2.91 7.37 L3.30 7.28 L3.66 7.19 L4.00 7.10 L4.28 6.99 L4.51 6.85 L4.68 6.68 L4.79 6.47 L4.85 6.21 L4.86 5.90 L4.85 5.56 L4.82 5.18 L4.79 4.79 L4.77 4.39 L4.79 3.99 L4.85 3.63 L4.95 3.30 L5.11 3.03 L5.33 2.82 L5.59 2.68 L5.90 2.61 L6.25 2.61 L6.61 2.67 L6.99 2.77 L7.37 2.91 L7.74 3.06 L8.09 3.21 L8.41 3.33 L8.70 3.41 L8.97 3.43 L9.20 3.39 L9.42 3.29 L9.62 3.11 L9.81 2.87 L10.00 2.59 L10.20 2.26 L10.40 1.93 L10.63 1.59 L10.87 1.28 L11.14 1.02 L11.41 0.82 L11.70 0.69Z"/><path d="M7.8 12.3l3 3 5.6-5.8" fill="none" stroke="#fff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
export const logo = (sub = "") => `<a class="logo" href="#/">${logoMark()}<span class="logo-word"><b>Faxton</b> Rentals${sub ? `<small>${sub}</small>` : ""}</span></a>`;

let toastT;
export function toast(msg, opt) {
  let t = $("#toast"); if (!t) { t = document.createElement("div"); t.id = "toast"; t.setAttribute("role", "status"); t.setAttribute("aria-live", "polite"); document.body.append(t); }
  t.textContent = msg; t.dataset.kind = opt?.kind || ""; if (opt?.href) { const a = document.createElement("a"); a.href = opt.href; a.textContent = opt.action || "Open"; a.className = "toast-act"; t.append(a); }
  t.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), opt?.ms || (opt?.href ? 9000 : 3200));
}
export function modal(html, { sticky = false } = {}) {
  const d = document.createElement("dialog"); d.className = "modal";
  d.innerHTML = `${sticky ? "" : `<button class="icon-btn close" aria-label="Close">${icon("x", 18)}</button>`}${html}`;
  document.body.append(d); d.showModal(); d.tabIndex = -1; if (!d.querySelector("[autofocus]")) d.focus({ preventScroll: true });
  const close = () => { d.close(); d.remove(); };
  // A sticky window stays until it is completed: no × button, no click outside, no Escape.
  if (sticky) d.addEventListener("cancel", (e) => e.preventDefault());
  else { $(".close", d).onclick = close; d.addEventListener("click", (e) => { if (e.target === d) close(); }); d.addEventListener("cancel", () => setTimeout(() => d.remove())); }
  return { el: d, close };
}
const FRIENDLY = {
  "auth/invalid-credential": "That email and password don’t match an account. Check them, use “Forgot password?”, or create an account if you’re new.", "auth/user-not-found": "We couldn’t find an account for that email and password.", "app/no-account": "We couldn’t find an account for that email and password.", "app/banned": "This account has been banned. If you think this is a mistake, please contact support.",
  "auth/wrong-password": "That email and password don’t match. Check them or use “Forgot password?”.", "auth/email-already-in-use": "An account with this email already exists. Sign in instead, or use “Forgot password?” if you don’t remember it.",
  "auth/weak-password": "Password must be at least 8 characters.", "auth/invalid-email": "Enter a valid email address.",
  "auth/popup-closed-by-user": "Sign-in was cancelled.", "auth/popup-blocked": "Your browser blocked the sign-in window. Allow pop-ups for this site and try again.", "auth/operation-not-allowed": "This sign-in method isn't enabled yet in Firebase Authentication.",
  "auth/unauthorized-domain": "This domain isn't authorised in Firebase Authentication yet.", "auth/too-many-requests": "Too many attempts. Try again shortly.",
  "permission-denied": "You don't have permission to do that.", "unavailable": "Can't reach the server. Check your connection.",
  // Google sign-in inside the Android / iPhone app (codes come from signInGoogle in main.js; a support code is appended)
  "google/cancelled": "Google sign-in was cancelled.",
  "google/no-account": "No Google account is ready on this phone. Add one in Settings > Accounts and try again, or sign in with your email and password below.",
  "google/not-registered": "Google sign-in isn't switched on for this version of the app yet. Please sign in with your email and password below for now.",
  "google/network": "Can't reach Google. Check your internet connection and try again.",
  "google/play-services": "Google Play services is missing or out of date on this phone. Update it in the Play Store, or sign in with your email and password below.",
  "google/failed": "Google sign-in didn't finish. Try again, or sign in with your email and password below.",
  "google/audience": "Google sign-in is set up for a different app version. Please update Faxton Rentals, or sign in with your email and password below.",
  "google/token-rejected": "Google sign-in was refused. Check that your phone's date and time are set automatically, then try again, or use your email and password below.",
  "app/plugin-missing": "Google sign-in isn't available in this version of the app. Please update the app, or sign in with your email and password below.",
  "app/no-token": "Google didn't send back a sign-in token. Try again, or sign in with your email and password below.",
  "app/google-unavailable": "Google sign-in isn't available in the iPhone app yet. Please sign in with your email and password below.",
  "auth/network-request-failed": "Can't reach the server. Check your internet connection and try again.",
  "auth/user-disabled": "This account has been disabled. Please contact support.",
  "auth/account-exists-with-different-credential": "An account with this email already exists. Sign in with your email and password instead.",
};
export const friendlyErr = (e) => {
  const m = FRIENDLY[e?.code?.replace("firestore/", "")];
  if (m) return m + (e?.gcode ? ` (code ${e.gcode})` : "");
  return `Something went wrong. Please try again.${e?.code || e?.message ? ` (${String(e.code || e.message).slice(0, 120)})` : ""}`;
};



export const BUILD = "2026-10-22.02";
