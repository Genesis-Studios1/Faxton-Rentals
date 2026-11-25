import assert from "node:assert/strict";
import { test } from "node:test";
import {
  toBackendApplicationPayload,
  toBackendApplicationViewModel,
  toBackendOfferThread,
  backendApplicationStatus
} from "../public/js/api-rental-mapper.js";

const propertyId = "5b6d4d8f-82c1-4f24-8c2f-5a6d0e0f7b11";
const applicationId = "2f1d4f7a-8b2a-4f31-9d4c-6b7c8d9e0f11";
const applicantId = "6a4d3b2c-1e0f-4a5b-8c7d-9e0f1a2b3c4d";
const managerId = "7b5e4c3d-2f1a-4b6c-9d8e-0f1a2b3c4d5e";

test("application payload maps local form values to strict backend enums", () => {
  const payload = toBackendApplicationPayload(propertyId, {
    phone: "+234 803 000 0000", address: "12 Broad Street, Lagos",
    occupants: "2", employment: "Self-employed", employer: "My business",
    job: "Consultant", income: "₦250,000 – ₦500,000", note: "Moving soon"
  }, "2026-12-10", [{ uploadId: applicantId, documentType: "identity", displayName: "ID.jpg" }]);
  assert.equal(payload.propertyId, propertyId);
  assert.equal(payload.occupantsCount, 2);
  assert.equal(payload.employmentStatus, "self_employed");
  assert.equal(payload.incomeBand, "250k_500k");
  assert.equal(payload.documents[0].documentType, "identity");
  assert.equal(payload.desiredMoveInDate, "2026-12-10");
});

test("application payload rejects missing private address and invalid occupants", () => {
  assert.throws(() => toBackendApplicationPayload(propertyId, {
    phone: "+234 803 000 0000", address: "", occupants: "1", employment: "Employed"
  }, ""), /current residential address/);
  assert.throws(() => toBackendApplicationPayload(propertyId, {
    phone: "+234 803 000 0000", address: "12 Broad Street", occupants: "0", employment: "Employed"
  }, ""), /number of occupants/);
});

test("backend application rows map to the renter and manager application view model", () => {
  const row = {
    id: applicationId, propertyId, applicantUserId: applicantId, status: "shortlisted",
    applicantPhone: "+234 803 000 0000", currentAddress: "12 Broad Street, Lagos",
    occupantsCount: 2, employmentStatus: "self_employed", employerName: "My business",
    jobTitle: "Consultant", incomeBand: "250k_500k", desiredMoveInDate: "2026-12-10",
    applicantNote: "Moving soon", currency: "NGN", submittedAt: "2026-11-26T10:00:00.000Z",
    createdAt: "2026-11-26T10:00:00.000Z", updatedAt: "2026-11-26T11:00:00.000Z"
  };
  const listing = { id: propertyId, title: "Palm Court", city: "Lagos", price: 1200000, thumb: "https://example.com/home.jpg", images: [] };
  const app = toBackendApplicationViewModel(row, listing, { name: "Applicant A" }, 1500000);
  assert.equal(app.status, "Shortlisted");
  assert.equal(app.name, "Applicant A");
  assert.equal(app.uid, applicantId);
  assert.equal(app.moveIn, "2026-12-10");
  assert.equal(app.amount, 1500000);
  assert.equal(app.details.address, "12 Broad Street, Lagos");
  assert.equal(backendApplicationStatus("Approved"), "approved");
  assert.equal(backendApplicationStatus("Awaiting documents"), null);
});

test("offer thread maps counter history and the party whose turn it is", () => {
  const application = { id: applicationId, uid: applicantId, listingId: propertyId, title: "Palm Court", area: "Lagos", name: "Applicant A", rent: 1200000 };
  const offers = [
    { id: "11111111-1111-4111-8111-111111111111", applicationId, parentOfferId: null, createdByUserId: managerId, recipientUserId: applicantId, rentAmount: 1100000, currency: "NGN", rentPeriod: "yearly", depositAmount: 100000, leaseMonths: 12, proposedMoveInDate: null, message: "Offer", status: "superseded", createdAt: "2026-11-26T10:00:00.000Z", updatedAt: "2026-11-26T10:05:00.000Z" },
    { id: "22222222-2222-4222-8222-222222222222", applicationId, parentOfferId: "11111111-1111-4111-8111-111111111111", createdByUserId: applicantId, recipientUserId: managerId, rentAmount: 1050000, currency: "NGN", rentPeriod: "yearly", depositAmount: 100000, leaseMonths: 12, proposedMoveInDate: null, message: "My counter", status: "pending", createdAt: "2026-11-26T10:05:00.000Z", updatedAt: "2026-11-26T10:05:00.000Z" }
  ];
  const thread = toBackendOfferThread(application, offers, { price: 1200000, title: "Palm Court" }, {}, managerId);
  assert.equal(thread.status, "Pending");
  assert.equal(thread.turn, "owner");
  assert.equal(thread.amount, 1050000);
  assert.equal(thread.history.length, 2);
  assert.equal(thread.history[1].type, "counter");
  assert.equal(thread._latestOffer.id, offers[1].id);
});

test("accepted backend offer is terminal and keeps its agreed amount", () => {
  const application = { id: applicationId, uid: applicantId, listingId: propertyId, title: "Palm Court", area: "Lagos", rent: 1200000 };
  const offer = { id: "33333333-3333-4333-8333-333333333333", applicationId, parentOfferId: null, createdByUserId: managerId, recipientUserId: applicantId, rentAmount: 1100000, currency: "NGN", rentPeriod: "yearly", depositAmount: 100000, leaseMonths: 12, status: "accepted", createdAt: "2026-11-26T10:00:00.000Z", respondedAt: "2026-11-26T10:10:00.000Z", updatedAt: "2026-11-26T10:10:00.000Z" };
  const thread = toBackendOfferThread(application, [offer], { price: 1200000 }, {}, applicantId);
  assert.equal(thread.status, "Accepted");
  assert.equal(thread.turn, "");
  assert.equal(thread.history.at(-1).type, "accept");
});
