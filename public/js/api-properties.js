import { apiGet, apiPost, apiPatch } from "./api-client.js";

const asNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

// Translate the backend's canonical property shape into the legacy listing view model.
// Media is intentionally not fabricated: the API listing is not enabled until media
// references are available from the backend.
export function toListingViewModel(property) {
  if (!property || typeof property !== "object" || typeof property.id !== "string") {
    throw new TypeError("Invalid property returned by Faxton API.");
  }
  return {
    id: property.id,
    ownerUid: property.ownerUserId || null,
    listedByUid: property.listedByUserId || null,
    title: String(property.title || ""),
    desc: String(property.description || ""),
    type: property.propertyType,
    listingMode: property.listingMode,
    status: property.status === "published" ? "active" : property.status,
    price: asNumber(property.priceAmount),
    currency: String(property.currency || "NGN"),
    pricePeriod: property.pricePeriod || "monthly",
    beds: property.bedrooms ?? 0,
    baths: property.bathrooms ?? 0,
    address: property.addressLine || "",
    area: [property.city, property.state].filter(Boolean).join(", "),
    city: property.city || "",
    state: property.state || "",
    country: property.country || "Nigeria",
    latitude: property.latitude == null ? null : asNumber(property.latitude),
    longitude: property.longitude == null ? null : asNumber(property.longitude),
    images: [],
    videos: [],
    amenities: [],
    createdAt: property.createdAt || null,
    updatedAt: property.updatedAt || null,
    source: "backend"
  };
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
  const data = await apiPost("/v1/properties", details, { signal });
  return toListingViewModel(data);
}

export async function updateBackendProperty(propertyId, changes, { signal } = {}) {
  if (!/^[0-9a-f-]{36}$/i.test(String(propertyId))) throw new TypeError("Invalid property identifier.");
  const data = await apiPatch(`/v1/me/properties/${encodeURIComponent(propertyId)}`, changes, { signal });
  return toListingViewModel(data);
}
