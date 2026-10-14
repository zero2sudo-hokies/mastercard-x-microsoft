import assert from "node:assert/strict";
import test from "node:test";
import { fmtMiles } from "../lib/format.ts";

test("distances display rounded US miles and preserve missing values", () => {
  assert.equal(fmtMiles(220), "137 miles");
  assert.equal(fmtMiles(150), "93 miles");
  assert.equal(fmtMiles(0), "0 miles");
  assert.equal(fmtMiles(null), "—");
  assert.equal(fmtMiles(undefined), "—");
});
