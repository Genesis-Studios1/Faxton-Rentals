import { apiGet, apiPost } from "./api-client.js";
import { toNotificationViewModel } from "./api-notifications-mapper.js";

export async function listBackendNotifications({ unreadOnly = false, limit = 40, offset = 0 } = {}) {
  const query = new URLSearchParams({ unreadOnly: String(!!unreadOnly), limit: String(limit), offset: String(offset) });
  const rows = await apiGet(`/v1/notifications?${query}`);
  if (!Array.isArray(rows)) throw new TypeError("The backend returned an invalid notification list.");
  return rows.map(toNotificationViewModel).filter(Boolean);
}
export async function markBackendNotificationRead(notificationId) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(notificationId || ""))) throw new TypeError("Invalid notification identifier.");
  return apiPost(`/v1/notifications/${encodeURIComponent(notificationId)}/read`, {});
}
export async function markAllBackendNotificationsRead() {
  return apiPost("/v1/notifications/read-all", {});
}
