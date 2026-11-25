import test from "node:test";
import assert from "node:assert/strict";
import { toListingViewModel, toPropertyImageViewModel, toPropertyVideoViewModel, toProfileViewModel, toBackendPropertyPayload } from "../public/js/api-property-mapper.js";

test("maps backend property fields to the legacy listing view model without inventing media", () => {
  const listing = toListingViewModel({
    id: "6b4d6b8a-4b7d-4a8d-9b5e-2a2f3b4c5d6e",
    ownerUserId: "owner-1", listedByUserId: "agent-1", title: "Palm Court",
    description: "A family home", propertyType: "house", listingMode: "long_term",
    status: "published", priceAmount: "2500000", currency: "NGN", pricePeriod: "yearly",
    bedrooms: 3, bathrooms: 2, addressLine: "12 Palm Road", city: "Lagos",
    state: "Lagos", country: "Nigeria", latitude: "6.5", longitude: "3.3",
    propertySubtype: "Apartment", buildingType: "Block of flats", floorLabel: "2nd floor",
    parkingSpaces: 2, sizeSqm: "120", furnishingStatus: "furnished",
    serviceChargeAmount: "350000", cautionDepositAmount: "200000",
    amenities: ["Security"], features: [{ name: "Bedrooms", count: 3 }]
  });
  assert.equal(listing.status, "active");
  assert.equal(listing.price, 2500000);
  assert.equal(listing.ownerUid, "owner-1");
  assert.equal(listing.area, "Lagos, Lagos");
  assert.equal(listing.type, "Apartment");
  assert.equal(listing.buildingType, "Block of flats");
  assert.equal(listing.floor, "2nd floor");
  assert.equal(listing.sqm, 120);
  assert.equal(listing.service, 350000);
  assert.deepEqual(listing.amenities, ["Security"]);
  assert.deepEqual(listing.features, [{ name: "Bedrooms", count: 3 }]);
  assert.deepEqual(listing.images, []);
  assert.equal(listing.source, "backend");
});

test("rejects malformed backend property records", () => {
  assert.throws(() => toListingViewModel(null), /Invalid property/);
  assert.throws(() => toListingViewModel({ title: "Missing id" }), /Invalid property/);
});


test("maps only secure, valid property image URLs", () => {
  assert.deepEqual(toPropertyImageViewModel({ id: "img-1", url: "https://cdn.example/image.webp", displayOrder: "2", contentType: "image/webp", byteSize: "1234" }), {
    id: "img-1", url: "https://cdn.example/image.webp", displayOrder: 2, contentType: "image/webp", byteSize: 1234
  });
  assert.throws(() => toPropertyImageViewModel({ id: "img-2", url: "http://insecure.example/image.jpg" }), /Invalid property image/);
  assert.throws(() => toPropertyImageViewModel({ id: "img-3", url: "javascript:alert(1)" }), /Invalid property image/);
});


test("maps the authenticated backend profile without exposing another user's profile", () => {
  const profile = toProfileViewModel({
    id: "user-1", email: "member@example.com", displayName: "Member", role: "landlord",
    phoneNumber: "+2348000000000",
    profile: { bio: "Owner", avatarUrl: "https://cdn.example/avatar.webp", websiteUrl: null, serviceArea: "Lagos" },
    verification: { emailVerified: true, phoneVerified: false, accountStatus: "active" },
    settings: { emailNotifications: true }, agency: null
  });
  assert.equal(profile.uid, "user-1");
  assert.equal(profile.name, "Member");
  assert.equal(profile.photo, "https://cdn.example/avatar.webp");
  assert.equal(profile.role, "landlord");
  assert.throws(() => toProfileViewModel(null), /Invalid profile/);
});


test("maps only secure MP4 and WebM property video URLs", () => {
  assert.deepEqual(toPropertyVideoViewModel({ id: "video-1", url: "https://cdn.example/tour.mp4", displayOrder: "1", contentType: "video/mp4", byteSize: "5000" }), {
    id: "video-1", url: "https://cdn.example/tour.mp4", displayOrder: 1, contentType: "video/mp4", byteSize: 5000
  });
  assert.throws(() => toPropertyVideoViewModel({ id: "video-2", url: "http://cdn.example/tour.mp4", contentType: "video/mp4" }), /Invalid property video/);
  assert.throws(() => toPropertyVideoViewModel({ id: "video-3", url: "https://cdn.example/tour.exe", contentType: "application/octet-stream" }), /Invalid property video/);
});


test("maps the legacy listing form into the complete backend property payload", () => {
  const payload = toBackendPropertyPayload({
    title: "Palm Court", desc: "Family apartment", type: "Apartment",
    price: 2500000, beds: 3, baths: 2, addressLine: "12 Palm Road",
    city: "Lagos", state: "Lagos", country: "Nigeria",
    buildingType: "Block of flats", floor: "2nd floor", roomNumber: "Flat 4B",
    yearBuilt: 2022, parking: 2, sqm: 120, furnished: "Semi-furnished",
    floorPlan: "https://example.test/floor-plan.pdf", service: 350000, deposit: 200000,
    amenities: ["Security"], features: [{ name: "Bedrooms", count: 3 }]
  });
  assert.equal(payload.propertyType, "apartment");
  assert.equal(payload.pricePeriod, "yearly");
  assert.equal(payload.floorLabel, "2nd floor");
  assert.equal(payload.furnishingStatus, "semi_furnished");
  assert.equal(payload.agencyFeePercent, 10);
  assert.equal(payload.legalFeePercent, 5);
  assert.deepEqual(payload.amenities, ["Security"]);
  assert.deepEqual(payload.features, [{ name: "Bedrooms", count: 3 }]);
});

test("requires a real street address before migrating a property listing", () => {
  assert.throws(() => toBackendPropertyPayload({
    title: "Palm Court", type: "Apartment", price: 2500000, city: "Lagos", state: "Lagos"
  }), /full street address is required/);
});


test("keeps property type separate from rental listing mode and preserves authorised owner", () => {
  const payload = toBackendPropertyPayload({
    title: "Shortlet Studio", type: "Studio", propertyType: "room",
    listingMode: "shortlet", price: 45000, addressLine: "4 Example Street",
    city: "Lagos", state: "Lagos", country: "Nigeria",
    ownerUserId: "11111111-1111-4111-8111-111111111111"
  });
  assert.equal(payload.propertyType, "room");
  assert.equal(payload.propertySubtype, "Studio");
  assert.equal(payload.listingMode, "shortlet");
  assert.equal(payload.ownerUserId, "11111111-1111-4111-8111-111111111111");
});

test("does not infer shortlet mode from a property category", () => {
  const payload = toBackendPropertyPayload({
    title: "Studio apartment", type: "Studio", propertyType: "room",
    price: 900000, addressLine: "4 Example Street", city: "Lagos", state: "Lagos"
  });
  assert.equal(payload.listingMode, "long_term");
});
