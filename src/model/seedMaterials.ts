import type { Material, MaterialNumericField } from "./types";

// Seed library — values exactly as given in docs/SPEC.md Section 6.
// Nothing here is invented: every crease strain is flagged as an estimate (the spec says so),
// and yields marked "(est.)" in the spec are flagged too.

type Row = [
  id: string,
  name: string,
  family: Material["family"],
  thermoplastic: boolean,
  density: number,
  E: number,
  poisson: number,
  UTS: number,
  yieldStrength: number | undefined,
  creaseStrain: number | undefined,
  estimated: MaterialNumericField[],
  notes?: string,
];

const C: MaterialNumericField[] = ["creaseStrain"];
const Y: MaterialNumericField[] = ["yieldStrength"];

const rows: Row[] = [
  ["pebax-25d", "Pebax 25D", "Polymer", true, 1.01, 12, 0.45, 30, undefined, 0.06, C],
  ["pebax-35d", "Pebax 35D", "Polymer", true, 1.01, 20, 0.45, 32, undefined, 0.06, C],
  ["pebax-40d", "Pebax 40D", "Polymer", true, 1.02, 75, 0.45, 35, undefined, 0.06, C],
  ["pebax-55d", "Pebax 55D", "Polymer", true, 1.02, 160, 0.44, 42, undefined, 0.06, C],
  ["pebax-63d", "Pebax 63D", "Polymer", true, 1.02, 300, 0.43, 50, undefined, 0.06, C],
  ["pebax-72d", "Pebax 72D", "Polymer", true, 1.02, 510, 0.42, 56, undefined, 0.06, C],
  ["nylon-12", "Nylon 12 (Vestamid / Grilamid L25)", "Polymer", true, 1.02, 1400, 0.4, 50, undefined, 0.06, C],
  ["pu-80a", "Polyurethane 80A", "Polymer", true, 1.15, 25, 0.48, 40, undefined, 0.1, C],
  ["hdpe", "HDPE", "Polymer", true, 0.95, 1000, 0.42, 27, undefined, 0.05, C],
  ["ptfe-liner", "PTFE (liner, etched)", "Polymer", false, 2.15, 500, 0.46, 25, undefined, 0.03, C],
  ["etfe", "ETFE", "Polymer", true, 1.7, 800, 0.4, 45, undefined, 0.03, C],
  ["fep", "FEP", "Polymer", true, 2.15, 500, 0.46, 23, undefined, 0.03, C],
  ["polyimide", "Polyimide", "Polymer", false, 1.42, 2500, 0.34, 120, undefined, 0.02, C],
  ["peek", "PEEK", "Polymer", true, 1.3, 3600, 0.4, 100, undefined, 0.025, C],
  ["heat-shrink-fep", "Heat shrink FEP (process aid)", "Polymer", false, 2.15, 500, 0.46, 23, undefined, 0.03, C],
  ["ss-304-annealed", "304 SS annealed", "Metal", false, 8.0, 193000, 0.29, 505, 215, undefined, []],
  ["ss-304v-spring", "304V spring temper", "Metal", false, 8.0, 193000, 0.29, 2000, 1700, undefined, Y],
  ["ss-316l", "316L", "Metal", false, 8.0, 193000, 0.27, 485, 170, undefined, []],
  ["nitinol", "Nitinol (superelastic, austenite)", "Metal", false, 6.45, 60000, 0.33, 1200, 500, undefined, Y, "Yield = upper plateau stress (estimate)."],
  ["tungsten", "Tungsten wire", "Metal", false, 19.3, 400000, 0.28, 2500, 2000, undefined, Y],
  ["peek-mono", "PEEK monofilament (braid)", "Other", false, 1.3, 3600, 0.4, 100, undefined, undefined, []],
  ["aramid-k49", "Aramid (Kevlar 49)", "Other", false, 1.44, 112000, 0.36, 3000, undefined, undefined, []],
];

export function seedMaterials(): Material[] {
  return rows.map(
    ([id, name, family, thermoplastic, density, E, poisson, UTS, yieldStrength, creaseStrain, estimated, notes]) => {
      const m: Material = { id, name, family, thermoplastic, density, E, poisson, UTS };
      if (yieldStrength !== undefined) m.yieldStrength = yieldStrength;
      if (creaseStrain !== undefined) m.creaseStrain = creaseStrain;
      if (estimated.length) m.estimated = [...estimated];
      if (notes) m.notes = notes;
      return m;
    },
  );
}

// Common wire sizes (inches), Section 6.
export const COMMON_RIBBON_IN: [thk: number, width: number][] = [
  [0.0005, 0.003],
  [0.001, 0.003],
  [0.001, 0.005],
  [0.0015, 0.005],
  [0.002, 0.006],
  [0.002, 0.01],
];
export const COMMON_ROUND_IN: number[] = [0.001, 0.0015, 0.002, 0.003, 0.004];
