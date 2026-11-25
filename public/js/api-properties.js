import { apiGet, apiPost, apiPatch, apiPut, apiDelete } from "./api-client.js";
import { toListingViewModel, toPropertyImageViewModel, toPropertyVideoViewModel, toBackendPropertyPayload } from "./api-property-mapper.js";
export { toListingViewModel, toBackendPropertyPayload } from "./api-property-mapper.js";

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

export async function createBackendPropertyFromListing(listing, { signal } = {}) {
  const payload = toBackendPropertyPayload(listing);
  return toListingViewModel(await apiPost("/v1/properties", payload, { signal }));
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


export async function listBackendPropertyVideos(propertyId, { signal, managed = false } = {}) {
  if (!/^[0-9a-f-]{36}$/i.test(String(propertyId))) throw new TypeError("Invalid property identifier.");
  const path = managed ? `/v1/me/properties/${encodeURIComponent(propertyId)}/videos` : `/v1/properties/${encodeURIComponent(propertyId)}/videos`;
  const data = await apiGet(path, { authenticated: managed, signal });
  if (!Array.isArray(data)) throw new TypeError("Faxton API returned invalid property videos.");
  return data.map(toPropertyVideoViewModel);
}

export async function uploadBackendPropertyVideo(propertyId, file, { signal } = {}) {
  if (!/^[0-9a-f-]{36}$/i.test(String(propertyId))) throw new TypeError("Invalid property identifier.");
  if (!(file instanceof Blob) || !["video/mp4", "video/webm"].includes(file.type)) throw new TypeError("Choose an MP4 or WebM video file.");
  if (file.size < 1 || file.size > 25 * 1024 * 1024) throw new TypeError("Property videos must be 25 MB or smaller.");
  const form = new FormData();
  form.append("file", file, file.name || "property-video");
  return apiPost(`/v1/me/properties/${encodeURIComponent(propertyId)}/videos`, form, { signal });
}

export async function deleteBackendPropertyVideo(propertyId, mediaId, { signal } = {}) {
  if (!/^[0-9a-f-]{36}$/i.test(String(propertyId)) || !/^[0-9a-f-]{36}$/i.test(String(mediaId))) throw new TypeError("Invalid property video identifier.");
  return apiDelete(`/v1/me/properties/${encodeURIComponent(propertyId)}/videos/${encodeURIComponent(mediaId)}`, { signal });
}

export async function getBackendPropertyWithMedia(propertyId, { signal, managed = false } = {}) {
  const propertyPromise = managed
    ? listMyBackendProperties({ signal }).then((items) => items.find((item) => item.id === propertyId))
    : getBackendProperty(propertyId, { signal });
  const [property, images, videos] = await Promise.all([
    propertyPromise,
    listBackendPropertyImages(propertyId, { signal, managed }),
    listBackendPropertyVideos(propertyId, { signal, managed })
  ]);
  if (!property) throw new Error("Managed property not found.");
  const orderedImages = images.sort((a, b) => a.displayOrder - b.displayOrder);
  const orderedVideos = videos.sort((a, b) => a.displayOrder - b.displayOrder);
  return { ...property, images: orderedImages.map((item) => item.url), videos: orderedVideos.map((item) => item.url), imageMedia: orderedImages, videoMedia: orderedVideos, thumb: orderedImages[0]?.url || "" };
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

export async function listBackendAgentAuthorisations({ signal } = {}) {
  const data = await apiGet("/v1/me/agent-authorisations", { signal });
  if (!Array.isArray(data)) throw new TypeError("Faxton API returned invalid agent authorisations.");
  return data.filter((item) => item && item.status === "accepted" && typeof (item.landlordUserId || item.landlord_user_id) === "string");
}

export async function submitBackendPropertyForReview(propertyId, { signal } = {}) {
  if (!/^[0-9a-f-]{36}$/i.test(String(propertyId))) throw new TypeError("Invalid property identifier.");
  const data = await apiPost(`/v1/me/properties/${encodeURIComponent(propertyId)}/submit`, {}, { signal });
  return toListingViewModel(data);
}

export async function listBackendPropertyMedia(propertyIds, { signal } = {}) {
  const ids = [...new Set((propertyIds || []).map((id) => String(id)))];
  if (!ids.length) return [];
  if (ids.length > 20 || ids.some((id) => !/^[0-9a-f-]{36}$/i.test(id))) throw new TypeError("Invalid property media batch.");
  const params = new URLSearchParams({ propertyIds: ids.join(",") });
  const data = await apiGet(`/v1/properties/media?${params.toString()}`, { authenticated: false, signal });
  if (!Array.isArray(data)) throw new TypeError("Faxton API returned invalid batched property media.");
  return data.map((group) => {
    if (!group || typeof group.propertyId !== "string" || !ids.includes(group.propertyId)) throw new TypeError("Invalid property media group.");
    return {
      propertyId: group.propertyId,
      images: Array.isArray(group.images) ? group.images.map(toPropertyImageViewModel).sort((x, y) => x.displayOrder - y.displayOrder).map((item) => item.url) : [],
      videos: Array.isArray(group.videos) ? group.videos.map(toPropertyVideoViewModel).sort((x, y) => x.displayOrder - y.displayOrder).map((item) => item.url) : []
    };
  });
}
