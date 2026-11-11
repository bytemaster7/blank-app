// Core data model (docs/SPEC.md Section 3).
// Internal units everywhere: mm, N, MPa, g/cm³. Strains are fractions (0.06 = 6%).

export type UnitSystem = "mm" | "in";
export type DesignMode = "fixedID" | "fixedOD" | "fixedODandID" | "multiLumenCore";
export type WireShape = "round" | "flat";

export interface WireDims {
  wireShape: WireShape;
  wireDia?: number; // round
  wireThk?: number; // flat
  wireWidth?: number; // flat
}

export type MaterialFamily = "Polymer" | "Metal" | "Other";

/** Material properties that can carry an "estimate" flag. */
export type MaterialNumericField =
  | "density"
  | "E"
  | "poisson"
  | "UTS"
  | "yieldStrength"
  | "creaseStrain";

export interface Material {
  id: string;
  name: string;
  family: MaterialFamily;
  thermoplastic: boolean; // used by Reflow tab; only meaningful for polymers
  density: number; // g/cm³
  E: number; // MPa
  poisson: number;
  UTS: number; // MPa
  yieldStrength?: number; // MPa, metals
  creaseStrain?: number; // fraction, polymers (kink)
  notes?: string;
  /** Properties that are estimates rather than datasheet values. */
  estimated?: MaterialNumericField[];
}

export interface Reinforcement extends WireDims {
  wireMaterialId: string;
  // braid & triaxial
  ppi?: number; // picks per inch (always per inch)
  carriers?: number; // LOADED wire ends
  filars?: number; // wires side by side per carrier, 1–10
  pattern?: "fullLoad" | "halfLoad" | "diamond";
  // triaxial only
  axialWireCount?: number;
  matchAxialToBias?: boolean;
  axialWire?: WireDims & { materialId: string };
  // coil
  pitch?: number; // axial centre-to-centre spacing of adjacent wire bands
  coilCarriers?: number; // independent starts, 1–10
  coilFilars?: number; // wires side by side in one band
}

export type LayerType = "polymer" | "braid" | "triaxialBraid" | "coil" | "pullwireLayer";

export interface Layer {
  id: string;
  name: string;
  color: string;
  type: LayerType;
  materialId?: string; // polymer layers only
  thickness: number; // editable for polymer; computed for reinforcement
  adaptive: boolean; // fixedODandID mode only
  reinforcement?: Reinforcement;
}

export interface PullwireLumen {
  lumenID?: number; // round lumen
  lumenThk?: number; // flat lumen
  lumenWidth?: number;
  linerMaterialId?: string;
  linerWall?: number;
  constructionType: "individualMandrels" | "multiLumenExtrusion";
}

export interface ManualStiffness {
  EI: number; // N·mm²
  GJ: number; // N·mm²
  EA: number; // N
  pullwireOffset: number; // mm
}

export type SectionMode = "layered" | "manualStiffness" | "rigid";

export interface Section {
  id: string;
  label: string;
  color: string;
  length: number; // mm, min 2
  mode: SectionMode;
  layers: Layer[]; // index 0 = innermost (liner), last = outermost (jacket)
  manual?: ManualStiffness;
  useCore: boolean;
  pullwireLumen?: PullwireLumen;
}

export interface PullwireConfig extends WireDims {
  arrangement: "none" | "single" | "two" | "four";
  anchorAfterSectionId?: string; // pull-wires end at the distal end of this section
  materialId: string;
}

export interface CoreProfile {
  template: "doubleD" | "satellites" | "crescent" | "custom";
  dims: Record<string, number>;
  materialId: string;
  rotationDeg: number;
}

export interface Design {
  name: string;
  units: UnitSystem; // display only
  designMode: DesignMode;
  fixedID?: number; // mandrel diameter
  fixedOD?: number;
  core?: CoreProfile;
  pullwires: PullwireConfig;
  sections: Section[]; // index 0 = PROXIMAL, last = DISTAL TIP
}

export const MIN_SECTION_LENGTH = 2; // mm
export const MAX_TOTAL_LENGTH = 1500; // mm
