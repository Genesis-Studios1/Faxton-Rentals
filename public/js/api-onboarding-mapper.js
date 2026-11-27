const roles = new Set(["renter", "landlord", "agent", "agency"]);

export function toBackendOnboardingPayload(legacy = {}, user = {}) {
  const roleAliases = { business: "agency", homeowner: "landlord" };
  const requestedRole = roleAliases[legacy.role] || legacy.role;
  const role = roles.has(requestedRole) ? requestedRole : "renter";
  const agent = legacy.agentInfo || {};
  const agency = legacy.agency || {};
  const payload = {
    role,
    displayName: String(legacy.name || user.displayName || "").trim() || undefined,
    phoneNumber: String(legacy.phone || agent.phone || agency.phone || "").trim() || undefined,
    serviceArea: String(legacy.location || legacy.area || agent.areas || agency.city || "").trim() || undefined
  };
  if (role === "agency") {
    if (!String(agency.business || "").trim()) {
      throw new Error("Your agency profile needs its business name before account setup can finish.");
    }
    payload.agencyProfile = {
      businessName: String(agency.business).trim(),
      businessType: String(agency.businessType || "real_estate").trim(),
      registrationNumber: String(agency.cac || "").trim() || null,
      supportEmail: String(agency.supportEmail || "").trim() || null,
      supportPhone: String(agency.phone || "").trim() || null,
      officeAddress: String(agency.address || "").trim() || null,
      serviceLocation: [agency.city, agency.state, agency.country].filter(Boolean).join(", ") || null
    };
  }
  return payload;
}
