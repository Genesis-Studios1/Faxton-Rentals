import { apiGet, apiPost, apiPatch, apiPut, apiDelete } from "./api-client.js";
import { toListingViewModel, toPropertyImageViewModel } from "./api-property-mapper.js";
export { toListingViewModel } from "./api-property-mapper.js";

export async function listMyBackendProperties({ signal } = {}) {
  const data = await apiGet("/v1/me/properties", { signal });
  if (!Array.isArray(data)) throw new TypeError("Faxton API returned an invalid managed property list.");
  return data.map(toListingViewModel);
}

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


export async function listBackendPropertyImages(propertyId, { signal, managed = false } = {}) {
  if (!/^[0-9a-f-]{36}$/i.test(String(propertyId))) throw new TypeError("Invalid property identifier.");
  const path = managed ? `/v1/me/properties/${encodeURIComponent(propertyId)}/images` : `/v1/properties/${encodeURIComponent(propertyId)}/images`;
  const data = await apiGet(path, { authenticated: managed, signal });
  if (!Array.isArray(data)) throw new TypeError("Faxton API returned invalid property media.");
  return data.map(toPropertyImageViewModel);
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


export async function getBackendPropertyWithImages(propertyId, { signal, managed = false } = {}) {
  const propertyPromise = managed
    ? listMyBackendProperties({ signal }).then((items) => items.find((item) => item.id === propertyId))
    : getBackendProperty(propertyId, { signal });
  const [property, media] = await Promise.all([
    propertyPromise,
    listBackendPropertyImages(propertyId, { signal, managed })
  ]);
  if (!property) throw new Error("Managed property not found.");
  const images = media.sort((a, b) => a.displayOrder - b.displayOrder).map((item) => item.url);
  return { ...property, images, thumb: images[0] || "" };
}
