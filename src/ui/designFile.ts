import { useApp } from "../state/store";
import { parseDesignFile, serializeDesign } from "../model/io";
import { combineLibraries } from "../model/materials";
import { validateDesign } from "../model/design";
import { downloadText, pickTextFile, safeFilename } from "./files";

export function saveDesignToFile(): void {
  const { design, materials } = useApp.getState();
  downloadText(`${safeFilename(design.name)}.cathsim.json`, serializeDesign(design, materials));
}

export async function loadDesignFromFile(): Promise<void> {
  const text = await pickTextFile();
  if (text === undefined) return;
  const { materials, setMaterials, replaceDesign, setNotice } = useApp.getState();
  const parsed = parseDesignFile(text);
  if (!parsed.ok) return setNotice({ kind: "error", lines: ["Could not load the design — nothing was changed.", ...parsed.errors] });
  // Bring in any materials the file carries that this library does not have yet (matched by id).
  const have = new Set(materials.map((m) => m.id));
  const missing = parsed.value.materials.filter((m) => !have.has(m.id));
  const nextMaterials = missing.length ? combineLibraries(materials, missing) : materials;
  const problems = validateDesign(parsed.value.design, nextMaterials);
  if (missing.length) setMaterials(nextMaterials);
  replaceDesign(parsed.value.design);
  setNotice({
    kind: problems.length ? "error" : "ok",
    lines: [`Loaded “${parsed.value.design.name}”.` + (missing.length ? ` Added ${missing.length} material(s) from the file to the library.` : ""), ...problems],
  });
}
