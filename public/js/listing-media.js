// Firebase Storage is not configured for this project yet.
// Keep this module fail-closed so the listing UI cannot silently attempt bucket uploads.
import { LISTING_MEDIA_LIMITS, validateListingMedia } from "./listing-media-core.js";

export async function uploadListingMedia() {
  throw new Error("Direct photo and video uploads are unavailable because Firebase Storage is not configured. Add publicly accessible HTTPS links instead.");
}

// No Storage objects can have been created while the feature is disabled.
export async function removeListingMedia() {
  return;
}

export { LISTING_MEDIA_LIMITS, validateListingMedia };
