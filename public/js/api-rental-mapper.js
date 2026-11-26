const EMPLOYMENT = {
  Employed: "employed", "Self-employed": "self_employed", Student: "student",
  Unemployed: "unemployed", Retired: "retired", Other: "other"
};
const INCOME = {
  "Below ₦100,000": "below_100k",
  "₦100,000 – ₦250,000": "100k_250k",
  "₦250,000 – ₦500,000": "250k_500k",
  "₦500,000 – ₦1,000,000": "500k_1m",
  "Above ₦1,000,000": "above_1m",
  "Prefer not to say": "not_disclosed"
};
const INCOME_LABEL = Object.fromEntries(Object.entries(INCOME).map(([label, value]) => [value, label]));
const APP_STATUS = {
  under_review: "Under review", shortlisted: "Shortlisted",
  approved: "Approved", rejected: "Rejected", withdrawn: "Withdrawn"
};
const OFFER_STATUS = {
  pending: "Pending", accepted: "Accepted", rejected: "Declined",
  withdrawn: "Withdrawn", expired: "Expired", superseded: "Countered"
};
export function toBackendApplicationPayload(listingId, details, moveIn, documents = []) {
  const occupants = String(details.occupants || "").trim();
  const occupantsCount = occupants === "6+" ? 6 : Number(occupants);
  const employmentStatus = EMPLOYMENT[details.employment];
  const incomeBand = INCOME[details.income];
  const applicantPhone = String(details.phone || "").trim();
  const currentAddress = String(details.address || "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(listingId))) throw new TypeError("Invalid property identifier.");
  if (applicantPhone.length < 7 || applicantPhone.length > 40) throw new TypeError("Enter a valid phone number.");
  if (currentAddress.length < 5 || currentAddress.length > 500) throw new TypeError("Enter your current residential address.");
  if (!Number.isInteger(occupantsCount) || occupantsCount < 1 || occupantsCount > 100) throw new TypeError("Choose a valid number of occupants.");
  if (!employmentStatus) throw new TypeError("Choose a valid employment status.");
  if (moveIn && !/^\d{4}-\d{2}-\d{2}$/.test(moveIn)) throw new TypeError("Choose a valid move-in date.");
  if (!Array.isArray(documents) || documents.length > 8) throw new TypeError("Too many application documents.");
  return {
    propertyId: listingId, applicantPhone, currentAddress, occupantsCount,
    employmentStatus, ...(details.employer ? { employerName: String(details.employer).slice(0,160) } : {}),
    ...(details.job ? { jobTitle: String(details.job).slice(0,120) } : {}),
    ...(incomeBand ? { incomeBand } : {}),
    ...(moveIn ? { desiredMoveInDate: moveIn } : {}),
    ...(details.note ? { applicantNote: String(details.note).slice(0,2000) } : {}),
    documents
  };
}
export function toBackendApplicationViewModel(row, listing = {}, profile = {}, total = 0) {
  if (!row || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(row.id)) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(row.propertyId))) {
    throw new TypeError("The backend returned an invalid rental application.");
  }
  const status = APP_STATUS[String(row.status || "").toLowerCase()];
  if (!status) throw new TypeError("The backend returned an unknown application status.");
  const details = {
    name: profile.name || profile.displayName || "Renter", phone: row.applicantPhone || "", address: row.currentAddress || "",
    occupants: String(row.occupantsCount ?? ""), employment: String(row.employmentStatus || "").replaceAll("_"," "),
    employer: row.employerName || "", job: row.jobTitle || "",
    income: INCOME_LABEL[row.incomeBand] || "", note: row.applicantNote || ""
  };
  return {
    id: row.id, _backend: true, uid: row.applicantUserId, listingId: row.propertyId,
    title: row.propertyTitle || listing.title || "Rental property",
    area: [row.propertyCity || listing.city, row.propertyState || listing.state].filter(Boolean).join(", ") || listing.area || "",
    image: listing.thumb || listing.images?.[0] || "",
    name: profile.name || profile.displayName || "Renter", email: "",
    phone: row.applicantPhone || "", details, rent: Number(listing.price) || 0,
    amount: total, moveIn: row.desiredMoveInDate || "", status,
    currency: row.currency || "NGN", createdAt: row.submittedAt || row.createdAt,
    updatedAt: row.updatedAt, employmentStatus: row.employmentStatus,
    incomeBand: row.incomeBand || "", applicantNote: row.applicantNote || "",
    occupantsCount: row.occupantsCount, acceptedOfferId: row.acceptedOfferId || null,
    agreedRentAmount: row.agreedRentAmount == null ? null : Number(row.agreedRentAmount),
    ownerUid: listing.ownerUid || null, l: listing
  };
}
export function toBackendOfferThread(application, offers, listing = {}, profile = {}, me = "") {
  if (!application || !Array.isArray(offers) || !offers.length) return null;
  const ordered = [...offers].sort((a,b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  const latest = ordered[ordered.length - 1];
  const applicantId = application.uid || application.applicantUserId;
  const history = [];
  for (const offer of ordered) {
    const by = offer.createdByUserId === applicantId ? "renter" : "owner";
    history.push({
      by, uid: offer.createdByUserId, type: offer.parentOfferId ? "counter" : "offer",
      amount: Number(offer.rentAmount), note: offer.message || "",
      at: Date.parse(offer.createdAt) || Date.now()
    });
    if (offer.status === "accepted" || offer.status === "rejected" || offer.status === "withdrawn" || offer.status === "expired") {
      history.push({
        by: offer.recipientUserId === applicantId ? "renter" : "owner",
        uid: offer.recipientUserId,
        type: ({ accepted: "accept", rejected: "decline", withdrawn: "withdraw", expired: "expire" })[offer.status],
        amount: Number(offer.rentAmount), note: "", at: Date.parse(offer.respondedAt || offer.updatedAt) || Date.now()
      });
    }
  }
  const listingPrice = Number(listing.price || application.rent || 0);
  const status = OFFER_STATUS[String(latest.status || "").toLowerCase()] || "Pending";
  const turn = latest.status === "pending" ? (latest.recipientUserId === applicantId ? "renter" : "owner") : "";
  return {
    id: latest.id, _backend: true, applicationId: application.id,
    uid: applicantId, ownerUid: me && me !== applicantId ? me : (listing.ownerUid || null),
    ownerName: listing.agent?.name || "Listing manager",
    name: application.name || profile.name || "Renter",
    listingId: application.listingId, title: application.title || listing.title || "Rental property",
    area: application.area || listing.area || "", image: listing.thumb || listing.images?.[0] || application.image || "",
    listPrice: listingPrice, amount: Number(latest.rentAmount), currency: latest.currency,
    rentPeriod: latest.rentPeriod, depositAmount: Number(latest.depositAmount || 0),
    leaseMonths: latest.leaseMonths, proposedMoveInDate: latest.proposedMoveInDate,
    service: Number(listing.service || 0), deposit: Number(listing.deposit || latest.depositAmount || 0),
    agencyFee: listing.agencyFee, legalFee: listing.legalFee,
    status, turn, history, createdAt: ordered[0].createdAt,
    updatedAt: latest.updatedAt, _latestOffer: latest, _application: application
  };
}
export const backendApplicationStatus = (status) => ({
  "Shortlisted": "shortlisted", "Approved": "approved", "Rejected": "rejected"
})[status] || null;
