import { useApp } from "../../state/store";
import type { DesignMode, PullwireConfig } from "../../model/types";
import { MAX_TOTAL_LENGTH, MIN_SECTION_LENGTH } from "../../model/types";
import { addSection, deleteSection, moveSection, updatePullwires, updateSection } from "../../model/designOps";
import { formatQuantity, unitLabel } from "../../units/units";
import { wireArea } from "../../physics/geometry";
import { NumberField } from "../components/NumberField";
import { Field } from "../components/Field";
import { Icon } from "../components/Icon";
import { MaterialSelect, WireFields } from "../components/WireFields";
import { ColorBar } from "../svg/ColorBar";
import { loadDesignFromFile } from "../designFile";

const MODES: { value: DesignMode; label: string; disabled?: boolean }[] = [
  { value: "fixedID", label: "Fixed ID — build outward from the mandrel" },
  { value: "fixedOD", label: "Fixed OD — build inward" },
  { value: "fixedODandID", label: "Fixed OD and ID — one adaptive layer" },
  { value: "multiLumenCore", label: "Multi-lumen core (Phase 9)", disabled: true },
];

export function DesignStep({ selected, onSelect }: { selected: string; onSelect: (id: string) => void }) {
  const { design, materials, edit, updateDesign } = useApp();
  const u = design.units;
  const L = unitLabel("length", u);
  const total = design.sections.reduce((a, s) => a + s.length, 0);
  const showID = design.designMode !== "fixedOD";
  const showOD = design.designMode === "fixedOD" || design.designMode === "fixedODandID";
  const pw = design.pullwires;
  const pwMat = materials.find((m) => m.id === pw.materialId);
  const limitStress = pwMat ? (pwMat.yieldStrength ?? pwMat.UTS) : undefined;
  const setPw = (patch: Partial<PullwireConfig>) => edit((d) => updatePullwires(d, patch));

  return (
    <div className="cols two">
      <div>
        <div className="card">
          <div className="card-head">
            <h3>Design</h3>
            <button className="text-btn" onClick={loadDesignFromFile}>
              <Icon name="open" /> Load Design from file
            </button>
          </div>
          <div className="form two">
            <Field label="Name" wide>
              <input className="text" value={design.name} onChange={(e) => updateDesign({ name: e.target.value })} />
            </Field>
            <Field label="Design mode" wide>
              <select value={design.designMode} onChange={(e) => updateDesign({ designMode: e.target.value as DesignMode })}>
                {MODES.map((m) => (
                  <option key={m.value} value={m.value} disabled={m.disabled}>
                    {m.label}
                  </option>
                ))}
              </select>
            </Field>
            {showID && (
              <Field label="Fixed ID — mandrel diameter" unit={L}>
                <NumberField value={design.fixedID} quantity="length" units={u} onCommit={(v) => (v === undefined || v <= 0 ? "Must be greater than 0" : updateDesign({ fixedID: v }))} />
              </Field>
            )}
            {showOD && (
              <Field label="Fixed OD" unit={L}>
                <NumberField value={design.fixedOD} quantity="length" units={u} optional onCommit={(v) => (v === undefined || v <= 0 ? "Must be greater than 0" : updateDesign({ fixedOD: v }))} />
              </Field>
            )}
          </div>
        </div>

        <div className="card">
          <h3>Pull-wires</h3>
          <div className="form two">
            <Field label="Arrangement">
              <select value={pw.arrangement} onChange={(e) => setPw({ arrangement: e.target.value as PullwireConfig["arrangement"] })}>
                <option value="none">None</option>
                <option value="single">1 wire (+Y)</option>
                <option value="two">2 wires @ 180° (±Y)</option>
                <option value="four">4 wires @ 90° (±X, ±Y)</option>
              </select>
            </Field>
            {pw.arrangement !== "none" && (
              <>
                <Field label="Anchor — wires end at the distal end of">
                  <select value={pw.anchorAfterSectionId} onChange={(e) => setPw({ anchorAfterSectionId: e.target.value })}>
                    {design.sections.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <WireFields wire={pw} units={u} onChange={setPw} />
                <Field label="Wire material" wide>
                  <MaterialSelect materials={materials} value={pw.materialId} families={["Metal"]} onChange={(id) => id && setPw({ materialId: id })} />
                </Field>
              </>
            )}
          </div>
          {pw.arrangement !== "none" && limitStress !== undefined && (
            <p className="small muted">
              Wire tension limit{" "}
              <b>
                {formatQuantity(limitStress * wireArea(pw), "force", u, 3)} {unitLabel("force", u)}
              </b>{" "}
              ({pwMat?.yieldStrength !== undefined ? "yield" : "UTS"} × area). A “Pullwires” layer has been added to each section up to the anchor — set the lumen size
              in Construction.
            </p>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>Sections</h3>
          <span className={`small ${total > MAX_TOTAL_LENGTH ? "bad" : "muted"}`}>
            Total {formatQuantity(total, "length", u)} {L} (max {formatQuantity(MAX_TOTAL_LENGTH, "length", u)})
          </span>
        </div>
        <ColorBar design={design} selectedId={selected} onSelect={onSelect} showAnchor />
        <table className="list">
          <thead>
            <tr>
              <th />
              <th className="left">Label</th>
              <th>Length ({L})</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {design.sections.map((s, i) => (
              <tr key={s.id} className={s.id === selected ? "sel" : ""} onClick={() => onSelect(s.id)}>
                <td>
                  <input type="color" aria-label={`${s.label} colour`} value={s.color} onChange={(e) => edit((d) => updateSection(d, s.id, { color: e.target.value }))} />
                </td>
                <td>
                  <input className="text" aria-label="Section label" value={s.label} onChange={(e) => edit((d) => updateSection(d, s.id, { label: e.target.value }))} />
                </td>
                <td className="right">
                  <NumberField
                    value={s.length}
                    quantity="length"
                    units={u}
                    ariaLabel={`${s.label} length`}
                    onCommit={(v) => (v === undefined || v < MIN_SECTION_LENGTH ? `Minimum ${MIN_SECTION_LENGTH} mm` : edit((d) => updateSection(d, s.id, { length: v })))}
                  />
                </td>
                <td className="nowrap right">
                  <button className="icon" title="Move towards proximal" disabled={i === 0} onClick={(e) => (e.stopPropagation(), edit((d) => moveSection(d, s.id, -1)))}>
                    <Icon name="up" />
                  </button>
                  <button className="icon" title="Move towards distal" disabled={i === design.sections.length - 1} onClick={(e) => (e.stopPropagation(), edit((d) => moveSection(d, s.id, 1)))}>
                    <Icon name="down" />
                  </button>
                  <button className="icon danger" title="Delete section" disabled={design.sections.length <= 1} onClick={(e) => (e.stopPropagation(), edit((d) => deleteSection(d, s.id)))}>
                    <Icon name="delete" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button
          className="tonal"
          onClick={() => {
            const r = addSection(design, selected);
            edit(() => r.design);
            onSelect(r.sectionId);
          }}
        >
          <Icon name="add" /> Add section proximal to selection
        </button>
        <p className="small muted">The first row is the proximal end; the last row is the distal tip. A new section starts as a copy of the selected one.</p>
      </div>
    </div>
  );
}
