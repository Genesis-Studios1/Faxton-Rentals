import test from "node:test";
import assert from "node:assert/strict";
import { LISTING_MEDIA_LIMITS, validateListingMedia, collectListingFeatures } from "../public/js/listing-media-core.js";

const file = (type, size) => ({ type, size });

test("listing media accepts supported photos and videos within limits", () => {
  assert.equal(validateListingMedia([file("image/jpeg", 1024)], [file("video/mp4", 2048)], 2, 1), "");
});

test("listing media counts links and uploads together", () => {
  assert.match(validateListingMedia(Array.from({ length: 2 }, () => file("image/png", 100)), [], 19, 0), /20 photos/);
  assert.match(validateListingMedia([], Array.from({ length: 2 }, () => file("video/mp4", 100)), 0, 5), /6 videos/);
});

test("listing media rejects unsupported formats and oversized files", () => {
  assert.match(validateListingMedia([file("image/gif", 100)]), /JPG, PNG or WebP/);
  assert.match(validateListingMedia([file("image/jpeg", LISTING_MEDIA_LIMITS.imageBytes + 1)]), /15 MB/);
  assert.match(validateListingMedia([], [file("video/avi", 100)]), /MP4, WebM or MOV/);
  assert.match(validateListingMedia([], [file("video/mp4", LISTING_MEDIA_LIMITS.videoBytes + 1)]), /100 MB/);
});

test("structured features include bedrooms, bathrooms and countable amenities", () => {
  assert.deepEqual(collectListingFeatures({
    bedrooms: 3, bathrooms: 4, kitchens: 2, parlours: 1, swimmingPools: 1, gardens: 2, parking: 3
  }), [
    { name: "Bedrooms", count: 3 }, { name: "Bathrooms", count: 4 },
    { name: "Kitchen", count: 2 }, { name: "Parlour", count: 1 },
    { name: "Swimming pool", count: 1 }, { name: "Garden", count: 2 },
    { name: "Parking spaces", count: 3 }
  ]);
});

test("custom features are trimmed, merged case-insensitively and bounded", () => {
  assert.deepEqual(collectListingFeatures({}, [
    { name: " Balconies ", count: 2 }, { name: "balconies", count: 1 }, { name: " ", count: 5 }
  ]), [{ name: "Balconies", count: 3 }]);
  assert.throws(() => collectListingFeatures({}, Array.from({ length: 26 }, (_, i) => ({ name: `Feature ${i}`, count: 1 }))), /25 countable features/);
});
