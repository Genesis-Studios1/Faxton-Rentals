import test from "node:test";
import assert from "node:assert/strict";
import { toListingViewModel, toPropertyImageViewModel, toPropertyVideoViewModel, toProfileViewModel } from "../public/js/api-property-mapper.js";

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
