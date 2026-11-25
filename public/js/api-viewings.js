import { apiGet, apiPost } from "./api-client.js";
import { localDateTime } from "./api-viewings-mapper.js";
const validId = (id) => { if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(id || ""))) throw new Error("This viewing or property is not linked to a valid backend record yet."); return id; };
const list = async (path) => { const result = await apiGet(path); if (!Array.isArray(result?.data)) throw new Error("The backend returned an invalid viewing list."); return result.data; };
export const listBackendViewings = (options = {}) => list(`/v1/me/viewings?limit=${Math.min(100, Math.max(1, Number(options.limit) || 100))}&offset=${Math.max(0, Number(options.offset) || 0)}`);
export const listBackendOwnerViewings = (options = {}) => list(`/v1/owner/viewings?limit=${Math.min(100, Math.max(1, Number(options.limit) || 100))}&offset=${Math.max(0, Number(options.offset) || 0)}`);
export async function createBackendViewing(propertyId, input) {
  validId(propertyId);
  const result = await apiPost(`/v1/properties/${propertyId}/viewings`, {
    tourType: input.tourType, requestedStartAt: input.requestedStartAt,
    contactPhone: String(input.contactPhone || "").trim(), ...(input.renterNote ? { renterNote: String(input.renterNote).slice(0, 2000) } : {})
  });
  if (!result?.id) throw new Error("The backend did not confirm the viewing request.");
  return result;
}
export const confirmBackendViewing = (id) => apiPost(`/v1/viewings/${validId(id)}/confirm`, {});
export const declineBackendViewing = (id) => apiPost(`/v1/viewings/${validId(id)}/decline`, {});
export const cancelBackendViewing = (id) => apiPost(`/v1/viewings/${validId(id)}/cancel`, {});
export const checkInBackendViewing = (id) => apiPost(`/v1/viewings/${validId(id)}/check-in`, {});
export const checkOutBackendViewing = (id) => apiPost(`/v1/viewings/${validId(id)}/check-out`, {});
export const raiseBackendViewingSos = (id) => apiPost(`/v1/viewings/${validId(id)}/sos`, {});
export const resolveBackendViewingSos = (id) => apiPost(`/v1/viewings/${validId(id)}/sos/resolve`, {});
export const rateBackendViewing = (id, rating, note = "") => apiPost(`/v1/viewings/${validId(id)}/rating`, { rating, ...(note ? { note: String(note).slice(0, 1000) } : {}) });
export const requestBackendViewingReschedule = (id, date, slot, note = "") => apiPost(`/v1/viewings/${validId(id)}/reschedule-requests`, {
  proposedStartAt: localDateTime(date, slot), ...(note ? { note: String(note).slice(0, 1000) } : {})
});
export const respondBackendViewingReschedule = (id, requestId, decision) => apiPost(`/v1/viewings/${validId(id)}/reschedule-requests/${validId(requestId)}/respond`, { decision });
export const listBackendViewingReschedules = (id) => apiGet(`/v1/viewings/${validId(id)}/reschedule-requests`);
