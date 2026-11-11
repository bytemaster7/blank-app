import type { Design, Material } from "./types";
import { newId } from "./id";

/** Validation rules from Section 5.9. Returns a list of problems (empty = valid). */
export function validateMaterial(m: Material): string[] {
  const errs: string[] = [];
  const num = (v: unknown) => typeof v === "number" && Number.isFinite(v);
  if (typeof m.name !== "string" || !m.name.trim()) errs.push("name is empty");
  if (!["Polymer", "Metal", "Other"].includes(m.family)) errs.push("family must be Polymer, Metal or Other");
  if (!num(m.E) || m.E <= 0) errs.push("E must be > 0");
  if (!num(m.density) || m.density <= 0) errs.push("density must be > 0");
  if (!num(m.UTS) || m.UTS <= 0) errs.push("UTS must be > 0");
  if (!num(m.poisson) || m.poisson <= -1 || m.poisson >= 0.5) errs.push("Poisson's ratio must be between −1 and 0.5");
  if (m.yieldStrength !== undefined) {
    if (!num(m.yieldStrength) || m.yieldStrength <= 0) errs.push("yield must be > 0");
    else if (num(m.UTS) && m.yieldStrength > m.UTS) errs.push("yield must be ≤ UTS");
  }
  if (m.creaseStrain !== undefined && (!num(m.creaseStrain) || m.creaseStrain <= 0)) {
    errs.push("crease strain must be > 0");
  }
  return errs;
}

/** Validates a whole library, including unique names. Each message names the offending row. */
export function validateLibrary(materials: Material[]): string[] {
  const errs: string[] = [];
  const seen = new Set<string>();
  materials.forEach((m, i) => {
    const label = `Row ${i + 1} (${m?.name || "unnamed"})`;
    for (const e of validateMaterial(m)) errs.push(`${label}: ${e}`);
    const key = (m.name ?? "").trim().toLowerCase();
    if (key && seen.has(key)) errs.push(`${label}: duplicate name`);
    seen.add(key);
  });
  return errs;
}

/** Returns `name`, or `name_2`, `name_3`… if it clashes with a name already taken. */
export function uniqueName(name: string, taken: Iterable<string>): string {
  const used = new Set([...taken].map((n) => n.trim().toLowerCase()));
  if (!used.has(name.trim().toLowerCase())) return name;
  for (let i = 2; ; i++) {
    const candidate = `${name}_${i}`;
    if (!used.has(candidate.toLowerCase())) return candidate;
  }
}

/** Import → Combine: keep the current library, append the incoming rows, renaming name clashes Name_2. */
export function combineLibraries(current: Material[], incoming: Material[]): Material[] {
  const out = [...current];
  const ids = new Set(current.map((m) => m.id));
  for (const m of incoming) {
    const name = uniqueName(m.name, out.map((x) => x.name));
    const id = !m.id || ids.has(m.id) ? newId("mat") : m.id;
    ids.add(id);
    out.push({ ...m, id, name });
  }
  return out;
}

/** Where a material is used in a design (human-readable), so we never delete one that is in use. */
export function materialUsage(design: Design, materialId: string): string[] {
  const uses: string[] = [];
  if (design.pullwires.arrangement !== "none" && design.pullwires.materialId === materialId) uses.push("pull-wire");
  if (design.core?.materialId === materialId) uses.push("core profile");
  for (const s of design.sections) {
    if (s.pullwireLumen?.linerMaterialId === materialId) uses.push(`${s.label}: pull-wire lumen liner`);
    for (const l of s.layers) {
      if (
        l.materialId === materialId ||
        l.reinforcement?.wireMaterialId === materialId ||
        l.reinforcement?.axialWire?.materialId === materialId
      ) {
        uses.push(`${s.label}: ${l.name}`);
      }
    }
  }
  return uses;
}

/** Every material id a design refers to. */
export function referencedMaterialIds(design: Design): string[] {
  const ids = new Set<string>();
  if (design.pullwires.arrangement !== "none") ids.add(design.pullwires.materialId);
  if (design.core) ids.add(design.core.materialId);
  for (const s of design.sections) {
    if (s.pullwireLumen?.linerMaterialId) ids.add(s.pullwireLumen.linerMaterialId);
    for (const l of s.layers) {
      if (l.materialId) ids.add(l.materialId);
      if (l.reinforcement) {
        ids.add(l.reinforcement.wireMaterialId);
        if (l.reinforcement.axialWire) ids.add(l.reinforcement.axialWire.materialId);
      }
    }
  }
  return [...ids];
}
