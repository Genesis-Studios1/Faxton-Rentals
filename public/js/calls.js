// Voice and video calls over WebRTC (signalled through Firestore), with screen sharing, recording to the device and call logs.
import { db } from "./firebase.js";
import { collection, doc, addDoc, getDoc, updateDoc, onSnapshot, query, where, serverTimestamp, arrayUnion }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { $, $$, esc, icon, toast, initials, modal } from "./ui.js";
import { playSound } from "./sound.js";
import { getPublic } from "./store.js";

// ---------- sounds (made with the browser, no audio files) ----------
let toneCtx = null;
const audio = () => { try { toneCtx ||= new (window.AudioContext || window.webkitAudioContext)(); toneCtx.resume?.(); return toneCtx; } catch { return null; } };
const tone = (ac, f, t, d, v) => { const o = ac.createOscillator(), g = ac.createGain(); o.type = "sine"; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + d + 0.05); };
// What the caller hears while the other phone rings: the familiar "ring-ring ... ring-ring" (two soft pulses, then a pause).
function ringback() {
  const ac = audio(); if (!ac) return () => {};
  const pulse = (t) => [440, 480].forEach((f) => { const o = ac.createOscillator(), g = ac.createGain(), lfo = ac.createOscillator(), lg = ac.createGain(); o.type = "sine"; o.frequency.value = f; lfo.frequency.value = 20; lg.gain.value = 0.035; lfo.connect(lg); lg.connect(g.gain); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.09, t + 0.03); g.gain.setValueAtTime(0.09, t + 0.38); g.gain.linearRampToValueAtTime(0.0001, t + 0.42); o.connect(g); g.connect(ac.destination); o.start(t); lfo.start(t); o.stop(t + 0.45); lfo.stop(t + 0.45); });
  const cycle = () => { const t = ac.currentTime + 0.02; pulse(t); pulse(t + 0.6); };
  cycle(); const id = setInterval(cycle, 3400); return () => clearInterval(id);
}

const STUN = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302", "stun:stun.cloudflare.com:3478"] }];
let ICE = { iceServers: STUN }, iceP = null;
// A credentials URL may answer with a bare list (Metered, Xirsys style) or { iceServers: [...] } / { iceServers: {...} } (Cloudflare style).
const asServers = (j) => { const v = Array.isArray(j) ? j : j && j.iceServers ? [].concat(j.iceServers) : []; return v.filter((x) => x && x.urls); };
// Turns what the admin saved (hand-entered servers and/or a credentials URL) into a list the browser can use. The URL wins when it answers.
export async function resolveIce(d = {}) {
  let servers = Array.isArray(d.servers) ? d.servers.filter((x) => x && x.urls) : [], via = servers.length ? "address" : "", error = "";
  if (d.credsUrl) {
    try { const r = await fetch(d.credsUrl, { cache: "no-store", signal: AbortSignal.timeout(6000) }); if (!r.ok) throw new Error("HTTP " + r.status); const v = asServers(await r.json()); if (v.length) { servers = v; via = "url"; } else error = "The credentials URL answered, but with no relay servers in it."; }
    catch (e) { error = /HTTP 40[13]/.test(String(e.message)) ? "The provider rejected the credentials URL (" + e.message + "). Check the API key." : "Couldn’t read the credentials URL (" + (e.message || "network error") + "). Check the address, and that the provider is one the site allows."; }
  }
  return { servers, via, error };
}
// Everyone who places or answers a call reads the saved relay once per page load.
const ensureIce = () => (iceP ||= getDoc(doc(db, "config", "ice")).then(async (s) => {
  const { servers } = await resolveIce(s.exists() ? s.data() : {});
  if (servers.length) ICE = { iceServers: [...servers, ...STUN] };
}).catch(() => {}));
// After an admin saves a new relay, the next call on this page should use it.
export const resetIce = () => { iceP = null; ICE = { iceServers: STUN }; };
// Used by the Settings relay card: a real test. Opens a connection that may only use the relay and waits for a "relay" candidate,
// which exists only if the relay accepted our credentials and allocated an address for us.
export async function testRelay(servers) {
  const turn = servers.flatMap((s) => [].concat(s.urls)).filter((u) => /^turns?:/i.test(u));
  if (!turn.length) return { ok: false, why: "These are STUN addresses only. A relay address starts with turn: or turns:." };
  if (typeof RTCPeerConnection === "undefined") return { ok: false, why: "This browser can’t make calls, so it can’t test the relay." };
  return new Promise((res) => { let pc; const t0 = Date.now(), seen = []; let code = 0, text = "";
    try { pc = new RTCPeerConnection({ iceServers: servers, iceTransportPolicy: "relay" }); } catch (e) { return res({ ok: false, why: "The browser rejected these relay details: " + (e.message || "not valid") + "." }); }
    let finished = false; const done = (r) => { if (finished) return; finished = true; clearTimeout(t); try { pc.close(); } catch {} res({ ms: Date.now() - t0, urls: turn.length, ...r }); };
    const fail = () => done({ ok: false, why: code === 401 || code === 403 ? "The relay answered but refused the user name or password." : code === 701 ? "Couldn’t reach the relay. Check the address and port (and that this network allows it)." : code ? `The relay reported an error (${code}${text ? ": " + text : ""}). Check the address and port.` : "No relay address came back. Check the address and port, and that the account is active." });
    const t = setTimeout(fail, 10000);
    pc.onicecandidateerror = (e) => { if (e.errorCode) { code = e.errorCode; text = e.errorText || ""; } };
    pc.onicecandidate = (e) => { if (e.candidate) { seen.push(e.candidate.candidate); if (/ typ relay /.test(e.candidate.candidate)) done({ ok: true, proto: (/ (udp|tcp) /i.exec(e.candidate.candidate) || [])[1]?.toUpperCase() }); } else fail(); };
    pc.createDataChannel("t"); pc.createOffer().then((o) => pc.setLocalDescription(o)).catch(() => done({ ok: false, why: "The browser couldn’t start the test." })); });
}
export const fmtDur = (s) => { s = Math.max(0, Math.round(s || 0)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(x).padStart(2, "0"); };

// ---------- Firestore signalling ----------
const patchCall = (id, d) => updateDoc(doc(db, "calls", id), d).catch(() => {});
const watchCall = (id, cb) => onSnapshot(doc(db, "calls", id), (s) => cb(s.exists() ? { ...s.data(), id: s.id } : null), () => {});
const addIce = (id, from, c) => addDoc(collection(db, "calls", id, "ice"), { from, c: JSON.stringify(c) }).catch(() => {});
const watchIce = (id, cb) => onSnapshot(collection(db, "calls", id, "ice"), (s) => s.docChanges().forEach((ch) => { if (ch.type === "added") cb(ch.doc.data()); }), () => {});
export const watchLogs = (uid, cb) => onSnapshot(query(collection(db, "calls"), where("members", "array-contains", uid)), (s) => cb(s.docs.map((d) => ({ ...d.data(), id: d.id })).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))), () => cb([]));

// ---------- who is on the other end: names and photos ----------
// The call document carries only a tiny photo (a web address); a real picture is looked up once per person from their public profile, the same cached lookup the chat list uses.
const smallPhoto = (p) => (typeof p === "string" && p.length <= 2000 ? p : "");
const PHOTO = {}, ASKED = new Set();
export const peerOf = (c, me) => { const out = c.callerUid === me; return { uid: out ? c.calleeUid : c.callerUid, name: out ? c.calleeName : c.callerName, photo: (out ? c.calleePhoto : c.callerPhoto) || "" }; };
export const peerPhoto = (c, me) => { const p = peerOf(c, me); return p.photo || PHOTO[p.uid] || ""; };
// Ask for the photos the call rows are missing; `done` runs when one arrives so the list can repaint.
export function warmPeers(list, me, done) {
  list.forEach((c) => { const p = peerOf(c, me); if (!p.uid || p.uid === "staff" || p.photo || ASKED.has(p.uid)) return; ASKED.add(p.uid); getPublic(p.uid).then((pb) => { if (pb?.photo) { PHOTO[p.uid] = pb.photo; done?.(); } }).catch(() => {}); });
}
export const lookupPhoto = async (uid) => { if (!uid || uid === "staff") return ""; if (PHOTO[uid]) return PHOTO[uid]; try { const pb = await getPublic(uid); if (pb?.photo) PHOTO[uid] = pb.photo; return pb?.photo || ""; } catch { return ""; } };
// A photo that fails to load falls back to the initials underneath it.
export function imgFallback(root) { if (root.__fb) return; root.__fb = 1; root.addEventListener("error", (e) => { const t = e.target; if (t?.tagName === "IMG" && t.closest(".mx-av.ini,.cs-pic,.cl-avw")) t.remove(); }, true); }
const photoImg = (src, cls = "") => `<img${cls ? ` class="${cls}"` : ""} src="${esc(src)}" alt="" decoding="async" referrerpolicy="no-referrer">`;

// ---------- the call window ----------
let active = null;
function run({ id, me, role, kind, other, offer }) {
  if (active) { toast("You’re already on a call."); return null; }
  const isCaller = role === "caller", name = other.name || "Faxton", recKey = isCaller ? "recCaller" : "recCallee";
  const ov = document.createElement("div"); ov.className = "cl-ov cs-ov"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true"); ov.setAttribute("aria-label", "Call with " + name);
  const pic = (other.photo ? photoImg(other.photo) : "") + `<span class="cs-ini">${esc(initials(name))}</span>`;
  const canShare = !!navigator.mediaDevices?.getDisplayMedia, recIc = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.6" fill="currentColor"/></svg>';
  ov.innerHTML = `<header class="cs-top"><span class="cs-logo"><img src="assets/mark.svg" alt="" width="32" height="28"><b>Faxton</b></span><i class="cs-sep"></i><span class="cs-state"><i class="cs-dot"></i><span id="clSt">${isCaller ? "Calling " + esc(name) + "…" : "Connecting…"}</span></span><div class="cs-tn"><b>${esc(name)}</b><span id="clVt2">${isCaller ? "Calling…" : "Connecting…"}</span></div><span class="cl-rec" id="clRec" hidden><i></i> Recording</span><button type="button" class="cs-minb" id="clMin" aria-label="Minimise the call" title="Minimise">${icon("dchev", 22)}</button></header>
    <div class="cs-stage"><video id="clRemote" autoplay playsinline></video><div class="cs-voice" id="clVoice"><div class="cs-ring"><span class="cs-pic">${pic}</span></div><h2>${esc(name)}</h2><p id="clVt">${isCaller ? "Calling…" : "Connecting…"}</p><div class="cs-wave" id="clWave" aria-hidden="true">${"<i></i>".repeat(29)}</div></div><video id="clLocal" class="cl-pip" autoplay playsinline muted hidden></video></div>
    <div class="cs-bar"><button type="button" class="cs-b" id="clMute" aria-pressed="false" aria-label="Mute"><span class="cs-ic">${icon("mic", 26)}</span><em>Mute</em></button>
      <button type="button" class="cs-b" id="clCam" aria-pressed="false" aria-label="Camera"><span class="cs-ic">${icon("video", 26)}</span><em>Camera</em></button>
      ${canShare ? `<i class="cs-bsep"></i><button type="button" class="cs-b" id="clShare" aria-pressed="false" aria-label="Share screen"><span class="cs-ic">${icon("upload", 26)}</span><em>Share Screen</em></button>` : `<button type="button" id="clShare" hidden></button>`}
      <button type="button" class="cs-b" id="clRecB" aria-pressed="false" aria-label="Record call"><span class="cs-ic">${recIc}</span><em>Record</em></button><i class="cs-bsep"></i>
      <button type="button" class="cs-b end" id="clEnd" aria-label="End call"><span class="cs-ic">${icon("phone", 28)}</span><em>End Call</em></button></div>
    <div class="cs-pill" id="clPill" role="button" tabindex="0" aria-label="Open the call"><span class="cs-pring"><span class="cs-pic sm">${pic}</span></span><div class="cs-pw"><b>${esc(name)}</b><small id="clPs">${isCaller ? "Calling…" : "Connecting…"}</small></div><i class="cs-sep"></i><button type="button" class="cs-pb" id="clMute2" aria-pressed="false" aria-label="Mute">${icon("mic", 20)}</button>${canShare ? `<button type="button" class="cs-pb" id="clShare2" aria-label="Share screen">${icon("upload", 20)}</button>` : ""}<button type="button" class="cs-pb end" id="clEnd2" aria-label="End call">${icon("phone", 22)}</button></div>`;
  document.body.append(ov); document.documentElement.classList.add("dlx-lock"); imgFallback(ov);
  if (!other.photo && other.uid) lookupPhoto(other.uid).then((src) => { if (src) $$(".cs-pic", ov).forEach((p) => p.insertAdjacentHTML("afterbegin", photoImg(src))); });
  const el = (i) => $("#" + i, ov), remoteV = el("clRemote"), localV = el("clLocal");
  const say = (t) => { el("clSt").textContent = /^(Calling|Ringing)…$/.test(t) ? t.replace("…", " " + name + "…") : t; el("clVt").textContent = t; el("clVt2").textContent = t; el("clPs").textContent = t; };
  const pc = new RTCPeerConnection(ICE), remote = new MediaStream(), preview = new MediaStream();
  let theirRec = false, mic = null, cam = null, screen = null, vtx = null, startedAt = 0, timer = null, ended = false, closing = false, recorder = null, rec = null, unsubs = [], pending = [], remoteVideo = false, ringTO = null;
  const S = { pc, stop: () => end("ended") };
  active = S;
  let stopTone = isCaller ? ringback() : null; const quiet = () => { stopTone?.(); stopTone = null; };

  const setRemoteVideo = (on) => { remoteVideo = on; remoteV.style.display = on ? "block" : "none"; el("clVoice").style.display = on ? "none" : "grid"; ov.classList.toggle("has-video", on); };
  const checkVideo = () => { const t = remote.getVideoTracks()[0]; setRemoteVideo(!!(t && t.readyState === "live" && !t.muted && remoteV.videoWidth > 0)); };
  const vidTimer = setInterval(checkVideo, 800); remoteV.addEventListener("resize", checkVideo);
  const syncLocal = () => { const v = preview.getVideoTracks()[0]; localV.hidden = !v; localV.srcObject = v ? preview : null; el("clCam").setAttribute("aria-pressed", String(!!cam && cam.enabled)); el("clShare").setAttribute("aria-pressed", String(!!screen)); };
  setRemoteVideo(false);
  remoteV.srcObject = remote;
  pc.ontrack = (e) => { remote.addTrack(e.track); if (e.track.kind === "video") { e.track.onunmute = checkVideo; e.track.onmute = checkVideo; } remoteV.play?.().catch(() => {}); };
  pc.onconnectionstatechange = () => { if (pc.connectionState === "connected") { quiet(); if (!startedAt) { startWave(); startedAt = Date.now(); timer = setInterval(() => say(fmtDur((Date.now() - startedAt) / 1000)), 1000); say("0:00"); } } if (pc.connectionState === "disconnected" && !ended) setTimeout(() => { if (pc.connectionState === "disconnected" && !ended) { toast("The call lost its connection."); end("ended"); } }, 8000);
    if (["failed", "closed"].includes(pc.connectionState) && !ended) { toast(startedAt ? "The call lost its connection." : "Couldn’t connect the call. One of the networks blocks direct calls."); end("ended"); } };
  let connectTO = null; const armConnect = () => { clearTimeout(connectTO); connectTO = setTimeout(() => { if (!startedAt && !ended) { toast("Couldn’t connect the call. One of the networks blocks direct calls."); end("ended"); } }, 25000); };
  // The sound-wave under the name moves with the other person's voice.
  let waveStop = null;
  const startWave = () => {
    const wave = el("clWave"), bars = [...wave.children]; wave.classList.add("live");
    try {
      const ac = audio(), src = ac.createMediaStreamSource(remote), an = ac.createAnalyser(); an.fftSize = 128; src.connect(an);
      const data = new Uint8Array(an.frequencyBinCount); let raf = 0;
      const tick = () => { an.getByteFrequencyData(data); const mid = bars.length >> 1; bars.forEach((b, i) => { const d = Math.abs(i - mid), v = data[Math.min(data.length - 1, 2 + d * 2)] / 255; b.style.transform = `scaleY(${(0.1 + v * 0.9 * (1 - d / (mid + 4))).toFixed(2)})`; }); raf = requestAnimationFrame(tick); };
      tick(); waveStop = () => { cancelAnimationFrame(raf); try { src.disconnect(); } catch {} };
    } catch { wave.classList.add("anim"); }
  };
  const addCand = async (c) => { try { if (pc.remoteDescription) await pc.addIceCandidate(c); else pending.push(c); } catch {} };
  const flush = async () => { for (const c of pending.splice(0)) { try { await pc.addIceCandidate(c); } catch {} } };

  // The caller always offers a video line, so the camera or a shared screen can start later without renegotiating.
  if (isCaller) vtx = pc.addTransceiver("video", { direction: "sendrecv" });

  const media = async () => {
    try { mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false }); }
    catch (e) { throw new Error(/NotAllowed|denied|permission/i.test(String(e?.name + e?.message)) ? "Allow microphone access in your settings to make calls." : /NotReadable|TrackStart|Abort/i.test(String(e?.name)) ? "Your microphone is being used by another app. Close it and try again." : "No microphone was found."); }
    mic.getAudioTracks().forEach((t) => pc.addTrack(t, mic));
  };
  const camMsg = (e) => (/NotAllowed|Permission|denied/i.test(String(e?.name + e?.message)) ? "Allow camera access in your settings to use video. This will be a voice call." : /NotFound|Overconstrained/i.test(String(e?.name)) ? "No camera was found, so this will be a voice call." : "The camera isn’t available, so this will be a voice call.");
  const useCamera = async () => {
    const s = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } } }); cam = s.getVideoTracks()[0];
    if (!screen) { await vtx.sender.replaceTrack(cam); setPreview(cam); } syncLocal();
  };
  const setPreview = (t) => { preview.getVideoTracks().forEach((x) => preview.removeTrack(x)); if (t) preview.addTrack(t); syncLocal(); };

  // ---- controls ----
  el("clMute").onclick = () => { const t = mic?.getAudioTracks()[0]; if (!t) return; t.enabled = !t.enabled; el("clMute").setAttribute("aria-pressed", String(!t.enabled)); el("clMute2").setAttribute("aria-pressed", String(!t.enabled)); el("clMute").querySelector("em").textContent = t.enabled ? "Mute" : "Unmute"; };
  el("clCam").onclick = async () => {
    try { if (!cam) { await useCamera(); return; } cam.enabled = !cam.enabled; if (!screen) { await vtx.sender.replaceTrack(cam.enabled ? cam : null); setPreview(cam.enabled ? cam : null); } syncLocal(); } catch (e) { toast(camMsg(e).replace(" This will be a voice call.", "").replace(", so this will be a voice call", "")); }
  };
  const stopShare = async () => { if (!screen) return; screen.onended = null; screen.stop(); screen = null; const back = cam && cam.enabled ? cam : null; await vtx.sender.replaceTrack(back).catch(() => {}); setPreview(back); el("clShare").querySelector("em").textContent = "Share Screen"; };
  el("clShare").onclick = async () => {
    if (screen) return stopShare();
    if (!navigator.mediaDevices?.getDisplayMedia) return toast("Screen sharing isn’t supported on this device.");
    try { const s = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false }); screen = s.getVideoTracks()[0]; screen.onended = stopShare; await vtx.sender.replaceTrack(screen); setPreview(screen); el("clShare").querySelector("em").textContent = "Stop Sharing"; }
    catch (e) { if (e?.name !== "NotAllowedError") toast("Couldn’t start screen sharing."); }
  };

  // ---- minimise to a small pill and back ----
  el("clMin").onclick = () => { ov.classList.add("min"); document.documentElement.classList.remove("dlx-lock"); };
  el("clPill").onclick = (e) => { if (e.target.closest("button")) return; ov.classList.remove("min"); document.documentElement.classList.add("dlx-lock"); };
  el("clMute2").onclick = () => el("clMute").click(); el("clEnd2").onclick = () => el("clEnd").click(); const sh2 = $("#clShare2", ov); if (sh2) sh2.onclick = () => el("clShare").click();

  // ---- recording: both people see the badge, and the file is saved to this device ----
  const showRec = (on) => { el("clRec").hidden = !on; el("clRecB").setAttribute("aria-pressed", String(!!recorder)); };
  const startRec = () => {
    if (!window.MediaRecorder) return toast("Recording isn’t supported on this device.");
    const ac = new (window.AudioContext || window.webkitAudioContext)(), dest = ac.createMediaStreamDestination();
    ac.createMediaStreamSource(new MediaStream(mic.getAudioTracks())).connect(dest); if (remote.getAudioTracks().length) ac.createMediaStreamSource(new MediaStream(remote.getAudioTracks())).connect(dest);
    const tracks = [...dest.stream.getAudioTracks()]; let raf = 0, cv = null;
    if (kind === "video" || cam || screen || remoteVideo) {
      cv = document.createElement("canvas"); cv.width = 1280; cv.height = 720; const g = cv.getContext("2d");
      const cover = (v, x, y, w, h) => { const vw = v.videoWidth, vh = v.videoHeight; if (!vw) return; const r = Math.max(w / vw, h / vh), dw = vw * r, dh = vh * r; g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.drawImage(v, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh); g.restore(); };
      const draw = () => { g.fillStyle = "#07110d"; g.fillRect(0, 0, 1280, 720); if (remoteVideo) cover(remoteV, 0, 0, 1280, 720); else { g.fillStyle = "#fff"; g.font = `600 44px ${getComputedStyle(document.documentElement).getPropertyValue("--font-display") || "system-ui, sans-serif"}`; g.textAlign = "center"; g.fillText(name, 640, 370); } if (!localV.hidden) cover(localV, 1280 - 340, 720 - 200, 320, 180); raf = requestAnimationFrame(draw); };
      draw(); tracks.unshift(...cv.captureStream(24).getVideoTracks());
    }
    const type = ["video/webm;codecs=vp8,opus", "video/webm", "audio/webm;codecs=opus", "audio/webm"].find((t) => (cv ? t.startsWith("video") : t.startsWith("audio")) && MediaRecorder.isTypeSupported(t)) || "";
    const chunks = []; recorder = new MediaRecorder(new MediaStream(tracks), type ? { mimeType: type } : undefined);
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    recorder.onstop = () => { cancelAnimationFrame(raf); ac.close().catch(() => {}); if (!chunks.length) return; const blob = new Blob(chunks, { type: recorder?.mimeType || type || "video/webm" }), a = document.createElement("a"), ext = blob.type.startsWith("audio") ? "webm" : "webm";
      a.href = URL.createObjectURL(blob); a.download = `Faxton-call-${name.replace(/[^\w]+/g, "-")}-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.${ext}`; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); toast("Recording saved to your device."); };
    recorder.start(1000); patchCall(id, { [recKey]: true, recorded: true }); showRec(true); el("clRecB").querySelector("em").textContent = "Stop";
  };
  const stopRec = () => { if (!recorder) return; const r = recorder; recorder = null; try { r.stop(); } catch {} patchCall(id, { [recKey]: false }); showRec(false); el("clRecB").querySelector("em").textContent = "Record"; };
  // (a window of our own: phone web views often block the browser's built-in confirm box)
  const askRecord = () => new Promise((res) => { let yes = false; const m = modal(`<div class="so-pop"><span class="vf-ic ok">${icon("mic", 30)}</span><h2>Record this call?</h2><p class="muted">Everyone on the call will see that it’s being recorded. The recording is saved on this device only.</p><div class="so-act"><button type="button" class="btn" id="rcNo">Not now</button><button type="button" class="btn primary" id="rcYes">Start recording</button></div></div>`); m.el.addEventListener("close", () => res(yes)); $("#rcNo", m.el).onclick = () => m.close(); $("#rcYes", m.el).onclick = () => { yes = true; m.close(); }; });
  el("clRecB").onclick = async () => { if (!startedAt) return toast("You can record once the call is connected."); if (recorder) return stopRec(); if (await askRecord() && !ended && !recorder) startRec(); };

  // ---- ending ----
  function end(status) {
    if (closing) return; closing = true; ended = true; quiet(); playSound("callEnd"); waveStop?.(); clearTimeout(ringTO); clearTimeout(connectTO); clearInterval(timer); clearInterval(vidTimer); stopRec();
    const dur = startedAt ? Math.round((Date.now() - startedAt) / 1000) : 0;
    patchCall(id, { status: startedAt ? "ended" : status, endedAt: Date.now(), duration: dur }); // in the background: the screen never waits for the network
    try { unsubs.forEach((f) => f()); [mic, cam, screen].forEach((s2) => { try { s2?.getTracks ? s2.getTracks().forEach((t) => t.stop()) : s2?.stop(); } catch {} }); pc.close(); } catch {}
    try { say(dur ? `Call ended · ${fmtDur(dur)}` : "Call ended"); ov.classList.add("ended"); $$(".cs-b,.cs-pb", ov).forEach((b) => { if (b.id !== "clEnd" && b.id !== "clEnd2") b.disabled = true; }); } catch {}
    document.documentElement.classList.remove("dlx-lock"); active = null;
    setTimeout(() => ov.remove(), 1500);
    if (dur >= 5) setTimeout(() => { try { import("./feedback.js").then((m) => m.rateCall({ callId: id, peer: name, seconds: dur })).catch(() => {}); } catch {} }, 1700); // ask for a rating once the call window has gone
  }
  el("clEnd").onclick = () => { if (closing) { ov.remove(); document.documentElement.classList.remove("dlx-lock"); active = null; return; } end(isCaller && !startedAt ? "cancelled" : "ended"); };

  const onDoc = (c) => {
    if (!c || closing) return;
    const theirs = isCaller ? c.recCallee : c.recCaller; if (theirs && !theirRec) toast("The other person started recording this call."); theirRec = !!theirs; showRec(!!(c.recCaller || c.recCallee));
    if (isCaller && c.delivered && !c.answer && !startedAt && !pc.remoteDescription) say("Ringing…");
    if (isCaller && c.answer) quiet();
    if (isCaller && c.answer && !pc.remoteDescription) pc.setRemoteDescription(c.answer).then(flush).then(() => { say("Connecting…"); armConnect(); }).catch(() => {});
    if (["declined", "cancelled", "missed", "ended"].includes(c.status) && !closing) { if (c.status === "declined") toast(`${name} declined the call.`); if (c.status === "missed") toast("No answer."); end(c.status); }
  };

  (async () => {
    try {
      unsubs.push(watchCall(id, onDoc)); // from the very start, so an ended call can never be missed
      await media();
      pc.onicecandidate = (e) => { if (e.candidate) addIce(id, me, e.candidate.toJSON()); };
      unsubs.push(watchIce(id, (d) => { if (d.from !== me) addCand(JSON.parse(d.c)); }));
      if (isCaller) {
        // The call document already exists (created by startCall); attach our offer to it.
        if (kind === "video") { try { await useCamera(); } catch (e) { toast(camMsg(e)); } }
        const o = await pc.createOffer(); await pc.setLocalDescription(o); await patchCall(id, { offer: { type: o.type, sdp: o.sdp } });
        ringTO = setTimeout(() => { if (!startedAt) { patchCall(id, { status: "missed" }); toast("No answer."); end("missed"); } }, 45000);
      } else {
        const cur = await getDoc(doc(db, "calls", id)); if (!cur.exists() || cur.data().status !== "ringing") { toast("That call has ended."); return end("ended"); }
        await pc.setRemoteDescription(offer); await flush(); pc.getTransceivers().forEach((t) => { try { t.direction = "sendrecv"; } catch {} });
        vtx = pc.getTransceivers().find((t) => t.receiver.track.kind === "video");
        if (kind === "video") { try { await useCamera(); } catch (e) { toast(camMsg(e)); } }
        const a = await pc.createAnswer(); await pc.setLocalDescription(a);
        await patchCall(id, { answer: { type: a.type, sdp: a.sdp }, status: "active", answeredAt: Date.now(), calleeUid: me, members: arrayUnion(me) });
        armConnect();
      }
    } catch (e) { toast(e.message || "The call couldn’t start."); end("cancelled"); }
  })();
  return S;
}

// ---------- starting a call ----------
// to: the person's uid, or "staff" to ring the Faxton team (admins and support).
const ROLE = { renter: "Tenant", landlord: "Property owner", agency: "Agency", agent: "Agent", admin: "Faxton team", owner: "Faxton team", support: "Faxton team" };
export async function startCall(ctx, { convId, to, toName, toPhoto = "", kind = "voice", title = "", image = "", area = "" }) {
  const u = ctx.S.user; if (!u) return;
  if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) return toast("Calling isn’t supported on this device or browser.");
  if (active) return toast("You’re already on a call.");
  if (to && to !== "staff") {
    if ((await getDoc(doc(db, "blocks", `${u.uid}_${to}`)).catch(() => null))?.exists()) return toast("You blocked this user. Unblock them to call.");
    if ((await getDoc(doc(db, "blocks", `${to}_${u.uid}`)).catch(() => null))?.exists()) return toast("You can’t call this user.");
  }
  audio(); await ensureIce(); // the call button counts as a tap, so the ringing sound may play
  try {
    const peerPic = smallPhoto(toPhoto), myPic = smallPhoto(ctx.S.profile?.photo);
    const ref = await addDoc(collection(db, "calls"), { convId: convId || "", title, kind, status: "ringing", callerUid: u.uid, callerName: u.displayName || ctx.S.profile?.name || u.email, callerPhoto: myPic, calleePhoto: peerPic, callerRole: ROLE[ctx.S.isOwner ? "owner" : ctx.S.profile?.role || "renter"] || "Tenant", image, area, calleeUid: to, calleeName: toName || "Faxton team", members: to === "staff" ? [u.uid] : [u.uid, to], createdAt: serverTimestamp() });
    run({ id: ref.id, me: u.uid, role: "caller", kind, other: { uid: to, name: toName || "Faxton team", photo: toPhoto } });
  } catch (e) { toast(/permission/i.test(String(e?.code || e)) ? "You can’t place calls from this account." : "The call couldn’t be placed."); }
}

// ---------- incoming calls ----------
let ringT = null;
const ringOn = () => {
  const ac = audio(); if (!ac) return;
  const note = (f, t, d) => { [[1, 0.13], [2, 0.04], [3, 0.015]].forEach(([m, v]) => { const o = ac.createOscillator(), g = ac.createGain(); o.type = "sine"; o.frequency.value = f * m; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + d + 0.05); }); };
  const tune = () => { const t = ac.currentTime + 0.02; [[659.25, 0], [783.99, 0.16], [1046.5, 0.32], [783.99, 0.55], [880, 0.71], [1174.66, 0.87], [987.77, 1.1], [783.99, 1.26], [659.25, 1.42], [783.99, 1.7]].forEach(([f, d]) => note(f, t + d, 0.5)); };
  const buzz = () => { try { if (navigator.userActivation?.hasBeenActive) navigator.vibrate?.([450, 200, 450]); } catch {} };
  tune(); buzz(); ringT = setInterval(() => { tune(); buzz(); }, 3200);
};
const ringOff = () => { clearInterval(ringT); ringT = null; try { if (navigator.userActivation?.hasBeenActive) navigator.vibrate?.(0); } catch {} };
const avatar = (c, cls = "") => { const src = c.callerPhoto || PHOTO[c.callerUid] || ""; return `<span class="cl-avw ${cls || "sm"}" data-u="${esc(c.callerUid || "")}"><span class="cl-av ${cls || "sm"}">${esc(initials(c.callerName || "?"))}</span>${src ? photoImg(src, "cl-ph " + (cls || "sm")) : ""}</span>`; };
// When the app isn't on screen, ring through the system: a notification with Decline and Accept buttons.
async function systemRing(c) {
  try {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const opts = { body: `Faxton Rentals · incoming ${c.kind === "video" ? "video" : "voice"} call…`, icon: c.callerPhoto || PHOTO[c.callerUid] || "assets/mark.svg", badge: "assets/mark.svg", tag: "call-" + c.id, requireInteraction: true, renotify: true, vibrate: [300, 150, 300, 150, 300], actions: [{ action: "decline", title: "Decline" }, { action: "accept", title: "Accept" }], data: { id: c.id } };
    const reg = await navigator.serviceWorker?.ready;
    if (reg?.showNotification) await reg.showNotification(c.callerName || "Incoming call", opts);
    else { const n = new Notification(c.callerName || "Incoming call", opts); n.onclick = () => { window.focus(); n.close(); }; }
  } catch {}
}
const closeSystem = (id) => { try { navigator.serviceWorker?.ready.then((r) => r.getNotifications({ tag: "call-" + id }).then((l) => l.forEach((n) => n.close()))); } catch {} };
// Answer or decline a call by its id (from a notification button or a link).
export async function answerById(ctx, id, accept) {
  const u = ctx.S.user; if (!u) return; await ensureIce();
  const s = await getDoc(doc(db, "calls", id)).catch(() => null); if (!s?.exists()) return toast("That call has ended.");
  const c = { ...s.data(), id }; if (c.status !== "ringing" || !c.offer) return toast("That call has ended.");
  closeSystem(id);
  if (!accept) return patchCall(id, { status: "declined", endedAt: Date.now() });
  run({ id, me: u.uid, role: "callee", kind: c.kind, other: { uid: c.callerUid, name: c.callerName, photo: c.callerPhoto || PHOTO[c.callerUid] || "" }, offer: c.offer });
}
let swHooked = false;
export function watchIncoming(ctx, staff) {
  ensureIce();
  // Browsers keep sounds muted until the person has tapped something once; unlock them early so a call can ring.
  const unlock = () => { audio(); }; ["pointerdown", "keydown", "touchend"].forEach((ev) => document.addEventListener(ev, unlock, { once: true, passive: true }));
  const u = ctx.user || ctx.S.user, seen = new Set(), live = new Map(); let box = null, curId = null;
  if (!swHooked && navigator.serviceWorker) { swHooked = true; navigator.serviceWorker.addEventListener("message", (e) => { const d = e.data || {}; if (d.type === "call-accept") answerById(ctx, d.id, true); else if (d.type === "call-decline") answerById(ctx, d.id, false); }); }
  const close = () => { ringOff(); box?.remove(); box = null; if (curId) closeSystem(curId); curId = null; };
  const handle = (docs) => docs.forEach((c) => {
    const fresh = c.createdAt?.seconds ? Date.now() / 1000 - c.createdAt.seconds < 60 : true;
    if (c.status === "ringing" && c.offer && fresh && !seen.has(c.id) && !active && c.callerUid !== u.uid) {
      seen.add(c.id);
      // People you have blocked can't ring you: the call is declined without a sound.
      getDoc(doc(db, "blocks", `${u.uid}_${c.callerUid}`)).then((b) => (b.exists() ? patchCall(c.id, { status: "declined", endedAt: Date.now() }) : present(c))).catch(() => present(c));
    }
    if (live.has(c.id)) { live.set(c.id, c); if (c.status !== "ringing") { live.delete(c.id); if (curId === c.id) close(); else closeSystem(c.id); } }
  });
  const present = (c) => {
    if (c.status !== "ringing") return;
    {
      live.set(c.id, c); close(); curId = c.id;
      const video = c.kind === "video";
      box = document.createElement("div"); box.className = "cl-incoming card"; box.setAttribute("role", "alertdialog"); box.setAttribute("aria-label", "Incoming call from " + (c.callerName || ""));
      box.innerHTML = `<div class="cl-card"><button type="button" class="cl-x" aria-label="Minimise">${icon("x", 18)}</button>
          <div class="cl-brand"><img src="assets/mark.svg" alt="" width="22" height="20"><span>Incoming ${video ? "video " : ""}call via <b>Faxton Rentals</b></span></div>
          <div class="cl-ring"><i></i><i></i><div class="cl-pic">${avatar(c, "xl")}</div><span class="cl-badge">${icon(video ? "video" : "phone", 16)}</span></div>
          <h3>${esc(c.callerName || "Someone")}</h3><p class="cl-role">${esc(c.callerRole || "Faxton Rentals")}</p>
          ${c.title ? `<div class="cl-prop">${c.image ? `<img src="${esc(c.image)}" alt="">` : `<span class="cl-pi">${icon("home", 22)}</span>`}<div><b>${esc(c.title)}</b>${c.area ? `<span>${icon("pin", 14)} ${esc(c.area)}${/,/.test(c.area) ? "" : ", Lagos"}</span>` : ""}</div></div>` : ""}
          <div class="cl-act"><button type="button" class="no">${icon("phone", 22)} Decline</button><button type="button" class="yes">${icon(video ? "video" : "phone", 22)} Accept</button></div>
          <div class="cl-sec"><button type="button" class="cl-s msg">${icon("msg", 22)}<span>Message</span></button><button type="button" class="cl-s mute">${icon("mic", 22)}<span>Mute</span></button></div></div>
        <div class="cl-mini" tabindex="0" role="button" aria-label="Open call details">${avatar(c, "sm")}<div><b>${esc(c.callerName || "Someone")}</b><small>${video ? "Video call…" : "Calling…"}</small></div><button type="button" class="cl-round no" aria-label="Decline">${icon("phone", 22)}</button><button type="button" class="cl-round yes" aria-label="Answer">${icon(video ? "video" : "phone", 22)}</button></div>`;
      document.body.append(box); ringOn(); imgFallback(box);
      if (!(c.callerPhoto || PHOTO[c.callerUid])) lookupPhoto(c.callerUid).then((src) => { if (src && box && curId === c.id) $$(".cl-avw", box).forEach((w) => w.insertAdjacentHTML("beforeend", photoImg(src, "cl-ph " + (w.classList.contains("xl") ? "xl" : "sm")))); });
      box.classList.add("min"); patchCall(c.id, { delivered: true }); if (document.hidden || !document.hasFocus()) systemRing(c);
      $(".cl-x", box).onclick = () => box.classList.add("min"); $(".cl-mini", box).onclick = (e) => { if (!e.target.closest("button")) box.classList.remove("min"); };
      $$(".no", box).forEach((b) => (b.onclick = (e) => { e.stopPropagation(); close(); patchCall(c.id, { status: "declined", endedAt: Date.now() }); }));
      $$(".yes", box).forEach((b) => (b.onclick = (e) => { e.stopPropagation(); const cur = live.get(c.id) || c; close(); run({ id: c.id, me: u.uid, role: "callee", kind: c.kind, other: { uid: c.callerUid, name: c.callerName, photo: c.callerPhoto || PHOTO[c.callerUid] || "" }, offer: cur.offer || c.offer }); }));
      $(".msg", box).onclick = () => { box.classList.add("min"); if (c.convId) location.hash = "#/messages/" + c.convId; };
      $(".mute", box).onclick = (e) => { ringOff(); e.currentTarget.querySelector("span").textContent = "Muted"; };
    }
  };
  // Listen by membership: that is the query the database rules can prove is allowed.
  const unsubs = [onSnapshot(query(collection(db, "calls"), where("members", "array-contains", u.uid)), (s) => handle(s.docs.map((d) => ({ ...d.data(), id: d.id })).filter((c) => c.calleeUid === u.uid)), () => {})];
  if (staff) unsubs.push(onSnapshot(query(collection(db, "calls"), where("calleeUid", "==", "staff")), (s) => handle(s.docs.map((d) => ({ ...d.data(), id: d.id }))), () => {}));
  return () => { unsubs.forEach((f) => f()); close(); };
}

// ---------- call logs (the Calls tab in Messages) ----------
export function logRow(c, me, srcOf) {
  const out = c.callerUid === me, other = out ? c.calleeName : c.callerName, when = c.createdAt?.seconds ? new Date(c.createdAt.seconds * 1000) : null;
  // A call that never got an answer or an ending is shown as unanswered once it is clearly over.
  const stale = c.status === "ringing" && when && Date.now() - when.getTime() > 90000;
  const st = stale ? "missed" : c.status, missed = !out && ["missed", "cancelled"].includes(st);
  const state = st === "ringing" ? "Ringing" : missed ? "Missed" : st === "declined" ? "Declined" : ["cancelled", "missed"].includes(st) ? "No answer" : "";
  const dur = c.duration ? fmtDur(c.duration) : "";
  return `<div class="mx-call ${missed ? "missed" : ""}"><span class="mx-av ini">${esc(initials(other || "?"))}${(srcOf ? srcOf(c) : peerPhoto(c, me)) ? photoImg(srcOf ? srcOf(c) : peerPhoto(c, me)) : ""}</span><div class="mx-cm"><b>${esc(other || "Unknown")}</b><p>${icon(c.kind === "video" ? "video" : "phone", 14)}${[out ? "Outgoing" : "Incoming", state, dur, c.recorded ? "Recorded" : ""].filter(Boolean).map((t) => `<span class="nw">${esc(t)}</span>`).join(' <i class="sp">·</i> ')}</p><small>${when ? when.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}</small></div><div class="mx-cb"><button type="button" class="mx-ib" data-cb="${esc(c.id)}" data-k="voice" aria-label="Call back" title="Call back">${icon("phone", 20)}</button><button type="button" class="mx-ib" data-cb="${esc(c.id)}" data-k="video" aria-label="Video call back" title="Video call back">${icon("video", 20)}</button></div></div>`;
}
