// Map helpers: Leaflet loader, "hold Ctrl and scroll to zoom", and the property location picker.
import { $, icon, modal, toast } from "./ui.js";

// Leaflet is self-hosted (vendor/leaflet) and loaded only when a map is opened, so normal pages never download it.
let leafletP = null;
export function loadLeaflet() {
  if (window.L) return Promise.resolve();
  if (leafletP) return leafletP;
  const css = new Promise((res) => {
    if (document.querySelector("link[data-leaflet]")) return res();
    const l = document.createElement("link"); l.rel = "stylesheet"; l.href = "vendor/leaflet/leaflet.css"; l.dataset.leaflet = "1"; l.onload = l.onerror = () => res();
    const first = document.querySelector('link[rel=stylesheet][href*="css/app.css"]'); first ? first.before(l) : document.head.append(l); // before app.css so our map styles still win
  });
  const js = new Promise((res, rej) => { const s = document.createElement("script"); s.src = "vendor/leaflet/leaflet.js"; s.onload = res; s.onerror = () => rej(new Error("map-script")); document.head.append(s); });
  leafletP = Promise.all([css, js]).then(() => {}, (e) => { leafletP = null; throw e; });
  return leafletP;
}
// Scrolling the page never zooms the map by accident: zoom only while Ctrl (or ⌘) is held.
export function ctrlZoom(map, el = map.getContainer()) {
  map.scrollWheelZoom.disable();
  const hint = document.createElement("div"); hint.className = "map-hint"; hint.textContent = /Mac|iPhone|iPad/.test(navigator.platform) ? "Hold ⌘ and scroll to zoom" : "Hold Ctrl and scroll to zoom"; el.append(hint);
  let last = 0, t;
  el.addEventListener("wheel", (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault(); const now = Date.now(); if (now - last < 140) return; last = now;
      map.setZoomAround(map.mouseEventToContainerPoint(e), map.getZoom() + (e.deltaY < 0 ? 1 : -1));
    } else { hint.classList.add("on"); clearTimeout(t); t = setTimeout(() => hint.classList.remove("on"), 1200); }
  }, { passive: false });
}
export const tiles = () => L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap contributors", maxZoom: 19 });

// Resolves with { lat, lng } when the owner saves the pin, or null when they close the window.
export function pickLocation({ lat, lng, title = "Set the property location" } = {}) {
  return new Promise(async (resolve) => {
    const m = modal(`<h2>${title}</h2><p class="muted" style="margin:4px 0 10px">Click the map to drop the pin, or drag it. Hold Ctrl and scroll to zoom.</p><div id="pickmap" class="pickmap"></div>
      <div class="pk-row"><button type="button" class="btn sm" id="pkme">${icon("pin", 16)} Use my location</button><span class="muted" id="pkc">${lat != null ? "" : "No pin yet"}</span></div><div class="a2-act"><button type="button" class="btn primary" id="pksave" disabled>Save location</button></div>`);
    m.el.classList.add("pk-modal"); let saved = false; m.el.addEventListener("close", () => { if (!saved) resolve(null); });
    try { await loadLeaflet(); } catch { $("#pickmap", m.el).innerHTML = '<div class="empty">The map couldn’t load. Check your connection.</div>'; return; }
    const has = lat != null && lng != null, map = L.map("pickmap").setView(has ? [lat, lng] : [6.5244, 3.3792], has ? 16 : 11);
    tiles().addTo(map); ctrlZoom(map); setTimeout(() => map.invalidateSize(), 200);
    let mk = null, at = has ? { lat, lng } : null;
    const show = () => { $("#pkc", m.el).textContent = at ? `${at.lat.toFixed(5)}, ${at.lng.toFixed(5)}` : "No pin yet"; $("#pksave", m.el).disabled = !at; };
    const put = (ll, pan) => { at = { lat: ll.lat, lng: ll.lng }; if (!mk) { mk = L.marker(ll, { draggable: true }).addTo(map); mk.on("dragend", () => put(mk.getLatLng())); } else mk.setLatLng(ll); if (pan) map.setView(ll, Math.max(map.getZoom(), 16)); show(); };
    if (has) put({ lat, lng }); else show();
    map.on("click", (e) => put(e.latlng));
    $("#pkme", m.el).onclick = () => { if (!navigator.geolocation) return toast("Your device can’t share its location."); navigator.geolocation.getCurrentPosition((p) => put({ lat: p.coords.latitude, lng: p.coords.longitude }, true), () => toast("We couldn’t get your location. Click the map instead."), { enableHighAccuracy: true, timeout: 8000 }); };
    $("#pksave", m.el).onclick = () => { saved = true; m.close(); resolve(at); };
  });
}

// The emerald house pin used on the property page and in pickers (styled in css/home.css: .hx-pin). Call after Leaflet has loaded.
export const homePin = () => L.divIcon({ className: "hx-pin", iconSize: [44, 52], iconAnchor: [22, 50], popupAnchor: [0, -46],
  html: `<span class="hx-pin-b"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5h13V10"/><path d="M10 19.5v-5h4v5"/></svg></span><i></i>` });
