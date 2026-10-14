// Pin colors for the top 3 banks; shared by the map pins and the top-banks strip so they read as one legend.
// Blues and teal so they stand out on the orange-red frustration ramp.
export const BANK_PIN_COLORS = ["#1d4ed8", "#7c3aed", "#0f766e"];
export const OTHER_PIN_COLOR = "#64748b";

export const pinColor = (rank: number | null) => (rank && rank <= 3 ? BANK_PIN_COLORS[rank - 1] : OTHER_PIN_COLOR);
