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
    type: property.propertySubtype || property.propertyType,
    propertyType: property.propertyType,
    propertySubtype: property.propertySubtype || "",
    buildingType: property.buildingType || "",
    floor: property.floorLabel || "",
    roomNumber: property.roomNumber || "",
    yearBuilt: property.yearBuilt ?? "",
    parking: property.parkingSpaces ?? "",
    sqm: property.sizeSqm ?? 0,
    furnished: property.furnishingStatus || "",
    floorPlan: property.floorPlanUrl || "",
    service: asNumber(property.serviceChargeAmount),
    deposit: asNumber(property.cautionDepositAmount),
    agencyFee: property.agencyFeeAmount ?? "",
    agencyFeePercent: asNumber(property.agencyFeePercent),
    legalFee: property.legalFeeAmount ?? "",
    legalFeePercent: asNumber(property.legalFeePercent),
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
    images: [], videos: [],
    amenities: Array.isArray(property.amenities) ? property.amenities : [],
    features: Array.isArray(property.features) ? property.features : [],
    createdAt: property.createdAt || null,
    updatedAt: property.updatedAt || null,
    source: "backend"
  };
}


export function toPropertyImageViewModel(image) {
  if (!image || typeof image !== "object" || typeof image.id !== "string" ||
      typeof image.url !== "string" || !/^https:\/\//i.test(image.url)) {
    throw new TypeError("Invalid property image returned by Faxton API.");
  }
  return {
    id: image.id,
    url: image.url,
    displayOrder: Number.isFinite(Number(image.displayOrder)) ? Number(image.displayOrder) : 0,
    contentType: String(image.contentType || ""),
    byteSize: Number.isFinite(Number(image.byteSize)) ? Number(image.byteSize) : 0
  };
}


export function toProfileViewModel(profile) {
  if (!profile || typeof profile !== "object" || typeof profile.id !== "string") {
    throw new TypeError("Invalid profile returned by Faxton API.");
  }
  return {
    id: profile.id,
    uid: profile.id,
    email: String(profile.email || ""),
    name: String(profile.displayName || ""),
    displayName: String(profile.displayName || ""),
    role: String(profile.role || "renter"),
    phone: profile.phoneNumber || "",
    phoneNumber: profile.phoneNumber || "",
    photo: profile.profile?.avatarUrl || "",
    bio: profile.profile?.bio || "",
    website: profile.profile?.websiteUrl || "",
    serviceArea: profile.profile?.serviceArea || "",
    verification: profile.verification || {},
    settings: profile.settings || {},
    agency: profile.agency || null
  };
}


export function toPropertyVideoViewModel(video) {
  if (!video || typeof video !== "object" || typeof video.id !== "string" ||
      typeof video.url !== "string" || !/^https:\/\//i.test(video.url) ||
      !["video/mp4", "video/webm"].includes(String(video.contentType || ""))) {
    throw new TypeError("Invalid property video returned by Faxton API.");
  }
  return {
    id: video.id,
    url: video.url,
    displayOrder: Number.isFinite(Number(video.displayOrder)) ? Number(video.displayOrder) : 0,
    contentType: String(video.contentType),
    byteSize: Number.isFinite(Number(video.byteSize)) ? Number(video.byteSize) : 0
  };
}
