type View = [number, number, number, number];

/** Preserve the map point under a pinch or cursor while changing zoom. */
export function zoomAround(base: View, view: View, zoom: number, fx: number, fy: number, anchor?: { x: number; y: number }) {
  zoom = Math.max(1, Math.min(16, zoom));
  const x = anchor?.x ?? view[0] + fx * view[2], y = anchor?.y ?? view[1] + fy * view[3];
  return { zoom, x: x - fx * base[2] / zoom - base[0] - base[2] * (1 - 1 / zoom) / 2,
    y: y - fy * base[3] / zoom - base[1] - base[3] * (1 - 1 / zoom) / 2 };
}

/** Find overlapping logo boxes using neighboring grid cells. Coordinates and spacing share units. */
export function crowdedMarkers(points: { x: number; y: number }[], spacing: number): Set<number> {
  const cells = new Map<string, number[]>();
  const crowded = new Set<number>();
  points.forEach((p, i) => {
    const x = Math.floor(p.x / spacing), y = Math.floor(p.y / spacing);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const j of cells.get(`${x + dx},${y + dy}`) ?? []) {
          const q = points[j];
          if (Math.abs(p.x - q.x) < spacing && Math.abs(p.y - q.y) < spacing) {
            crowded.add(i);
            crowded.add(j);
          }
        }
      }
    }
    const key = `${x},${y}`;
    const bucket = cells.get(key) ?? [];
    bucket.push(i);
    cells.set(key, bucket);
  });
  return crowded;
}
