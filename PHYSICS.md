# CathSim — PHYSICS.md

Every formula the app implements is listed here in plain engineering notation, with the assumption it relies on and its validity range. Section numbers refer to `docs/SPEC.md`. If the code ever differs from the spec, the difference is stated here and in `CHANGELOG.md`.

> **Screening estimates from simplified mechanics. Not a substitute for bench testing or V&V.**

Status: **Phase 2** — conventions, unit conversion, the Materials blend tool, the layer-stack geometry and the braid / coil geometry are implemented. The stiffness and failure formulas (Sections 4.1, 4.4, 4.5, 4.7) are added to this file in Phase 3, when they are implemented and tested.

---

## 1. Conventions (spec 4.0)

- Internal units: **mm, N, MPa (= N/mm²)**, N·mm (moment), N·mm² (EI, GJ). Density is stored in **g/cm³**. Strains are stored as fractions (0.06 = 6%).
- Mass: `mass [g] = ρ [g/cm³] × A [mm²] × L [mm] × 10⁻³`.
- Gravity load: `w [N/mm] = ρ_lin [g/mm] × 9.81 × 10⁻³`.
- Wire angles α are measured from the tube axis: 0° = axial, 90° = hoop.
- PPI is always picks per **inch**, whatever the display units.

## 2. Unit conversion (display only)

Values are stored in internal units and multiplied by a factor only when shown; typing a value divides by the same factor. Switching units recomputes nothing and changes no stored number.

| Quantity | Internal | Imperial display | Factor (internal → imperial) |
|---|---|---|---|
| Length | mm | in | ÷ 25.4 |
| Pressure, modulus, strength | MPa | psi | × 145.0377 |
| Force | N | lbf | ÷ 4.448222 |
| Density | g/cm³ | lb/in³ | × 0.0361273 |
| Moment | N·mm | lbf·in | ÷ (4.448222 × 25.4) |
| EI, GJ | N·mm² | lbf·in² | ÷ (4.448222 × 25.4²) |
| Strain | fraction | % | × 100 (both systems) |

## 3. Blend tool (spec 5.9) — all outputs are estimates

Code: `src/physics/blend.ts`. Tests: `src/physics/blend.test.ts` (hand calculation 10.12).

### 3.1 Mass fraction → volume fraction, and density (both blend types)

- `φᵢ = (mᵢ/ρᵢ) / Σ(mⱼ/ρⱼ)`
- `ρ = 1 / Σ(mᵢ/ρᵢ)`

Assumption: volumes add (no voids, no densification). Valid for any mass fractions.

### 3.2 (a) Polymer + polymer — immiscible blend

| Property | Formula | Assumption / validity |
|---|---|---|
| Modulus | Davies rule: `E^(1/5) = Σ φᵢ·Eᵢ^(1/5)` | Co-continuous two-phase blend. Reasonable for 5–95% by mass; not for miscible blends or where one phase is fully dispersed droplets. |
| Poisson | `ν = Σ φᵢ·νᵢ` | Linear rule of mixtures. |
| UTS (reported) | `min(UTSᵢ)` | Immiscible blends rarely exceed the weaker phase. Conservative. |
| UTS (upper bound, preview only) | `Σ φᵢ·UTSᵢ` | Linear rule of mixtures; needs good interfacial adhesion. |
| Crease strain | `min(ε_crease,ᵢ)` | Conservative. |
| Thermoplastic | only if both components are | |

Mass fraction is limited to 5–95%.

### 3.3 (b) Polymer + particulate additive

φ = filler volume fraction from 3.1.

| Property | Formula | Assumption / validity |
|---|---|---|
| Density | inverse rule of mixtures (3.1) | Uses the true φ, never capped. |
| Modulus | Guth–Gold: `E = E_m·(1 + 2.5φ + 14.1φ²)` | Rigid, roughly spherical particles, well dispersed. Valid to about φ ≈ 0.3. |
| Poisson | `ν = (1−φ)·ν_m + 0.25·φ` | Filler Poisson's ratio taken as 0.25 (spec). |
| UTS | Nicolais–Narkis: `UTS = UTS_m·(1 − 1.21·φ^(2/3))` | Poorly bonded particles (no load transfer). Lower-bound style estimate. |
| Crease strain | Nielsen: `ε = ε_m·(1 − φ^(1/3))` | Perfectly bonded rigid particles; strain concentrates in the matrix. |

**Cap:** φ is capped at **0.35** for modulus, Poisson, UTS and crease strain (spec). The preview warns when the cap is active. Density is still calculated with the true φ, because the density formula stays exact at any loading — this detail is my reading of "cap at 0.35"; say if you want density capped too.

Additive densities (spec, g/cm³): BaSO₄ 4.50 · W 19.3 · Bi₂O₃ 8.90 · bismuth subcarbonate 6.86 · PTFE micropowder 2.20 · or custom.

**Check (test 10.12):** Pebax 72D + 20% BaSO₄ by mass → φ = 0.0536, ρ = 1.207 g/cm³, E = 599 MPa, UTS = 46.4 MPa, crease strain = 3.7%.

## 4. Material data

Seed values are exactly those in spec Section 6; none were added or altered. Flagged as estimates in the library (amber **est** tag): every crease strain, and the yield strength of 304V spring temper, Nitinol (upper plateau) and tungsten wire. Blend-tool results are saved with every property flagged as an estimate.

## 5. Braid and coil geometry (spec 4.3)

Code: `src/physics/braid.ts`. Tests: `src/physics/geometry.test.ts` (hand calculation 10.3).

Symbols: Dm = mean diameter, N = number of **loaded** wire ends, f = filars per carrier, w = wire width (diameter for round wire), t_w = wire thickness, α = angle from the tube axis.

### 5.1 Braid

| Quantity | Formula | Assumption / validity |
|---|---|---|
| Mean diameter | `Dm = seat diameter (layer ID) + t_w` | As specified. See the note below. |
| Lay length | `L_lay = N / (2·PPI)` inches, × 25.4 for mm | One pick = one crossing along a line parallel to the axis; each helix direction carries N/2 ends. |
| Braid angle | `tan α = π·Dm / L_lay` | Wires follow true helices on a round mandrel. |
| Fill factor (one family) | `F = w·f·N / (2π·Dm·cos α)` | Wires lie flat, side by side, no overlap within a family. |
| Coverage | `C = 1 − (1 − F)²`, clamped to 0–1 | Ko & Pastore; two independent families. |
| Jamming limit | `cos α_jam = w·f·N / (2π·Dm)`; `L_lay,jam = π·Dm / tan α_jam`; `PPI_max = N / (2·L_lay,jam)` | F = 1. If the right-hand side ≥ 1 the wires cannot fit even at 0° — reported as an error. |

Density bands on F: below 0.70 OK · 0.70–0.85 High density (process limit) · 0.85–1.0 Near binding · 1.0 and above Binding likely.

The PPI input is capped at PPI_max (rounded down to 0.1). If the diameter or wire is changed afterwards so that the existing PPI exceeds the new limit, the section shows an error instead of silently changing your PPI.

Pattern: diamond = 1-over-1, full load = 2-over-2, half load = diamond geometry with N = the ends actually loaded. The pattern changes only the preview drawing and the ride-over rule (6.2).

**Note on Dm (not a change — implemented as written).** `Dm = layer ID + t_w` is the centreline of the inner wire course. The mid-wall of the 2·t_w braid layer would be `layer ID + 2·t_w`. For 0.001" wire on a 2 mm seat the difference is 1.2% on diameter and about 0.3° on braid angle. Test 10.3 fixes the definition as ID + t_w, so that is what the code uses. Tell me if you would rather use the mid-wall.

**Check (test 10.3):** 16 ends, 1 filar, 0.001" × 0.003" flat wire, 60 PPI, seated on 2.000 mm → Dm = 2.0254 mm, L_lay = 3.387 mm, α = 62.0°, F = 0.204, C = 0.366, PPI_max = 332.

### 5.2 Coil

| Quantity | Formula | Assumption / validity |
|---|---|---|
| Mean diameter | `Dm = seat diameter + t_w` | Exact mid-wall for a one-wire-thick layer. |
| Lead | `lead = pitch × starts` | Pitch = measured centre-to-centre spacing of adjacent bands. |
| Coil angle | `tan α = π·Dm / lead` | From the axis, so a tight coil is close to 90°. |
| Coverage | `C_coil = w·filars / pitch` | 1.0 = closed pitch. Pitch below `w × filars` is refused. |

## 6. Layer stack (spec 3, 4.2)

Code: `src/physics/geometry.ts`.

### 6.1 Diameters by design mode

- **Fixed ID:** section ID = mandrel diameter; each layer's OD = its ID + 2 × thickness, stacked outward.
- **Fixed OD:** section OD is fixed; layers are stacked inward.
- **Fixed OD and ID:** layers inside the adaptive layer stack outward from the ID, layers outside it stack inward from the OD, and the adaptive layer takes what is left. Zero or negative → error.

### 6.2 Computed thicknesses (never typed in)

| Layer | Thickness |
|---|---|
| Braid | `2·t_w`, plus `0.10·t_w` ride-over allowance only when F > 0.85 **and** the pattern is 2-over-2 |
| Triaxial braid | `2·t_w,bias + t_w,axial` (same ride-over rule on the bias wires) |
| Coil | `t_w` (filars sit side by side) |
| Pull-wire layer | `lumen bore + 2 × lumen liner wall` |

### 6.3 Pull-wire lumens

- The "Pullwires" layer is a ring whose thickness is the lumen's outer size. It is inserted directly over the liner by default (braid over the lumens, `docs/DECISIONS.md` #2) and can be moved.
- Lumen centre radius = pull-wire moment arm: `r_pw = (ring ID + ring OD) / 4` (mid-radius of the ring).
- Angular positions: 1 wire at +Y (90°); 2 wires at ±Y; 4 wires at ±X and ±Y.
- Sections distal of the anchor carry no lumens.
- Minimum lumen: wire size + 0.025 mm on each dimension. The lumen takes the wire's shape (round wire → round lumen; flat wire → flat lumen, thickness radial, width tangential).
- "Within the wall" check: the lumen with its liner must not reach inside the section ID or outside the section OD (for a flat lumen the outer corners are checked).

### 6.4 Matrix of a reinforcement layer

The polymer that fills a braid, coil or pull-wire layer is the nearest polymer layer **outside** it (spec 4.4). It is shown in the layer editor now and used by the stiffness formulas from Phase 3.
