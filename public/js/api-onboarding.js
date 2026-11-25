import { apiPost } from "./api-client.js";

const roles = new Set(["renter", "landlord", "agent", "agency"]);

export async function submitBackendOnboarding(details, { signal } = {}) {
  if (!details || !roles.has(details.role)) throw new TypeError("Choose a valid Faxton account type.");
  const data = await apiPost("/v1/me/onboarding", details, { signal });
  if (!data || data.role !== details.role || data.onboardingComplete !== true) {
    throw new TypeError("Faxton API returned an invalid onboarding response.");
  }
  return data;
}
