import assert from "node:assert/strict";
import test from "node:test";
import { mapBounds } from "../lib/map-bounds.ts";

test("navigation stays near the mainland and supports Alaska and Hawaii", () => {
  assert.deepEqual(mapBounds(null), [[-126, 24], [-66, 50]]);
  assert.deepEqual(mapBounds("36"), mapBounds(null));
  assert.deepEqual(mapBounds("02"), [[-180, 50], [-129, 72]]);
  assert.deepEqual(mapBounds("15"), [[-161, 18], [-154, 23]]);
});
