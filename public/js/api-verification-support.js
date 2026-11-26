import { apiGet, apiPost, apiPatch, apiRequest } from "./api-client.js";
import { isBackendUuid, toVerificationSubmission, toSupportCasePayload } from "./api-verification-support-mapper.js";

const uuid = isBackendUuid;
const record = (value, label) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`The backend returned an invalid ${label}.`);
  return value;
};
const rows = (value, label) => {
  if (!Array.isArray(value)) throw new TypeError(`The backend returned an invalid ${label} list.`);
  return value;
};

export async function uploadBackendVerificationDocument(file) {
  if (!(file instanceof Blob) || !file.size || file.size > 10 * 1024 * 1024) throw new TypeError("Choose a document up to 10 MB.");
  const allowed = new Set(["application/pdf", "image/jpeg", "image/png"]);
  if (!allowed.has(String(file.type).toLowerCase())) throw new TypeError("Use a PDF, JPG or PNG document.");
  const form = new FormData();
  form.append("file", file, file.name || "verification-document");
  const result = record(await apiPost("/v1/uploads/verification-document", form), "document upload");
  if (!uuid(result.uploadId) || result.status !== "verified") throw new TypeError("The uploaded document could not be verified by the backend.");
  return { uploadId: result.uploadId, contentType: result.contentType, contentLength: result.contentLength };
}

export async function submitBackendVerification(input) {
  return record(await apiPost("/v1/me/verifications", toVerificationSubmission(input)), "verification case");
}
export async function listBackendVerifications() {
  return rows(await apiGet("/v1/me/verifications"), "verification");
}
export async function listBackendVerificationQueue({ status = "pending", subjectType, limit = 50, offset = 0 } = {}) {
  const q = new URLSearchParams({ status, limit: String(limit), offset: String(offset) });
  if (subjectType) q.set("subjectType", subjectType);
  return rows(await apiGet(`/v1/admin/verifications?${q}`), "verification queue");
}
export async function getBackendVerificationCase(caseId) {
  if (!uuid(caseId)) throw new TypeError("Invalid verification case.");
  return record(await apiGet(`/v1/admin/verifications/${encodeURIComponent(caseId)}`), "verification details");
}
export async function reviewBackendVerification(caseId, { status, reason }) {
  if (!uuid(caseId) || !["approved", "rejected", "needs_resubmission"].includes(status) || String(reason || "").trim().length < 8) throw new TypeError("Provide a valid verification decision and reason.");
  return record(await apiPost(`/v1/admin/verifications/${encodeURIComponent(caseId)}/review`, { status, reason: String(reason).trim() }), "verification decision");
}

export async function createBackendSupportCase(input) {
  return record(await apiPost("/v1/support/cases", toSupportCasePayload(input)), "support case");
}
export async function listBackendSupportCases({ limit = 50, offset = 0 } = {}) {
  const q = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  return rows(await apiGet(`/v1/me/support/cases?${q}`), "support cases");
}
export async function listBackendAdminSupportCases({ status, limit = 50, offset = 0 } = {}) {
  const q = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (status) q.set("status", status);
  return rows(await apiGet(`/v1/admin/support/cases?${q}`), "support case queue");
}
export async function getBackendSupportCase(caseId) {
  if (!uuid(caseId)) throw new TypeError("Invalid support case.");
  return record(await apiRequest(`/v1/support/cases/${encodeURIComponent(caseId)}`, { method: "GET", unwrapData: false }), "support case details");
}
export async function listBackendSupportCaseEvents(caseId) {
  if (!uuid(caseId)) throw new TypeError("Invalid support case.");
  return rows(await apiGet(`/v1/support/cases/${encodeURIComponent(caseId)}/events`), "support case events");
}
export async function sendBackendSupportMessage(caseId, body) {
  if (!uuid(caseId) || !String(body || "").trim()) throw new TypeError("Write a message first.");
  return record(await apiPost(`/v1/support/cases/${encodeURIComponent(caseId)}/messages`, { body: String(body).trim() }), "support message");
}
export async function updateBackendSupportCase(caseId, changes) {
  if (!uuid(caseId) || String(changes.reason || "").trim().length < 8) throw new TypeError("A reason is required for case updates.");
  const payload = { ...changes, reason: String(changes.reason).trim() };
  return record(await apiPatch(`/v1/admin/support/cases/${encodeURIComponent(caseId)}`, payload), "support case update");
}
