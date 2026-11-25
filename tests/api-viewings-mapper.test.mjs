import assert from "node:assert/strict";
import { test } from "node:test";
import { localDateTime, toViewingViewModel, toBackendTourType, toLocalViewingTime } from "../public/js/api-viewings-mapper.js";

test("Lagos viewing times convert to the correct UTC instant", () => {
  assert.equal(localDateTime("2026-12-01", "10:00 AM"), "2026-12-01T09:00:00.000Z");
  assert.equal(localDateTime("2026-12-01", "2:00 PM"), "2026-12-01T13:00:00.000Z");
});
test("viewing lifecycle maps to the existing renter UI", () => {
  const v = toViewingViewModel({
    id: "4c0d7e5c-33d0-4e4c-93a9-5e4c30baf912", propertyId: "4c0d7e5c-33d0-4e4c-93a9-5e4c30baf913",
    renterUserId: "renter-1", propertyTitle: "Palm Court", propertyCity: "Lagos",
    tourType: "in_person", requestedStartAt: "2026-12-01T09:00:00.000Z", requestedEndAt: null,
    contactPhone: "08030000000", renterNote: "Please call", assignedAgentUserId: "agent-1",
    status: "confirmed", checkedInAt: "2026-12-01T09:05:00.000Z", checkedOutAt: null,
    sosRaisedAt: "2026-12-01T09:10:00.000Z", sosResolvedAt: null, rating: null,
    ratingNote: null, createdAt: "2026-11-26T10:00:00.000Z"
  }, { thumb: "https://example.com/home.webp", agent: { name: "Agent A", verified: true } });
  assert.equal(v.when, "2026-12-01"); assert.equal(v.slot, "10:00 AM"); assert.equal(v.status, "Confirmed");
  assert.equal(v.checkIn.at, Date.parse("2026-12-01T09:05:00.000Z")); assert.equal(v.sos.resolved, false);
  assert.equal(v.image, "https://example.com/home.webp"); assert.equal(v.agentName, "Agent A");
});
test("tour type maps to backend enum", () => {
  assert.equal(toBackendTourType("Virtual tour"), "video"); assert.equal(toBackendTourType("Phone tour"), "phone");
  assert.equal(toBackendTourType("In-person tour"), "in_person");
});
test("invalid dates and response rows are rejected", () => {
  assert.throws(() => localDateTime("not-a-date", "10:00 AM"), /valid viewing date and time/);
  assert.throws(() => toViewingViewModel({ id: "bad", propertyId: "bad" }), /invalid viewing/);
});

test("proposed viewing times are formatted in Lagos time", () => {
  assert.deepEqual(toLocalViewingTime("2026-12-01T09:00:00.000Z"), { when: "2026-12-01", slot: "10:00 AM" });
});
