export function mapBounds(stateFips: string | null): [[number, number], [number, number]] {
  if (stateFips === "02") return [[-180, 50], [-129, 72]];
  if (stateFips === "15") return [[-161, 18], [-154, 23]];
  return [[-126, 24], [-66, 50]];
}
