import { describe, expect, it } from "vitest";
import { check } from "../testUtil";
import { blendDensity, massToVolumeFractions, particulateBlend, polymerBlend } from "./blend";
import { seedMaterials } from "../model/seedMaterials";

const lib = seedMaterials();
const get = (id: string) => {
  const m = lib.find((x) => x.id === id);
  if (!m) throw new Error(id);
  return m;
};

describe("10.12 Particulate blend — Pebax 72D + 20% BaSO4 by mass", () => {
  it("matches the hand calculation", () => {
    console.log("\nTest 10.12 — Pebax 72D + 20 wt% BaSO4 (4.50 g/cm³)");
    const r = particulateBlend(get("pebax-72d"), 4.5, 0.2);
    check("filler volume fraction φ", r.volumeFraction, 0.0536, "");
    check("density ρ", r.density, 1.207, "g/cm³");
    check("modulus E (Guth–Gold)", r.E, 599, "MPa");
    check("UTS (Nicolais–Narkis)", r.UTS, 46.4, "MPa");
    check("crease strain (Nielsen)", r.creaseStrain! * 100, 3.7, "%", 0.02);
    expect(r.capped).toBe(false);
    expect(r.thermoplastic).toBe(true);
  });

  it("caps the filler volume fraction at 0.35", () => {
    // 90 wt% BaSO4 in Pebax is φ ≈ 0.67 by volume — far outside Guth–Gold's range.
    const r = particulateBlend(get("pebax-72d"), 4.5, 0.9);
    expect(r.rawVolumeFraction).toBeGreaterThan(0.35);
    expect(r.volumeFraction).toBe(0.35);
    expect(r.capped).toBe(true);
  });
});

describe("Polymer blend (Davies rule)", () => {
  it("Pebax 72D / Pebax 35D 50/50 by mass", () => {
    console.log("\nPolymer blend — Pebax 72D / Pebax 35D, 50/50 by mass");
    const a = get("pebax-72d");
    const b = get("pebax-35d");
    const r = polymerBlend(a, b, 0.5);
    // Hand calc: φ_B = (0.5/1.01)/(0.5/1.02+0.5/1.01) = 0.50246; φ_A = 0.49754
    //   ρ = 1/(0.5/1.02+0.5/1.01) = 1.01498
    //   E^(1/5) = 0.49754·510^0.2 + 0.50246·20^0.2 = 0.49754·3.4794 + 0.50246·1.8206 = 2.6459 → E = 129.7 MPa
    check("volume fraction of B", r.volumeFraction, 0.50246, "");
    check("density ρ", r.density, 1.01498, "g/cm³");
    check("modulus E (Davies)", r.E, 129.7, "MPa");
    check("Poisson ν", r.poisson, 0.49754 * 0.42 + 0.50246 * 0.45, "");
    check("UTS reported (weaker phase)", r.UTS, 32, "MPa");
    check("UTS upper bound (linear)", r.UTSUpperBound, 0.49754 * 56 + 0.50246 * 32, "MPa");
    expect(r.creaseStrain).toBe(0.06);
    expect(r.thermoplastic).toBe(true);
  });

  it("a blend of a material with itself returns that material", () => {
    const a = get("pebax-55d");
    const r = polymerBlend(a, a, 0.3);
    expect(r.E).toBeCloseTo(a.E, 6);
    expect(r.density).toBeCloseTo(a.density, 9);
  });

  it("is not thermoplastic if either component is not", () => {
    expect(polymerBlend(get("pebax-72d"), get("ptfe-liner"), 0.5).thermoplastic).toBe(false);
  });

  it("volume fractions sum to 1 and density is consistent", () => {
    const phi = massToVolumeFractions([0.8, 0.2], [1.02, 4.5]);
    expect(phi[0] + phi[1]).toBeCloseTo(1, 12);
    // ρ must also equal Σ φᵢ·ρᵢ
    expect(blendDensity([0.8, 0.2], [1.02, 4.5])).toBeCloseTo(phi[0] * 1.02 + phi[1] * 4.5, 9);
  });
});
