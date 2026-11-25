import { apiGet, apiPost, apiPatch } from "./api-client.js";
import { toListingViewModel } from "./api-property-mapper.js";
export { toListingViewModel } from "./api-property-mapper.js";

export async function listBackendProperties({ city, propertyType, listingMode, limit = 20, offset = 0, signal } = {}) {
  const params = new URLSearchParams();
  if (city) params.set("city", city);
  if (propertyType) params.set("propertyType", propertyType);
  if (listingMode) params.set("listingMode", listingMode);
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  const data = await apiGet(`/v1/properties?${params.toString()}`, { authenticated: false, signal });
  if (!Array.isArray(data)) throw new TypeError("Faxton API returned an invalid property list.");
  return data.map(toListingViewModel);
}

export async function getBackendProperty(propertyId, { signal } = {}) {
  if (!/^[0-9a-f-]{36}$/i.test(String(propertyId))) throw new TypeError("Invalid property identifier.");
  const data = await apiGet(`/v1/properties/${encodeURIComponent(propertyId)}`, { authenticated: false, signal });
  return toListingViewModel(data);
}

export async function createBackendProperty(details, { signal } = {}) {
  return toListingViewModel(await apiPost("/v1/properties", details, { signal }));
}

export async function updateBackendProperty(propertyId, changes, { signal } = {}) {
  if (!/^[0-9a-f-]{36}$/i.test(String(propertyId))) throw new TypeError("Invalid property identifier.");
  return toListingViewModel(await apiPatch(`/v1/me/properties/${encodeURIComponent(propertyId)}`, changes, { signal }));
}


export async function listBackendPropertyImages(propertyId, { signal } = {}) {
  if (!/^[0-9a-f-]{36}$/i.test(String(propertyId))) throw new TypeError("Invalid property identifier.");
  const data = await apiGet(`/v1/properties/${encodeURIComponent(propertyId)}/images`, { authenticated: false, signal });
  if (!Array.isArray(data)) throw new TypeError("Faxton API returned invalid property media.");
  return data.map((image) => {
    if (!image || typeof image.id !== "string" || typeof image.url !== "string" || !/^https:\/\//i.test(image.url)) {
      throw new TypeError("Faxton API returned an invalid property image.");
    }
    return { id: image.id, url: image.url, displayOrder: Number(image.displayOrder) || 0, contentType: image.contentType, byteSize: Number(image.byteSize) || 0 };
  });
}

export async function uploadBackendPropertyImage(propertyId, file, { signal } = {}) {
  if (!/^[0-9a-f-]{36}$/i.test(String(propertyId))) throw new TypeError("Invalid property identifier.");
  if (!(file instanceof Blob)) throw new TypeError("Choose an image file to upload.");
  const form = new FormData();
  form.append("file", file, file.name || "property-image");
  return apiPost(`/v1/me/properties/${encodeURIComponent(propertyId)}/images`, form, { signal });
}

export async function reorderBackendPropertyImages(propertyId, mediaIds, { signal } = {}) {
  if (!/^[0-9a-f-]{36}$/i.test(String(propertyId)) || !Array.isArray(mediaIds)) throw new TypeError("Invalid property image order.");
  return apiPut(`/v1/me/properties/${encodeURIComponent(propertyId)}/images/order`, { mediaIds }, { signal });
}

export async function deleteBackendPropertyImage(propertyId, mediaId, { signal } = {}) {
  if (!/^[0-9a-f-]{36}$/i.test(String(propertyId)) || !/^[0-9a-f-]{36}$/i.test(String(mediaId))) throw new TypeError("Invalid property image identifier.");
  return apiDelete(`/v1/me/properties/${encodeURIComponent(propertyId)}/images/${encodeURIComponent(mediaId)}`, { signal });
}
