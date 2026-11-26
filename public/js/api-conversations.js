import { apiGet, apiPost, apiPatch } from "./api-client.js";

const uuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
const rows = (value, label) => { if (!Array.isArray(value)) throw new TypeError(`The backend returned an invalid ${label} list.`); return value; };
const record = (value, label) => { if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`The backend returned an invalid ${label}.`); return value; };

export async function listBackendConversations() {
  return rows(await apiGet("/v1/conversations"), "conversation");
}
export async function createBackendConversation(recipientUserId) {
  if (!uuid(recipientUserId)) throw new TypeError("A valid Faxton account is required to start a conversation.");
  return record(await apiPost("/v1/conversations", { recipientUserId }), "conversation");
}
export async function listBackendMessages(conversationId, { limit = 50, offset = 0 } = {}) {
  if (!uuid(conversationId)) throw new TypeError("Invalid conversation.");
  const q = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  return rows(await apiGet(`/v1/conversations/${encodeURIComponent(conversationId)}/messages?${q}`), "message");
}
export async function sendBackendTextMessage(conversationId, body, attachmentUploadIds = []) {
  if (!uuid(conversationId) || !String(body || "").trim() || String(body).length > 10000 || !Array.isArray(attachmentUploadIds) || attachmentUploadIds.length > 5 || attachmentUploadIds.some((id) => !uuid(id)) || new Set(attachmentUploadIds).size !== attachmentUploadIds.length) throw new TypeError("Enter a message and check its attachments.");
  return record(await apiPost(`/v1/conversations/${encodeURIComponent(conversationId)}/messages`, { body: String(body).trim(), attachmentUploadIds }), "message");
}
export async function markBackendConversationRead(conversationId) {
  if (!uuid(conversationId)) throw new TypeError("Invalid conversation.");
  return record(await apiPost(`/v1/conversations/${encodeURIComponent(conversationId)}/read`, {}), "read confirmation");
}
export async function editBackendTextMessage(conversationId, messageId, body) {
  if (!uuid(conversationId) || !uuid(messageId) || !String(body || "").trim() || String(body).length > 10000) throw new TypeError("Invalid message edit.");
  return record(await apiPatch(`/v1/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}`, { body: String(body).trim() }), "edited message");
}
export async function uploadBackendMessageAttachment(file) {
  if (!(file instanceof Blob) || !file.size || file.size > 10 * 1024 * 1024) throw new TypeError("Choose an attachment up to 10 MB.");
  const allowed = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
  if (!allowed.has(String(file.type).toLowerCase())) throw new TypeError("Use a PDF, JPG, PNG or WebP attachment.");
  const form = new FormData(); form.append("file", file, file.name || "message-attachment");
  const result = record(await apiPost("/v1/uploads/message-attachment", form), "message attachment upload");
  if (!uuid(result.uploadId) || result.status !== "verified") throw new TypeError("The attachment could not be verified.");
  return result.uploadId;
}
