export function toNotificationViewModel(row) {
  if (!row || typeof row !== "object" || typeof row.id !== "string" || !row.id || typeof row.title !== "string") return null;
  const created = new Date(row.createdAt);
  if (Number.isNaN(created.getTime())) return null;
  const data = row.data && typeof row.data === "object" && !Array.isArray(row.data) ? row.data : {};
  const read = !!row.readAt;
  const kind = row.type === "message_received" ? "message" : String(row.type || "info");
  return {
    id: row.id, kind, title: row.title, body: typeof row.body === "string" ? row.body : "",
    read, data,
    createdAt: { seconds: Math.floor(created.getTime() / 1000), toDate: () => created }
  };
}
