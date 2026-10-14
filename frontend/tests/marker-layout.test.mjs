import assert from 'node:assert/strict';
import { test } from 'node:test';
import { crowdedMarkers, zoomAround } from '../lib/marker-layout.ts';

test('isolated logos stay visible; overlapping and coincident markers become dots', () => {
  assert.deepEqual([...crowdedMarkers([{x: 0, y: 0}, {x: 80, y: 0}], 32)], []);
  assert.deepEqual([...crowdedMarkers([{x: 31, y: 0}, {x: 33, y: 0}, {x: 100, y: 0}], 32)].sort(), [0, 1]);
  assert.equal(crowdedMarkers([{x: 0, y: 0}, {x: 0, y: 0}], 32).size, 2);
});

test('zooming in makes room for logos while exactly coincident branches remain dots', () => {
  const points = [{x: 0, y: 0}, {x: 20, y: 0}, {x: 80, y: 0}];
  assert.equal(crowdedMarkers(points, 32).size, 2);
  assert.equal(crowdedMarkers(points, 16).size, 0);
});

test('pinch zoom preserves its anchor and limits the zoom range', () => {
  const base = [0, 0, 100, 100];
  assert.deepEqual(zoomAround(base, base, 2, .25, .75), {zoom: 2, x: -12.5, y: 12.5});
  assert.deepEqual(zoomAround(base, base, 2, .5, .5, {x: 25, y: 75}), {zoom: 2, x: -25, y: 25});
  assert.equal(zoomAround(base, base, .01, .5, .5).zoom, 1);
  assert.equal(zoomAround(base, base, 100, .5, .5).zoom, 16);
});
