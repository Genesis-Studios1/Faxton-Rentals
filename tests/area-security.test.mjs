import test from "node:test";
import assert from "node:assert/strict";
import { validCoordinates } from "../public/js/area.js";

test("accepts valid numeric coordinates", () => {
  assert.deepEqual(validCoordinates({ lat: 6.5244, lng: 3.3792 }), { lat: 6.5244, lng: 3.3792 });
});

test("normalises valid numeric-string coordinates", () => {
  assert.deepEqual(validCoordinates({ lat: "6.5244", lng: "3.3792" }), { lat: 6.5244, lng: 3.3792 });
});

test("rejects missing, empty, null and nonnumeric coordinates", () => {
  for (const value of [undefined, null, {}, { lat: null, lng: null }, { lat: "", lng: " " }, { lat: "6.5,alert(1)", lng: "3.3" }, { lat: "NaN", lng: 3 }]) {
    assert.equal(validCoordinates(value), null);
  }
});

test("rejects coordinates outside geographic bounds", () => {
  for (const value of [{ lat: 91, lng: 0 }, { lat: -91, lng: 0 }, { lat: 0, lng: 181 }, { lat: 0, lng: -181 }, { lat: Infinity, lng: 0 }]) {
    assert.equal(validCoordinates(value), null);
  }
});

test("rejects non-number and non-string coordinate values", () => {
  assert.equal(validCoordinates({ lat: true, lng: 3 }), null);
  assert.equal(validCoordinates({ lat: 6, lng: {} }), null);
});
