import assert from "node:assert/strict";
import { test } from "node:test";
import { toTenancyAgreementViewModel, toRentalPaymentViewModel } from "../public/js/api-tenancy-mapper.js";

const agreement = {
  id: "44444444-4444-4444-8444-444444444444",
  applicationId: "66666666-6666-4666-8666-666666666666",
  status: "awaiting_signatures", propertyTitle: "Palm Court",
  terms: { rent: { amount: "150000", currency: "NGN", period: "monthly" }, deposit: { amount: "300000" }, proposedMoveInDate: "2027-01-01", leaseMonths: 12 },
  termsSha256: "a".repeat(64), landlordSignature: null, tenantSignature: null
};
const payment = {
  id: "55555555-5555-4555-8555-555555555555",
  agreementId: agreement.id, paymentType: "rent", amountMinorUnits: "15000000",
  currency: "NGN", status: "pending"
};

test("maps immutable agreement terms and signature state", () => {
  const result = toTenancyAgreementViewModel(agreement);
  assert.equal(result.propertyTitle, "Palm Court");
  assert.equal(result.rentAmount, 150000);
  assert.equal(result.rentPeriod, "monthly");
  assert.equal(result.depositAmount, 300000);
  assert.equal(result.tenantSignature, null);
});
test("rejects malformed agreement identity, status or currency", () => {
  assert.equal(toTenancyAgreementViewModel({ ...agreement, id: "bad" }), null);
  assert.equal(toTenancyAgreementViewModel({ ...agreement, status: "paid" }), null);
  assert.equal(toTenancyAgreementViewModel({ ...agreement, terms: { rent: { currency: "Naira" } } }), null);
});
test("maps integer minor-unit payment values into naira", () => {
  const result = toRentalPaymentViewModel(payment);
  assert.equal(result.amountMinorUnits, 15000000);
  assert.equal(result.amount, 150000);
  assert.equal(result.status, "pending");
});
test("rejects unsafe payment amounts and unknown payment statuses", () => {
  assert.equal(toRentalPaymentViewModel({ ...payment, amountMinorUnits: Number.MAX_SAFE_INTEGER + 1 }), null);
  assert.equal(toRentalPaymentViewModel({ ...payment, status: "confirmed" }), null);
});
