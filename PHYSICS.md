# CathSim — PHYSICS.md

Every formula the app implements is listed here in plain engineering notation, with the assumption it relies on and its validity range. Section numbers refer to `docs/SPEC.md`. If the code ever differs from the spec, the difference is stated here and in `CHANGELOG.md`.

> **Screening estimates from simplified mechanics. Not a substitute for bench testing or V&V.**

Status: **Phase 1** — conventions, unit conversion and the Materials blend tool are implemented. The calculator formulas (Sections 4.1–4.5, 4.7) are added to this file in Phase 3, when they are implemented and tested.

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
