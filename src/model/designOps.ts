// Pure editing operations on a Design (used by the Setup wizard). Each returns a new Design.

import type { Design, Layer, LayerType, PullwireConfig, PullwireLumen, Section } from "./types";
import { newId } from "./id";
import { PULLWIRE_CLEARANCE, resolveSection, wireThk, wireWidth } from "../physics/geometry";

export const SECTION_COLORS = ["#4285f4", "#34a853", "#fbbc04", "#ea4335", "#a142f4", "#24c1e0", "#f29900", "#5f6368"];
const LAYER_COLORS: Record<LayerType, string> = {
  polymer: "#8ab4f8",
  braid: "#9aa0a6",
  triaxialBraid: "#80868b",
  coil: "#bdc1c6",
  pullwireLayer: "#fde293",
};
const IN = 25.4;

const mapSection = (d: Design, sectionId: string, f: (s: Section) => Section): Design => ({
  ...d,
  sections: d.sections.map((s) => (s.id === sectionId ? f(s) : s)),
});

export function updateSection(d: Design, sectionId: string, patch: Partial<Section>): Design {
  return mapSection(d, sectionId, (s) => ({ ...s, ...patch }));
}

export function updateLayer(d: Design, sectionId: string, layerId: string, patch: Partial<Layer>): Design {
  return mapSection(d, sectionId, (s) => ({
    ...s,
    layers: s.layers.map((l) => {
      if (patch.adaptive && l.id !== layerId) return { ...l, adaptive: false }; // exactly one adaptive layer
      return l.id === layerId ? { ...l, ...patch } : l;
    }),
  }));
}

export function updateReinforcement(d: Design, sectionId: string, layerId: string, patch: Partial<NonNullable<Layer["reinforcement"]>>): Design {
  return mapSection(d, sectionId, (s) => ({
    ...s,
    layers: s.layers.map((l) => (l.id === layerId && l.reinforcement ? { ...l, reinforcement: { ...l.reinforcement, ...patch } } : l)),
  }));
}

/** A new layer with starting values. Wire defaults are common sizes from spec Section 6, not recommendations. */
export function makeLayer(type: Exclude<LayerType, "pullwireLayer">, defaultPolymerId?: string): Layer {
  const base = { id: newId("lay"), color: LAYER_COLORS[type], adaptive: false };
  const flat = { wireShape: "flat" as const, wireThk: 0.001 * IN, wireWidth: 0.003 * IN };
  switch (type) {
    case "polymer":
      return { ...base, name: "Polymer", type, materialId: defaultPolymerId, thickness: 0.1 };
    case "braid":
      return { ...base, name: "Braid", type, thickness: 0, reinforcement: { ...flat, wireMaterialId: "ss-304v-spring", ppi: 60, carriers: 16, filars: 1, pattern: "fullLoad" } };
    case "triaxialBraid":
      return {
        ...base,
        name: "Triaxial braid",
        type,
        thickness: 0,
        reinforcement: { ...flat, wireMaterialId: "ss-304v-spring", ppi: 60, carriers: 16, filars: 1, pattern: "fullLoad", axialWireCount: 4, matchAxialToBias: true },
      };
    case "coil":
      return { ...base, name: "Coil", type, thickness: 0, reinforcement: { ...flat, wireMaterialId: "ss-304v-spring", pitch: 0.006 * IN, coilCarriers: 1, coilFilars: 1 } };
  }
}

/** Inserts a new layer just outside `afterLayerId` (or as the outermost layer if not given). */
export function addLayer(d: Design, sectionId: string, type: Exclude<LayerType, "pullwireLayer">, afterLayerId?: string): { design: Design; layerId: string } {
  const layer = makeLayer(type);
  const design = mapSection(d, sectionId, (s) => {
    if (type === "polymer") layer.materialId = [...s.layers].reverse().find((l) => l.type === "polymer")?.materialId;
    const i = afterLayerId ? s.layers.findIndex((l) => l.id === afterLayerId) : s.layers.length - 1;
    const layers = [...s.layers];
    layers.splice(i + 1, 0, layer);
    return { ...s, layers };
  });
  return { design, layerId: layer.id };
}

export function deleteLayer(d: Design, sectionId: string, layerId: string): Design {
  return mapSection(d, sectionId, (s) => ({ ...s, layers: s.layers.filter((l) => l.id !== layerId || l.type === "pullwireLayer") }));
}

export function moveLayer(d: Design, sectionId: string, layerId: string, dir: -1 | 1): Design {
  return mapSection(d, sectionId, (s) => {
    const i = s.layers.findIndex((l) => l.id === layerId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= s.layers.length) return s;
    const layers = [...s.layers];
    [layers[i], layers[j]] = [layers[j], layers[i]];
    return { ...s, layers };
  });
}

// ---------- pull-wires ----------

/** Smallest allowed lumen for the current wire: wire size + clearance (spec Section 3). */
export function minimumLumen(pw: PullwireConfig): Pick<PullwireLumen, "lumenID" | "lumenThk" | "lumenWidth"> {
  return pw.wireShape === "round"
    ? { lumenID: wireThk(pw) + PULLWIRE_CLEARANCE }
    : { lumenThk: wireThk(pw) + PULLWIRE_CLEARANCE, lumenWidth: wireWidth(pw) + PULLWIRE_CLEARANCE };
}

/** Keeps a section's lumen the same shape as the wire and never smaller than the minimum. */
function fitLumen(pw: PullwireConfig, lumen: PullwireLumen | undefined): PullwireLumen {
  const min = minimumLumen(pw);
  const base: PullwireLumen = lumen ? { ...lumen } : { constructionType: "individualMandrels" };
  if (pw.wireShape === "round") {
    const id = Math.max(base.lumenID ?? 0, min.lumenID!);
    delete base.lumenThk;
    delete base.lumenWidth;
    return { ...base, lumenID: id };
  }
  const thk = Math.max(base.lumenThk ?? 0, min.lumenThk!);
  const width = Math.max(base.lumenWidth ?? 0, min.lumenWidth!);
  delete base.lumenID;
  return { ...base, lumenThk: thk, lumenWidth: width };
}

/**
 * Makes the "Pullwires" pseudo-layer agree with the pull-wire settings: present (directly over the liner
 * by default, see docs/DECISIONS.md #2) in every section from the proximal end up to and including the
 * anchor section, absent elsewhere.
 */
export function syncPullwires(d: Design): Design {
  const on = d.pullwires.arrangement !== "none";
  let anchorId = d.pullwires.anchorAfterSectionId;
  if (!d.sections.some((s) => s.id === anchorId)) anchorId = d.sections[d.sections.length - 1]?.id;
  const anchorIdx = d.sections.findIndex((s) => s.id === anchorId);
  const sections = d.sections.map((s, i) => {
    const has = s.layers.some((l) => l.type === "pullwireLayer");
    const want = on && i <= anchorIdx;
    if (!want) {
      if (!has && !s.pullwireLumen) return s;
      const { pullwireLumen: _drop, ...rest } = s;
      return { ...rest, layers: s.layers.filter((l) => l.type !== "pullwireLayer") };
    }
    let layers = s.layers;
    if (!has) {
      const layer: Layer = { id: newId("lay"), name: "Pullwires", color: LAYER_COLORS.pullwireLayer, type: "pullwireLayer", thickness: 0, adaptive: false };
      layers = [...s.layers];
      layers.splice(Math.min(1, layers.length), 0, layer);
    }
    return { ...s, layers, pullwireLumen: fitLumen(d.pullwires, s.pullwireLumen) };
  });
  return { ...d, pullwires: { ...d.pullwires, anchorAfterSectionId: anchorId }, sections };
}

export function updatePullwires(d: Design, patch: Partial<PullwireConfig>): Design {
  return syncPullwires({ ...d, pullwires: { ...d.pullwires, ...patch } });
}

// ---------- sections ----------

function copyConstruction(from: Section): Pick<Section, "mode" | "layers" | "manual" | "useCore" | "pullwireLumen"> {
  return {
    mode: from.mode,
    useCore: from.useCore,
    layers: from.layers.map((l) => ({ ...l, id: newId("lay"), reinforcement: l.reinforcement ? { ...l.reinforcement, axialWire: l.reinforcement.axialWire ? { ...l.reinforcement.axialWire } : undefined } : undefined })),
    manual: from.manual ? { ...from.manual } : undefined,
    pullwireLumen: from.pullwireLumen ? { ...from.pullwireLumen } : undefined,
  };
}

/** Adds a section proximal to (before) the selected one, starting as a copy of its construction. */
export function addSection(d: Design, selectedId?: string): { design: Design; sectionId: string } {
  const idx = Math.max(0, d.sections.findIndex((s) => s.id === selectedId));
  const src = d.sections[idx];
  const used = new Set(d.sections.map((s) => s.color));
  const color = SECTION_COLORS.find((c) => !used.has(c)) ?? SECTION_COLORS[d.sections.length % SECTION_COLORS.length];
  let n = d.sections.length + 1;
  while (d.sections.some((s) => s.label === `Section ${n}`)) n++;
  const section: Section = { id: newId("sec"), label: `Section ${n}`, color, length: src.length, ...copyConstruction(src) };
  const sections = [...d.sections];
  sections.splice(idx, 0, section);
  return { design: syncPullwires({ ...d, sections }), sectionId: section.id };
}

export function deleteSection(d: Design, sectionId: string): Design {
  if (d.sections.length <= 1) return d;
  const idx = d.sections.findIndex((s) => s.id === sectionId);
  const sections = d.sections.filter((s) => s.id !== sectionId);
  let pullwires = d.pullwires;
  if (pullwires.anchorAfterSectionId === sectionId) {
    pullwires = { ...pullwires, anchorAfterSectionId: sections[Math.max(0, idx - 1)].id };
  }
  return syncPullwires({ ...d, sections, pullwires });
}

export function moveSection(d: Design, sectionId: string, dir: -1 | 1): Design {
  const i = d.sections.findIndex((s) => s.id === sectionId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= d.sections.length) return d;
  const sections = [...d.sections];
  [sections[i], sections[j]] = [sections[j], sections[i]];
  return syncPullwires({ ...d, sections });
}

/** Clone From…: replaces the target section's whole construction with a copy of the source's. */
export function cloneConstruction(d: Design, targetId: string, sourceId: string): Design {
  const src = d.sections.find((s) => s.id === sourceId);
  if (!src || targetId === sourceId) return d;
  return syncPullwires(mapSection(d, targetId, (s) => ({ ...s, ...copyConstruction(src) })));
}

/**
 * Match Dimension To…: makes the target section's OD or ID equal to the source section's by changing
 * the thickness of one chosen polymer layer. Returns an error message if it cannot be done.
 */
export function matchDimension(d: Design, targetId: string, sourceId: string, dim: "OD" | "ID", layerId: string): { design: Design; error?: string } {
  const target = d.sections.find((s) => s.id === targetId);
  const source = d.sections.find((s) => s.id === sourceId);
  const layer = target?.layers.find((l) => l.id === layerId);
  if (!target || !source || !layer) return { design: d, error: "Choose a section and a layer." };
  if (layer.type !== "polymer") return { design: d, error: "Only a polymer layer can be adjusted." };
  if (dim === "OD" && (d.designMode === "fixedOD" || d.designMode === "fixedODandID")) return { design: d, error: "The OD is fixed in this design mode — every section already has the same OD." };
  if (dim === "ID" && d.designMode !== "fixedOD") return { design: d, error: "The ID is fixed in this design mode — every section already has the same ID." };
  const want = resolveSection(d, source);
  let design = d;
  // Reinforcement thickness can shift slightly with diameter (ride-over), so iterate a few times.
  for (let k = 0; k < 4; k++) {
    const sec = design.sections.find((s) => s.id === targetId)!;
    const now = resolveSection(design, sec);
    const diff = dim === "OD" ? (want.outerDia - now.outerDia) / 2 : (now.innerDia - want.innerDia) / 2;
    if (Math.abs(diff) < 1e-9) break;
    const current = sec.layers.find((l) => l.id === layerId)!.thickness;
    const next = current + diff;
    if (!(next > 0)) return { design: d, error: `"${layer.name}" would need a thickness of ${next.toFixed(4)} mm — choose a different layer.` };
    design = updateLayer(design, targetId, layerId, { thickness: next });
  }
  return { design };
}
