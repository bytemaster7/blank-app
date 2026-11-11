import { useState } from "react";
import { useApp } from "../../state/store";
import type { Material, MaterialNumericField } from "../../model/types";
import { FILLERS, particulateBlend, polymerBlend } from "../../physics/blend";
import { uniqueName } from "../../model/materials";
import { newId } from "../../model/id";
import { formatNumber, formatQuantity, unitLabel } from "../../units/units";
import { NumberField } from "../components/NumberField";
import { Modal } from "../components/Modal";

const ALL_ESTIMATED: MaterialNumericField[] = ["density", "E", "poisson", "UTS", "creaseStrain"];

export function BlendTool({ onClose, onSave }: { onClose: () => void; onSave: (m: Material) => void }) {
  const { materials, design } = useApp();
  const units = design.units;
  const polymers = materials.filter((m) => m.family === "Polymer");
  const [mode, setMode] = useState<"polymer" | "particulate">("polymer");
  const [aId, setAId] = useState(polymers[0]?.id ?? "");
  const [bId, setBId] = useState(polymers[1]?.id ?? polymers[0]?.id ?? "");
  const [pctB, setPctB] = useState(50);
  const [fillerIdx, setFillerIdx] = useState(0); // FILLERS.length = custom
  const [customDensity, setCustomDensity] = useState<number | undefined>(undefined);
  const [customName, setCustomName] = useState("additive");
  const [pctFiller, setPctFiller] = useState(20);
  const [savedName, setSavedName] = useState<string | null>(null);

  const a = polymers.find((m) => m.id === aId);
  const b = polymers.find((m) => m.id === bId);
  const filler = fillerIdx < FILLERS.length ? FILLERS[fillerIdx] : { name: customName, short: customName, density: customDensity ?? NaN };

  let name = "";
  let notes = "";
  let result: ReturnType<typeof polymerBlend> | ReturnType<typeof particulateBlend> | undefined;
  let extra: string[] = [];

  if (mode === "polymer" && a && b) {
    const r = polymerBlend(a, b, pctB / 100);
    result = r;
    name = `${a.name} / ${b.name} (${100 - pctB}/${pctB})`;
    notes = `Blend estimate: ${100 - pctB}% ${a.name} + ${pctB}% ${b.name} by mass (Davies rule).`;
    extra = [
      `Volume fractions: ${formatNumber((1 - r.volumeFraction) * 100, 3)}% / ${formatNumber(r.volumeFraction * 100, 3)}%`,
      `UTS upper bound (linear rule of mixtures): ${formatQuantity(r.UTSUpperBound, "pressure", units)} ${unitLabel("pressure", units)}`,
    ];
  } else if (mode === "particulate" && a && filler.density > 0) {
    const r = particulateBlend(a, filler.density, pctFiller / 100);
    result = r;
    name = `${a.name} (${pctFiller}% ${filler.short})`;
    notes = `Blend estimate: ${a.name} + ${pctFiller}% ${filler.short} by mass (Guth–Gold, Nicolais–Narkis, Nielsen).`;
    extra = [`Filler volume fraction φ: ${formatNumber(r.rawVolumeFraction, 3)}`];
    if (r.capped) {
      extra.push(`⚠ φ exceeds 0.35 — modulus, ν, UTS and crease strain are calculated at φ = 0.35 (the formulas are not valid beyond it). Density uses the true φ.`);
    }
  }

  const save = () => {
    if (!result) return;
    const finalName = uniqueName(name, materials.map((m) => m.name));
    const m: Material = {
      id: newId("mat"),
      name: finalName,
      family: "Polymer",
      thermoplastic: result.thermoplastic,
      density: result.density,
      E: result.E,
      poisson: result.poisson,
      UTS: result.UTS,
      notes,
      estimated: ALL_ESTIMATED.filter((f) => f !== "creaseStrain" || result!.creaseStrain !== undefined),
    };
    if (result.creaseStrain !== undefined) m.creaseStrain = result.creaseStrain;
    onSave(m);
    setSavedName(finalName);
  };

  const polymerSelect = (value: string, set: (id: string) => void, label: string) => (
    <label>
      {label}
      <select value={value} onChange={(e) => set(e.target.value)}>
        {polymers.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
    </label>
  );

  const row = (label: string, value: string, unit: string) => (
    <tr>
      <td>{label}</td>
      <td className="right">
        <b>{value}</b>
      </td>
      <td className="muted">{unit}</td>
    </tr>
  );

  return (
    <Modal title="Blend tool — estimates only" onClose={onClose} wide>
      <div className="segmented">
        <button className={mode === "polymer" ? "on" : ""} onClick={() => setMode("polymer")}>
          Polymer + polymer
        </button>
        <button className={mode === "particulate" ? "on" : ""} onClick={() => setMode("particulate")}>
          Polymer + additive
        </button>
      </div>

      <div className="blend">
        <div className="form">
          {mode === "polymer" ? (
            <>
              {polymerSelect(aId, setAId, "Polymer A")}
              {polymerSelect(bId, setBId, "Polymer B")}
              <label>
                Polymer B by mass: <b>{pctB}%</b>
                <input type="range" min={5} max={95} step={1} value={pctB} onChange={(e) => setPctB(Number(e.target.value))} />
              </label>
            </>
          ) : (
            <>
              {polymerSelect(aId, setAId, "Polymer")}
              <label>
                Additive
                <select value={fillerIdx} onChange={(e) => setFillerIdx(Number(e.target.value))}>
                  {FILLERS.map((f, i) => (
                    <option key={f.short} value={i}>
                      {f.name} — {f.density} g/cm³
                    </option>
                  ))}
                  <option value={FILLERS.length}>Custom…</option>
                </select>
              </label>
              {fillerIdx === FILLERS.length && (
                <>
                  <label>
                    Additive name
                    <input className="text" value={customName} onChange={(e) => setCustomName(e.target.value)} />
                  </label>
                  <label>
                    Additive density ({unitLabel("density", units)})
                    <NumberField value={customDensity} quantity="density" units={units} optional onCommit={(v) => setCustomDensity(v)} />
                  </label>
                </>
              )}
              <label>
                Additive by mass: <b>{pctFiller}%</b>
                <input type="range" min={1} max={80} step={1} value={pctFiller} onChange={(e) => setPctFiller(Number(e.target.value))} />
              </label>
            </>
          )}
        </div>

        <div className="preview">
          <div className="preview-title">Preview — estimate, not validated</div>
          {result ? (
            <>
              <div className="blend-name">{name}</div>
              <table className="kv">
                <tbody>
                  {row("Density", formatQuantity(result.density, "density", units), unitLabel("density", units))}
                  {row("Modulus E", formatQuantity(result.E, "pressure", units), unitLabel("pressure", units))}
                  {row("Poisson ν", formatNumber(result.poisson, 3), "")}
                  {row("UTS", formatQuantity(result.UTS, "pressure", units), unitLabel("pressure", units))}
                  {row("Crease strain", result.creaseStrain !== undefined ? formatQuantity(result.creaseStrain, "strain", units, 3) : "—", "%")}
                  {row("Thermoplastic", result.thermoplastic ? "Yes" : "No", "")}
                </tbody>
              </table>
              {extra.map((e) => (
                <div key={e} className="small muted">
                  {e}
                </div>
              ))}
            </>
          ) : (
            <div className="muted">Choose the components{mode === "particulate" && fillerIdx === FILLERS.length ? " and enter the additive density" : ""}.</div>
          )}
        </div>
      </div>

      {savedName && <div className="message ok">Saved “{savedName}” to the library.</div>}
      <div className="modal-actions">
        <button onClick={onClose}>Close</button>
        <button className="primary" disabled={!result} onClick={save}>
          Save to library
        </button>
      </div>
    </Modal>
  );
}
