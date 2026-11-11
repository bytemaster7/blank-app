import { useState } from "react";
import { useApp } from "../../state/store";
import type { LayerType, ManualStiffness, Section, SectionMode } from "../../model/types";
import { MIN_SECTION_LENGTH } from "../../model/types";
import { addLayer, cloneConstruction, deleteLayer, matchDimension, moveLayer, updateSection } from "../../model/designOps";
import type { ResolvedSection } from "../../physics/geometry";
import { formatNumber, formatQuantity, unitLabel } from "../../units/units";
import { NumberField } from "../components/NumberField";
import { Field } from "../components/Field";
import { Icon } from "../components/Icon";
import { Modal } from "../components/Modal";
import { CrossSection } from "../svg/CrossSection";
import { LayerEditor } from "./LayerEditor";

const TYPE_SHORT: Record<LayerType, string> = { polymer: "Polymer", braid: "Braid", triaxialBraid: "Triaxial", coil: "Coil", pullwireLayer: "Pullwires" };

export function ConstructionStep({ section, resolved }: { section: Section; resolved: ResolvedSection }) {
  const { design, materials, edit } = useApp();
  const u = design.units;
  const L = unitLabel("length", u);
  const [selectedLayer, setSelectedLayer] = useState<string | undefined>(section.layers[0]?.id);
  const [cloneOpen, setCloneOpen] = useState(false);
  const layer = section.layers.find((l) => l.id === selectedLayer) ?? section.layers[0];
  const rl = resolved.layers.find((x) => x.layer.id === layer?.id);
  const matName = (id?: string) => materials.find((m) => m.id === id)?.name;
  const len = (v: number) => formatQuantity(v, "length", u);

  const summary = (l: Section["layers"][number]) => {
    if (l.type === "polymer") return matName(l.materialId) ?? "— choose material —";
    if (l.type === "pullwireLayer") return `${resolved.lumens.length} lumen${resolved.lumens.length === 1 ? "" : "s"}`;
    const r = l.reinforcement;
    if (!r) return "";
    const wire = r.wireShape === "round" ? `Ø${len(r.wireDia ?? 0)}` : `${len(r.wireThk ?? 0)}×${len(r.wireWidth ?? 0)}`;
    return l.type === "coil" ? `${wire} ${L}, pitch ${len(r.pitch ?? 0)}` : `${r.carriers}×${wire} ${L}, ${formatNumber(r.ppi ?? 0, 4)} PPI`;
  };

  const add = (type: Exclude<LayerType, "pullwireLayer">) => {
    const r = addLayer(design, section.id, type, layer?.id);
    edit(() => r.design);
    setSelectedLayer(r.layerId);
  };

  return (
    <div className="cols three">
      {/* ---------- left: section + layer list ---------- */}
      <div className="card">
        <div className="section-strip" style={{ borderColor: section.color }}>
          <input type="color" aria-label="Section colour" value={section.color} onChange={(e) => edit((d) => updateSection(d, section.id, { color: e.target.value }))} />
          <input className="text title" aria-label="Section label" value={section.label} onChange={(e) => edit((d) => updateSection(d, section.id, { label: e.target.value }))} />
          <NumberField
            value={section.length}
            quantity="length"
            units={u}
            ariaLabel="Section length"
            onCommit={(v) => (v === undefined || v < MIN_SECTION_LENGTH ? `Minimum ${MIN_SECTION_LENGTH} mm` : edit((d) => updateSection(d, section.id, { length: v })))}
          />
          <span className="muted">{L}</span>
        </div>

        <div className="radio-row" role="radiogroup" aria-label="Section mode">
          {(
            [
              ["layered", "Layer construction"],
              ["manualStiffness", "Manual stiffness"],
              ["rigid", "Rigid body"],
            ] as [SectionMode, string][]
          ).map(([mode, label]) => (
            <label key={mode} className="check">
              <input
                type="radio"
                name={`mode-${section.id}`}
                checked={section.mode === mode}
                onChange={() => edit((d) => updateSection(d, section.id, { mode, manual: mode === "manualStiffness" ? (section.manual ?? { EI: 0, GJ: 0, EA: 0, pullwireOffset: 0 }) : section.manual }))}
              />
              {label}
            </label>
          ))}
        </div>

        {section.mode === "layered" && (
          <>
            <div className="card-head">
              <h4>Layers (inside → outside)</h4>
              <button className="text-btn" onClick={() => setCloneOpen(true)} disabled={design.sections.length < 2} title={design.sections.length < 2 ? "Needs at least two sections" : ""}>
                <Icon name="copy" /> Clone…
              </button>
            </div>
            <table className="list layers">
              <tbody>
                {section.layers.map((l, i) => {
                  const r = resolved.layers[i];
                  return (
                    <tr key={l.id} className={l.id === layer?.id ? "sel" : ""} onClick={() => setSelectedLayer(l.id)}>
                      <td>
                        <span className="dot" style={{ background: l.color }} />
                      </td>
                      <td>
                        <div className="layer-name">
                          {l.name} {l.adaptive && <span className="chip tiny">adaptive</span>}
                        </div>
                        <div className="small muted">
                          {TYPE_SHORT[l.type]} · {summary(l)}
                        </div>
                      </td>
                      <td className={`right nowrap ${r && !(r.thickness > 0) ? "bad" : ""}`}>{r ? len(r.thickness) : ""}</td>
                      <td className="nowrap right">
                        <button className="icon" title="Move inward" disabled={i === 0} onClick={(e) => (e.stopPropagation(), edit((d) => moveLayer(d, section.id, l.id, -1)))}>
                          <Icon name="up" size={16} />
                        </button>
                        <button className="icon" title="Move outward" disabled={i === section.layers.length - 1} onClick={(e) => (e.stopPropagation(), edit((d) => moveLayer(d, section.id, l.id, 1)))}>
                          <Icon name="down" size={16} />
                        </button>
                        <button
                          className="icon danger"
                          title={l.type === "pullwireLayer" ? "Set pull-wires to None on the Design step to remove" : "Delete layer"}
                          disabled={l.type === "pullwireLayer"}
                          onClick={(e) => (e.stopPropagation(), edit((d) => deleteLayer(d, section.id, l.id)))}
                        >
                          <Icon name="delete" size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="add-row">
              <span className="small muted">Add outside the selected layer:</span>
              <button className="tonal small" onClick={() => add("polymer")}>
                <Icon name="add" size={16} /> Polymer
              </button>
              <button className="tonal small" onClick={() => add("braid")}>
                <Icon name="add" size={16} /> Braid
              </button>
              <button className="tonal small" onClick={() => add("triaxialBraid")}>
                <Icon name="add" size={16} /> Triaxial
              </button>
              <button className="tonal small" onClick={() => add("coil")}>
                <Icon name="add" size={16} /> Coil
              </button>
            </div>
            <div className="computed foot">
              <div className="kpi">
                <span>OD</span>
                <b>
                  {len(resolved.outerDia)} {L}
                </b>
              </div>
              <div className="kpi">
                <span>ID</span>
                <b>
                  {len(resolved.innerDia)} {L}
                </b>
              </div>
              <div className="kpi">
                <span>Wall</span>
                <b>
                  {len(resolved.wall)} {L}
                </b>
              </div>
              <div className="kpi">
                <span>French</span>
                <b>{formatNumber(resolved.outerDia * 3, 3)} Fr</b>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ---------- centre: editor ---------- */}
      <div>
        {section.mode === "layered" && layer && rl && <LayerEditor key={layer.id} section={section} layer={layer} resolved={resolved} rl={rl} />}
        {section.mode === "manualStiffness" && <ManualEditor section={section} />}
        {section.mode === "rigid" && (
          <div className="card">
            <h3>Rigid body</h3>
            <p>This section does not bend, twist or stretch. Use it for a marker band, a bonded tip electrode or a rigid fitting. Only its length is used.</p>
          </div>
        )}
      </div>

      {/* ---------- right: cross-section + problems ---------- */}
      <div className="card center-card">
        <h4>Cross-section (to scale)</h4>
        {section.mode === "layered" ? <CrossSection resolved={resolved} design={design} selectedLayerId={layer?.id} /> : <div className="svg-empty" style={{ width: 320, height: 200 }}>No layer drawing for this mode</div>}
        {resolved.problems.length > 0 ? (
          <ul className="problems">
            {resolved.problems.map((p) => (
              <li key={p}>
                <Icon name="error" size={16} /> {p}
              </li>
            ))}
          </ul>
        ) : (
          <div className="ok-line">
            <Icon name="check" size={16} /> No problems in this section
          </div>
        )}
      </div>

      {cloneOpen && <CloneDialog section={section} onClose={() => setCloneOpen(false)} />}
    </div>
  );
}

function ManualEditor({ section }: { section: Section }) {
  const { design, edit } = useApp();
  const u = design.units;
  const m: ManualStiffness = section.manual ?? { EI: 0, GJ: 0, EA: 0, pullwireOffset: 0 };
  const set = (patch: Partial<ManualStiffness>) => edit((d) => updateSection(d, section.id, { manual: { ...m, ...patch } }));
  const pos = (v: number | undefined, apply: (v: number) => void) => (v === undefined || v <= 0 ? "Must be greater than 0" : apply(v));
  return (
    <div className="card">
      <h3>Manual stiffness</h3>
      <div className="form two">
        <Field label="Bending stiffness EI" unit={unitLabel("stiffness", u)}>
          <NumberField value={m.EI || undefined} quantity="stiffness" units={u} optional onCommit={(v) => pos(v, (x) => set({ EI: x }))} />
        </Field>
        <Field label="Torsional stiffness GJ" unit={unitLabel("stiffness", u)}>
          <NumberField value={m.GJ || undefined} quantity="stiffness" units={u} optional onCommit={(v) => pos(v, (x) => set({ GJ: x }))} />
        </Field>
        <Field label="Axial stiffness EA" unit={unitLabel("force", u)}>
          <NumberField value={m.EA || undefined} quantity="force" units={u} optional onCommit={(v) => pos(v, (x) => set({ EA: x }))} />
        </Field>
        <Field label="Pull-wire offset" unit={unitLabel("length", u)}>
          <NumberField value={m.pullwireOffset || undefined} quantity="length" units={u} optional onCommit={(v) => pos(v, (x) => set({ pullwireOffset: x }))} />
        </Field>
      </div>
      <div className="help">
        <b>How to obtain these values</b>
        <ul>
          <li>
            <b>From CAD:</b> EI = E × I and GJ = G × J using the section properties report (second moment of area I, polar moment J) and EA = E × area. For a laser-cut
            hypotube use the properties of the cut pattern averaged over one repeat, or bench values.
          </li>
          <li>
            <b>3-point bend:</b> span L, centre load F, centre deflection δ in the straight-line part of the curve → EI = F·L³ / (48·δ). Keep δ under about L/10.
          </li>
          <li>
            <b>Torsion:</b> gauge length L, torque T, twist angle φ in radians → GJ = T·L / φ.
          </li>
          <li>
            <b>Tensile:</b> gauge length L, load F, extension ΔL in the initial linear part → EA = F·L / ΔL.
          </li>
        </ul>
        The same EI is used for both bending directions.
      </div>
    </div>
  );
}

function CloneDialog({ section, onClose }: { section: Section; onClose: () => void }) {
  const { design, edit } = useApp();
  const others = design.sections.filter((s) => s.id !== section.id);
  const polymers = section.layers.filter((l) => l.type === "polymer");
  const [source, setSource] = useState(others[0]?.id ?? "");
  const [dim, setDim] = useState<"OD" | "ID">(design.designMode === "fixedOD" ? "ID" : "OD");
  const [layerId, setLayerId] = useState(polymers[polymers.length - 1]?.id ?? "");
  const [error, setError] = useState<string | null>(null);

  const sectionSelect = (
    <Field label="Other section" wide>
      <select value={source} onChange={(e) => setSource(e.target.value)}>
        {others.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
    </Field>
  );

  return (
    <Modal title={`Clone / match — ${section.label}`} onClose={onClose}>
      <div className="form">{sectionSelect}</div>
      <div className="clone-block">
        <h4>Clone From…</h4>
        <p className="small muted">Replaces every layer of {section.label} with a copy of the other section's construction.</p>
        <button
          className="tonal"
          onClick={() => {
            edit((d) => cloneConstruction(d, section.id, source));
            onClose();
          }}
        >
          Clone construction
        </button>
      </div>
      <div className="clone-block">
        <h4>Match Dimension To…</h4>
        <p className="small muted">Makes this section's OD or ID equal to the other section's by changing the thickness of one layer.</p>
        <div className="form two">
          <Field label="Dimension">
            <select value={dim} onChange={(e) => setDim(e.target.value as "OD" | "ID")}>
              <option>OD</option>
              <option>ID</option>
            </select>
          </Field>
          <Field label="Layer to adjust">
            <select value={layerId} onChange={(e) => setLayerId(e.target.value)}>
              {polymers.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {error && <div className="message error">{error}</div>}
        <button
          className="tonal"
          onClick={() => {
            const r = matchDimension(design, section.id, source, dim, layerId);
            if (r.error) return setError(r.error);
            edit(() => r.design);
            onClose();
          }}
        >
          Match {dim}
        </button>
      </div>
    </Modal>
  );
}
