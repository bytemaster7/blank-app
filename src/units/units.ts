import type { UnitSystem } from "../model/types";

// Unit conversion at the UI boundary only (Section 2 / 4.0).
// Everything is stored internally in mm, N, MPa, g/cm³; these helpers only re-label for display.

export type Quantity =
  | "length" // mm ↔ in
  | "pressure" // MPa ↔ psi (also modulus and strength)
  | "force" // N ↔ lbf
  | "density" // g/cm³ ↔ lb/in³
  | "moment" // N·mm ↔ lbf·in
  | "stiffness" // EI, GJ: N·mm² ↔ lbf·in²
  | "strain" // fraction ↔ % (same in both systems)
  | "none"; // dimensionless

const MM_PER_IN = 25.4;
const N_PER_LBF = 4.4482216152605;
const PSI_PER_MPA = 1e6 / (N_PER_LBF / (0.0254 * 0.0254)); // 145.0377…
const LBIN3_PER_GCM3 = 0.036127292; // 1 g/cm³ = 0.036127 lb/in³

/** Multiply an internal value by this factor to get the display value. */
export function displayFactor(q: Quantity, units: UnitSystem): number {
  if (q === "strain") return 100;
  if (q === "none" || units === "mm") return 1;
  switch (q) {
    case "length":
      return 1 / MM_PER_IN;
    case "pressure":
      return PSI_PER_MPA;
    case "force":
      return 1 / N_PER_LBF;
    case "density":
      return LBIN3_PER_GCM3;
    case "moment":
      return 1 / (N_PER_LBF * MM_PER_IN);
    case "stiffness":
      return 1 / (N_PER_LBF * MM_PER_IN * MM_PER_IN);
  }
}

export function toDisplay(value: number, q: Quantity, units: UnitSystem): number {
  return value * displayFactor(q, units);
}

export function fromDisplay(value: number, q: Quantity, units: UnitSystem): number {
  return value / displayFactor(q, units);
}

export function unitLabel(q: Quantity, units: UnitSystem): string {
  const si = units === "mm";
  switch (q) {
    case "length":
      return si ? "mm" : "in";
    case "pressure":
      return si ? "MPa" : "psi";
    case "force":
      return si ? "N" : "lbf";
    case "density":
      return si ? "g/cm³" : "lb/in³";
    case "moment":
      return si ? "N·mm" : "lbf·in";
    case "stiffness":
      return si ? "N·mm²" : "lbf·in²";
    case "strain":
      return "%";
    case "none":
      return "";
  }
}

/** Formats a number to `sig` significant figures without exponent notation or trailing zeros. */
export function formatNumber(value: number, sig = 4): string {
  if (!Number.isFinite(value)) return "--";
  if (value === 0) return "0";
  const rounded = Number(value.toPrecision(sig));
  const abs = Math.abs(rounded);
  if (abs >= 1e15 || abs < 1e-9) return rounded.toExponential(sig - 1);
  const decimals = Math.max(0, sig - 1 - Math.floor(Math.log10(abs)));
  return rounded.toFixed(Math.min(decimals, 12)).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

export function formatQuantity(value: number | undefined, q: Quantity, units: UnitSystem, sig = 4): string {
  if (value === undefined) return "";
  return formatNumber(toDisplay(value, q, units), sig);
}
