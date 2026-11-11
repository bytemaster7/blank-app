import { create } from "zustand";
import type { Design, Material, UnitSystem } from "../model/types";
import { seedMaterials } from "../model/seedMaterials";
import { createDefaultDesign } from "../model/design";
import { validateLibrary } from "../model/materials";

export const TABS = [
  "Setup",
  "Analysis",
  "Steering",
  "Kink Radius",
  "Pushability",
  "Design Sweep",
  "Reflow",
  "Braid Transfer",
  "Materials",
] as const;
export type TabName = (typeof TABS)[number];

const STORAGE_KEY = "cathsim.autosave.v1";

interface Persisted {
  design: Design;
  materials: Material[];
}

function loadAutosave(): Persisted | undefined {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    const p = JSON.parse(raw) as Persisted;
    if (!p?.design?.sections || !Array.isArray(p.materials) || validateLibrary(p.materials).length) return undefined;
    return p;
  } catch {
    return undefined;
  }
}

interface AppState {
  design: Design;
  materials: Material[];
  /** True once Build Model has been run on the current design (Phase 2 onward). */
  modelBuilt: boolean;
  tab: TabName;
  setTab: (tab: TabName) => void;
  setUnits: (units: UnitSystem) => void;
  updateDesign: (patch: Partial<Design>) => void;
  replaceDesign: (design: Design) => void;
  setMaterials: (materials: Material[]) => void;
  /** Applies a pure edit to the design; any edit un-builds the model. */
  edit: (fn: (d: Design) => Design) => void;
  /** Setup wizard step: "design", a section id (Construction), or "review". */
  step: string;
  setStep: (step: string) => void;
  buildModel: () => void;
  notice: Notice | null;
  setNotice: (n: Notice | null) => void;
}

export interface Notice {
  kind: "error" | "ok";
  lines: string[];
}

const saved = loadAutosave();

export const useApp = create<AppState>((set) => ({
  design: saved?.design ?? createDefaultDesign(),
  materials: saved?.materials ?? seedMaterials(),
  modelBuilt: false,
  tab: "Setup",
  setTab: (tab) => set({ tab }),
  // Display only: nothing is recomputed, stored values are untouched.
  setUnits: (units) => set((s) => ({ design: { ...s.design, units } })),
  updateDesign: (patch) => set((s) => ({ design: { ...s.design, ...patch }, modelBuilt: false })),
  replaceDesign: (design) => set({ design, modelBuilt: false, step: "design" }),
  setMaterials: (materials) => set({ materials }),
  edit: (fn) => set((s) => ({ design: fn(s.design), modelBuilt: false })),
  step: "design",
  setStep: (step) => set({ step, tab: "Setup" }),
  buildModel: () => set({ modelBuilt: true, tab: "Analysis" }),
  notice: null,
  setNotice: (notice) => set({ notice }),
}));

// Autosave to localStorage on every change.
useApp.subscribe((s) => {
  try {
    const p: Persisted = { design: s.design, materials: s.materials };
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    // storage full or unavailable — the explicit Save buttons still work
  }
});
