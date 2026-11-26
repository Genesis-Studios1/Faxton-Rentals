import { apiGet, apiPatch } from "./api-client.js";
import { toListingViewModel } from "./api-property-mapper.js";

const record = (value, label) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`The backend returned an invalid ${label}.`);
  return value;
};
const list = (value, label) => {
  if (!Array.isArray(value)) throw new TypeError(`The backend returned an invalid ${label} list.`);
  return value;
};

export async function listBackendAdminUsers({ search = "", role = "", status = "", limit = 25, offset = 0 } = {}) {
  const query = new URLSearchParams();
  if (search.trim()) query.set("search", search.trim());
  if (role) query.set("role", role);
  if (status) query.set("status", status);
  query.set("limit", String(limit));
  query.set("offset", String(offset));
  const result = await apiGet(`/v1/admin/users?${query.toString()}`);
  return list(result, "admin user");
}

export async function setBackendAdminUserStatus(userId, status, reason) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(userId || ""))) {
    throw new TypeError("The selected account has an invalid backend ID.");
  }
  if (!["active", "suspended"].includes(status)) throw new TypeError("Choose a valid account status.");
  const cleanReason = String(reason || "").trim();
  if (cleanReason.length < 8 || cleanReason.length > 500) throw new TypeError("Enter a reason between 8 and 500 characters.");
  const result = await apiPatch(`/v1/admin/users/${encodeURIComponent(userId)}/status`, { status, reason: cleanReason });
  return record(result, "account status response");
}

export async function listBackendAdminAuditLogs({ targetUserId = "", limit = 50, offset = 0 } = {}) {
  const query = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (targetUserId) query.set("targetUserId", targetUserId);
  const result = await apiGet(`/v1/admin/audit-logs?${query.toString()}`);
  return list(result, "admin audit log");
}

const propertyStatuses = ["draft", "pending_review", "published", "paused", "archived"];
export async function listBackendAdminProperties({ status = "", limit = 20, offset = 0 } = {}) {
  if (status && !propertyStatuses.includes(status)) throw new TypeError("Choose a valid property status.");
  if (!Number.isInteger(limit) || limit < 1 || limit > 50 || !Number.isInteger(offset) || offset < 0 || offset > 10000) {
    throw new TypeError("The property review page is outside the allowed range.");
  }
  const query = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (status) query.set("status", status);
  const result = await apiGet(`/v1/admin/properties?${query.toString()}`);
  return list(result, "admin property").map(toListingViewModel);
}

export async function setBackendAdminPropertyStatus(propertyId, status) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(propertyId || ""))) {
    throw new TypeError("The selected property has an invalid backend ID.");
  }
  if (!["published", "paused", "archived"].includes(status)) throw new TypeError("Choose a supported property status.");
  const result = await apiPatch(`/v1/admin/properties/${encodeURIComponent(propertyId)}/status`, { status });
  return toListingViewModel(record(result, "property status response"));
}
