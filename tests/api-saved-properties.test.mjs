import assert from "node:assert/strict";
import { test } from "node:test";
import { removeBackendSavedProperty, saveBackendProperty } from "../public/js/api-saved-properties.js";

test("saved-property mutations reject malformed IDs before any network request", async () => {
  await assert.rejects(() => saveBackendProperty("not-a-uuid"), /valid property identifier/);
  await assert.rejects(() => removeBackendSavedProperty("not-a-uuid"), /valid property identifier/);
});

test("saved-property mutation adapter exports both save and remove operations", () => {
  assert.equal(typeof saveBackendProperty, "function");
  assert.equal(typeof removeBackendSavedProperty, "function");
});
