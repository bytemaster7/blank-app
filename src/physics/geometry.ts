// Layer-stack geometry (docs/SPEC.md 3, 4.2, 4.3; PHYSICS.md sections 4–6).
// Resolves each section's layers into diameters, computes reinforcement thickness and geometry,
// places the pull-wire lumens and collects the live validation problems. Pure functions, mm.

import type { Design, Layer, Section, WireDims } from "../model/types";
import { MIN_SECTION_LENGTH } from "../model/types";
import { braidGeometry, coilGeometry, type BraidGeometry, type CoilGeometry } from "./braid";

/** Minimum diametral clearance between a pull-wire and its lumen (spec Section 3). */
export const PULLWIRE_CLEARANCE = 0.025;
/** Ride-over allowance (spec 4.2): +10% of wire thickness when F > 0.85 on a 2-over-2 braid. */
export const RIDE_OVER_FILL = 0.85;
export const RIDE_OVER_FRACTION = 0.1;

export const wireThk = (w: WireDims): number => (w.wireShape === "round" ? (w.wireDia ?? 0) : (w.wireThk ?? 0));
export const wireWidth = (w: WireDims): number => (w.wireShape === "round" ? (w.wireDia ?? 0) : (w.wireWidth ?? 0));
export const wireArea = (w: WireDims): number =>
  w.wireShape === "round" ? (Math.PI * (w.wireDia ?? 0) ** 2) / 4 : (w.wireThk ?? 0) * (w.wireWidth ?? 0);

export const isReinforcement = (l: Layer): boolean => l.type === "braid" || l.type === "triaxialBraid" || l.type === "coil";

export interface ResolvedLayer {
  layer: Layer;
  innerDia: number;
  outerDia: number;
  thickness: number;
  braid?: BraidGeometry & { rideOver: boolean };
  coil?: CoilGeometry;
  /** Polymer that fills this reinforcement / pull-wire layer: the nearest polymer layer outside it. */
  matrixMaterialId?: string;
}

export interface ResolvedLumen {
  /** Angular position, degrees from +X towards +Y (a single wire sits at 90° = +Y). */
  angleDeg: number;
  /** Radius of the lumen centre = pull-wire moment arm, mm. */
  rp: number;
  shape: "round" | "flat";
  /** Open bore: diameter (round) or radial thickness × tangential width (flat). */
  boreThk: number;
  boreWidth: number;
  linerWall: number;
  linerMaterialId?: string;
}

export interface ResolvedSection {
  section: Section;
  innerDia: number;
  outerDia: number;
  wall: number;
  layers: ResolvedLayer[];
  lumens: ResolvedLumen[];
  /** Pull-wire moment arm r_pw, if the section carries pull-wires. */
  pullwireOffset?: number;
  /** Validation problems (red). Empty = the section can be built. */
  problems: string[];
}

/** Radial thickness of the pull-wire pseudo-layer = lumen bore + 2 × liner wall. */
export function pullwireLayerThickness(section: Section): number {
  const lu = section.pullwireLumen;
  if (!lu) return 0;
  const bore = lu.lumenID ?? lu.lumenThk ?? 0;
  return bore + 2 * (lu.linerMaterialId ? (lu.linerWall ?? 0) : 0);
}

interface Sized {
  thickness: number;
  braid?: ResolvedLayer["braid"];
  coil?: CoilGeometry;
}

/** Thickness (and geometry) of a non-polymer layer seated on a given inner diameter. */
function sizeOnDiameter(layer: Layer, section: Section, innerDia: number): Sized {
  if (layer.type === "pullwireLayer") return { thickness: pullwireLayerThickness(section) };
  const r = layer.reinforcement;
  if (!r) return { thickness: 0 };
  const tw = wireThk(r);
  const w = wireWidth(r);
  const Dm = innerDia + tw; // spec 4.3: mean diameter = layer ID + wire thickness
  if (layer.type === "coil") {
    const coil = coilGeometry({ Dm, pitch: r.pitch ?? 0, starts: r.coilCarriers ?? 1, filars: r.coilFilars ?? 1, wireWidth: w });
    return { thickness: tw, coil };
  }
  const g = braidGeometry({ Dm, carriers: r.carriers ?? 0, filars: r.filars ?? 1, wireWidth: w, ppi: r.ppi ?? 0 });
  const rideOver = g.fill > RIDE_OVER_FILL && r.pattern === "fullLoad";
  let thickness = 2 * tw + (rideOver ? RIDE_OVER_FRACTION * tw : 0);
  if (layer.type === "triaxialBraid") {
    thickness += r.matchAxialToBias || !r.axialWire ? tw : wireThk(r.axialWire);
  }
  return { thickness, braid: { ...g, rideOver } };
}

function layerThicknessOutward(layer: Layer, section: Section, innerDia: number): Sized {
  if (layer.type === "polymer") return { thickness: layer.thickness };
  return sizeOnDiameter(layer, section, innerDia);
}

/** Same, but when the OUTER diameter is known (stacking inward). One correction pass handles the ride-over rule. */
function layerThicknessInward(layer: Layer, section: Section, outerDia: number): Sized {
  if (layer.type === "polymer") return { thickness: layer.thickness };
  const first = sizeOnDiameter(layer, section, outerDia);
  const guess = sizeOnDiameter(layer, section, outerDia - 2 * first.thickness);
  const final = sizeOnDiameter(layer, section, outerDia - 2 * guess.thickness);
  return { ...final, thickness: guess.thickness };
}

const PULLWIRE_ANGLES: Record<Design["pullwires"]["arrangement"], number[]> = {
  none: [],
  single: [90],
  two: [90, 270],
  four: [0, 90, 180, 270],
};

const fmt = (v: number) => (Math.round(v * 10000) / 10000).toString();

/** Resolves one section of a design into diameters, reinforcement geometry, lumens and problems. */
export function resolveSection(design: Design, section: Section): ResolvedSection {
  const problems: string[] = [];
  const layers = section.layers;
  const n = layers.length;
  const sized: (Sized & { innerDia: number; outerDia: number })[] = new Array(n);
  const mode = design.designMode;

  const outward = (from: number, to: number, startID: number) => {
    let d = startID;
    for (let i = from; i < to; i++) {
      const s = layerThicknessOutward(layers[i], section, d);
      sized[i] = { ...s, innerDia: d, outerDia: d + 2 * s.thickness };
      d += 2 * s.thickness;
    }
    return d;
  };
  const inward = (from: number, to: number, startOD: number) => {
    let d = startOD;
    for (let i = from; i > to; i--) {
      const s = layerThicknessInward(layers[i], section, d);
      sized[i] = { ...s, innerDia: d - 2 * s.thickness, outerDia: d };
      d -= 2 * s.thickness;
    }
    return d;
  };

  if (mode === "fixedOD") {
    if (!(design.fixedOD && design.fixedOD > 0)) problems.push("Enter the fixed OD on the Design step.");
    inward(n - 1, -1, design.fixedOD ?? 0);
  } else if (mode === "fixedODandID") {
    const id = design.fixedID ?? 0;
    const od = design.fixedOD ?? 0;
    if (!(id > 0 && od > id)) problems.push("Fixed OD must be larger than fixed ID (Design step).");
    const a = layers.findIndex((l) => l.adaptive);
    if (a < 0) {
      problems.push("Choose one adaptive layer to take up the wall between the fixed ID and OD.");
      outward(0, n, id);
    } else {
      const below = outward(0, a, id);
      const above = inward(n - 1, a, od);
      const t = (above - below) / 2;
      sized[a] = { thickness: t, innerDia: below, outerDia: above };
      if (!(t > 0)) problems.push(`Adaptive layer "${layers[a].name}" has no room: thickness ${fmt(t)} mm. Thin the other layers or widen the OD–ID gap.`);
    }
  } else {
    if (!(design.fixedID && design.fixedID > 0)) problems.push("Enter the fixed ID (mandrel diameter) on the Design step.");
    outward(0, n, design.fixedID ?? 0);
  }

  // Matrix of each non-polymer layer = nearest polymer layer outside it.
  const resolved: ResolvedLayer[] = layers.map((layer, i) => {
    const r: ResolvedLayer = { layer, innerDia: sized[i].innerDia, outerDia: sized[i].outerDia, thickness: sized[i].thickness };
    if (sized[i].braid) r.braid = sized[i].braid;
    if (sized[i].coil) r.coil = sized[i].coil;
    if (layer.type !== "polymer") r.matrixMaterialId = layers.slice(i + 1).find((l) => l.type === "polymer")?.materialId;
    return r;
  });

  const innerDia = n ? resolved[0].innerDia : 0;
  const outerDia = n ? resolved[n - 1].outerDia : 0;

  // ---- validation (spec Section 3) ----
  if (n === 0) problems.push("The section has no layers.");
  else {
    if (layers[0].type !== "polymer") problems.push("The innermost layer must be a polymer.");
    if (layers[n - 1].type !== "polymer") problems.push("The outermost layer must be a polymer.");
  }
  if (!(innerDia > 0) && n > 0 && mode === "fixedOD") problems.push("The layers are thicker than the fixed OD allows (ID ≤ 0).");

  for (const rl of resolved) {
    const { layer } = rl;
    const name = `"${layer.name}"`;
    if (layer.type === "polymer") {
      if (!layer.materialId) problems.push(`${name}: choose a material.`);
      if (!layer.adaptive && !(layer.thickness > 0)) problems.push(`${name}: thickness must be greater than 0.`);
      continue;
    }
    if (layer.adaptive) problems.push(`${name}: a reinforcement layer cannot be the adaptive layer.`);
    const r = layer.reinforcement;
    if (!r) continue;
    if (!(wireThk(r) > 0 && wireWidth(r) > 0)) problems.push(`${name}: enter the wire size.`);
    if (rl.braid) {
      if (!((r.carriers ?? 0) >= 2) || !((r.ppi ?? 0) > 0)) problems.push(`${name}: enter carriers and PPI.`);
      else if (!rl.braid.jam.fits) problems.push(`${name}: the wires cannot fit round this diameter even laid axially — use fewer ends/filars or narrower wire.`);
      else if ((r.ppi ?? 0) > rl.braid.jam.ppiMax * (1 + 1e-9)) problems.push(`${name}: ${r.ppi} PPI is above the jamming limit of ${rl.braid.jam.ppiMax.toFixed(1)} PPI.`);
      if (layer.type === "triaxialBraid" && !((r.axialWireCount ?? 0) >= 1)) problems.push(`${name}: enter the number of axial wires.`);
    }
    if (rl.coil) {
      if (!((r.pitch ?? 0) > 0)) problems.push(`${name}: enter the coil pitch.`);
      else if ((r.pitch ?? 0) < rl.coil.minPitch * (1 - 1e-9)) problems.push(`${name}: pitch is below closed pitch (${fmt(rl.coil.minPitch)} mm = wire width × filars).`);
    }
  }

  // ---- pull-wire lumens ----
  const lumens: ResolvedLumen[] = [];
  let pullwireOffset: number | undefined;
  const pw = resolved.find((l) => l.layer.type === "pullwireLayer");
  const lu = section.pullwireLumen;
  if (pw && lu && design.pullwires.arrangement !== "none") {
    const rp = (pw.innerDia + pw.outerDia) / 4;
    pullwireOffset = rp;
    const flat = lu.lumenID === undefined;
    const boreThk = flat ? (lu.lumenThk ?? 0) : (lu.lumenID ?? 0);
    const boreWidth = flat ? (lu.lumenWidth ?? 0) : (lu.lumenID ?? 0);
    const linerWall = lu.linerMaterialId ? (lu.linerWall ?? 0) : 0;
    for (const angleDeg of PULLWIRE_ANGLES[design.pullwires.arrangement]) {
      lumens.push({ angleDeg, rp, shape: flat ? "flat" : "round", boreThk, boreWidth, linerWall, linerMaterialId: lu.linerMaterialId });
    }
    const w = design.pullwires;
    const needThk = wireThk(w) + PULLWIRE_CLEARANCE;
    const needWidth = wireWidth(w) + PULLWIRE_CLEARANCE;
    if (boreThk < needThk - 1e-9 || boreWidth < needWidth - 1e-9) {
      problems.push(`Pull-wire lumen is too small: it must be at least the wire size + ${PULLWIRE_CLEARANCE} mm (${fmt(needThk)}${flat ? ` × ${fmt(needWidth)}` : ""} mm).`);
    }
    if (lu.linerMaterialId && !(linerWall > 0)) problems.push("Pull-wire lumen liner: enter the liner wall.");
    // The lumen (with its liner) must lie entirely inside the wall.
    const halfT = boreThk / 2 + linerWall;
    const halfW = boreWidth / 2 + linerWall;
    const farCorner = flat ? Math.hypot(rp + halfT, halfW) : rp + halfT;
    if (rp - halfT < innerDia / 2 - 1e-9) problems.push("Pull-wire lumen breaks into the bore.");
    if (farCorner > outerDia / 2 + 1e-9) problems.push("Pull-wire lumen breaks through the OD — add jacket thickness or use a narrower lumen.");
    if (lumens.length === 4 && halfW >= (rp - halfT) * Math.SQRT1_2) problems.push("The four pull-wire lumens overlap each other.");
    if (lumens.length === 2 && halfW >= rp + halfT) problems.push("The two pull-wire lumens overlap each other.");
  }

  if (section.mode !== "layered") {
    // Manual-stiffness and rigid sections are not built from layers; only their own inputs are checked.
    problems.length = 0;
    if (section.mode === "manualStiffness") {
      const m = section.manual;
      if (!m || !(m.EI > 0 && m.GJ > 0 && m.EA > 0)) problems.push("Manual stiffness: enter EI, GJ and EA (all greater than 0).");
      if (design.pullwires.arrangement !== "none" && !((m?.pullwireOffset ?? 0) > 0)) problems.push("Manual stiffness: enter the pull-wire offset.");
      pullwireOffset = m?.pullwireOffset;
    }
  }
  if (!(section.length >= MIN_SECTION_LENGTH)) problems.push(`Length must be at least ${MIN_SECTION_LENGTH} mm.`);

  return { section, innerDia, outerDia, wall: (outerDia - innerDia) / 2, layers: resolved, lumens, pullwireOffset, problems };
}

export function resolveDesign(design: Design): ResolvedSection[] {
  return design.sections.map((s) => resolveSection(design, s));
}
