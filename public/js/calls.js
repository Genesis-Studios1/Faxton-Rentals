// Voice and video calls over WebRTC (signalled through Firestore), with screen sharing, recording to the device and call logs.
import { db } from "./firebase.js";
import { collection, doc, addDoc, getDoc, updateDoc, onSnapshot, query, where, serverTimestamp, arrayUnion }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { $, $$, esc, icon, toast, initials } from "./ui.js";

const ICE = { iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }] };
export const fmtDur = (s) => { s = Math.max(0, Math.round(s || 0)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(x).padStart(2, "0"); };

// ---------- Firestore signalling ----------
const patchCall = (id, d) => updateDoc(doc(db, "calls", id), d).catch(() => {});
const watchCall = (id, cb) => onSnapshot(doc(db, "calls", id), (s) => cb(s.exists() ? { ...s.data(), id: s.id } : null), () => {});
const addIce = (id, from, c) => addDoc(collection(db, "calls", id, "ice"), { from, c: JSON.stringify(c) }).catch(() => {});
const watchIce = (id, cb) => onSnapshot(collection(db, "calls", id, "ice"), (s) => s.docChanges().forEach((ch) => { if (ch.type === "added") cb(ch.doc.data()); }), () => {});
export const watchLogs = (uid, cb) => onSnapshot(query(collection(db, "calls"), where("members", "array-contains", uid)), (s) => cb(s.docs.map((d) => ({ ...d.data(), id: d.id })).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))), () => cb([]));

// ---------- the call window ----------
let active = null;
function run({ id, me, role, kind, other, offer }) {
  if (active) { toast("You’re already on a call."); return null; }
  const isCaller = role === "caller", name = other.name || "Faxton", recKey = isCaller ? "recCaller" : "recCallee";
  const ov = document.createElement("div"); ov.className = "cl-ov"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true"); ov.setAttribute("aria-label", "Call with " + name);
  ov.innerHTML = `<div class="cl-top"><div class="cl-who"><b>${esc(name)}</b><span id="clSt">${isCaller ? "Calling…" : "Connecting…"}</span></div><span class="cl-rec" id="clRec" hidden><i></i> Recording</span></div>
    <div class="cl-stage"><video id="clRemote" autoplay playsinline></video><div class="cl-voice" id="clVoice"><span class="cl-av">${esc(initials(name))}</span><p id="clVt">${isCaller ? "Calling…" : "Connecting…"}</p></div><video id="clLocal" class="cl-pip" autoplay playsinline muted hidden></video></div>
    <div class="cl-bar"><button type="button" class="cl-b" id="clMute" aria-pressed="false" aria-label="Mute">${icon("mic", 24)}<span>Mute</span></button>
      <button type="button" class="cl-b" id="clCam" aria-pressed="false" aria-label="Camera">${icon("video", 24)}<span>Camera</span></button>
      <button type="button" class="cl-b" id="clShare" aria-pressed="false" aria-label="Share screen">${icon("monitor", 24)}<span>Share</span></button>
      <button type="button" class="cl-b" id="clRecB" aria-pressed="false" aria-label="Record call">${icon("camera", 24)}<span>Record</span></button>
      <button type="button" class="cl-b end" id="clEnd" aria-label="End call">${icon("phone", 26)}<span>End</span></button></div>`;
  document.body.append(ov); document.documentElement.classList.add("dlx-lock");
  const el = (i) => $("#" + i, ov), remoteV = el("clRemote"), localV = el("clLocal");
  const say = (t) => { el("clSt").textContent = t; el("clVt").textContent = t; };
  const pc = new RTCPeerConnection(ICE), remote = new MediaStream(), preview = new MediaStream();
  let theirRec = false, mic = null, cam = null, screen = null, vtx = null, startedAt = 0, timer = null, ended = false, closing = false, recorder = null, rec = null, unsubs = [], pending = [], remoteVideo = false, ringTO = null;
  const S = { pc, stop: () => end("ended") };
  active = S;

  const setRemoteVideo = (on) => { remoteVideo = on; remoteV.style.display = on ? "block" : "none"; el("clVoice").style.display = on ? "none" : "grid"; };
  const syncLocal = () => { const v = preview.getVideoTracks()[0]; localV.hidden = !v; localV.srcObject = v ? preview : null; el("clCam").setAttribute("aria-pressed", String(!!cam && cam.enabled)); el("clShare").setAttribute("aria-pressed", String(!!screen)); };
  setRemoteVideo(false);
  remoteV.srcObject = remote;
  pc.ontrack = (e) => { remote.addTrack(e.track); if (e.track.kind === "video") { e.track.onunmute = () => setRemoteVideo(true); e.track.onmute = () => setRemoteVideo(false); } remoteV.play?.().catch(() => {}); };
  pc.onconnectionstatechange = () => { if (pc.connectionState === "connected") { if (!startedAt) { startedAt = Date.now(); timer = setInterval(() => say(fmtDur((Date.now() - startedAt) / 1000)), 1000); say("0:00"); } } if (["failed", "closed"].includes(pc.connectionState) && !ended) { toast("The call lost its connection."); end("ended"); } };
  const addCand = async (c) => { try { if (pc.remoteDescription) await pc.addIceCandidate(c); else pending.push(c); } catch {} };
  const flush = async () => { for (const c of pending.splice(0)) { try { await pc.addIceCandidate(c); } catch {} } };

  // The caller always offers a video line, so the camera or a shared screen can start later without renegotiating.
  if (isCaller) vtx = pc.addTransceiver("video", { direction: "sendrecv" });

  const media = async () => {
    try { mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false }); }
    catch (e) { throw new Error(/denied|permission/i.test(String(e?.name + e?.message)) ? "Allow microphone access to make calls." : "No microphone was found."); }
    mic.getAudioTracks().forEach((t) => pc.addTrack(t, mic));
  };
  const useCamera = async () => {
    const s = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } } }); cam = s.getVideoTracks()[0];
    if (!screen) { await vtx.sender.replaceTrack(cam); setPreview(cam); } syncLocal();
  };
  const setPreview = (t) => { preview.getVideoTracks().forEach((x) => preview.removeTrack(x)); if (t) preview.addTrack(t); syncLocal(); };

  // ---- controls ----
  el("clMute").onclick = () => { const t = mic?.getAudioTracks()[0]; if (!t) return; t.enabled = !t.enabled; el("clMute").setAttribute("aria-pressed", String(!t.enabled)); el("clMute").querySelector("span").textContent = t.enabled ? "Mute" : "Unmute"; };
  el("clCam").onclick = async () => {
    try { if (!cam) { await useCamera(); return; } cam.enabled = !cam.enabled; if (!screen) { await vtx.sender.replaceTrack(cam.enabled ? cam : null); setPreview(cam.enabled ? cam : null); } syncLocal(); } catch { toast("The camera isn’t available."); }
  };
  const stopShare = async () => { if (!screen) return; screen.onended = null; screen.stop(); screen = null; const back = cam && cam.enabled ? cam : null; await vtx.sender.replaceTrack(back).catch(() => {}); setPreview(back); el("clShare").querySelector("span").textContent = "Share"; };
  el("clShare").onclick = async () => {
    if (screen) return stopShare();
    if (!navigator.mediaDevices?.getDisplayMedia) return toast("Screen sharing isn’t supported on this device.");
    try { const s = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false }); screen = s.getVideoTracks()[0]; screen.onended = stopShare; await vtx.sender.replaceTrack(screen); setPreview(screen); el("clShare").querySelector("span").textContent = "Stop"; }
    catch (e) { if (e?.name !== "NotAllowedError") toast("Couldn’t start screen sharing."); }
  };

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
      const draw = () => { g.fillStyle = "#07110d"; g.fillRect(0, 0, 1280, 720); if (remoteVideo) cover(remoteV, 0, 0, 1280, 720); else { g.fillStyle = "#fff"; g.font = "600 44px sans-serif"; g.textAlign = "center"; g.fillText(name, 640, 370); } if (!localV.hidden) cover(localV, 1280 - 340, 720 - 200, 320, 180); raf = requestAnimationFrame(draw); };
      draw(); tracks.unshift(...cv.captureStream(24).getVideoTracks());
    }
    const type = ["video/webm;codecs=vp8,opus", "video/webm", "audio/webm;codecs=opus", "audio/webm"].find((t) => (cv ? t.startsWith("video") : t.startsWith("audio")) && MediaRecorder.isTypeSupported(t)) || "";
    const chunks = []; recorder = new MediaRecorder(new MediaStream(tracks), type ? { mimeType: type } : undefined);
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    recorder.onstop = () => { cancelAnimationFrame(raf); ac.close().catch(() => {}); if (!chunks.length) return; const blob = new Blob(chunks, { type: recorder?.mimeType || type || "video/webm" }), a = document.createElement("a"), ext = blob.type.startsWith("audio") ? "webm" : "webm";
      a.href = URL.createObjectURL(blob); a.download = `Faxton-call-${name.replace(/[^\w]+/g, "-")}-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.${ext}`; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); toast("Recording saved to your device."); };
    recorder.start(1000); patchCall(id, { [recKey]: true, recorded: true }); showRec(true); el("clRecB").querySelector("span").textContent = "Stop";
  };
  const stopRec = () => { if (!recorder) return; const r = recorder; recorder = null; try { r.stop(); } catch {} patchCall(id, { [recKey]: false }); showRec(false); el("clRecB").querySelector("span").textContent = "Record"; };
  el("clRecB").onclick = () => { if (!startedAt) return toast("You can record once the call is connected."); recorder ? stopRec() : (confirm("Everyone on the call will see that it’s being recorded. The recording is saved to this device only. Start recording?") && startRec()); };

  // ---- ending ----
  async function end(status) {
    if (closing) return; closing = true; ended = true; clearTimeout(ringTO); clearInterval(timer); stopRec();
    const dur = startedAt ? Math.round((Date.now() - startedAt) / 1000) : 0;
    await patchCall(id, { status: startedAt ? "ended" : status, endedAt: Date.now(), duration: dur });
    unsubs.forEach((f) => f()); [mic, cam, screen].forEach((s) => { try { s?.getTracks ? s.getTracks().forEach((t) => t.stop()) : s?.stop(); } catch {} });
    try { pc.close(); } catch {}
    say(dur ? `Call ended · ${fmtDur(dur)}` : "Call ended"); document.documentElement.classList.remove("dlx-lock"); active = null;
    setTimeout(() => ov.remove(), 900);
  }
  el("clEnd").onclick = () => end(isCaller && !startedAt ? "cancelled" : "ended");

  const onDoc = (c) => {
    if (!c || closing) return;
    const theirs = isCaller ? c.recCallee : c.recCaller; if (theirs && !theirRec) toast("The other person started recording this call."); theirRec = !!theirs; showRec(!!(c.recCaller || c.recCallee));
    if (isCaller && c.answer && !pc.remoteDescription) pc.setRemoteDescription(c.answer).then(flush).then(() => say("Connecting…")).catch(() => {});
    if (["declined", "cancelled", "missed", "ended"].includes(c.status) && !closing) { if (c.status === "declined") toast(`${name} declined the call.`); if (c.status === "missed") toast("No answer."); end(c.status); }
  };

  (async () => {
    try {
      await media();
      pc.onicecandidate = (e) => { if (e.candidate) addIce(id, me, e.candidate.toJSON()); };
      unsubs.push(watchIce(id, (d) => { if (d.from !== me) addCand(JSON.parse(d.c)); }));
      if (isCaller) {
        // The call document already exists (created by startCall); attach our offer to it.
        if (kind === "video") { try { await useCamera(); } catch { toast("The camera isn’t available, so this will be a voice call."); } }
        const o = await pc.createOffer(); await pc.setLocalDescription(o); await patchCall(id, { offer: { type: o.type, sdp: o.sdp } });
        ringTO = setTimeout(() => { if (!startedAt) { patchCall(id, { status: "missed" }); toast("No answer."); end("missed"); } }, 45000);
      } else {
        await pc.setRemoteDescription(offer); await flush(); pc.getTransceivers().forEach((t) => { try { t.direction = "sendrecv"; } catch {} });
        vtx = pc.getTransceivers().find((t) => t.receiver.track.kind === "video");
        if (kind === "video") { try { await useCamera(); } catch { toast("The camera isn’t available, so this will be a voice call."); } }
        const a = await pc.createAnswer(); await pc.setLocalDescription(a);
        await patchCall(id, { answer: { type: a.type, sdp: a.sdp }, status: "active", answeredAt: Date.now(), calleeUid: me, members: arrayUnion(me) });
      }
      unsubs.push(watchCall(id, onDoc));
    } catch (e) { toast(e.message || "The call couldn’t start."); end("cancelled"); }
  })();
  return S;
}

// ---------- starting a call ----------
// to: the person's uid, or "staff" to ring the Faxton team (admins and support).
const ROLE = { renter: "Tenant", landlord: "Property owner", agency: "Agency", agent: "Agent", admin: "Faxton team", owner: "Faxton team", support: "Faxton team" };
export async function startCall(ctx, { convId, to, toName, kind = "voice", title = "", image = "", area = "" }) {
  const u = ctx.S.user; if (!u) return;
  if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) return toast("Calling isn’t supported on this device or browser.");
  if (active) return toast("You’re already on a call.");
  try {
    const ref = await addDoc(collection(db, "calls"), { convId: convId || "", title, kind, status: "ringing", callerUid: u.uid, callerName: u.displayName || ctx.S.profile?.name || u.email, callerPhoto: ctx.S.profile?.photo || "", callerRole: ROLE[ctx.S.isOwner ? "owner" : ctx.S.profile?.role || "renter"] || "Tenant", image, area, calleeUid: to, calleeName: toName || "Faxton team", members: to === "staff" ? [u.uid] : [u.uid, to], createdAt: serverTimestamp() });
    run({ id: ref.id, me: u.uid, role: "caller", kind, other: { name: toName || "Faxton team" } });
  } catch (e) { toast(/permission/i.test(String(e?.code || e)) ? "You can’t place calls from this account." : "The call couldn’t be placed."); }
}

// ---------- incoming calls ----------
let ringCtx = null, ringT = null;
const ringOn = () => { try { ringCtx ||= new (window.AudioContext || window.webkitAudioContext)(); const beep = () => { const o = ringCtx.createOscillator(), g = ringCtx.createGain(); o.frequency.value = 440; g.gain.value = 0.08; o.connect(g); g.connect(ringCtx.destination); o.start(); o.stop(ringCtx.currentTime + 0.35); }; beep(); ringT = setInterval(beep, 1400); } catch {} };
const ringOff = () => { clearInterval(ringT); ringT = null; };
const avatar = (c, cls = "") => (c.callerPhoto ? `<img class="cl-ph ${cls}" src="${esc(c.callerPhoto)}" alt="">` : `<span class="cl-av ${cls || "sm"}">${esc(initials(c.callerName || "?"))}</span>`);
// When the app isn't on screen, ring through the system: a notification with Decline and Accept buttons.
async function systemRing(c) {
  try {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const opts = { body: `Faxton Rentals · incoming ${c.kind === "video" ? "video" : "voice"} call…`, icon: c.callerPhoto || "assets/mark.svg", badge: "assets/mark.svg", tag: "call-" + c.id, requireInteraction: true, renotify: true, vibrate: [300, 150, 300, 150, 300], actions: [{ action: "decline", title: "Decline" }, { action: "accept", title: "Accept" }], data: { id: c.id } };
    const reg = await navigator.serviceWorker?.ready;
    if (reg?.showNotification) await reg.showNotification(c.callerName || "Incoming call", opts);
    else { const n = new Notification(c.callerName || "Incoming call", opts); n.onclick = () => { window.focus(); n.close(); }; }
  } catch {}
}
const closeSystem = (id) => { try { navigator.serviceWorker?.ready.then((r) => r.getNotifications({ tag: "call-" + id }).then((l) => l.forEach((n) => n.close()))); } catch {} };
// Answer or decline a call by its id (from a notification button or a link).
export async function answerById(ctx, id, accept) {
  const u = ctx.S.user; if (!u) return;
  const s = await getDoc(doc(db, "calls", id)).catch(() => null); if (!s?.exists()) return toast("That call has ended.");
  const c = { ...s.data(), id }; if (c.status !== "ringing" || !c.offer) return toast("That call has ended.");
  closeSystem(id);
  if (!accept) return patchCall(id, { status: "declined", endedAt: Date.now() });
  run({ id, me: u.uid, role: "callee", kind: c.kind, other: { name: c.callerName }, offer: c.offer });
}
let swHooked = false;
export function watchIncoming(ctx, staff) {
  const u = ctx.user || ctx.S.user, seen = new Set(), live = new Map(); let box = null, curId = null;
  if (!swHooked && navigator.serviceWorker) { swHooked = true; navigator.serviceWorker.addEventListener("message", (e) => { const d = e.data || {}; if (d.type === "call-accept") answerById(ctx, d.id, true); else if (d.type === "call-decline") answerById(ctx, d.id, false); }); }
  const close = () => { ringOff(); box?.remove(); box = null; if (curId) closeSystem(curId); curId = null; };
  const handle = (docs) => docs.forEach((c) => {
    const fresh = c.createdAt?.seconds ? Date.now() / 1000 - c.createdAt.seconds < 60 : true;
    if (c.status === "ringing" && c.offer && fresh && !seen.has(c.id) && !active && c.callerUid !== u.uid) {
      seen.add(c.id); live.set(c.id, c); close(); curId = c.id;
      const video = c.kind === "video";
      box = document.createElement("div"); box.className = "cl-incoming card"; box.setAttribute("role", "alertdialog"); box.setAttribute("aria-label", "Incoming call from " + (c.callerName || ""));
      box.innerHTML = `<div class="cl-card"><button type="button" class="cl-x" aria-label="Minimise">${icon("x", 18)}</button>
          <div class="cl-brand"><img src="assets/mark.svg" alt="" width="22" height="20"><span>Incoming ${video ? "video " : ""}call via <b>Faxton Rentals</b></span></div>
          <div class="cl-ring"><i></i><i></i><div class="cl-pic">${avatar(c, "xl")}</div><span class="cl-badge">${icon(video ? "video" : "phone", 16)}</span></div>
          <h3>${esc(c.callerName || "Someone")}</h3><p class="cl-role">${esc(c.callerRole || "Faxton Rentals")}</p>
          ${c.title ? `<div class="cl-prop">${c.image ? `<img src="${esc(c.image)}" alt="">` : `<span class="cl-pi">${icon("home", 22)}</span>`}<div><b>${esc(c.title)}</b>${c.area ? `<span>${icon("pin", 14)} ${esc(c.area)}${/,/.test(c.area) ? "" : ", Lagos"}</span>` : ""}</div></div>` : ""}
          <div class="cl-act"><button type="button" class="no">${icon("phone", 22)} Decline</button><button type="button" class="yes">${icon(video ? "video" : "phone", 22)} Accept</button></div>
          <div class="cl-sec"><button type="button" class="cl-s msg">${icon("msg", 22)}<span>Message</span></button><button type="button" class="cl-s mute">${icon("mic", 22)}<span>Mute</span></button></div></div>
        <div class="cl-mini" tabindex="0" role="button" aria-label="Open call details">${avatar(c, "sm")}<div><b>${esc(c.callerName || "Someone")}</b><small>Incoming ${video ? "video " : ""}call…</small></div><button type="button" class="cl-round no" aria-label="Decline">${icon("phone", 22)}</button><button type="button" class="cl-round yes" aria-label="Answer">${icon(video ? "video" : "phone", 22)}</button></div>`;
      document.body.append(box); ringOn();
      const hide = document.hidden || !document.hasFocus(); if (hide) { box.classList.add("min"); systemRing(c); }
      $(".cl-x", box).onclick = () => box.classList.add("min"); $(".cl-mini", box).onclick = (e) => { if (!e.target.closest("button")) box.classList.remove("min"); };
      $$(".no", box).forEach((b) => (b.onclick = (e) => { e.stopPropagation(); close(); patchCall(c.id, { status: "declined", endedAt: Date.now() }); }));
      $$(".yes", box).forEach((b) => (b.onclick = (e) => { e.stopPropagation(); const cur = live.get(c.id) || c; close(); run({ id: c.id, me: u.uid, role: "callee", kind: c.kind, other: { name: c.callerName }, offer: cur.offer || c.offer }); }));
      $(".msg", box).onclick = () => { box.classList.add("min"); if (c.convId) location.hash = "#/messages/" + c.convId; };
      $(".mute", box).onclick = (e) => { ringOff(); e.currentTarget.querySelector("span").textContent = "Muted"; };
    }
    if (live.has(c.id)) { live.set(c.id, c); if (c.status !== "ringing") { live.delete(c.id); if (curId === c.id) close(); else closeSystem(c.id); } }
  });
  const unsubs = [onSnapshot(query(collection(db, "calls"), where("calleeUid", "==", u.uid)), (s) => handle(s.docs.map((d) => ({ ...d.data(), id: d.id }))), () => {})];
  if (staff) unsubs.push(onSnapshot(query(collection(db, "calls"), where("calleeUid", "==", "staff")), (s) => handle(s.docs.map((d) => ({ ...d.data(), id: d.id }))), () => {}));
  return () => { unsubs.forEach((f) => f()); close(); };
}

// ---------- call logs (the Calls tab in Messages) ----------
export function logRow(c, me) {
  const out = c.callerUid === me, other = out ? c.calleeName : c.callerName, missed = !out && ["missed", "cancelled"].includes(c.status), when = c.createdAt?.seconds ? new Date(c.createdAt.seconds * 1000) : null;
  const state = c.status === "ringing" ? "Ringing" : missed ? "Missed" : c.status === "declined" ? "Declined" : ["cancelled", "missed"].includes(c.status) ? "No answer" : "";
  const dur = c.duration ? fmtDur(c.duration) : "";
  return `<div class="conv call-row ${missed ? "missed" : ""}"><span class="cl-av sm">${esc(initials(other || "?"))}</span><div class="conv-main"><div class="conv-top"><b>${esc(other || "Unknown")}</b><span>${when ? when.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}</span></div><p>${icon(c.kind === "video" ? "video" : "phone", 14)} ${out ? "Outgoing" : "Incoming"}${state ? " · " + state : ""}${dur ? " · " + dur : ""}${c.recorded ? " · Recorded" : ""}</p></div><button type="button" class="icon-btn flat" data-cb="${esc(c.id)}" data-k="voice" aria-label="Call back">${icon("phone", 20)}</button><button type="button" class="icon-btn flat" data-cb="${esc(c.id)}" data-k="video" aria-label="Video call back">${icon("video", 20)}</button></div>`;
}
