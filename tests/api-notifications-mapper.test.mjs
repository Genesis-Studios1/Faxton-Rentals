import test from "node:test";
import assert from "node:assert/strict";
import { toNotificationViewModel } from "../public/js/api-notifications-mapper.js";

test("maps backend message notifications to the existing bell view model", () => {
  const result = toNotificationViewModel({
    id: "11111111-1111-4111-8111-111111111111",
    type: "message_received", title: "New message", body: "You have a new message.",
    data: { conversationId: "22222222-2222-4222-8222-222222222222", messageId: "33333333-3333-4333-8333-333333333333" },
    readAt: null, createdAt: "2026-11-26T12:00:00.000Z"
  });
  assert.equal(result.kind, "message");
  assert.equal(result.read, false);
  assert.equal(result.href, undefined);
  assert.equal(result.createdAt.seconds, 1795694400);
});
test("keeps conversation identifiers as data until the backend chat screen is integrated", () => {
  const result = toNotificationViewModel({
    id: "11111111-1111-4111-8111-111111111111",
    type: "message_received", title: "New message", data: { conversationId: "javascript:alert(1)" },
    readAt: "2026-11-26T12:00:00.000Z", createdAt: "2026-11-26T12:00:00.000Z"
  });
  assert.equal(result.href, undefined);
  assert.equal(result.data.conversationId, "javascript:alert(1)");
  assert.equal(result.read, true);
});
test("rejects malformed notification records", () => {
  assert.equal(toNotificationViewModel(null), null);
  assert.equal(toNotificationViewModel({ id: "x", title: "Bad", createdAt: "not-a-date" }), null);
});
