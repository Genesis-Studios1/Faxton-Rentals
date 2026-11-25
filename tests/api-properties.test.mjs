import test from "node:test";
import assert from "node:assert/strict";
import { toListingViewModel } from "../public/js/api-property-mapper.js";

test("maps backend property fields to the legacy listing view model without inventing media", () => {
  const listing = toListingViewModel({
    id: "6b4d6b8a-4b7d-4a8d-9b5e-2a2f3b4c5d6e",
    ownerUserId: "owner-1", listedByUserId: "agent-1", title: "Palm Court",
    description: "A family home", propertyType: "house", listingMode: "long_term",
    status: "published", priceAmount: "2500000", currency: "NGN", pricePeriod: "yearly",
    bedrooms: 3, bathrooms: 2, addressLine: "12 Palm Road", city: "Lagos",
    state: "Lagos", country: "Nigeria", latitude: "6.5", longitude: "3.3"
  });
  assert.equal(listing.status, "active");
  assert.equal(listing.price, 2500000);
  assert.equal(listing.ownerUid, "owner-1");
  assert.equal(listing.area, "Lagos, Lagos");
  assert.deepEqual(listing.images, []);
  assert.equal(listing.source, "backend");
});

test("rejects malformed backend property records", () => {
  assert.throws(() => toListingViewModel(null), /Invalid property/);
  assert.throws(() => toListingViewModel({ title: "Missing id" }), /Invalid property/);
});
