# Decisions

Answers to clarifying questions. Where the owner said "pick the industry standard", the choice and the reason are recorded here so they can be overruled later.

| # | Question | Decision | Why | Applies from |
|---|---|---|---|---|
| 1 | Leftover Streamlit starter files | Deleted. | Unrelated to the app. | Phase 1 |
| 2 | Where the pull-wire lumen layer sits | Default position is **directly over the liner, under the braid** (braid over the lumens). It is a ring whose thickness = lumen outer size (lumen ID + 2 × liner wall), filled with the polymer that reflows into it; lumen centre r_p = mid-radius of that ring. The layer can be moved in the stack. | Braiding over the pull-wire lumens is the usual steerable-sheath construction: the braid stops the wire pulling through the wall. (My first proposal was over the braid; this replaces it.) | Phase 2 |
| 3 | Braid Transfer: is D₁ the mandrel OD or the braid mean diameter? | The input is the **mandrel OD**; the app adds one wire thickness to get the mean diameter (same rule as spec 4.3, Dm = seat diameter + t_w). The physics function works on mean diameters, so test 10.11 is unchanged. | Braid angle and PPI are conventionally calculated at the braid's pitch (mean) diameter, while the mandrel OD is what is specified and measured. | Phase 5 |
| 4 | Kink Radius orientation in Phase A | Keep the Brazier formulas exactly as written in spec 4.7. Orientation is shown but has no numerical effect until Phase B. | Classical Brazier is the textbook form; test 10.5 stays at M_B = 20.0 N·mm. | Phase 6 |
| 5 | Manual-stiffness sections | The single EI entered applies to both bending axes. | A bench 3-point bend gives one value. | Phase 3 |
| 6 | Triaxial braid lamination | Plies weighted by their own thickness: t_w per bias family, t_ax for the axial wires. | Standard classical lamination theory. | Phase 3 |
| 7 | Reinforcement matrix | Always the polymer layer directly outside the reinforcement, even if it is not thermoplastic. | As written in spec 4.4. | Phase 3 |
| 8 | PPI and wire sizes | PPI is always per inch. Wire sizes offered from the inch dropdowns and shown in mm as well. | Industry convention. | Phase 2 |
| 9 | Pull-wire angular positions | Single wire at +Y; two at ±Y; four at ±X and ±Y. | Matches spec 5.3 (0° azimuth = +Y bend). | Phase 2 |
| 10 | Blend tool timing | Built in Phase 1 with the Materials tab, tested against 10.12 first. | It is part of spec 5.9. | Phase 1 |
