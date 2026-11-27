const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function listBackendSavedProperties({ signal } = {}) {
  const { apiGet } = await import("./api-client.js");
  const data = await apiGet("/v1/me/saved-properties", { signal });
  if (!Array.isArray(data)) throw new TypeError("Faxton API returned an invalid saved-property list.");
  return [...new Set(data.filter((id) => typeof id === "string" && idPattern.test(id)))];
}

export async function saveBackendProperty(propertyId, { signal } = {}) {
  if (typeof propertyId !== "string" || !idPattern.test(propertyId)) throw new TypeError("A valid property identifier is required.");
  const { apiPost } = await import("./api-client.js");
  const data = await apiPost("/v1/me/saved-properties", { propertyId }, { signal });
  if (data?.propertyId !== propertyId || data?.saved !== true) throw new TypeError("Faxton API returned an invalid save response.");
  return data;
}

export async function removeBackendSavedProperty(propertyId, { signal } = {}) {
  if (typeof propertyId !== "string" || !idPattern.test(propertyId)) throw new TypeError("A valid property identifier is required.");
  const { apiDelete } = await import("./api-client.js");
  const data = await apiDelete(`/v1/me/saved-properties/${propertyId}`, { signal });
  if (data?.propertyId !== propertyId || data?.saved !== false) throw new TypeError("Faxton API returned an invalid removal response.");
  return data;
}
