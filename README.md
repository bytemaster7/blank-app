# CathSim

A personal catheter design & simulation workbench. Runs entirely on your own computer in a web browser — no cloud, no accounts.

> Screening estimates from simplified mechanics. Not a substitute for bench testing or V&V.

## Running it

You need [Node.js](https://nodejs.org) version 20 or newer (install the "LTS" version once).

Open a terminal in this folder and run:

```
npm install      (first time only — needs internet once)
npm run dev      (starts the app and opens it in your browser)
```

To stop the app, press `Ctrl + C` in the terminal.

To run the calculation checks: `npm test`

## Where things are

| File | What it is |
|---|---|
| `docs/SPEC.md` | The full specification |
| `PHYSICS.md` | Every formula the app uses, with assumptions and validity |
| `CHANGELOG.md` | What each phase added |
| `docs/DECISIONS.md` | Design decisions and why |
| `src/physics/` | The calculations (pure functions, each with tests) |
