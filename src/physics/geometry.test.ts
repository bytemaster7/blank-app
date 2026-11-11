import { describe, expect, it } from "vitest";
import { check } from "../testUtil";
import { braidGeometry, coilGeometry, densityBand } from "./braid";
import { resolveSection } from "./geometry";
import { createDefaultDesign } from "../model/design";
import { addLayer, addSection, cloneConstruction, deleteSection, matchDimension, updateLayer, updatePullwires, updateReinforcement } from "../model/designOps";
import type { Design } from "../model/types";

const IN = 25.4;

describe("10.3 Braid geometry — 16 ends, 0.001×0.003 in flat wire, 60 PPI on a 2.000 mm liner", () => {
  it("matches the hand calculation", () => {
    console.log("\nTest 10.3 — braid geometry (Dm = 2.0254 mm)");
    const g = braidGeometry({ Dm: 2.0254, carriers: 16, filars: 1, wireWidth: 0.0762, ppi: 60 });
    check("lay length L_lay", g.layLength, 3.387, "mm");
    check("braid angle α (from axis)", g.alphaDeg, 62.0, "deg");
    check("fill factor F", g.fill, 0.204, "");
    check("coverage C", g.coverage, 0.366, "");
    check("jamming limit PPI_max", g.jam.ppiMax, 332, "PPI");
    expect(g.band).toBe("ok");
  });

  it("at PPI_max the fill factor is exactly 1", () => {
    const g0 = braidGeometry({ Dm: 2.0254, carriers: 16, filars: 1, wireWidth: 0.0762, ppi: 60 });
    const g = braidGeometry({ Dm: 2.0254, carriers: 16, filars: 1, wireWidth: 0.0762, ppi: g0.jam.ppiMax });
    expect(g.fill).toBeCloseTo(1, 9);
    expect(g.coverage).toBeCloseTo(1, 9);
  });

  it("reports when the wires cannot fit even at 0°", () => {
    // Each family has N/2 wires: 96/2 ends × 2 filars × 0.0762 mm = 7.32 mm of wire on a 6.36 mm circumference
    expect(braidGeometry({ Dm: 2.0254, carriers: 96, filars: 2, wireWidth: 0.0762, ppi: 60 }).jam.fits).toBe(false);
    expect(braidGeometry({ Dm: 2.0254, carriers: 64, filars: 2, wireWidth: 0.0762, ppi: 60 }).jam.fits).toBe(true);
  });

  it("density bands", () => {
    expect([0.5, 0.7, 0.84, 0.85, 0.99, 1, 1.2].map(densityBand)).toEqual(["ok", "high", "high", "nearBinding", "nearBinding", "binding", "binding"]);
  });
});

describe("Coil geometry (4.3)", () => {
  it("single-start and two-start coil", () => {
    console.log("\nCoil geometry — 0.003 in wide wire, pitch 0.300 mm, Dm = 2.0254 mm");
    // Hand calc: lead = 0.300; tan α = π·2.0254/0.300 = 21.210 → α = 87.30°; C = 0.0762/0.300 = 0.254
    const c1 = coilGeometry({ Dm: 2.0254, pitch: 0.3, starts: 1, filars: 1, wireWidth: 0.0762 });
    check("lead (1 start)", c1.lead, 0.3, "mm");
    check("coil angle α", c1.alphaDeg, 87.3, "deg");
    check("coverage C_coil", c1.coverage, 0.254, "");
    // Two starts: lead = 0.600; tan α = 10.605 → α = 84.61°
    const c2 = coilGeometry({ Dm: 2.0254, pitch: 0.3, starts: 2, filars: 1, wireWidth: 0.0762 });
    check("lead (2 starts)", c2.lead, 0.6, "mm");
    check("coil angle α (2 starts)", c2.alphaDeg, 84.61, "deg");
    expect(c2.minPitch).toBeCloseTo(0.0762, 12);
  });
});

/** Liner 0.200 mm on a 1.600 mm mandrel (→ 2.000 mm OD), braid, 0.150 mm jacket. */
function braidedDesign(): { design: Design; secId: string; braidId: string; jacketId: string } {
  let design = createDefaultDesign();
  const sec = design.sections[0];
  design = updateLayer(design, sec.id, sec.layers[0].id, { thickness: 0.2 });
  design = updateLayer(design, sec.id, sec.layers[1].id, { thickness: 0.15 });
  const added = addLayer(design, sec.id, "braid", sec.layers[0].id);
  return { design: added.design, secId: sec.id, braidId: added.layerId, jacketId: sec.layers[1].id };
}

describe("Layer stack (Section 3, 4.2)", () => {
  it("fixed ID: stacks outward; braid thickness = 2 × wire thickness; braid seats on the liner OD", () => {
    console.log("\nLayer stack — 1.600 mandrel, 0.200 liner, 16×0.001×0.003 braid @60 PPI, 0.150 jacket");
    const { design } = braidedDesign();
    const r = resolveSection(design, design.sections[0]);
    expect(r.problems).toEqual([]);
    check("section ID", r.innerDia, 1.6, "mm", 1e-9);
    check("braid seat diameter", r.layers[1].innerDia, 2.0, "mm", 1e-9);
    check("braid thickness (2·t_w)", r.layers[1].thickness, 0.0508, "mm", 1e-9);
    check("braid mean diameter Dm", r.layers[1].braid!.Dm, 2.0254, "mm", 1e-9);
    check("braid angle", r.layers[1].braid!.alphaDeg, 62.0, "deg");
    check("section OD", r.outerDia, 2.0 + 2 * 0.0508 + 0.3, "mm", 1e-9);
    check("wall", r.wall, 0.2 + 0.0508 + 0.15, "mm", 1e-9);
    expect(r.layers[1].matrixMaterialId).toBe("pebax-72d"); // matrix = the jacket outside the braid
  });

  it("fixed OD: stacks inward", () => {
    const { design } = braidedDesign();
    const d: Design = { ...design, designMode: "fixedOD", fixedOD: 2.4016 };
    const r = resolveSection(d, d.sections[0]);
    expect(r.outerDia).toBeCloseTo(2.4016, 12);
    expect(r.innerDia).toBeCloseTo(1.6, 9);
    expect(r.layers[1].braid!.alphaDeg).toBeCloseTo(61.98, 1);
  });

  it("fixed OD and ID: the adaptive layer takes up the difference, and errors when there is no room", () => {
    const { design, secId, jacketId } = braidedDesign();
    let d: Design = { ...design, designMode: "fixedODandID", fixedID: 1.6, fixedOD: 2.5 };
    expect(resolveSection(d, d.sections[0]).problems.join()).toMatch(/adaptive layer/);
    d = updateLayer(d, secId, jacketId, { adaptive: true });
    const r = resolveSection(d, d.sections[0]);
    expect(r.problems).toEqual([]);
    check("adaptive jacket thickness", r.layers[2].thickness, (2.5 - 1.6) / 2 - 0.2 - 0.0508, "mm", 1e-9);
    d = { ...d, fixedOD: 2.05 };
    expect(resolveSection(d, d.sections[0]).problems.join()).toMatch(/no room/);
  });

  it("ride-over: +10% of wire thickness only when F > 0.85 on a 2-over-2 braid", () => {
    const { design, secId, braidId } = braidedDesign();
    const dense = updateReinforcement(design, secId, braidId, { ppi: 320 }); // F ≈ 0.97
    const r1 = resolveSection(dense, dense.sections[0]).layers[1];
    expect(r1.braid!.fill).toBeGreaterThan(0.85);
    expect(r1.thickness).toBeCloseTo(2.1 * 0.0254, 12);
    const diamond = updateReinforcement(dense, secId, braidId, { pattern: "diamond" });
    expect(resolveSection(diamond, diamond.sections[0]).layers[1].thickness).toBeCloseTo(2 * 0.0254, 12);
  });

  it("triaxial = 2 × bias + 1 × axial; coil = 1 × wire thickness", () => {
    const { design, secId, braidId } = braidedDesign();
    const tri = updateLayer(design, secId, braidId, { type: "triaxialBraid", reinforcement: { ...design.sections[0].layers[1].reinforcement!, axialWireCount: 4, matchAxialToBias: true } });
    expect(resolveSection(tri, tri.sections[0]).layers[1].thickness).toBeCloseTo(3 * 0.0254, 12);
    const coil = updateLayer(design, secId, braidId, { type: "coil", reinforcement: { wireShape: "round", wireDia: 0.002 * IN, wireMaterialId: "ss-304v-spring", pitch: 0.1, coilCarriers: 1, coilFilars: 1 } });
    const rc = resolveSection(coil, coil.sections[0]);
    expect(rc.layers[1].thickness).toBeCloseTo(0.0508, 12);
    expect(rc.problems).toEqual([]);
    const tight = updateReinforcement(coil, secId, braidId, { pitch: 0.04 });
    expect(resolveSection(tight, tight.sections[0]).problems.join()).toMatch(/closed pitch/);
  });

  it("validation: PPI above the jamming limit, reinforcement as outermost layer", () => {
    const { design, secId, braidId, jacketId } = braidedDesign();
    const over = updateReinforcement(design, secId, braidId, { ppi: 400 });
    expect(resolveSection(over, over.sections[0]).problems.join()).toMatch(/above the jamming limit of 331\.8 PPI/);
    const noJacket: Design = { ...design, sections: [{ ...design.sections[0], layers: design.sections[0].layers.filter((l) => l.id !== jacketId) }] };
    expect(resolveSection(noJacket, noJacket.sections[0]).problems).toContain("The outermost layer must be a polymer.");
  });
});

describe("Pull-wires", () => {
  it("inserts the Pullwires layer over the liner, sized to the wire + 0.025 mm, with the lumen at mid-radius", () => {
    console.log("\nPull-wire lumen — 0.004 in round wire, one wire at +Y");
    const { design } = braidedDesign();
    const d = updatePullwires(design, { arrangement: "single" });
    const s = d.sections[0];
    expect(s.layers.map((l) => l.type)).toEqual(["polymer", "pullwireLayer", "braid", "polymer"]);
    const r = resolveSection(d, s);
    expect(r.problems).toEqual([]);
    check("lumen ID (wire + 0.025)", s.pullwireLumen!.lumenID!, 0.1016 + 0.025, "mm", 1e-9);
    check("pull-wire layer thickness", r.layers[1].thickness, 0.1266, "mm", 1e-9);
    check("pull-wire offset r_pw", r.pullwireOffset!, 1.0 + 0.1266 / 2, "mm", 1e-9);
    expect(r.lumens.map((l) => l.angleDeg)).toEqual([90]);
    expect(resolveSection(updatePullwires(d, { arrangement: "four" }), s).lumens.map((l) => l.angleDeg)).toEqual([0, 90, 180, 270]);
  });

  it("only sections up to the anchor carry lumens; turning pull-wires off removes them", () => {
    const { design } = braidedDesign();
    const two = addSection(design, design.sections[0].id).design; // new section is proximal
    const [prox, dist] = two.sections;
    const d = updatePullwires(two, { arrangement: "two", anchorAfterSectionId: prox.id });
    expect(d.sections[0].layers.some((l) => l.type === "pullwireLayer")).toBe(true);
    expect(d.sections[1].layers.some((l) => l.type === "pullwireLayer")).toBe(false);
    const off = updatePullwires(d, { arrangement: "none" });
    expect(off.sections.every((s) => !s.pullwireLumen && !s.layers.some((l) => l.type === "pullwireLayer"))).toBe(true);
    // deleting the anchor section moves the anchor rather than leaving it dangling
    const moved = deleteSection(updatePullwires(two, { arrangement: "single", anchorAfterSectionId: dist.id }), dist.id);
    expect(moved.pullwires.anchorAfterSectionId).toBe(prox.id);
  });

  it("a lumen smaller than wire + clearance is an error; a bigger wire grows the lumen", () => {
    const { design } = braidedDesign();
    let d = updatePullwires(design, { arrangement: "single" });
    const s = d.sections[0];
    const small: Design = { ...d, sections: [{ ...s, pullwireLumen: { ...s.pullwireLumen!, lumenID: 0.11 } }] };
    expect(resolveSection(small, small.sections[0]).problems.join()).toMatch(/too small/);
    d = updatePullwires(d, { wireDia: 0.2 });
    expect(d.sections[0].pullwireLumen!.lumenID).toBeCloseTo(0.225, 12);
  });
});

describe("Clone From / Match Dimension To", () => {
  it("clone copies the construction with fresh layer ids", () => {
    const { design } = braidedDesign();
    const { design: two, sectionId } = addSection(createDefaultDesign());
    const merged: Design = { ...two, sections: [...two.sections, { ...design.sections[0], label: "Braided" }] };
    const cloned = cloneConstruction(merged, sectionId, design.sections[0].id);
    const target = cloned.sections.find((s) => s.id === sectionId)!;
    expect(target.layers.map((l) => l.type)).toEqual(["polymer", "braid", "polymer"]);
    expect(target.layers[1].id).not.toBe(design.sections[0].layers[1].id);
  });

  it("match OD adjusts the chosen layer so both sections have the same OD", () => {
    const { design } = braidedDesign();
    const { design: two, sectionId } = addSection(design, design.sections[0].id);
    // make the new section plain (no braid) so its OD differs
    const plain: Design = { ...two, sections: two.sections.map((s) => (s.id === sectionId ? { ...s, layers: s.layers.filter((l) => l.type === "polymer") } : s)) };
    const target = plain.sections.find((s) => s.id === sectionId)!;
    const res = matchDimension(plain, sectionId, design.sections[0].id, "OD", target.layers[1].id);
    expect(res.error).toBeUndefined();
    const a = resolveSection(res.design, res.design.sections[0]);
    const b = resolveSection(res.design, res.design.sections[1]);
    expect(a.outerDia).toBeCloseTo(b.outerDia, 9);
    expect(a.layers[1].thickness).toBeCloseTo(0.15 + 0.0508, 9);
    expect(matchDimension(plain, sectionId, design.sections[0].id, "ID", target.layers[1].id).error).toMatch(/ID is fixed/);
  });
});
