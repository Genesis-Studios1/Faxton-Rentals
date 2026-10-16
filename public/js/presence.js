// Presence: "online" is a heartbeat, not a connection. While the app is open and visible it stamps presence/<uid>
// every 45 seconds (and straight away when the tab comes back); the other person treats a stamp newer than 90 seconds as online.
// It is written only when the person has at least one conversation (nobody else could be looking) and never when they
// switched "Show when I'm online" off (then a single { show:false } document is kept, so others see "unknown").
// Cost on the free plan: about 80 small writes per hour of active use per person.
import * as st from "./store.js";
import { HEARTBEAT_MS, needsDelivery } from "./receipts.js";

const MIN_GAP = 8000;
let cur = null; // { uid, shows(), wanted(), timer, last, wrote }

const visible = () => document.visibilityState !== "hidden";
const online = () => navigator.onLine !== false;

function put(on) {
  if (!cur) return;
  const show = cur.shows();
  cur.last = Date.now(); cur.wrote = show ? (on ? "on" : "off") : "hidden";
  st.setPresence(cur.uid, on, show).catch(() => { if (cur) cur.wrote = ""; });
}

// Write a heartbeat if one is due. force skips the minimum gap (tab came back, network came back, setting changed).
function tick(force) {
  if (!cur || !visible() || !online()) return;
  if (!cur.shows()) { if (cur.wrote !== "hidden") put(false); return; } // hidden: one document, no heartbeats
  if (!cur.wanted()) return;
  if (force || Date.now() - cur.last >= MIN_GAP) put(true);
}
function arm() {
  clearInterval(cur?.timer); if (!cur) return;
  cur.timer = visible() ? setInterval(() => tick(false), HEARTBEAT_MS) : 0;
}
const onVis = () => { if (!cur) return; arm(); if (visible()) tick(true); };
const onHide = () => { if (cur && cur.wrote === "on") put(false); }; // best effort: the browser may cancel the write
const onNet = () => tick(true);
const onOff = () => { if (cur && cur.wrote === "on") cur.wrote = ""; };

export function start(uid, opts) {
  stop(false);
  cur = { uid, shows: opts.shows, wanted: opts.wanted, timer: 0, last: 0, wrote: "" };
  document.addEventListener("visibilitychange", onVis); addEventListener("pagehide", onHide); addEventListener("online", onNet); addEventListener("offline", onOff);
  arm(); tick(true);
}
// Call when something the gates read has changed (conversations loaded, privacy setting toggled).
export function refresh() { if (cur) { arm(); tick(true); } }
export function stop(goOffline = true) {
  if (!cur) return;
  clearInterval(cur.timer); document.removeEventListener("visibilitychange", onVis); removeEventListener("pagehide", onHide); removeEventListener("online", onNet); removeEventListener("offline", onOff);
  if (goOffline && cur.wrote === "on") put(false);
  cur = null;
}
// May this device tell people that a message arrived? (Same switch: if I hide when I'm online, I don't send delivery receipts either.)
export const shares = () => (cur ? cur.shows() : true);

// Tell the other side their message arrived: one batched write for every conversation in the list that has news and no marker yet.
const told = new Set();
const keyOf = (c) => c.id + "|" + (c.lastAt?.seconds || 0) + "." + (c.lastAt?.nanoseconds || 0);
export function ackDelivery(list, side) {
  if (!cur || !shares() || !online()) return;
  const due = list.filter((c) => needsDelivery(c, side) && !told.has(keyOf(c)));
  if (!due.length) return;
  due.forEach((c) => told.add(keyOf(c)));
  st.ackDelivered(due.map((c) => c.id), side).catch(() => due.forEach((c) => told.delete(keyOf(c))));
  if (told.size > 500) told.clear();
}
