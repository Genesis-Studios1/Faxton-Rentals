const uuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
const AGREEMENT_STATES = new Set(["draft", "awaiting_signatures", "executed", "cancelled", "expired"]);
const PAYMENT_STATES = new Set(["pending", "processing", "paid", "failed", "refunded", "reversed", "cancelled"]);

export function toTenancyAgreementViewModel(row) {
  if (!row || !uuid(row.id) || !uuid(row.applicationId) || !AGREEMENT_STATES.has(row.status) || !row.terms || typeof row.terms !== "object" || Array.isArray(row.terms)) return null;
  const rent = row.terms.rent && typeof row.terms.rent === "object" ? row.terms.rent : {};
  const deposit = row.terms.deposit && typeof row.terms.deposit === "object" ? row.terms.deposit : {};
  const currency = String(rent.currency || deposit.currency || "");
  if (!/^[A-Z]{3}$/.test(currency)) return null;
  return {
    id: row.id, applicationId: row.applicationId, status: row.status,
    propertyTitle: String(row.propertyTitle || row.terms.property?.title || "Rental property"),
    landlordName: String(row.landlordName || row.terms.parties?.landlordName || "Landlord"),
    tenantName: String(row.tenantName || row.terms.parties?.tenantName || "Tenant"),
    rentAmount: Number(rent.amount), rentPeriod: String(rent.period || "yearly"),
    depositAmount: Number(deposit.amount || 0), currency,
    moveInDate: row.terms.proposedMoveInDate || null,
    leaseMonths: Number.isInteger(row.terms.leaseMonths) ? row.terms.leaseMonths : null,
    termsSha256: String(row.termsSha256 || ""),
    landlordUserId: row.landlordUserId || null, tenantUserId: row.tenantUserId || null,
    landlordSignature: row.landlordSignature || null, tenantSignature: row.tenantSignature || null,
    sentForSignatureAt: row.sentForSignatureAt || null, executedAt: row.executedAt || null
  };
}
export function toRentalPaymentViewModel(row) {
  const amountMinorUnits = Number(row?.amountMinorUnits);
  if (!row || !uuid(row.id) || !uuid(row.agreementId) || !Number.isSafeInteger(amountMinorUnits) || amountMinorUnits <= 0 ||
      !/^[A-Z]{3}$/.test(String(row.currency || "")) || !PAYMENT_STATES.has(row.status)) return null;
  return {
    id: row.id, agreementId: row.agreementId, paymentType: row.paymentType,
    amountMinorUnits, amount: amountMinorUnits / 100, currency: row.currency,
    dueAt: row.dueAt || null, status: row.status, paidAt: row.paidAt || null,
    payerUserId: row.payerUserId || null, payeeUserId: row.payeeUserId || null
  };
}
