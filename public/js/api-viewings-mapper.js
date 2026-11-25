const STATUS = Object.freeze({ requested: "Requested", confirmed: "Confirmed", declined: "Declined", cancelled: "Cancelled", completed: "Completed" });
const pad = (n) => String(n).padStart(2, "0");
export function localDateTime(date, slot) {
  const d = String(date || "").slice(0, 10);
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(String(slot || "").trim());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !m) throw new Error("Choose a valid viewing date and time.");
  let hour = Number(m[1]) % 12;
  if (m[3].toUpperCase() === "PM") hour += 12;
  return new Date(`${d}T${pad(hour)}:${m[2]}:00+01:00`).toISOString();
}
export function toViewingViewModel(row, listing = {}, renter = {}) {
  if (!row || typeof row.id !== "string" || typeof row.propertyId !== "string") throw new Error("The backend returned an invalid viewing.");
  const start = new Date(row.requestedStartAt);
  if (Number.isNaN(start.getTime())) throw new Error("The backend returned an invalid viewing time.");
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(start);
  const date = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const time = new Intl.DateTimeFormat("en-US", { timeZone: "Africa/Lagos", hour: "numeric", minute: "2-digit", hour12: true }).format(start).replace(/^0/, "");
  const status = STATUS[String(row.status || "").toLowerCase()];
  if (!status) throw new Error("The backend returned an unknown viewing status.");
  const checkInAt = row.checkedInAt ? Date.parse(row.checkedInAt) : 0;
  const checkOutAt = row.checkedOutAt ? Date.parse(row.checkedOutAt) : 0;
  const sosAt = row.sosRaisedAt ? Date.parse(row.sosRaisedAt) : 0;
  const sosResolvedAt = row.sosResolvedAt ? Date.parse(row.sosResolvedAt) : 0;
  const createdAt = Date.parse(row.createdAt);
  return {
    id: row.id, _backend: true, uid: row.renterUserId, name: renter.name || "Renter",
    listingId: row.propertyId, title: row.propertyTitle || listing.title || "Property viewing",
    area: [row.propertyCity || listing.city || listing.area, row.propertyState || listing.state].filter(Boolean).join(", "),
    image: listing.thumb || listing.images?.[0] || listing.image || "img/palm-court.webp",
    when: `${date.year}-${date.month}-${date.day}`, slot: time,
    tour: row.tourType === "video" ? "Virtual tour" : row.tourType === "phone" ? "Phone tour" : "In-person tour",
    phone: row.contactPhone || "", note: row.renterNote || "", status,
    agentUid: row.assignedAgentUserId || listing.ownerUid || listing.agent?.id || "",
    agentName: listing.agent?.name || "Faxton agent", agentPhoto: listing.agent?.avatar || listing.agent?.photo || "",
    agentVerified: !!listing.agent?.verified, createdAt: Number.isFinite(createdAt) ? { seconds: Math.floor(createdAt / 1000) } : null,
    checkIn: checkInAt ? { at: checkInAt } : null, checkOut: checkOutAt ? { at: checkOutAt } : null,
    sos: sosAt ? { at: sosAt, resolved: !!sosResolvedAt, ...(sosResolvedAt ? { resolvedAt: sosResolvedAt } : {}) } : null,
    rating: row.rating ? { stars: row.rating, ...(row.ratingNote ? { text: row.ratingNote } : {}) } : null,
    requestedStartAt: row.requestedStartAt, requestedEndAt: row.requestedEndAt || null
  };
}
export const toBackendTourType = (tour) => /virtual/i.test(String(tour || "")) ? "video" : /phone/i.test(String(tour || "")) ? "phone" : "in_person";
