import assert from "node:assert/strict";
import test from "node:test";
import { NORTH_AMERICA_BOUNDS } from "../lib/map-bounds.ts";

test("North America limits include Alaska, Hawaii, Canada, and Mexico with margin", () => {
  const [[west, south], [east, north]] = NORTH_AMERICA_BOUNDS;
  for (const [longitude, latitude] of [[-170, 65], [-157, 20], [-123, 49], [-99, 19], [-52, 70]]) {
    assert(longitude > west && longitude < east && latitude > south && latitude < north);
  }
});
