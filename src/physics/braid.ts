// Braid and coil geometry (docs/SPEC.md 4.3, PHYSICS.md section 5). Pure functions, lengths in mm.

const MM_PER_IN = 25.4;
const deg = (rad: number) => (rad * 180) / Math.PI;

export type DensityBand = "ok" | "high" | "nearBinding" | "binding";

/** Density bands on the fill factor F of one wire family. */
export function densityBand(F: number): DensityBand {
  if (F >= 1) return "binding";
  if (F >= 0.85) return "nearBinding";
  if (F >= 0.7) return "high";
  return "ok";
}

export const DENSITY_BAND_LABEL: Record<DensityBand, string> = {
  ok: "OK",
  high: "High density (process limit)",
  nearBinding: "Near binding",
  binding: "Binding likely (jamming)",
};

export interface BraidInput {
  /** Braid mean diameter = seat (layer inner) diameter + wire thickness, mm. */
  Dm: number;
  /** Number of LOADED wire ends. */
  carriers: number;
  /** Wires side by side per carrier. */
  filars: number;
  /** Wire width (diameter for round wire), mm. */
  wireWidth: number;
  /** Picks per inch. */
  ppi: number;
}

export interface JamLimit {
  /** False when the wires cannot fit round the circumference even laid axially (0°). */
  fits: boolean;
  alphaJamDeg: number;
  layLengthJam: number; // mm
  ppiMax: number;
}

export interface BraidGeometry {
  Dm: number;
  /** Axial length of one full turn of one wire, mm. */
  layLength: number;
  /** Braid angle from the tube axis, degrees. */
  alphaDeg: number;
  alphaRad: number;
  /** Fill factor: fraction of the surface covered by ONE wire family. */
  fill: number;
  /** Coverage of both families, C = 1 − (1 − F)², clamped to [0, 1]. */
  coverage: number;
  band: DensityBand;
  jam: JamLimit;
}

/** Lay length from PPI: L_lay = N / (2·PPI) inches, returned in mm. */
export function layLengthFromPPI(carriers: number, ppi: number): number {
  return (carriers / (2 * ppi)) * MM_PER_IN;
}

/** PPI from lay length (mm): PPI = N / (2·L_lay[in]). */
export function ppiFromLayLength(carriers: number, layLength: number): number {
  return carriers / (2 * (layLength / MM_PER_IN));
}

/** Fill factor of one wire family at angle alpha (rad): F = w·f·N / (2π·Dm·cos α). */
export function braidFill(Dm: number, carriers: number, filars: number, wireWidth: number, alphaRad: number): number {
  return (wireWidth * filars * carriers) / (2 * Math.PI * Dm * Math.cos(alphaRad));
}

/** Closed-form jamming limit: cos α_jam = w·f·N / (2π·Dm). */
export function braidJamLimit(Dm: number, carriers: number, filars: number, wireWidth: number): JamLimit {
  const c = (wireWidth * filars * carriers) / (2 * Math.PI * Dm);
  if (!(c < 1)) return { fits: false, alphaJamDeg: 0, layLengthJam: Infinity, ppiMax: 0 };
  const alphaJam = Math.acos(c);
  const layLengthJam = (Math.PI * Dm) / Math.tan(alphaJam);
  return { fits: true, alphaJamDeg: deg(alphaJam), layLengthJam, ppiMax: ppiFromLayLength(carriers, layLengthJam) };
}

export function braidGeometry(i: BraidInput): BraidGeometry {
  const layLength = layLengthFromPPI(i.carriers, i.ppi);
  const alphaRad = Math.atan((Math.PI * i.Dm) / layLength);
  const fill = braidFill(i.Dm, i.carriers, i.filars, i.wireWidth, alphaRad);
  const coverage = Math.min(1, Math.max(0, 1 - (1 - fill) * (1 - fill)));
  return {
    Dm: i.Dm,
    layLength,
    alphaDeg: deg(alphaRad),
    alphaRad,
    fill,
    coverage,
    band: densityBand(fill),
    jam: braidJamLimit(i.Dm, i.carriers, i.filars, i.wireWidth),
  };
}

export interface CoilInput {
  /** Coil mean diameter = seat diameter + wire thickness, mm. */
  Dm: number;
  /** Axial centre-to-centre spacing of adjacent wire bands, mm. */
  pitch: number;
  /** Number of independent starts. */
  starts: number;
  /** Wires side by side in one band. */
  filars: number;
  /** Wire width (diameter for round wire), mm. */
  wireWidth: number;
}

export interface CoilGeometry {
  Dm: number;
  /** Axial advance per turn of one start = pitch × starts, mm. */
  lead: number;
  /** Coil angle from the tube axis, degrees (near 90° = nearly hoop). */
  alphaDeg: number;
  alphaRad: number;
  /** C_coil = w·filars / pitch; 1.0 = closed pitch. */
  coverage: number;
  /** Smallest allowed pitch = w × filars (closed pitch). */
  minPitch: number;
}

export function coilGeometry(i: CoilInput): CoilGeometry {
  const lead = i.pitch * i.starts;
  const alphaRad = Math.atan((Math.PI * i.Dm) / lead);
  return {
    Dm: i.Dm,
    lead,
    alphaDeg: deg(alphaRad),
    alphaRad,
    coverage: (i.wireWidth * i.filars) / i.pitch,
    minPitch: i.wireWidth * i.filars,
  };
}
