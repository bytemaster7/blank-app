# Changelog

## Phase 1 — Skeleton (tag `phase-1`)

**Added**
- Project skeleton: Vite + React + TypeScript, Vitest wired to `npm test`, starts with `npm run dev`. Fully offline after the one-time `npm install`.
- `CLAUDE.md` (Section 0 verbatim), `docs/SPEC.md` (the full brief), `docs/DECISIONS.md`, `PHYSICS.md`, this file.
- Data model from spec Section 3 (`src/model/types.ts`): Design, Section, Layer, Reinforcement, PullwireConfig, CoreProfile, Material.
- Seed materials library (22 materials, values exactly as in spec Section 6).
- Materials tab: editable table, search, add / delete / reorder, Import JSON (Combine or Replace), Export JSON, Reset to defaults, live validation.
- Blend tool: polymer + polymer (Davies) and polymer + additive (Guth–Gold, Nicolais–Narkis, Nielsen), live preview, auto-name, Save to library.
- Unit switch mm ↔ inch (with MPa ↔ psi, N ↔ lbf, g/cm³ ↔ lb/in³). Display only.
- Save Design / Load Design as readable JSON; autosave to the browser's local storage.
- Tab bar with all nine tabs; tabs that need a model show "Build the model first".
- Disclaimer banner on every screen.

**Tests (23, all green)** — blend tool incl. hand calculation 10.12, unit conversions, material validation, library export/import round trip, design save/load round trip.

**Differences from the spec / things I added (none change any formula)**
- Materials have a **notes** field (it is in the 5.9 table but not in the Section 3 model) and a per-property **estimate flag** (rule 4).
- Design files also carry a copy of the materials library, so a design emailed to another machine still finds its materials. On Load, materials the library does not already have are added.
- A material that the current design uses cannot be deleted, and Import → Replace is refused if it would remove one. The spec does not mention this; without it a design could point at a missing material.
- Edits that break a validation rule are rejected on the spot (the cell reverts, with the reason shown) so the library can never hold an invalid material.
- Blend tool: when the filler exceeds φ = 0.35 the cap is applied to E, ν, UTS and crease strain but **not** to density (see PHYSICS.md 3.3).
- The Setup tab is a placeholder (name, design mode, fixed ID/OD) until the wizard is built in Phase 2.
- Removed the Streamlit starter files that came with the repository.
