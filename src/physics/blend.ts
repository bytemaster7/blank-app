// Material blend estimates (docs/SPEC.md 5.9, PHYSICS.md "Blend tool").
// Pure functions, no UI imports. All outputs are estimates.

export interface BlendComponent {
  density: number; // g/cm³
  E: number; // MPa
  poisson: number;
  UTS: number; // MPa
  creaseStrain?: number; // fraction
  thermoplastic: boolean;
}

export interface BlendResult {
  density: number;
  E: number;
  poisson: number;
  UTS: number;
  creaseStrain?: number;
  thermoplastic: boolean;
  /** Volume fraction of the second component (polymer B, or the filler). */
  volumeFraction: number;
}

/** Mass fractions → volume fractions: φᵢ = (mᵢ/ρᵢ) / Σ(mⱼ/ρⱼ). */
export function massToVolumeFractions(massFractions: number[], densities: number[]): number[] {
  const v = massFractions.map((m, i) => m / densities[i]);
  const total = v.reduce((a, b) => a + b, 0);
  return v.map((x) => x / total);
}

/** Blend density: ρ = 1 / Σ(mᵢ/ρᵢ) (inverse rule of mixtures on mass fractions). */
export function blendDensity(massFractions: number[], densities: number[]): number {
  return 1 / massFractions.reduce((sum, m, i) => sum + m / densities[i], 0);
}

export interface PolymerBlendResult extends BlendResult {
  /** Linear rule-of-mixtures strength Σφᵢ·UTSᵢ — shown only as an upper bound. */
  UTSUpperBound: number;
}

/**
 * (a) Immiscible blend of two polymers. `massFractionB` is the mass fraction of polymer B (0.05–0.95).
 * Modulus by the Davies rule for co-continuous blends: E^(1/5) = Σ φᵢ·Eᵢ^(1/5).
 */
export function polymerBlend(a: BlendComponent, b: BlendComponent, massFractionB: number): PolymerBlendResult {
  const m = [1 - massFractionB, massFractionB];
  const rho = [a.density, b.density];
  const [phiA, phiB] = massToVolumeFractions(m, rho);
  const E = Math.pow(phiA * Math.pow(a.E, 0.2) + phiB * Math.pow(b.E, 0.2), 5);
  const crease =
    a.creaseStrain !== undefined && b.creaseStrain !== undefined
      ? Math.min(a.creaseStrain, b.creaseStrain)
      : (a.creaseStrain ?? b.creaseStrain);
  return {
    density: blendDensity(m, rho),
    E,
    poisson: phiA * a.poisson + phiB * b.poisson,
    UTS: Math.min(a.UTS, b.UTS),
    UTSUpperBound: phiA * a.UTS + phiB * b.UTS,
    creaseStrain: crease,
    thermoplastic: a.thermoplastic && b.thermoplastic,
    volumeFraction: phiB,
  };
}

/** Filler volume fraction above which the particulate formulas are not applied (Section 5.9). */
export const MAX_FILLER_VOLUME_FRACTION = 0.35;
/** Poisson's ratio assumed for the filler particles (Section 5.9). */
export const FILLER_POISSON = 0.25;

export interface ParticulateBlendResult extends BlendResult {
  /** True when the true volume fraction exceeded the cap and was limited to it for E, ν, UTS and crease. */
  capped: boolean;
  /** Uncapped filler volume fraction from the densities. */
  rawVolumeFraction: number;
}

/**
 * (b) Polymer + particulate additive. `massFractionFiller` by mass (e.g. 0.20).
 * E: Guth–Gold (spherical particles). UTS: Nicolais–Narkis (poorly bonded). Crease strain: Nielsen.
 */
export function particulateBlend(
  matrix: BlendComponent,
  fillerDensity: number,
  massFractionFiller: number,
): ParticulateBlendResult {
  const m = [1 - massFractionFiller, massFractionFiller];
  const rho = [matrix.density, fillerDensity];
  const raw = massToVolumeFractions(m, rho)[1];
  const phi = Math.min(raw, MAX_FILLER_VOLUME_FRACTION);
  return {
    density: blendDensity(m, rho),
    E: matrix.E * (1 + 2.5 * phi + 14.1 * phi * phi),
    poisson: (1 - phi) * matrix.poisson + FILLER_POISSON * phi,
    UTS: matrix.UTS * (1 - 1.21 * Math.pow(phi, 2 / 3)),
    creaseStrain: matrix.creaseStrain !== undefined ? matrix.creaseStrain * (1 - Math.cbrt(phi)) : undefined,
    thermoplastic: matrix.thermoplastic,
    volumeFraction: phi,
    rawVolumeFraction: raw,
    capped: raw > MAX_FILLER_VOLUME_FRACTION,
  };
}

/** Additive densities given in Section 5.9 (g/cm³). */
export const FILLERS: { name: string; short: string; density: number }[] = [
  { name: "Barium sulfate (BaSO₄)", short: "BaSO4", density: 4.5 },
  { name: "Tungsten (W)", short: "W", density: 19.3 },
  { name: "Bismuth trioxide (Bi₂O₃)", short: "Bi2O3", density: 8.9 },
  { name: "Bismuth subcarbonate", short: "Bi subcarbonate", density: 6.86 },
  { name: "PTFE micropowder", short: "PTFE powder", density: 2.2 },
];
