// Message receipts and presence: the small pure helpers behind the ticks (no Firestore in here, so they are easy to test).
//
// A conversation has two sides. "u" is the person whose inbox it is, "s" is the Faxton team side (admin, support or the
// staff member who started the chat). Each side stamps two markers on the conversation document, with the server clock:
//   dv.<side>  "delivered": this side's app received the conversation update (written once per burst of new messages)
//   rd.<side>  "read":      this side had the thread open and visible
// A message sent by one side is Delivered once the other side's dv is at or after the message, and Read once its rd is.
// The existing unread / staffUnread flags stay as they were (they drive the badges); the markers only add precision.

export const FRESH_MS = 90 * 1000; // a heartbeat newer than this means "online"
export const HEARTBEAT_MS = 45 * 1000;

const num = (t) => (t && typeof t === "object" ? (t.seconds ?? 0) + (t.nanoseconds ?? 0) / 1e9 : typeof t === "number" ? t : 0);
export const otherSide = (side) => (side === "u" ? "s" : "u");

// Who wrote the newest message: the stored lastBy, or (for conversations from before receipts existed) a guess from the unread flags.
export const lastBy = (c) => c?.lastBy || (c?.unread === true ? "s" : c?.staffUnread === true ? "u" : "");

const legacyRead = (c, side) => (side === "s" ? c.unread === false : c.listingId === "direct" ? c.staffUnread === false : false);

// "pending" (still sending), "sent", "delivered" or "read" for one message I sent. pres is the other person's presence, when it is known.
export function msgStatus(m, c, mySide, pres) {
  if (!m || !m.at) return "pending";
  const o = otherSide(mySide), at = num(m.at);
  const rd = num(c?.rd?.[o]);
  if (rd && rd >= at) return "read";
  if (!c?.rd && !c?.dv && legacyRead(c || {}, mySide)) return "read";
  const dv = num(c?.dv?.[o]);
  if ((dv && dv >= at) || pres?.state === "online") return "delivered";
  return "sent";
}

// The status of the newest message in a conversation, for the list preview (only when I wrote it).
export function listStatus(c, mySide) {
  if (!c || lastBy(c) !== mySide || !c.last) return "";
  return msgStatus({ at: c.lastAt }, c, mySide, null);
}

// Does this side still owe the other side a "delivered" marker / a "read" marker for the newest message?
export const needsDelivery = (c, side) => !!c && !!c.lastAt && lastBy(c) === otherSide(side) && num(c.lastAt) > num(c.dv?.[side]);
export const needsRead = (c, side) => !!c && !!c.lastAt && lastBy(c) === otherSide(side) && (num(c.lastAt) > num(c.rd?.[side]) || (side === "s" ? c.staffUnread === true : c.unread === true));

// What a presence document says right now. state: online | offline | hidden (they chose not to show it) | unknown (no document).
export function presenceInfo(p, now = Date.now()) {
  if (!p) return { state: "unknown", last: 0 };
  if (p.show === false) return { state: "hidden", last: 0 };
  const last = num(p.lastSeen) * 1000;
  if (!last) return { state: "unknown", last: 0 };
  const online = p.online === true && now - last < FRESH_MS;
  return { state: online ? "online" : "offline", last, expires: online ? last + FRESH_MS : 0 };
}

export const STATUS_LABEL = { pending: "Sending", sent: "Sent", delivered: "Delivered", read: "Read" };
const P = 'fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"';
const ICON = {
  pending: `<svg viewBox="0 0 16 16" width="15" height="15" ${P} aria-hidden="true"><circle cx="8" cy="8" r="5.6"/><path d="M8 5v3.2l2 1.2"/></svg>`,
  sent: `<svg viewBox="0 0 18 16" width="16" height="15" ${P} aria-hidden="true"><path d="M3.5 8.6l3.3 3.3 7.2-7.8"/></svg>`,
  two: `<svg viewBox="0 0 18 16" width="16" height="15" ${P} aria-hidden="true"><path d="M1.5 8.6l3.3 3.3 7.2-7.8"/><path d="M8.4 11.1l.8.8 7.2-7.8"/></svg>`,
};
// One small icon with an accessible label: clock (sending), one tick (sent), two ticks (delivered), two blue ticks (read).
export const tickHtml = (status, cls = "") => {
  if (!status) return "";
  const label = STATUS_LABEL[status];
  return `<span class="ticks st-${status} ${cls}" role="img" aria-label="${label}" title="${label}">${status === "pending" ? ICON.pending : status === "sent" ? ICON.sent : ICON.two}</span>`;
};

// "Online", "Last seen 14:05", "Last seen yesterday" ... or "" when nothing should be shown.
export function presenceLine(info, now = Date.now()) {
  if (!info) return "";
  if (info.state === "online") return "Online";
  if (info.state !== "offline" || !info.last) return "";
  const d = new Date(info.last), n = new Date(now), y = new Date(now - 864e5), same = (a, b) => a.toDateString() === b.toDateString();
  const hm = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  if (same(d, n)) return `Last seen today at ${hm}`;
  if (same(d, y)) return `Last seen yesterday at ${hm}`;
  return `Last seen ${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
}
