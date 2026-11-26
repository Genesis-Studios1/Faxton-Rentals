import { apiGet, apiPost } from "./api-client.js";

const idOk = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
const rows = (value, label) => {
  if (!Array.isArray(value)) throw new TypeError(`Faxton API returned an invalid ${label} list.`);
  return value;
};
export async function uploadBackendApplicationDocument(dataUrl, displayName) {
  if (typeof dataUrl !== "string" || !/^data:(application\/pdf|image\/(?:jpeg|png));base64,/i.test(dataUrl)) {
    throw new TypeError("The application document could not be read. Please attach it again.");
  }
  const marker = ";base64,";
  const split = dataUrl.indexOf(marker);
  const mime = split > 5 ? dataUrl.slice(5, split).toLowerCase() : "";
  const encoded = split > 5 ? dataUrl.slice(split + marker.length) : "";
  if (!["application/pdf", "image/jpeg", "image/png"].includes(mime) || !/^[A-Za-z0-9+/=]+$/.test(encoded)) throw new TypeError("The application document data is invalid.");
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: mime });
  if (!blob.size || blob.size > 10 * 1024 * 1024) throw new TypeError("Application documents must be smaller than 10 MB.");
  const form = new FormData();
  const safeName = String(displayName || "application-document").replace(/[\\/\u0000-\u001f]/g, "_").slice(0,120) || "application-document";
  form.append("file", blob, safeName);
  const result = await apiPost("/v1/uploads/application-document", form);
  if (!idOk(result?.uploadId) || result.status !== "verified") throw new TypeError("The backend did not verify the uploaded application document.");
  return result.uploadId;
}
export async function createBackendApplication(payload) {
  const result = await apiPost("/v1/applications", payload);
  if (!idOk(result?.id) || result.status !== "under_review") throw new TypeError("The backend returned an invalid application confirmation.");
  return result;
}
export async function listBackendApplications({ owner = false, status, limit = 100, offset = 0 } = {}) {
  const q = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (status) q.set("status", status);
  const result = await apiGet(`/v1/${owner ? "owner" : "me"}/applications?${q}`);
  return rows(result, "rental application");
}
export async function withdrawBackendApplication(applicationId) {
  if (!idOk(applicationId)) throw new TypeError("Invalid application identifier.");
  return apiPost(`/v1/applications/${encodeURIComponent(applicationId)}/withdraw`, {});
}
export async function decideBackendApplication(applicationId, status) {
  if (!idOk(applicationId) || !["shortlisted","approved","rejected"].includes(status)) throw new TypeError("Invalid application decision.");
  return apiPost(`/v1/applications/${encodeURIComponent(applicationId)}/decision`, { status });
}
export async function listBackendApplicationDocuments(applicationId) {
  if (!idOk(applicationId)) throw new TypeError("Invalid application identifier.");
  const result = await apiGet(`/v1/applications/${encodeURIComponent(applicationId)}/documents`);
  return rows(result, "application document");
}
export async function getBackendApplicationDocumentUrl(applicationId, documentId) {
  if (!idOk(applicationId) || !idOk(documentId)) throw new TypeError("Invalid application document identifier.");
  const result = await apiGet(`/v1/applications/${encodeURIComponent(applicationId)}/documents/${encodeURIComponent(documentId)}/download`);
  if (typeof result?.url !== "string" || !/^https:\/\//i.test(result.url)) throw new TypeError("The backend returned an invalid document link.");
  return result.url;
}
export async function listBackendApplicationEvents(applicationId) {
  if (!idOk(applicationId)) throw new TypeError("Invalid application identifier.");
  return rows(await apiGet(`/v1/applications/${encodeURIComponent(applicationId)}/events`), "application event");
}
export async function createBackendOffer(applicationId, terms) {
  if (!idOk(applicationId)) throw new TypeError("Invalid application identifier.");
  const result = await apiPost(`/v1/applications/${encodeURIComponent(applicationId)}/offers`, terms);
  if (!idOk(result?.id) || result.status !== "pending") throw new TypeError("The backend returned an invalid offer confirmation.");
  return result;
}
export async function listBackendApplicationOffers(applicationId) {
  if (!idOk(applicationId)) throw new TypeError("Invalid application identifier.");
  return rows(await apiGet(`/v1/applications/${encodeURIComponent(applicationId)}/offers`), "rental offer");
}
export async function respondBackendOffer(offerId, action, terms, message = "") {
  if (!idOk(offerId) || !["accept","reject","counter"].includes(action)) throw new TypeError("Invalid offer response.");
  const body = action === "counter" ? { action, terms } : action === "reject" ? { action, message } : { action };
  return apiPost(`/v1/offers/${encodeURIComponent(offerId)}/respond`, body);
}
export async function withdrawBackendOffer(offerId) {
  if (!idOk(offerId)) throw new TypeError("Invalid offer identifier.");
  return apiPost(`/v1/offers/${encodeURIComponent(offerId)}/withdraw`, {});
}
export async function getBackendOffer(offerId) {
  if (!idOk(offerId)) throw new TypeError("Invalid offer identifier.");
  return apiGet(`/v1/offers/${encodeURIComponent(offerId)}`);
}
