const asNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

// Translate the backend's canonical property shape into the legacy listing view model.
// Media is intentionally not fabricated: this API adapter does not invent image URLs.
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
    images: [], videos: [], amenities: [],
    createdAt: property.createdAt || null,
    updatedAt: property.updatedAt || null,
    source: "backend"
  };
}
