import test from "node:test";
import assert from "node:assert/strict";
import { isBackendUuid, toVerificationSubmission, toSupportCasePayload } from "../public/js/api-verification-support-mapper.js";

const uploadA = "11111111-1111-4111-8111-111111111111";
const uploadB = "22222222-2222-4222-8222-222222222222";
const propertyId = "33333333-3333-4333-8333-333333333333";
const applicationId = "44444444-4444-4444-8444-444444444444";

test("validates UUID identifiers and complete identity evidence", () => {
  assert.equal(isBackendUuid(propertyId), true);
  assert.equal(isBackendUuid("not-a-uuid"), false);
  const result = toVerificationSubmission({ subjectType: "identity", documents: [
    { uploadId: uploadA, documentType: "government_id" },
    { uploadId: uploadB, documentType: "proof_of_address" }
  ] });
  assert.equal(result.documents.length, 2);
  assert.equal(result.subjectType, "identity");
});

test("requires evidence that matches the verification subject", () => {
  assert.throws(() => toVerificationSubmission({ subjectType: "identity", documents: [{ uploadId: uploadA, documentType: "government_id" }] }), /requires an ID and proof of address/);
  assert.throws(() => toVerificationSubmission({ subjectType: "business", documents: [{ uploadId: uploadA, documentType: "ownership_proof" }] }), /does not match/);
  assert.throws(() => toVerificationSubmission({ subjectType: "property_ownership", propertyId, documents: [{ uploadId: uploadA, documentType: "ownership_proof" }] }).documents[0].documentType, /never/);
});

test("rejects duplicate upload references and property IDs on identity requests", () => {
  assert.throws(() => toVerificationSubmission({ subjectType: "identity", documents: [
    { uploadId: uploadA, documentType: "government_id" },
    { uploadId: uploadA, documentType: "proof_of_address" }
  ] }), /only be used once/);
  assert.throws(() => toVerificationSubmission({ subjectType: "identity", propertyId, documents: [
    { uploadId: uploadA, documentType: "government_id" },
    { uploadId: uploadB, documentType: "proof_of_address" }
  ] }), /Invalid property reference/);
});

test("maps only valid support, property report and rental dispute payloads", () => {
  assert.deepEqual(toSupportCasePayload({ caseType: "support", subject: "Account access", description: "I cannot update my profile." }), {
    caseType: "support", subject: "Account access", description: "I cannot update my profile."
  });
  assert.equal(toSupportCasePayload({ caseType: "property_report", subject: "Incorrect listing", description: "The property details are misleading.", propertyId }).propertyId, propertyId);
  assert.equal(toSupportCasePayload({ caseType: "rental_dispute", subject: "Deposit dispute", description: "The deposit request differs from the agreement.", applicationId }).applicationId, applicationId);
  assert.throws(() => toSupportCasePayload({ caseType: "property_report", subject: "Report", description: "Something is wrong" }), /one property/);
  assert.throws(() => toSupportCasePayload({ caseType: "support", subject: "General help", description: "Please help with my rental.", propertyId }), /cannot reference/);
});
