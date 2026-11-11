import type { Design, Material } from "./types";
import { validateLibrary } from "./materials";

// File formats. Human-readable JSON, versioned so later phases can migrate old files.
export const FILE_VERSION = 1;

export interface MaterialsFile {
  format: "cathsim-materials";
  version: number;
  materials: Material[];
}

export interface DesignFile {
  format: "cathsim-design";
  version: number;
  design: Design;
  /** Snapshot of the library so a design emailed to another machine still resolves its materials. */
  materials: Material[];
}

export function serializeMaterials(materials: Material[]): string {
  const file: MaterialsFile = { format: "cathsim-materials", version: FILE_VERSION, materials };
  return JSON.stringify(file, null, 2);
}

export function serializeDesign(design: Design, materials: Material[]): string {
  const file: DesignFile = { format: "cathsim-design", version: FILE_VERSION, design, materials };
  return JSON.stringify(file, null, 2);
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };

function parseJson(text: string): ParseResult<unknown> {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (e) {
    return { ok: false, errors: [`Not a valid JSON file (${(e as Error).message}).`] };
  }
}

function checkVersion(v: unknown): string | undefined {
  if (typeof v !== "number") return "The file has no version number.";
  if (v > FILE_VERSION) return `The file was written by a newer CathSim (file version ${v}).`;
  return undefined;
}

/** Parses a materials library file. Refuses the whole file if any row is invalid, naming the row. */
export function parseMaterialsFile(text: string): ParseResult<Material[]> {
  const j = parseJson(text);
  if (!j.ok) return j;
  const f = j.value as Partial<MaterialsFile>;
  if (!f || f.format !== "cathsim-materials" || !Array.isArray(f.materials)) {
    return { ok: false, errors: ["This is not a CathSim materials library file."] };
  }
  const v = checkVersion(f.version);
  if (v) return { ok: false, errors: [v] };
  const errors = validateLibrary(f.materials);
  if (errors.length) return { ok: false, errors };
  return { ok: true, value: f.materials };
}

export function parseDesignFile(text: string): ParseResult<{ design: Design; materials: Material[] }> {
  const j = parseJson(text);
  if (!j.ok) return j;
  const f = j.value as Partial<DesignFile>;
  if (!f || f.format !== "cathsim-design" || !f.design || !Array.isArray(f.design.sections) || !f.design.pullwires) {
    return { ok: false, errors: ["This is not a CathSim design file."] };
  }
  const v = checkVersion(f.version);
  if (v) return { ok: false, errors: [v] };
  const materials = Array.isArray(f.materials) ? f.materials : [];
  const errors = validateLibrary(materials);
  if (errors.length) return { ok: false, errors: errors.map((e) => `Materials in file — ${e}`) };
  return { ok: true, value: { design: f.design, materials } };
}
