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
