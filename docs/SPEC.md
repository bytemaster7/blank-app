# Build Prompt: "CathSim" — a personal catheter design & simulation workbench (v2)

> Stored verbatim as the project's reference specification. Section numbers used in `CLAUDE.md`, `PHYSICS.md` and `CHANGELOG.md` refer to this file.

Paste everything below this line into Claude Code. Work through it phase by phase — do not build everything in one go. After each phase, open the app, test it with a real design you know the answer for, then move to the next phase.

---

## 0. Who I am and how to work with me

I am a principal R&D engineer in catheter design and manufacturing with 20+ years' experience (extrusion, braiding, coiling, reflow lamination, tipping, PTFE liners, laser-cut hypotubes). I am not a software developer. I understand the mechanics deeply, so explain engineering choices to me plainly and do not hide formulas — but keep all code decisions yours. When something is ambiguous, ask me one short question rather than guessing.

Rules of engagement:

1. **First action of Phase 1:** create `CLAUDE.md` containing this Section 0 verbatim, so these rules survive every session.
2. Build in phases (Section 9). At the end of every phase: run `npm test` (it must be green), update `CHANGELOG.md`, commit and tag `phase-N`, then stop and tell me how to test the phase by hand. Do not start the next phase until I say "go".
3. Every formula you implement must appear in `PHYSICS.md` in plain engineering notation, with the assumption it relies on and its validity range. If you implement something differently from how I wrote it here, say so in PHYSICS.md and the CHANGELOG — never silently "correct" me; ask first.
4. Never fabricate material property values. Use the seed table in Section 6 and flag anything you had to estimate. Any threshold or constant that is not given in this prompt goes in a Settings panel, editable, labelled "estimate — not validated".
5. Every physics module gets Vitest unit tests against the hand-calculation cases in Section 10 before I see a UI for it. Print computed and expected values in the test output so I can read them.
6. The app runs fully offline on my laptop and starts with one command (`npm run dev`). No cloud, no accounts, no telemetry, and no Python backend — the only possible exception is Kink Radius Phase B (Section 5.4), and only if we get there.

## 1. What we are building (one paragraph)

A local browser app for designing and screening deflectable and non-deflectable catheter shafts. I define a shaft as a chain of sections; each section is a layer stack (liner → reinforcement → jacket) built from a materials library. The app then (a) calculates section stiffness and failure KPIs from composite mechanics, (b) simulates pull-wire steering of the whole shaft as a digital twin, (c) estimates the bend radius at which a section kinks and the push force at which the shaft buckles, (d) backs out pre-reflow extrusion sizes and heat-shrink ratios for procurement, (e) sweeps design variables in a DOE and plots a response surface, and (f) converts spool braid specs to on-shaft braid specs. This is a design-screening aid, not validated FEA — it should say so on every results screen.

This is for personal use. Do not use the name, logo, wording, or assets of any commercial product. All algorithms come from textbook mechanics (classical lamination theory, Euler-Bernoulli beams, Barlow's law, Euler buckling, Brazier collapse, braided-sleeve kinematics), which I list below.

## 2. Technology constraints

- Single-user, local-first: Vite + React + TypeScript, one repo, TypeScript throughout. Physics lives in `src/physics/` as pure functions with no UI imports.
- 3D: three.js for the deflected catheter viewer.
- Charts: recharts or plotly.js (Plotly is needed for the 3D response surface in Phase 8).
- Persistence: everything saved as human-readable JSON files I can email or version. Also autosave to localStorage. Provide Save Design / Load Design and Export/Import Materials Library buttons.
- Units: global toggle mm ↔ inch (and MPa ↔ psi, N ↔ lbf, g/cm³ ↔ lb/in³). Store everything internally in a consistent mm–N–MPa system (Section 4.0) and convert at the UI boundary only. Changing the unit toggle must never recompute anything — it only re-labels.
- Layout: tabbed workspace. Tabs in order: Setup · Analysis · Steering · Kink Radius · Pushability · Design Sweep · Reflow · Braid Transfer · Materials. Tabs that need a built model show a "Build the model first" empty state with a button back to Setup.
- Colours: every section and every layer has a user-pickable colour that is used consistently across the cross-section drawing, the peel-away drawing, the 3D viewer, and every chart.
- Reports: Export PDF/HTML report and Export CSV/XLSX of numeric results.

## 3. Core data model (define this first — everything hangs off it)

```
Design
  name: string
  units: "mm" | "in"           // display only
  designMode: "fixedID" | "fixedOD" | "fixedODandID" | "multiLumenCore"
  fixedID?: number             // mandrel diameter
  fixedOD?: number
  core?: CoreProfile           // only in multiLumenCore mode
  pullwires: PullwireConfig
  sections: Section[]          // index 0 = PROXIMAL, last = DISTAL TIP

Section
  id, label, color
  length: number               // min 2 mm; sum of all sections ≤ 1500 mm
  mode: "layered" | "manualStiffness" | "rigid"
  layers: Layer[]              // index 0 = INNERMOST (liner), last = OUTERMOST (jacket)
  manual?: { EI, GJ, EA, pullwireOffset }   // manualStiffness mode (also how I enter a laser-cut hypotube)
  useCore: boolean             // multi-lumen designs: false = plain bore in this section (e.g. soft tip)
  pullwireLumen?: { lumenID | lumenThk+lumenWidth, linerMaterialId?, linerWall?,
                    constructionType: "individualMandrels" | "multiLumenExtrusion" }

Layer
  id, name, color
  type: "polymer" | "braid" | "triaxialBraid" | "coil" | "pullwireLayer"
  materialId?                  // polymer layers only; reinforcement inherits its matrix from the layer OUTSIDE it
  thickness: number            // editable for polymer; COMPUTED for reinforcement (4.2)
  adaptive: boolean            // only in fixedODandID mode; exactly one per section; never a reinforcement layer
  reinforcement?: Reinforcement

Reinforcement
  wireMaterialId
  wireShape: "round" | "flat"
  wireDia? | wireThk? + wireWidth?
  // braid & triaxial
  ppi?: number                 // picks per inch
  carriers?: number            // number of LOADED wire ends: 16 / 24 / 32 / 48 / 64 …
  filars?: number              // wires side by side per carrier, 1–10, default 1
  pattern?: "fullLoad" | "halfLoad" | "diamond"     // semantics in 4.3
  // triaxial only
  axialWireCount?, matchAxialToBias: boolean, axialWire?: {shape, dims, materialId}
  // coil
  pitch?: number               // axial centre-to-centre spacing of adjacent wire bands (what I measure)
  coilCarriers?: number        // number of independent starts (multi-start helix), 1–10
  coilFilars?: number          // wires side by side in one band

PullwireConfig
  arrangement: "none" | "single" | "two" | "four"
  anchorAfterSectionId         // pullwires terminate at the distal end of this section
  wireShape: "round" | "flat"; dims; materialId (default 304V spring temper)
  // derived: wire area A_w, wire stiffness k = E·A_w/L, tension limit = yield·A_w (UTS·A_w if no yield)

CoreProfile   (multi-lumen extruded core)
  template: "doubleD" | "satellites" | "crescent" | "custom"
  parametric dims per template (OD, septum thickness, lumen dia, satellite count/pitch-circle, …)
  material, rotationDeg (relative to pullwire layout)

Material
  id, name, family: "Polymer" | "Metal" | "Other"
  thermoplastic: boolean       // used by Reflow tab
  density (g/cm³), E (MPa), poisson, UTS (MPa)
  optional: yieldStrength (MPa, metals), creaseStrain (polymers, for kink)
```

Derived per section (never stored, always recomputed): ID, OD, wall, per-layer ID/OD; EA, EIx, EIy (EImin, EImax), GJ, L/EA, L/GJ; (Et)x and Dθ from 4.4; linear density; burst, crush, tensile first-yield, torque first-yield; pull-wire offset; per reinforcement layer: angle α, fill F, coverage C, wire volume fraction Vf, Ex, Eθ, Gxθ. Multi-lumen cores additionally report principal EImin/EImax and the anisotropy ratio.

Validation rules to enforce live in the UI:

- Innermost and outermost layers must be polymer.
- Reinforcement layers cannot be adaptive.
- Pull-wire lumen dimension ≥ wire dimension + 0.025 mm (0.001") clearance; can be larger per section, never smaller.
- Pull-wire lumens must lie entirely within the wall (not break into the bore or through the OD).
- Braid PPI capped at the jamming limit for the current wire/carrier/filar/diameter (closed form in 4.3).
- Coil pitch ≥ wire width × coilFilars (closed pitch).
- In fixedODandID mode, if the adaptive layer thickness goes ≤ 0, show a red error on that section.

## 4. Physics — the calculator (Analysis tab)

Implement as pure functions in `src/physics/` with unit tests (Section 10). Every formula below goes into PHYSICS.md.

### 4.0 Conventions

- Internal units: mm, N, MPa (= N/mm²), N·mm (moment), N·mm² (EI, GJ). Density is stored in g/cm³ and converted where mass is needed: mass [g] = ρ [g/cm³] × A [mm²] × L [mm] × 10⁻³. Distributed gravity load: w [N/mm] = ρ_lin [g/mm] × 9.81 × 10⁻³.
- Braid and coil wire angles α are measured from the tube axis: 0° = axial, 90° = hoop.
- Per layer: inner radius rᵢ, outer radius rₒ, thickness t = rₒ − rᵢ. Per section: wall t_s = (OD − ID)/2, mean radius r_m = (OD + ID)/4.
- All section stiffnesses are computed about the section's geometric centre in two orthogonal directions (x, y), so pull-wire lumens and shaped cores are handled the same way.

### 4.1 Homogeneous polymer tube layer

For a layer with inner radius rᵢ, outer radius rₒ, modulus E, Poisson ν, shear modulus G = E / (2(1+ν)):

- A = π(rₒ² − rᵢ²), I = π/4 (rₒ⁴ − rᵢ⁴), J = π/2 (rₒ⁴ − rᵢ⁴)
- EA = E·A, EI = E·I, GJ = G·J

Layers are concentric, so section totals are plain sums over layers (no parallel-axis term).

**Pull-wire lumens** are voids that must be subtracted from every layer they pass through. For a lumen of diameter d (round) or thk × width (treat as a rectangle) centred at radius r_p and angle φ_p:

- ΔA = the lumen area falling inside that layer's annulus.
- ΔIx = I_own + ΔA·(r_p·sin φ_p)², ΔIy = I_own + ΔA·(r_p·cos φ_p)², where I_own = π·d⁴/64 for a round lumen or the rectangle's own second moments.
- ΔJ ≈ ΔIx + ΔIy (state this approximation).
- If the lumen has a liner (e.g. PTFE), add the liner back as its own material ring inside the lumen.
- Compute about the geometric centre and state in PHYSICS.md that the centroid shift caused by an unsymmetric lumen is neglected (< 0.1% for typical lumens — test 10.2).

Report EIx and EIy for every section; EImin/EImax are their min/max (identical for a round section with symmetric lumens). Steering, Kink Radius and Pushability use the EI about the actual bend axis (5.3, 5.4, 5.5).

### 4.2 Reinforcement layer thickness (read-only, computed)

- Braid: 2 × wire thickness (wire dia for round, ribbon thickness for flat). Add a ride-over allowance of +10% of the wire thickness only when fill factor F > 0.85 and the pattern is 2-over-2.
- Triaxial braid: 2 × bias wire thickness + 1 × axial wire thickness.
- Coil: 1 × wire thickness. Filars sit side by side and add no thickness.

### 4.3 Braid and coil geometry

**Braid.** Let Dm = braid mean diameter (layer ID + wire thickness), R = Dm/2, N = number of loaded wire ends (carriers), f = filars, w = wire width (dia for round), t_w = wire thickness, A_w = wire cross-section area (π·d²/4 round, w·t_w flat), PPI = picks per inch.

- Lay length (axial length of one full turn of one wire): L_lay = N / (2·PPI). PPI is per inch — convert L_lay to mm.
- Braid angle from the axis: tan α = π·Dm / L_lay.
- Fill factor = fraction of the surface covered by ONE wire family: F = (w·f·N) / (4π·R·cos α) = (w·f·N) / (2π·Dm·cos α).
- Coverage (Ko & Pastore): C = 1 − (1 − F)², clamped to [0, 1].
- Density bands: F < 0.70 OK · 0.70–0.85 High Density (process limit) · 0.85–1.0 Near Binding · ≥ 1.0 Binding Likely (jamming).
- Jamming limit, closed form (no iteration): cos α_jam = (w·f·N) / (2π·Dm). If the right-hand side ≥ 1 the wires cannot fit even at 0° — show an error. Otherwise L_lay,jam = π·Dm / tan α_jam and PPI_max = N / (2·L_lay,jam). Cap the PPI input at PPI_max.
- Pattern semantics: `diamond` = 1-over-1 interlace; `fullLoad` = 2-over-2 (regular) interlace; `halfLoad` = a 2-over-2 machine with alternate carriers empty, which is geometrically the diamond pattern with N = the ends actually loaded. N always means loaded ends. Pattern affects only the SVG preview and the ride-over rule in 4.2.
- Show a live SVG braid preview (two families of helices at ±α) with the computed angle, F and C.

**Coil.** pitch = axial centre-to-centre spacing of adjacent wire bands; a band = coilFilars wires side by side; coilCarriers = number of independent starts.

- Lead (axial advance per turn of one start) = pitch × coilCarriers.
- Coil angle from the axis: tan α_coil = π·Dm / lead.
- Coil coverage: C_coil = (w·coilFilars) / pitch; 1.0 is closed pitch.

### 4.4 Reinforcement layer stiffness (composite micromechanics)

Treat a braid band as a laminate of two unidirectional plies at +α and −α in a matrix of the polymer immediately outside it (the jacket that reflows into the braid). Wire E_w, ν_w, G_w; matrix E_m, ν_m, G_m.

**Wire volume fraction** — derived from the geometry, not assumed:

- Braid: Vf = F × A_w / (w·t_w). This equals F for flat wire and (π/4)·F for round wire. (At F = 1 each family is a complete sheet one wire thick, so the 2·t_w layer is solid metal and Vf = 1.)
- Coil: Vf = C_coil × A_w / (w·t_w).
- Triaxial axial wires: Vf,ax = n_ax·A_ax / (π·Dm,ax·t_ax) in their own sub-layer of thickness t_ax.

**Ply properties** (rule of mixtures): E₁ = Vf·E_w + (1−Vf)·E_m; E₂ = E_m / (1 − Vf·(1 − E_m/E_w)) (inverse ROM); G₁₂ = G_m / (1 − Vf·(1 − G_m/G_w)); ν₁₂ = Vf·ν_w + (1−Vf)·ν_m.

**Laminate.** Form the ply stiffness Q, rotate to Q̄(+α) and Q̄(−α), and build the in-plane stiffness A = (t_layer/2)·[Q̄(+α) + Q̄(−α)] — the ±α pair is balanced, so A₁₆ = A₂₆ = 0. Engineering constants of the layer:

- Ex = (A₁₁A₂₂ − A₁₂²) / (A₂₂·t_layer), Eθ = (A₁₁A₂₂ − A₁₂²) / (A₁₁·t_layer), Gxθ = A₆₆ / t_layer, νxθ = A₁₂/A₂₂, νθx = νxθ·Eθ/Ex.
- Sanity check (put in the tests): Ex ≈ Vf·E_w·cos⁴α + (1−Vf)·E_m within ~15% for sparse braids; at α = 0° Ex → E₁, at α = 90° Ex → E₂.
- Triaxial: add a 0° ply with Vf,ax into the same A matrix.
- Coil: a single off-axis ply at α_coil. Use the off-axis lamina compliances: Ex = 1/S̄₁₁, Eθ = 1/S̄₂₂, Gxθ = 1/S̄₆₆, νxθ = −S̄₁₂/S̄₁₁ (shear–extension coupling relaxed — state this). A coil contributes little to EI and EA and a lot to Eθ, which is exactly what 4.5 and 4.7 need.

**Layer contributions:** EAᵢ = Ex,ᵢ·Aᵢ, EIx,ᵢ = Ex,ᵢ·Ix,ᵢ, EIy,ᵢ = Ex,ᵢ·Iy,ᵢ, GJᵢ = Gxθ,ᵢ·Jᵢ with A, I, J from 4.1 (lumens subtracted). A polymer layer is the special case Ex = Eθ = E, Gxθ = G, νxθ = νθx = ν.

**Section roll-ups** (all layers):

- EA = Σ EAᵢ, EIx = Σ EIx,ᵢ, EIy = Σ EIy,ᵢ, GJ = Σ GJᵢ.
- Axial membrane stiffness per unit circumference: (Et)x = Σ Ex,ᵢ·tᵢ.
- Hoop bending stiffness per unit length (a laminated ring): Dθ = Σ [Eθ,ᵢ / (1 − νxθ,ᵢ·νθx,ᵢ)] · (tᵢ³/12 + tᵢ·zᵢ²), where zᵢ is the distance of layer i's mid-surface from the hoop-bending neutral surface, located by Σ [Eθ,ᵢ/(1 − νxθ,ᵢνθx,ᵢ)]·tᵢ·zᵢ = 0. This is what gives a coil its real crush and kink credit: a stiff hoop layer near the outside of the wall dominates Dθ.

Accuracy note for PHYSICS.md: expect roughly ±10–15% on EI/GJ for sparse to moderate braids and larger errors (under-prediction) for dense, high-angle steel braids; relative comparisons between similar constructions are far more reliable than absolutes. Revise this note after I compare Phase 3 against bench data.

### 4.5 Failure-mode KPIs (per section)

- **Burst pressure** (Barlow, round bore only): P_burst = 2·σ_hoop·t_s / OD, with σ_hoop the thickness-weighted hoop strength: σ_hoop = [Σ_polymer UTSᵢ·tᵢ + Σ_reinf (UTS_w·Vf·sin²α + UTS_m·(1−Vf))·tᵢ] / t_s. Label as a screening upper bound (typically over-predicts 2–3×).
- **External crush pressure** (long-tube elastic buckling, two-lobe): P_crush = 3·Dθ / r_m³, with Dθ from 4.4. For a single isotropic layer this reduces to the textbook 2·E/(1−ν²)·(t/Dm)³ — required unit test 10.4.
- **Tensile failure load** (first yield): apply axial strain ε; load = EA·ε. Polymer layer stress Eᵢ·ε vs UTSᵢ; wire stress along the wire E_w·ε·cos²α vs yield (UTS if no yield given). The first layer to reach its limit sets ε_fail; report EA·ε_fail (conservative).
- **Torque failure** (first yield): apply twist per unit length φ′; torque = GJ·φ′. Polymer shear stress at rₒ,ᵢ = Gᵢ·rₒ,ᵢ·φ′ vs 0.577·UTSᵢ (von Mises); wire strain along the wire under shear γ = r̄·φ′ is ε_w = γ·sin α·cos α → E_w·ε_w vs yield. The first to fail sets the torque.
- **Linear density:** Σ ρᵢ·Aᵢ, with ρᵢ = Vf·ρ_w + (1−Vf)·ρ_m for reinforcement layers.
- **Axial compliance** L/EA and **torsional compliance** L/GJ.
- **Pull-wire offset** r_pw = radial distance from the section centre to the pull-wire lumen centre (moment arm).

### 4.6 Multi-lumen core (Phase 9 — optional)

Compute A, Ix, Iy, Ixy, J of the shaped core numerically (polygonal/parametric area with lumen subtraction, ~1000 boundary points; shoelace + second moments). Report EIx, EIy, principal EImin/EImax and the anisotropy ratio. Wall layers stack outward from the core's bounding circle. Pullwires are never routed through the core.

### 4.7 Bending collapse of the wall (laminated Brazier) — used by Kink Radius, Design Sweep and Pushability

A tube bent to curvature κ ovalises; ovalisation reduces I, so the moment–curvature curve reaches a maximum (the Brazier limit point) beyond which the tube collapses — that is the kink. With (Et)x and Dθ from 4.4 and the section mean radius r_m:

- Ovalisation (flattening of the bend-plane diameter, D_bend = OD·(1 − ζ)): ζ = (Et)x · κ² · r_m⁴ / (12·Dθ), valid only for ζ < 2/9.
- Moment: M(κ) = π·r_m³·(Et)x·κ·(1 − 3ζ/2).
- Collapse onset: ζ_B = 2/9, κ_B = (1/r_m²)·√(8·Dθ / (3·(Et)x)), R_B = 1/κ_B, M_B = (2/3)·π·r_m³·(Et)x·κ_B.
- Required unit test 10.5: for a single isotropic layer these reduce to Brazier's classic κ_B = (√2/3)·t / (r²·√(1−ν²)) and M_B = (2√2/9)·π·E·r·t² / √(1−ν²).
- Notes for PHYSICS.md: Brazier assumes a thin shell (r/t ≫ 1); catheter walls sit at r/t ≈ 3–8, so R_B ranks constructions rather than predicting a number. At the limit point the bend-plane diameter has flattened by only ~22%, so a "50% lumen loss" is never reached before collapse in this model — lumen-loss criteria belong to Kink Radius Phase B.

## 5. UI specification per tab

### 5.1 Setup tab (wizard)

Left step rail (tree): Design → [Core Profile if multi-lumen] → Construction → Section 1 … Section n → Review & Build. Back/Next at the bottom; Next becomes Build Model on the last step.

**Design step** (two columns):

- Name, design mode, fixed ID / OD inputs, Load Design from file.
- Section list: label, length, colour swatch, ▲▼ reorder, ➕ add proximal to selection, ✖ delete. A horizontal colour bar at the top showing sections to scale, proximal on the left, tip on the right.
- Pull-wire settings: arrangement (None / 1 / 2 @180° / 4 @90°), anchor section, wire shape and dims, wire material (metals only in the dropdown, with a "More materials…" entry that opens the whole library).

**Construction step** — master/detail, three columns:

- Left: section length/colour strip, Clone… menu (Clone From… copies another section's whole construction; Match Dimension To… matches OD or ID to another section by adjusting one chosen layer, usually the jacket), then the layer list inside-out with type/material/thickness, and at the foot the resolved OD / ID / wall live. ▲▼ ✖ ➕ layer controls.
- Centre: editor for the selected layer only (name, colour, type, material or wire settings, thickness, computed ID/OD, adaptive toggle in fixedODandID mode). Reinforcement sub-panel with live braid/coil preview and computed angle, coverage, fill status and PPI_max.
- Right: scaled cross-section SVG that redraws on every keystroke — every layer as an annulus in its colour, pull-wire lumens cut through the stack at the correct radial position, liners drawn as white sleeves, wire drawn as dark grey circle/rect to scale.
- A "Pullwires" pseudo-layer is auto-inserted when pullwires are enabled; its card holds the lumen ID/thk×width, liner material + wall, construction type.
- Manual override radio: Layer Construction / Manual Stiffness (EI, GJ, EA, pullwire offset) / Rigid Body. Include the help text on how to obtain EI/GJ/EA from CAD or 3-point bend / torsion / tensile bench tests.

**Review & Build step**

- Colour bar with a black tick at the pull-wire anchor point.
- Summary cards per section with Edit links back to the right step.
- Parametric peel-away illustration per section (SVG: layers cut back in steps, lumens cut through, wires emerging at the distal end). Right-click → copy as PNG.
- Save Design and Build Model buttons. Building runs the calculator for all sections, stores the results, and jumps to Analysis.

### 5.2 Analysis tab

Left rail: section picker + a vertical colour bar (proximal at top). Main area: KPI cards for the selected section (ID, OD, wall, EIx, EIy with EImin/EImax, GJ, EA, L/EA, L/GJ, linear density, burst, crush, tensile first-yield, torque first-yield, pull-wire offset, Dθ; for cores the principal values and anisotropy ratio) plus a card per reinforcement layer (α, F, C, Vf, Ex, Eθ). Beside them: that section's cross-section and peel-away. A Catheter Total card: total length, total mass, whole-shaft axial and torsional compliance (sum of section compliances). Once Kink Radius has been run, add the bend limits to the section card. A Recalculate button. A permanent banner: "Screening estimates from simplified mechanics. Not a substitute for bench testing or V&V."

### 5.3 Steering tab (the digital twin)

Three resizable columns: controls · 3D viewer · live readouts.

**Solver** (`src/physics/steering.ts`, a pure function — Phase 4 builds and tests it before any 3D). Discretise the shaft into rigid links (2 mm each) joined by joints with bending springs k_b = EI/ℓ, twist springs k_t = GJ/ℓ, and axial springs k_a = EA/ℓ from the section that link lies in. The bending spring uses the EI about the bend axis for the commanded direction (from the pull-wire layout: pulling a wire on the +Y side bends the shaft in the Y–Z plane, about the X axis, so use EIx for that direction and EIy for an X-side wire). Pull-wires are tendons running at offset r (the section's pull-wire offset) from the proximal end to the anchor joint. Commanded input is tendon displacement δ; solve for tendon tension T and joint angles such that the shaft is in static equilibrium (moment at each joint = T·r for joints proximal of the anchor; zero distal of it) and the tendon path length shortens by δ minus wire stretch T·L_w/(E_w·A_w) minus shaft axial shortening Σ T·ℓ/EA. Solve with damped Newton iteration or a quasi-static relaxation loop; converge each frame. Optional gravity as a distributed load on links (w from 4.0). A proximal fixture locks all joints proximal of a chosen distance from the tip (default 150 mm, yellow ring). Do not discretise the locked region: the solver only holds the joints distal of the fixture (~75 links for the default), and the locked part is drawn as a straight rigid body.

Sanity solutions the solver must reproduce (tests 10.7, 10.8): constant-curvature bending κ = T·r/EI, θ = κ·L, δ ≈ r·θ (rigid tendon); and a horizontal cantilever under gravity, small deflection δ_tip = w·L⁴ / (8·EI).

**Controls:** jog dials for X (and Y for 4-wire) with fine/medium/coarse steps and Home; direct numeric entry; gravity on/off + direction; Goal Seek (enter target tip angle, iterate δ until reached); fixture on/off + distance; Run / Pause / Reset; auto-pause after 5 minutes; Export run log CSV + viewport PNG + deflected STL.

**Readouts** (update every frame): X/Y displacement; tip angle θ (integrated) and azimuth φ (0° = +Y bend, 90° = +X bend); wire tension per wire (turn red when ≥ the wire's tension limit, Section 3); wire stretch; total strain energy; total shaft shortening; tip position (x, y, z) with the proximal end as origin; tip quaternion. Per flexible section: bend radius (show "--" if straight), bending moment, axial compression (0 for sections distal of the anchor). If Kink Radius limits exist, show a live warning banner when a section is bent past its first-failure limit (present tense: "is bent past its kink limit"), clearing when straightened; otherwise a quiet note that limits are unmeasured.

**3D viewer:** sections rendered as tube geometry in their colours; pull-wires as dark grey lines at true diameter; orbit (LMB), pan (RMB), zoom (wheel); preset view buttons (front/side/top/iso) with keyboard shortcuts; the fixture ring; a small axis gizmo.

### 5.4 Kink Radius tab

Inputs: section picker (grey out manual-stiffness sections with the reason), section orientation (0/90/180/270° — where the pull-wire lumen sits relative to the bend plane; 180° puts a single lumen on the intrados; this selects which of EIx/EIy applies and which layers sit on the intrados), Run Section / Run All Sections / Cancel.

**Phase A (closed form, do this first)** — all from 4.7 and the section's layer data:

1. Collapse onset: κ_B, R_B = 1/κ_B, M_B (laminated Brazier, 4.7).
2. First crease per polymer layer: the outer-fibre strain at centreline radius R is ε = rₒ,ᵢ / R; layer i creases when ε ≥ ε_crease,ᵢ, i.e. at R_crease,ᵢ = rₒ,ᵢ / ε_crease,ᵢ. Take the largest R over the polymer layers (seed values in Section 6, ~4–8% for Pebax/nylon, ~2–3% for PTFE/polyimide-class liners — flag as estimates).
3. First failure = the larger of R_B and R_crease — the limit you reach first as the bend tightens. Name which mechanism and which layer.
4. Flattening at any radius R ≥ R_B: report ζ from 4.7 as "% flattening of the bend-plane diameter"; for R < R_B report "collapsed". No lumen-loss criterion in Phase A (see the note in 4.7).
5. Reinforcement wire buckling risk on the intrados at the first-failure radius: wire-axis compressive strain ε_w = (r̄_layer / R)·cos²α, compared against three editable bands in Settings (defaults, labelled "estimate — not validated": Unlikely < 0.5%, Possible 0.5–1.5%, Likely > 1.5%).
6. Report every radius both as a centreline radius and as the equivalent mandrel diameter = 2R − OD (the mandrel is what I actually wrap the shaft around). Round the display to 1 mm / 0.05 in; keep full precision in exports.

**Phase B (optional, ambitious):** replace Phase A with a 2D plane-strain finite-element ring model of the actual cross-section (layers as concentric material rings, pull-wire lumens as voids, core webs if present), bent to progressively tighter curvature, tracking moment–curvature, OD major / ID minor, lumen area (this is where a 50% lumen-loss criterion lives), per-layer peak strain, self-intersection. Stop the ramp at self-contact. Show a scrub slider with Play/Loop of the deformed section, a bend illustration with the mandrel pin drawn tangent, and moment vs mandrel-diameter plots centred on the first failure. If this needs Python + scikit-fem, it is a separate optional package with its own start command — the rest of the app must not depend on it.

Rebuilding the model clears all kink runs. Publish each section's limits to the Analysis tab, the Steering warnings, the Pushability comparison, and the report.

### 5.5 Pushability tab

Inputs: free length from tip (default 76 mm or whole shaft), tip restraint (Free K=2 / Pinned K=0.7 / Guided K=1 / Clamped K=0.5 / Wall contact default; all assume a clamped proximal end), tip shape (round / conical with cone length default 2×OD / flat), approach angle 0–45°, tip friction μ, optional vessel walls (lumen diameter default 4×OD, shaft friction μ — typical hydrophilic 0.03, uncoated 0.15), stroke (≤ half the free length). Pullwires ignored — passive rod.

**Phase A:** stepped-column Euler buckling: P_cr = π²·EI_min / (K·L_free)² for a uniform shaft, EI_min = min(EIx, EIy); for a stepped shaft solve the transfer-matrix or a discretised eigenvalue problem using each section's EI_min. Report peak push force and which section governs (test 10.9).

**Phase B:** planar elastica push using the same discretised-rod solver as Steering (EI about the bend plane): clamp the proximal node, advance it by stroke increments, apply an initial L/500 bow, tip contact against a rigid wall with Coulomb friction (stick if tan(angle) < μ), optional lateral wall contact at ±lumen/2. Output: force–stroke curve (push force at clamp, tip normal force, wall contact forces), buckling knee (intersection of pre-buckling rise and post-buckling plateau; none inside a vessel), peak tip normal force, peak wall contact force, animated deflected shape with force vectors, tightest bend radius per section compared against that section's Kink Radius first-failure limit ("not measured" if unknown). Free-body check every step; flag unresolved steps.

### 5.6 Design Sweep tab

Left: parameter tree built from the design — every numeric input (layer thickness, PPI, wire dia, pitch, section length, …) as a variable, every dropdown (material, wire shape, pattern) as an attribute. Allow up to 2 variables + 1 attribute (A/B). Min/max for each variable. Checkbox Include kink radius (slow) with bend-direction checkboxes (+Y, −Y, X (symmetric) …) offered only when the design is asymmetric, plus a flattening reference radius (default 10×OD). Run / Cancel with progress. Core OD is read-only (tooling, not a variable).

Engine: 5-point sweep for 1 variable, 5×5 = 25 points for 2; doubled for A/B. At each point: clone design → apply values → run calculator (and optionally a fixed-pose steering solve and the kink solve). Fit: for 1 variable a quadratic (3 coefficients on 5 points — a cubic would nearly interpolate and make R² meaningless); for 2 variables a full cubic (10 coefficients on 25 points), falling back to a quadratic (6) if fewer than 15 points succeed. Report adjusted R² colour-coded: green ≥ 0.95, amber 0.70–0.95, red < 0.70, grey if the metric is essentially constant.

Right: Plotly 3D surface (or 2D curve for one variable), sample dots at the actual design points, floor contour projection, colour bar in display units, A/B as blue vs orange surfaces, two exploration sliders driving a cursor sphere + predicted value readout, Reset View, Save PNG, Export CSV (column names `sec{N}_<metric>` and `sec{N}_{ypos|yneg|y|xpos|xneg|x|any}_kink_*` for bend-direction results).

Middle: metric picker tree — Static (EIx, EIy, GJ, EA, L/EA, L/GJ, burst, crush, linear density, tensile, torque, Dθ; core rows only for core designs), Kink (first failure, collapse onset, first crease, % flattening at the reference radius — "collapsed" if the reference radius is inside R_B, wire-buckling band), Dynamic (tip angle, tip position, wire tension, strain energy, per-section bend radius/moment/shortening at a fixed commanded displacement).

### 5.7 Reflow tab

Left rail: section picker, Finished Size card, actions. Centre: cross-section visualiser with Assembly / Reflow toggle (assembly shows each layer as a separate tube with radial clearance gaps; reflow shows the consolidated wall). Right: design grid — one row per layer inside-out: name, type, material, thermoplastic?, ID, wall, OD, link icon (auto) or unlinked (custom entry), tolerance ±.

Logic:

- Auto mode: pre-reflow ID of each tube = OD of the layer inside it + 2 × a per-material-type radial clearance (default 0.025 mm / 0.001" for polymer over polymer, 0.05 mm over braid; editable in a Settings panel).
- Reflow conserves the polymer's cross-sectional area, not its wall: each thermoplastic layer's pre-reflow area A = π(rₒ² − rᵢ²) is preserved, its reflowed ID becomes the OD of the layer inside it, and its reflowed OD = √(rᵢ,new² + A/π) × 2. The wall therefore grows slightly as the gap closes (test 10.10). State this in PHYSICS.md.
- Unlinking a row lets me round to a stock extrusion size; the change cascades outward only.
- Braid/coil/pullwire rows: ID editable, wall locked to wire dims. Mandrel row: solid, ID locked. Core row (multi-lumen): fully locked, drawn statically, never reflows. Non-thermoplastic layers (PTFE, polyimide) keep their dimensions.
- Finished Size card: post-reflow OD (heat shrink excluded), worst-case tolerance stack = simple sum of per-layer tolerances, nominal design OD, change vs nominal, minimum heat-shrink recovery ratio = (assembly OD × 1.15) / reflowed OD — turn red above 2:1.
- Buttons: Export to Setup (push custom dims back into the design; confirm, irreversible), Revert to Nominal, include in report / XLSX sheet with dimensions, tolerances and gaps for procurement.

### 5.8 Braid Transfer tab (standalone — no model needed)

Kinematics (D = braid mean diameter, α from the axis, N loaded ends, w wire width, f filars):

- Each wire keeps its length and its number of turns, so the helix length per turn ℓ = π·D / sin α is conserved: sin α₂ = sin α₁ · (D₂/D₁). Requires sin α₁·D₂/D₁ ≤ 1.
- Lay length L_lay = π·D / tan α; PPI = N / (2·L_lay); coverage and fill from 4.3.
- Elongation on transfer E_L = L_lay,2 / L_lay,1 = cos α₂ / cos α₁ (greater than 1 when D₂ < D₁: the braid necks down and stretches out). Spool braid needed per finished metre = 1 / E_L.
- Transferable diameter range (fill F = 1 at both ends): with s = sin α₁ / D₁ and c = w·f·N / (2π), the condition F(D) = 1 becomes D²·(1 − s²·D²) = c², so D² = [1 ± √(1 − 4·s²·c²)] / (2·s²). The minus root is D_min (necking toward 0° crowds the wires circumferentially), the plus root is D_max (expanding toward 90° jams the wires in hoop). No real root means the spool braid itself is over-jammed. Also D ≤ 1/s (α = 90°).

Two modes:

- **Goal Seek** (default): define the braid wanted on the shaft (carriers, filars, wire, pattern) and pin one of PPI / angle / coverage at the target diameter D₂; enter the spool mandrel OD D₁ (must be > D₂, auto-clamped so that sin α₁ ≤ 1 and F₁ < 1 at the spool); output the required spool PPI (exact) and the nearest integer PPI with what it actually yields at the target. "Import braid from design" button to pull a braid layer and its seat diameter from the built model.
- **Forward Transfer:** define the as-wound spool braid → show what it becomes at D₂. Results side-by-side (spool | target): PPI, angle, coverage, fill factor, lay length, density status; elongation; spool length per finished length; transferable OD range. Two braid preview SVGs at common scale. Warning banner. Copy Summary to clipboard as plain text for a PO.

### 5.9 Materials tab

Spreadsheet-style table: name, family, thermoplastic, density, E, ν, UTS, yield (metals), crease strain (polymers), notes. Search filter, add/delete/reorder rows, Import JSON (Combine — rename clashes as Name_2 / Replace), Export JSON, Reset to defaults (confirm). Validation: E > 0, ρ > 0, UTS > 0, −1 < ν < 0.5, yield ≤ UTS, unique names; import refused with the offending row named if any fails.

Blend tool (all outputs labelled "estimate"):

- (a) Polymer blend of two library polymers by mass fraction 5–95% (default 50/50), immiscible-blend estimate. Convert mass fractions to volume fractions with the densities: φᵢ = (mᵢ/ρᵢ) / Σ(mⱼ/ρⱼ). Density ρ = 1 / Σ(mᵢ/ρᵢ). Modulus by the Davies rule for co-continuous blends: E^(1/5) = Σ φᵢ·Eᵢ^(1/5). ν = Σ φᵢ·νᵢ. UTS = min(UTSᵢ) as the reported value (immiscible blends rarely exceed the weaker phase) with the linear rule of mixtures Σ φᵢ·UTSᵢ shown as an upper bound in the preview. Crease strain = min. Thermoplastic if both components are.
- (b) Polymer + particulate additive (BaSO₄ 4.50, W 19.3, Bi₂O₃ 8.90, bismuth subcarbonate 6.86, PTFE micropowder 2.20 g/cm³, or custom), default 80/20 by mass. Filler volume fraction φ from the densities as above (cap at 0.35). Density by inverse rule of mixtures. Modulus by Guth–Gold for spherical particles: E = E_m·(1 + 2.5φ + 14.1φ²). ν = (1−φ)·ν_m + 0.25φ. UTS by Nicolais–Narkis for poorly bonded particles: UTS = UTS_m·(1 − 1.21·φ^(2/3)). Crease strain by Nielsen: ε = ε_m·(1 − φ^(1/3)). (Test 10.12.)
- Live preview, auto-name e.g. `Pebax 72D (20% BaSO4)`, Save to library. Every dropdown in Setup must refresh immediately.

## 6. Seed materials library (verify against datasheets; flag estimates)

| Name | Family | Thermo | ρ g/cm³ | E MPa | ν | UTS MPa | Yield MPa | Crease strain |
|---|---|---|---|---|---|---|---|---|
| Pebax 25D | Polymer | Y | 1.01 | 12 | 0.45 | 30 | — | 6% |
| Pebax 35D | Polymer | Y | 1.01 | 20 | 0.45 | 32 | — | 6% |
| Pebax 40D | Polymer | Y | 1.02 | 75 | 0.45 | 35 | — | 6% |
| Pebax 55D | Polymer | Y | 1.02 | 160 | 0.44 | 42 | — | 6% |
| Pebax 63D | Polymer | Y | 1.02 | 300 | 0.43 | 50 | — | 6% |
| Pebax 72D | Polymer | Y | 1.02 | 510 | 0.42 | 56 | — | 6% |
| Nylon 12 (Vestamid / Grilamid L25) | Polymer | Y | 1.02 | 1400 | 0.40 | 50 | — | 6% |
| Polyurethane 80A | Polymer | Y | 1.15 | 25 | 0.48 | 40 | — | 10% |
| HDPE | Polymer | Y | 0.95 | 1000 | 0.42 | 27 | — | 5% |
| PTFE (liner, etched) | Polymer | N | 2.15 | 500 | 0.46 | 25 | — | 3% |
| ETFE | Polymer | Y | 1.70 | 800 | 0.40 | 45 | — | 3% |
| FEP | Polymer | Y | 2.15 | 500 | 0.46 | 23 | — | 3% |
| Polyimide | Polymer | N | 1.42 | 2500 | 0.34 | 120 | — | 2% |
| PEEK | Polymer | Y | 1.30 | 3600 | 0.40 | 100 | — | 2.5% |
| Heat shrink FEP (process aid) | Polymer | N | 2.15 | 500 | 0.46 | 23 | — | 3% |
| 304 SS annealed | Metal | — | 8.00 | 193000 | 0.29 | 505 | 215 | — |
| 304V spring temper | Metal | — | 8.00 | 193000 | 0.29 | 2000 | 1700 (est.) | — |
| 316L | Metal | — | 8.00 | 193000 | 0.27 | 485 | 170 | — |
| Nitinol (superelastic, austenite) | Metal | — | 6.45 | 60000 | 0.33 | 1200 | 500 (upper plateau, est.) | — |
| Tungsten wire | Metal | — | 19.3 | 400000 | 0.28 | 2500 | 2000 (est.) | — |
| PEEK monofilament (braid) | Other | — | 1.30 | 3600 | 0.40 | 100 | — | — |
| Aramid (Kevlar 49) | Other | — | 1.44 | 112000 | 0.36 | 3000 | — | — |

Crease strains are estimates and editable. Where no yield is given, use UTS as the limit. Polymer shear strength = 0.577 × UTS.

Common ribbon sizes dropdown: 0.0005"×0.003", 0.001"×0.003", 0.001"×0.005", 0.0015"×0.005", 0.002"×0.006", 0.002"×0.010". Common round: 0.001", 0.0015", 0.002", 0.003", 0.004".

## 7. Reports and exports

Report → Generate Report… dialog with tick-boxes per block: Design summary (colour bar, section cards, peel-aways), Analysis KPIs, Kink Radius runs, Pushability run (inputs + results, shape at knee and end of stroke, force curves), Design Sweep (surface PNG + table), Reflow stack-up, Braid Transfer. Output HTML (print-to-PDF) and XLSX with one sheet per block (Pushability raw curve: one row per stroke step; Reflow: dims/tolerances/gaps). Steering readouts are not a report block — they are live only; the Export button on that tab writes a run-log CSV instead. Every report page carries the design-aid disclaimer.

## 8. Non-goals (do not build)

- No 3D FEA, no hysteresis, no viscoelasticity, no shear deformation in the beam model, no tendon–lumen friction, no contact between catheter and anatomy in the steering sim.
- No user accounts, licensing, cloud sync, or analytics.
- No CLI/REPL initially (a later phase could expose computeSection(design) as a Node script that reads/writes JSON so I can drive it from a spreadsheet).

## 9. Phased build plan (stop after each and tell me how to test)

1. **Skeleton:** repo, `CLAUDE.md` (Section 0), `PHYSICS.md`, `CHANGELOG.md`, Vitest wired to `npm test`; data model; Materials tab; JSON save/load; unit toggle. Test: create a material, export, re-import, switch units.
2. **Setup wizard** (Design + Construction + Review) with live cross-section SVG and peel-away, validation rules, Clone/Match. Test: build a 3-section 6 Fr braided shaft with a PTFE liner, 16-carrier 0.001"×0.003" SS braid at 60 PPI, Pebax 72D / 55D / 35D jackets, one pull-wire. The Construction panel must show ≈ 62° for that braid (test 10.3).
3. **Calculator + Analysis tab** (Sections 4.0–4.5, 4.7) with unit tests 10.1–10.6. Show me the test file and its output.
4. **Steering:** first the solver as a pure function passing 10.7 and 10.8, with a small Node harness (`npm run sim -- design.json`) that prints the readouts; only then the 3D viewer, controls, readouts, goal seek, fixture, gravity.
5. **Reflow tab and Braid Transfer tab** (pure geometry — quick wins). Tests 10.10 and 10.11, plus the real braid-transfer case I will supply.
6. **Kink Radius Phase A** with mandrel-diameter reporting and publication of limits to Analysis/Steering. Test 10.5.
7. **Pushability** Phase A (Euler stepped column, test 10.9) then Phase B (elastica push with wall contact).
8. **Design Sweep** with response surface and A/B.
9. **Reports/exports**, polish, keyboard shortcuts; then optionally Multi-lumen core (4.6) and Kink Radius Phase B (2D FE).

## 10. Hand-calculation test cases (every one becomes a unit test)

Reference tube for 10.1, 10.4–10.9: plain Pebax 72D, 2.00 mm OD × 0.20 mm wall (ID 1.60 mm), E = 510 MPa, ν = 0.42, ρ = 1.02 g/cm³.

1. **Tube stiffness (4.1):** A = 1.1310 mm², I = 0.4637 mm⁴, J = 0.9274 mm⁴; EA = 576.8 N, EI = 236.5 N·mm², GJ = 166.5 N·mm² (G = 179.6 MPa).
2. **Lumen subtraction (4.1):** a 2.00 mm OD × 1.40 mm ID tube with one round 0.20 mm lumen centred at r_p = 0.85 mm on the +Y axis: I of the plain tube = 0.5968 mm⁴; Ix (bending about X, the lumen in the bend plane) drops by 0.0228 mm⁴ to 0.5741 mm⁴; Iy drops by only 0.00008 mm⁴. Centroid shift 0.017 mm, neglected.
3. **Braid geometry (4.3):** 16 loaded ends, 1 filar, flat 0.001"×0.003" wire (t_w = 0.0254 mm, w = 0.0762 mm), 60 PPI, seated on a 2.000 mm OD liner (Dm = 2.0254 mm): L_lay = 3.387 mm, α = 62.0°, F = 0.204, C = 0.366, PPI_max ≈ 332.
4. **Crush (4.5):** P_crush = 1.70 MPa by both routes — the textbook 2E/(1−ν²)·(t/Dm)³ and 3·Dθ/r_m³ with Dθ = 0.4128 N·mm.
5. **Brazier (4.7):** κ_B = 0.1283 mm⁻¹, R_B = 7.80 mm centreline (mandrel 13.6 mm), M_B = 20.0 N·mm — identical from the laminated form and the classic isotropic form. With a 6% crease strain, first crease at R = 16.7 mm centreline (mandrel 31.3 mm), so the first failure is the crease.
6. **Burst (4.5):** P_burst = 2 × 56 × 0.20 / 2.00 = 11.2 MPa (screening upper bound).
7. **Constant-curvature steering (5.3):** EI = 236.5 N·mm², pull-wire offset r = 0.70 mm, T = 1.00 N over a 30 mm section: κ = 2.960 × 10⁻³ mm⁻¹ (R = 338 mm), θ = 5.09°, δ = 0.0622 mm with a rigid tendon.
8. **Cantilever under gravity (5.3):** the reference tube, 100 mm horizontal cantilever: ρ_lin = 1.154 × 10⁻³ g/mm, w = 1.132 × 10⁻⁵ N/mm, δ_tip = 0.598 mm.
9. **Euler (5.5):** clamped–free, K = 2, L_free = 76 mm: P_cr = 0.101 N.
10. **Reflow (5.7):** a 0.200 mm-wall Pebax jacket with pre-reflow ID 1.650 mm (0.025 mm radial gap over a 1.600 mm OD liner) has A = 1.1624 mm²; reflowed onto the 1.600 mm liner its OD becomes 2.010 mm and its wall 0.205 mm.
11. **Braid transfer (5.8), synthetic:** 16 ends, 1 filar, 0.001"×0.003" flat wire, wound on a 3.000 mm spool at α₁ = 60.0° (PPI₁ = 37.3). Transferred to D₂ = 2.000 mm: α₂ = 35.26°, PPI₂ = 22.9, L_lay 5.441 → 8.886 mm, elongation 1.633, spool needed per finished metre 0.612 m. Transferable range for that spool braid: D_min ≈ 0.194 mm, D_max ≈ 3.46 mm.
12. **Particulate blend (5.9):** Pebax 72D + 20% BaSO₄ by mass: φ = 0.0536, ρ = 1.207 g/cm³, E ≈ 599 MPa, UTS ≈ 46.4 MPa, crease strain ≈ 3.7%.

Start with Phase 1. Before writing code, restate the data model back to me in a table, list the formulas you will put in PHYSICS.md for Phase 3 in your own words, and list any questions.
