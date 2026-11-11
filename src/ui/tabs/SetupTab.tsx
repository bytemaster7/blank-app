import { useApp } from "../../state/store";
import type { DesignMode } from "../../model/types";
import { formatQuantity, unitLabel } from "../../units/units";
import { NumberField } from "../components/NumberField";

const MODES: { value: DesignMode; label: string }[] = [
  { value: "fixedID", label: "Fixed ID (build outward from the mandrel)" },
  { value: "fixedOD", label: "Fixed OD (build inward)" },
  { value: "fixedODandID", label: "Fixed OD and ID (one adaptive layer)" },
  { value: "multiLumenCore", label: "Multi-lumen core" },
];

/** Phase 1 placeholder for the Setup wizard: design basics and a read-only view of the starter design. */
export function SetupTab() {
  const { design, materials, updateDesign } = useApp();
  const u = design.units;
  const L = unitLabel("length", u);
  const matName = (id?: string) => materials.find((m) => m.id === id)?.name ?? "—";
  const showID = design.designMode === "fixedID" || design.designMode === "fixedODandID";
  const showOD = design.designMode === "fixedOD" || design.designMode === "fixedODandID";

  return (
    <div className="tab-body narrow">
      <div className="message info">
        <div>
          The full Setup wizard (sections, layers, live cross-section) arrives in Phase 2. For now this page holds the design basics so that Save / Load Design and
          the unit switch can be tested.
        </div>
      </div>
      <div className="card">
        <h3>Design</h3>
        <div className="form two">
          <label>
            Name
            <input className="text" value={design.name} onChange={(e) => updateDesign({ name: e.target.value })} />
          </label>
          <label>
            Design mode
            <select value={design.designMode} onChange={(e) => updateDesign({ designMode: e.target.value as DesignMode })}>
              {MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          {showID && (
            <label>
              Fixed ID — mandrel diameter ({L})
              <NumberField value={design.fixedID} quantity="length" units={u} optional onCommit={(v) => (v !== undefined && v <= 0 ? "Must be > 0" : updateDesign({ fixedID: v }))} />
            </label>
          )}
          {showOD && (
            <label>
              Fixed OD ({L})
              <NumberField value={design.fixedOD} quantity="length" units={u} optional onCommit={(v) => (v !== undefined && v <= 0 ? "Must be > 0" : updateDesign({ fixedOD: v }))} />
            </label>
          )}
        </div>
      </div>

      <div className="card">
        <h3>Sections (proximal → distal tip)</h3>
        {design.sections.map((s) => (
          <div key={s.id} className="section-row">
            <div className="swatch" style={{ background: s.color }} />
            <div>
              <b>{s.label}</b> — {formatQuantity(s.length, "length", u)} {L}
              <table className="kv small">
                <tbody>
                  {s.layers.map((l, i) => (
                    <tr key={l.id}>
                      <td className="muted">{i + 1}</td>
                      <td>{l.name}</td>
                      <td>{l.type}</td>
                      <td>{matName(l.materialId)}</td>
                      <td className="right">
                        {formatQuantity(l.thickness, "length", u)} {L}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
