import type { Design, Material } from "./types";
import { MAX_TOTAL_LENGTH, MIN_SECTION_LENGTH } from "./types";
import { newId } from "./id";
import { referencedMaterialIds } from "./materials";

/** Starter design shown on first launch: one section, PTFE liner + Pebax 72D jacket, no pull-wires. */
export function createDefaultDesign(): Design {
  const sectionId = newId("sec");
  return {
    name: "Untitled design",
    units: "mm",
    designMode: "fixedID",
    fixedID: 1.6,
    pullwires: {
      arrangement: "none",
      anchorAfterSectionId: sectionId,
      wireShape: "round",
      wireDia: 0.1016, // 0.004"
      materialId: "ss-304v-spring",
    },
    sections: [
      {
        id: sectionId,
        label: "Section 1",
        color: "#4f8fd0",
        length: 100,
        mode: "layered",
        useCore: false,
        layers: [
          { id: newId("lay"), name: "Liner", color: "#e8e2c8", type: "polymer", materialId: "ptfe-liner", thickness: 0.025, adaptive: false },
          { id: newId("lay"), name: "Jacket", color: "#4f8fd0", type: "polymer", materialId: "pebax-72d", thickness: 0.175, adaptive: false },
        ],
      },
    ],
  };
}

const isReinforcement = (t: string) => t === "braid" || t === "triaxialBraid" || t === "coil";

/** Structural checks on a design (Section 3 rules that do not need the calculator). */
export function validateDesign(design: Design, materials: Material[]): string[] {
  const errs: string[] = [];
  if (!design.sections.length) errs.push("The design has no sections.");
  let total = 0;
  for (const s of design.sections) {
    total += s.length;
    if (!(s.length >= MIN_SECTION_LENGTH)) errs.push(`${s.label}: length must be at least ${MIN_SECTION_LENGTH} mm.`);
    if (s.mode === "layered") {
      if (s.layers.length === 0) errs.push(`${s.label}: has no layers.`);
      else {
        if (s.layers[0].type !== "polymer") errs.push(`${s.label}: the innermost layer must be a polymer.`);
        if (s.layers[s.layers.length - 1].type !== "polymer") errs.push(`${s.label}: the outermost layer must be a polymer.`);
      }
      const adaptive = s.layers.filter((l) => l.adaptive);
      if (adaptive.some((l) => isReinforcement(l.type))) errs.push(`${s.label}: a reinforcement layer cannot be adaptive.`);
      if (design.designMode === "fixedODandID" && adaptive.length !== 1) {
        errs.push(`${s.label}: exactly one adaptive layer is needed in fixed OD + ID mode.`);
      }
    }
    if (s.mode === "manualStiffness" && !s.manual) errs.push(`${s.label}: manual stiffness values are missing.`);
  }
  if (total > MAX_TOTAL_LENGTH) errs.push(`Total length ${total} mm exceeds ${MAX_TOTAL_LENGTH} mm.`);
  const known = new Set(materials.map((m) => m.id));
  for (const id of referencedMaterialIds(design)) {
    if (!known.has(id)) errs.push(`Material "${id}" is used in the design but is not in the library.`);
  }
  return errs;
}
