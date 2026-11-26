import { apiGet, apiPost } from "./api-client.js";

const idOk = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
const rows = (value, label) => {
  if (!Array.isArray(value)) throw new TypeError(`Faxton API returned an invalid ${label} list.`);
  return value;
};
const agreement = (value) => {
  if (!value || !idOk(value.id) || !idOk(value.applicationId) || !["draft", "awaiting_signatures", "executed", "cancelled", "expired"].includes(value.status) || !value.terms || typeof value.terms !== "object") {
    throw new TypeError("The backend returned an invalid tenancy agreement.");
  }
  return value;
};
const payment = (value) => {
  if (!value || !idOk(value.id) || !idOk(value.agreementId) || !Number.isSafeInteger(Number(value.amountMinorUnits)) || Number(value.amountMinorUnits) <= 0 || !/^[A-Z]{3}$/.test(String(value.currency || ""))) {
    throw new TypeError("The backend returned an invalid rental payment request.");
  }
  return value;
};

export async function listBackendTenancyAgreements() {
  return rows(await apiGet("/v1/me/tenancy-agreements"), "tenancy agreement").map(agreement);
}
export async function getBackendTenancyAgreement(agreementId) {
  if (!idOk(agreementId)) throw new TypeError("Invalid tenancy agreement identifier.");
  return agreement(await apiGet(`/v1/tenancy-agreements/${encodeURIComponent(agreementId)}`));
}
export async function createBackendTenancyAgreement(applicationId) {
  if (!idOk(applicationId)) throw new TypeError("Invalid application identifier.");
  const result = await apiPost(`/v1/applications/${encodeURIComponent(applicationId)}/tenancy-agreements`, {});
  if (!idOk(result?.id) || result.status !== "draft") throw new TypeError("The backend did not prepare a valid agreement.");
  return result;
}
export async function sendBackendTenancyAgreement(agreementId) {
  if (!idOk(agreementId)) throw new TypeError("Invalid tenancy agreement identifier.");
  const result = await apiPost(`/v1/tenancy-agreements/${encodeURIComponent(agreementId)}/send-for-signature`, {});
  if (!idOk(result?.id) || result.status !== "awaiting_signatures") throw new TypeError("The backend did not send the agreement for signature.");
  return result;
}
export async function signBackendTenancyAgreement(agreementId, typedName, consent) {
  if (!idOk(agreementId) || typeof typedName !== "string" || typedName.trim().length < 2 || typedName.trim().length > 160 || consent !== true) {
    throw new TypeError("Enter your name and explicitly agree before signing.");
  }
  const result = await apiPost(`/v1/tenancy-agreements/${encodeURIComponent(agreementId)}/sign`, { typedName: typedName.trim(), consent: true });
  if (!idOk(result?.id) || !["awaiting_signatures", "executed"].includes(result.status)) throw new TypeError("The backend returned an invalid signature confirmation.");
  return result;
}
export async function createBackendRentalPaymentRequest(agreementId, details) {
  if (!idOk(agreementId)) throw new TypeError("Invalid tenancy agreement identifier.");
  const type = details?.paymentType;
  const amount = Number(details?.amountMinorUnits);
  if (!["rent", "deposit", "other"].includes(type) || !Number.isSafeInteger(amount) || amount <= 0 || amount > Number.MAX_SAFE_INTEGER) {
    throw new TypeError("Enter a valid payment type and amount.");
  }
  const idempotencyKey = String(details?.idempotencyKey || "");
  if (idempotencyKey.length < 12 || idempotencyKey.length > 128) throw new TypeError("A valid request reference is required.");
  const dueAt = details?.dueAt || null;
  if (dueAt !== null && (typeof dueAt !== "string" || Number.isNaN(Date.parse(dueAt)))) throw new TypeError("Enter a valid due date.");
  const result = await apiPost(`/v1/tenancy-agreements/${encodeURIComponent(agreementId)}/payment-requests`, {
    paymentType: type, amountMinorUnits: amount, dueAt, idempotencyKey
  });
  if (!idOk(result?.id) || !["pending", "processing", "paid", "failed", "refunded", "reversed", "cancelled"].includes(result.status) || !/^[A-Z]{3}$/.test(String(result.currency || "")) || Number(result.amountMinorUnits) !== amount || result.paymentType !== type) {
    throw new TypeError("The backend returned an invalid payment request confirmation.");
  }
  return result;
}
export async function listBackendRentalPayments() {
  return rows(await apiGet("/v1/me/rental-payments"), "rental payment").map(payment);
}
export async function getBackendRentalPayment(paymentId) {
  if (!idOk(paymentId)) throw new TypeError("Invalid rental payment identifier.");
  return payment(await apiGet(`/v1/rental-payments/${encodeURIComponent(paymentId)}`));
}
