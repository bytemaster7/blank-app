# Changelog

## Phase 2 — Setup wizard (tag `phase-2`)

**Added**
- Setup wizard: Design → Construction (one step per section) → Review & Build, with a step rail and Back / Next.
- Design step: name, design mode, fixed ID / OD, section list (colour, label, length, reorder, add proximal to selection, delete), to-scale colour bar, pull-wire settings.
- Construction step: layer list, layer editor, live to-scale cross-section, Clone From… / Match Dimension To…, Manual Stiffness (with the how-to-measure help text) and Rigid Body modes.
- Braid and coil: live preview drawn to scale with the over/under pattern, braid angle, coverage, fill factor, density band, lay length and PPI max. PPI is capped at the jamming limit.
- Automatic "Pullwires" layer with lumen size, liner and construction type; lumens drawn in the cross-section with the wire to scale.
- Review & Build: colour bar with the anchor tick, a summary card per section with an Edit link, peel-away illustration (right-click copies it as a PNG), Save Design, Build Model.
- Live validation of every rule in spec Section 3; problems are listed beside the cross-section and counted on the step rail. Build Model is disabled until they are cleared.
- Physics: braid and coil geometry (4.3), computed reinforcement thickness (4.2), layer-stack resolution for all three design modes. See PHYSICS.md sections 5 and 6.
- **Look and feel:** restyled in Google's Material Design (bundled Roboto font, pill buttons, rounded cards, outlined fields).
- **No Node.js needed to use it:** `release/CathSim.html` is the whole app in one file — download it and double-click. Works offline; designs autosave in the browser.

**Tests (39, all green)** — adds hand calculation 10.3 (braid: 3.387 mm, 62.0°, F 0.204, C 0.366, PPI max 332), a coil hand calculation, layer stacking in each design mode, ride-over, pull-wire lumen placement, and Clone / Match.

**Differences from the spec / decisions (none change a formula)**
- Build Model checks the design and opens Analysis, but the calculator itself is Phase 3, so Analysis is still empty.
- Multi-lumen core is listed as a design mode but disabled until Phase 9.
- The pull-wire lumen takes the same shape as the wire (round or flat) rather than being chosen separately.
- Pull-wire lumens exist only from the proximal end to the anchor section; sections distal of the anchor have none.
- Entering a PPI above the limit caps it. If a later change (smaller diameter, wider wire) pushes the existing PPI above the new limit, an error is shown rather than changing your number.
- "Add section proximal to selection" starts the new section as a copy of the selected one.
- The peel-away exaggerates thin layers radially (minimum drawn thickness) so liners and braids stay visible; the cross-section is true to scale.
- Braid mean diameter is implemented exactly as written (layer ID + t_w); PHYSICS.md 5.1 notes that the layer's mid-wall would be ID + 2·t_w, for you to decide.
- New dependencies: `@fontsource/roboto` (font, bundled) and `vite-plugin-singlefile` (build tool).

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
