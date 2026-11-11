import { useMemo, useState } from "react";
import { useApp } from "../../state/store";
import type { Material, MaterialFamily, MaterialNumericField } from "../../model/types";
import { combineLibraries, materialUsage, referencedMaterialIds, validateMaterial } from "../../model/materials";
import { parseMaterialsFile, serializeMaterials } from "../../model/io";
import { seedMaterials } from "../../model/seedMaterials";
import { newId } from "../../model/id";
import { unitLabel, type Quantity } from "../../units/units";
import { NumberField } from "../components/NumberField";
import { Modal } from "../components/Modal";
import { downloadText, pickTextFile } from "../files";
import { BlendTool } from "./BlendTool";

const NUM_COLS: { field: MaterialNumericField; label: string; quantity: Quantity; optional?: boolean; only?: MaterialFamily }[] = [
  { field: "density", label: "Density", quantity: "density" },
  { field: "E", label: "E", quantity: "pressure" },
  { field: "poisson", label: "ν", quantity: "none" },
  { field: "UTS", label: "UTS", quantity: "pressure" },
  { field: "yieldStrength", label: "Yield", quantity: "pressure", optional: true, only: "Metal" },
  { field: "creaseStrain", label: "Crease strain", quantity: "strain", optional: true, only: "Polymer" },
];

export function MaterialsTab() {
  const { materials, setMaterials, design } = useApp();
  const units = design.units;
  const [filter, setFilter] = useState("");
  const [message, setMessage] = useState<{ kind: "error" | "ok"; lines: string[] } | null>(null);
  const [adding, setAdding] = useState(false);
  const [blending, setBlending] = useState(false);
  const [pendingImport, setPendingImport] = useState<Material[] | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return materials;
    return materials.filter((m) => `${m.name} ${m.family} ${m.notes ?? ""}`.toLowerCase().includes(q));
  }, [materials, filter]);

  const fail = (...lines: string[]) => setMessage({ kind: "error", lines });
  const ok = (...lines: string[]) => setMessage({ kind: "ok", lines });

  /** Applies an edit if the result is still a valid, uniquely named material; otherwise returns the reason. */
  const tryUpdate = (id: string, patch: Partial<Material>): string | void => {
    const current = materials.find((m) => m.id === id);
    if (!current) return;
    const next: Material = { ...current, ...patch };
    for (const k of Object.keys(next) as (keyof Material)[]) if (next[k] === undefined) delete next[k];
    const errs = validateMaterial(next);
    if (materials.some((m) => m.id !== id && m.name.trim().toLowerCase() === next.name.trim().toLowerCase())) {
      errs.push("another material already has this name");
    }
    if (errs.length) {
      fail(`${current.name}: ${errs.join("; ")}. The change was not applied.`);
      return errs[0];
    }
    setMessage(null);
    setMaterials(materials.map((m) => (m.id === id ? next : m)));
  };

  const toggleEstimate = (m: Material, field: MaterialNumericField) => {
    const set = new Set(m.estimated ?? []);
    if (set.has(field)) set.delete(field);
    else set.add(field);
    tryUpdate(m.id, { estimated: set.size ? [...set] : undefined });
  };

  const move = (id: string, dir: -1 | 1) => {
    const i = materials.findIndex((m) => m.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= materials.length) return;
    const next = [...materials];
    [next[i], next[j]] = [next[j], next[i]];
    setMaterials(next);
  };

  const remove = (m: Material) => {
    const uses = materialUsage(design, m.id);
    if (uses.length) return fail(`"${m.name}" is used in the current design (${uses.join(", ")}) and cannot be deleted.`);
    setMaterials(materials.filter((x) => x.id !== m.id));
    ok(`Deleted "${m.name}".`);
  };

  const doExport = () => downloadText("cathsim-materials.json", serializeMaterials(materials));

  const doImport = async () => {
    const text = await pickTextFile();
    if (text === undefined) return;
    const parsed = parseMaterialsFile(text);
    if (!parsed.ok) return fail("Import refused — nothing was changed.", ...parsed.errors);
    setMessage(null);
    setPendingImport(parsed.value);
  };

  const finishImport = (mode: "combine" | "replace") => {
    if (!pendingImport) return;
    if (mode === "replace") {
      const ids = new Set(pendingImport.map((m) => m.id));
      const missing = referencedMaterialIds(design)
        .filter((id) => !ids.has(id))
        .map((id) => materials.find((m) => m.id === id)?.name ?? id);
      if (missing.length) {
        setPendingImport(null);
        return fail(`Replace refused: the current design uses materials that are not in the imported file (${missing.join(", ")}). Use Combine instead.`);
      }
      setMaterials(pendingImport);
      ok(`Library replaced with ${pendingImport.length} materials.`);
    } else {
      const next = combineLibraries(materials, pendingImport);
      const renamed = next.slice(materials.length).filter((m, i) => m.name !== pendingImport[i].name).length;
      setMaterials(next);
      ok(`Added ${pendingImport.length} materials${renamed ? ` (${renamed} renamed because the name already existed)` : ""}.`);
    }
    setPendingImport(null);
  };

  const doReset = () => {
    const seeds = seedMaterials();
    const ids = new Set(seeds.map((m) => m.id));
    // Keep any custom material the current design depends on, so the design never points at nothing.
    const keep = materials.filter((m) => !ids.has(m.id) && materialUsage(design, m.id).length);
    setMaterials(combineLibraries(seeds, keep));
    setConfirmReset(false);
    ok(`Library reset to the ${seeds.length} default materials${keep.length ? ` (kept ${keep.length} custom material(s) used by the current design)` : ""}.`);
  };

  const filtering = filter.trim() !== "";

  return (
    <div className="tab-body">
      <div className="toolbar">
        <input className="search" placeholder="Search materials…" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <span className="muted">
          {visible.length} of {materials.length}
        </span>
        <span className="spacer" />
        <button onClick={() => setAdding(true)}>➕ Add material</button>
        <button onClick={() => setBlending(true)}>Blend tool…</button>
        <button onClick={doImport}>Import JSON</button>
        <button onClick={doExport}>Export JSON</button>
        <button onClick={() => setConfirmReset(true)}>Reset to defaults</button>
      </div>

      {message && (
        <div className={`message ${message.kind}`} role={message.kind === "error" ? "alert" : "status"}>
          <div>
            {message.lines.map((l, i) => (
              <div key={i}>{l}</div>
            ))}
          </div>
          <button className="icon" onClick={() => setMessage(null)} aria-label="Dismiss">
            ✕
          </button>
        </div>
      )}

      <div className="table-wrap">
        <table className="grid">
          <thead>
            <tr>
              <th />
              <th className="left">Name</th>
              <th className="left">Family</th>
              <th title="Thermoplastic — reflows (used by the Reflow tab)">Thermo</th>
              {NUM_COLS.map((c) => (
                <th key={c.field}>
                  {c.label}
                  {unitLabel(c.quantity, units) && <span className="unit"> {unitLabel(c.quantity, units)}</span>}
                </th>
              ))}
              <th className="left">Notes</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {visible.map((m) => (
              <tr key={m.id}>
                <td className="nowrap">
                  <button className="icon" disabled={filtering} title={filtering ? "Clear the search to reorder" : "Move up"} onClick={() => move(m.id, -1)}>
                    ▲
                  </button>
                  <button className="icon" disabled={filtering} title={filtering ? "Clear the search to reorder" : "Move down"} onClick={() => move(m.id, 1)}>
                    ▼
                  </button>
                </td>
                <td>
                  <TextCell value={m.name} wide onCommit={(name) => tryUpdate(m.id, { name })} ariaLabel="Name" />
                </td>
                <td>
                  <select
                    value={m.family}
                    aria-label="Family"
                    onChange={(e) => {
                      const family = e.target.value as MaterialFamily;
                      tryUpdate(m.id, { family, thermoplastic: family === "Polymer" ? m.thermoplastic : false });
                    }}
                  >
                    <option>Polymer</option>
                    <option>Metal</option>
                    <option>Other</option>
                  </select>
                </td>
                <td className="center">
                  {m.family === "Polymer" ? (
                    <input type="checkbox" aria-label="Thermoplastic" checked={m.thermoplastic} onChange={(e) => tryUpdate(m.id, { thermoplastic: e.target.checked })} />
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                {NUM_COLS.map((c) => {
                  const est = m.estimated?.includes(c.field) ?? false;
                  const applicable = !c.only || c.only === m.family || m[c.field] !== undefined;
                  return (
                    <td key={c.field} className="numcell">
                      {applicable ? (
                        <>
                          <NumberField
                            value={m[c.field]}
                            quantity={c.quantity}
                            units={units}
                            optional={c.optional}
                            ariaLabel={`${m.name} ${c.label}`}
                            onCommit={(v) => tryUpdate(m.id, { [c.field]: v } as Partial<Material>)}
                          />
                          <button
                            className={`est ${est ? "on" : ""}`}
                            title={est ? "Estimate — not validated. Click once you have a datasheet value." : "Datasheet value. Click to flag as an estimate."}
                            onClick={() => toggleEstimate(m, c.field)}
                            disabled={m[c.field] === undefined}
                          >
                            est
                          </button>
                        </>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                  );
                })}
                <td>
                  <TextCell value={m.notes ?? ""} wide onCommit={(notes) => tryUpdate(m.id, { notes: notes || undefined })} ariaLabel="Notes" />
                </td>
                <td>
                  <button className="icon danger" title="Delete" onClick={() => remove(m)}>
                    ✖
                  </button>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={NUM_COLS.length + 6} className="muted center">
                  No materials match “{filter}”.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="muted small">
        An amber <b>est</b> tag marks a value that is an estimate rather than a datasheet figure. Values are stored in mm–N–MPa; the unit switch only changes how
        they are displayed.
      </p>

      {adding && (
        <AddMaterial
          onClose={() => setAdding(false)}
          onSave={(m) => {
            setMaterials([...materials, m]);
            setAdding(false);
            ok(`Added "${m.name}".`);
          }}
        />
      )}
      {blending && (
        <BlendTool
          onClose={() => setBlending(false)}
          onSave={(m) => {
            setMaterials([...materials, m]);
            ok(`Saved "${m.name}" to the library (all properties flagged as estimates).`);
          }}
        />
      )}
      {pendingImport && (
        <Modal title="Import materials" onClose={() => setPendingImport(null)}>
          <p>The file contains {pendingImport.length} valid materials. How should they be imported?</p>
          <ul className="small">
            <li>
              <b>Combine</b> — keep the current library and add these. A material whose name already exists is added as <i>Name_2</i>.
            </li>
            <li>
              <b>Replace</b> — discard the current library and use only the file.
            </li>
          </ul>
          <div className="modal-actions">
            <button onClick={() => setPendingImport(null)}>Cancel</button>
            <button onClick={() => finishImport("replace")}>Replace</button>
            <button className="primary" onClick={() => finishImport("combine")}>
              Combine
            </button>
          </div>
        </Modal>
      )}
      {confirmReset && (
        <Modal title="Reset materials library?" onClose={() => setConfirmReset(false)}>
          <p>This discards your edits and custom materials and restores the default library. Export first if you want to keep a copy.</p>
          <div className="modal-actions">
            <button onClick={() => setConfirmReset(false)}>Cancel</button>
            <button className="primary danger" onClick={doReset}>
              Reset to defaults
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function TextCell({ value, onCommit, wide, ariaLabel }: { value: string; onCommit: (v: string) => string | void; wide?: boolean; ariaLabel?: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      className={wide ? "text wide" : "text"}
      aria-label={ariaLabel}
      value={draft ?? value}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== null && draft.trim() !== value) onCommit(draft.trim());
        setDraft(null);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") setDraft(null);
      }}
    />
  );
}

function AddMaterial({ onClose, onSave }: { onClose: () => void; onSave: (m: Material) => void }) {
  const { materials, design } = useApp();
  const units = design.units;
  const [m, setM] = useState<Partial<Material>>({ name: "", family: "Polymer", thermoplastic: true });
  const [errors, setErrors] = useState<string[]>([]);

  const save = () => {
    const candidate = { ...m, id: newId("mat"), name: (m.name ?? "").trim(), thermoplastic: m.family === "Polymer" && !!m.thermoplastic } as Material;
    const errs = validateMaterial(candidate);
    if (materials.some((x) => x.name.trim().toLowerCase() === candidate.name.toLowerCase())) errs.push("another material already has this name");
    if (errs.length) return setErrors(errs);
    onSave(candidate);
  };

  return (
    <Modal title="Add material" onClose={onClose}>
      <p className="small muted">Enter values from the supplier datasheet. Nothing is pre-filled, so no value is invented for you.</p>
      <div className="form">
        <label>
          Name
          <input className="text" autoFocus value={m.name} onChange={(e) => setM({ ...m, name: e.target.value })} />
        </label>
        <label>
          Family
          <select value={m.family} onChange={(e) => setM({ ...m, family: e.target.value as MaterialFamily })}>
            <option>Polymer</option>
            <option>Metal</option>
            <option>Other</option>
          </select>
        </label>
        {m.family === "Polymer" && (
          <label className="check">
            <input type="checkbox" checked={!!m.thermoplastic} onChange={(e) => setM({ ...m, thermoplastic: e.target.checked })} />
            Thermoplastic (reflows)
          </label>
        )}
        {NUM_COLS.filter((c) => !c.only || c.only === m.family).map((c) => (
          <label key={c.field}>
            {c.label} {unitLabel(c.quantity, units) && `(${unitLabel(c.quantity, units)})`}
            {c.optional && <span className="muted"> — optional</span>}
            <NumberField value={m[c.field]} quantity={c.quantity} units={units} optional onCommit={(v) => setM((prev) => ({ ...prev, [c.field]: v }))} />
          </label>
        ))}
        <label>
          Notes
          <input className="text" value={m.notes ?? ""} onChange={(e) => setM({ ...m, notes: e.target.value || undefined })} />
        </label>
      </div>
      {errors.length > 0 && (
        <div className="message error">
          <div>
            {errors.map((e) => (
              <div key={e}>{e}</div>
            ))}
          </div>
        </div>
      )}
      <div className="modal-actions">
        <button onClick={onClose}>Cancel</button>
        <button className="primary" onMouseDown={(e) => e.preventDefault()} onClick={save}>
          Save to library
        </button>
      </div>
    </Modal>
  );
}
