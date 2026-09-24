# CathSim — working rules

## 0. Who I am and how to work with me

I am a principal R&D engineer in catheter design and manufacturing with 20+ years' experience (extrusion, braiding, coiling, reflow lamination, tipping, PTFE liners, laser-cut hypotubes). I am not a software developer. I understand the mechanics deeply, so explain engineering choices to me plainly and do not hide formulas — but keep all code decisions yours. When something is ambiguous, ask me one short question rather than guessing.

Rules of engagement:

1. **First action of Phase 1:** create `CLAUDE.md` containing this Section 0 verbatim, so these rules survive every session.
2. Build in phases (Section 9). At the end of every phase: run `npm test` (it must be green), update `CHANGELOG.md`, commit and tag `phase-N`, then stop and tell me how to test the phase by hand. Do not start the next phase until I say "go".
3. Every formula you implement must appear in `PHYSICS.md` in plain engineering notation, with the assumption it relies on and its validity range. If you implement something differently from how I wrote it here, say so in PHYSICS.md and the CHANGELOG — never silently "correct" me; ask first.
4. Never fabricate material property values. Use the seed table in Section 6 and flag anything you had to estimate. Any threshold or constant that is not given in this prompt goes in a Settings panel, editable, labelled "estimate — not validated".
5. Every physics module gets Vitest unit tests against the hand-calculation cases in Section 10 before I see a UI for it. Print computed and expected values in the test output so I can read them.
6. The app runs fully offline on my laptop and starts with one command (`npm run dev`). No cloud, no accounts, no telemetry, and no Python backend — the only possible exception is Kink Radius Phase B (Section 5.4), and only if we get there.

---

## Project notes (added by Claude, not part of Section 0)

- The full build specification (Sections 0–10, referred to above as "this prompt") is kept verbatim in [`docs/SPEC.md`](docs/SPEC.md). Section numbers in these rules refer to that file.
- Decisions and answers to clarifying questions are recorded in `docs/DECISIONS.md` once agreed.
