import { describe, expect, it } from "vitest";
import { seedMaterials } from "./seedMaterials";
import { combineLibraries, materialUsage, uniqueName, validateLibrary, validateMaterial } from "./materials";
import { parseDesignFile, parseMaterialsFile, serializeDesign, serializeMaterials } from "./io";
import { createDefaultDesign, validateDesign } from "./design";
import type { Material } from "./types";

describe("Seed materials library (Section 6)", () => {
  const lib = seedMaterials();

  it("has all 22 rows and passes validation", () => {
    expect(lib.length).toBe(22);
    expect(validateLibrary(lib)).toEqual([]);
  });

  it("carries the spec values for the reference material", () => {
    const p = lib.find((m) => m.name === "Pebax 72D")!;
    expect([p.density, p.E, p.poisson, p.UTS, p.creaseStrain]).toEqual([1.02, 510, 0.42, 56, 0.06]);
  });

  it("flags every crease strain and the three '(est.)' yields as estimates", () => {
    for (const m of lib) {
      if (m.creaseStrain !== undefined) expect(m.estimated).toContain("creaseStrain");
    }
    const estYield = lib.filter((m) => m.estimated?.includes("yieldStrength")).map((m) => m.id).sort();
    expect(estYield).toEqual(["nitinol", "ss-304v-spring", "tungsten"]);
  });
});

describe("Material validation (Section 5.9)", () => {
  const good: Material = { id: "x", name: "X", family: "Metal", thermoplastic: false, density: 8, E: 193000, poisson: 0.29, UTS: 505, yieldStrength: 215 };

  it("accepts a valid material", () => expect(validateMaterial(good)).toEqual([]));

  it("rejects each rule violation", () => {
    expect(validateMaterial({ ...good, E: 0 })).toContain("E must be > 0");
    expect(validateMaterial({ ...good, density: -1 })).toContain("density must be > 0");
    expect(validateMaterial({ ...good, UTS: 0 })).toContain("UTS must be > 0");
    expect(validateMaterial({ ...good, poisson: 0.5 }).length).toBe(1);
    expect(validateMaterial({ ...good, poisson: -1 }).length).toBe(1);
    expect(validateMaterial({ ...good, yieldStrength: 600 })).toContain("yield must be ≤ UTS");
    expect(validateMaterial({ ...good, name: " " })).toContain("name is empty");
  });

  it("names the offending row and catches duplicate names", () => {
    const errs = validateLibrary([good, { ...good, id: "y", name: "x" }, { ...good, id: "z", name: "Bad", E: -5 }]);
    expect(errs).toEqual(["Row 2 (x): duplicate name", "Row 3 (Bad): E must be > 0"]);
  });
});

describe("Materials library export / import", () => {
  const lib = seedMaterials();

  it("export → import returns an identical library", () => {
    const parsed = parseMaterialsFile(serializeMaterials(lib));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.value).toEqual(lib);
  });

  it("refuses a file with an invalid row and names it", () => {
    const bad = lib.map((m) => ({ ...m }));
    bad[5].poisson = 0.7;
    const parsed = parseMaterialsFile(serializeMaterials(bad));
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.errors[0]).toMatch(/^Row 6 \(Pebax 72D\)/);
  });

  it("refuses files that are not a materials library", () => {
    expect(parseMaterialsFile("not json").ok).toBe(false);
    expect(parseMaterialsFile('{"format":"something-else"}').ok).toBe(false);
    expect(parseMaterialsFile(serializeDesign(createDefaultDesign(), lib)).ok).toBe(false);
  });

  it("Combine renames clashes Name_2, Name_3 and keeps ids unique", () => {
    const once = combineLibraries(lib, [lib[5]]);
    const twice = combineLibraries(once, [lib[5]]);
    expect(twice.slice(-2).map((m) => m.name)).toEqual(["Pebax 72D_2", "Pebax 72D_3"]);
    expect(new Set(twice.map((m) => m.id)).size).toBe(twice.length);
    expect(validateLibrary(twice)).toEqual([]);
    expect(uniqueName("New", ["a", "b"])).toBe("New");
  });
});

describe("Design save / load", () => {
  const lib = seedMaterials();

  it("the starter design is valid", () => {
    expect(validateDesign(createDefaultDesign(), lib)).toEqual([]);
  });

  it("save → load returns an identical design", () => {
    const d = createDefaultDesign();
    d.name = "6 Fr test";
    d.units = "in";
    const parsed = parseDesignFile(serializeDesign(d, lib));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.design).toEqual(d);
      expect(parsed.value.materials).toEqual(lib);
    }
  });

  it("flags structural problems", () => {
    const d = createDefaultDesign();
    d.sections[0].length = 1;
    d.sections[0].layers[1].type = "braid";
    d.sections[0].layers[0].materialId = "missing";
    const errs = validateDesign(d, lib);
    expect(errs.some((e) => e.includes("at least 2 mm"))).toBe(true);
    expect(errs.some((e) => e.includes("outermost layer must be a polymer"))).toBe(true);
    expect(errs.some((e) => e.includes('"missing"'))).toBe(true);
  });

  it("reports where a material is used", () => {
    const d = createDefaultDesign();
    expect(materialUsage(d, "pebax-72d")).toEqual(["Section 1: Jacket"]);
    expect(materialUsage(d, "ss-304v-spring")).toEqual([]); // pull-wires are off
  });
});
