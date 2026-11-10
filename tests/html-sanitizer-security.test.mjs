import test from "node:test";
import assert from "node:assert/strict";
import { safeHtmlUrl } from "../public/js/ui.js";

const base = "https://faxtonrentals.com/app/";

test("allows HTTPS and same-page relative links", () => {
  assert.equal(safeHtmlUrl("https://example.com/help", "href", base), true);
  assert.equal(safeHtmlUrl("#details", "href", base), true);
  assert.equal(safeHtmlUrl("../privacy", "href", base), true);
});

test("allows mail and telephone links only as href values", () => {
  assert.equal(safeHtmlUrl("mailto:support@example.com", "href", base), true);
  assert.equal(safeHtmlUrl("tel:+2348000000000", "href", base), true);
  assert.equal(safeHtmlUrl("mailto:support@example.com", "src", base), false);
});

test("rejects script and active document URL schemes", () => {
  for (const value of ["javascript:alert(1)", "vbscript:msgbox(1)", "data:text/html,<script>alert(1)</script>", "data:image/svg+xml,<svg onload=alert(1)>", "blob:https://faxtonrentals.com/abc"]) {
    assert.equal(safeHtmlUrl(value, "href", base), false, value);
  }
});

test("allows only raster base64 data images as image sources", () => {
  assert.equal(safeHtmlUrl("data:image/png;base64,aGVsbG8=", "src", base), true);
  assert.equal(safeHtmlUrl("data:image/svg+xml;base64,PHN2Zz4=", "src", base), false);
  assert.equal(safeHtmlUrl("data:text/html;base64,PHNjcmlwdD4=", "src", base), false);
});

test("form submissions must remain on the same origin", () => {
  assert.equal(safeHtmlUrl("/submit", "action", base), true);
  assert.equal(safeHtmlUrl("https://faxtonrentals.com/submit", "formaction", base), true);
  assert.equal(safeHtmlUrl("https://example.com/collect", "action", base), false);
});
