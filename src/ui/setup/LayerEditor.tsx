import { useApp } from "../../state/store";
import type { Layer, LayerType, PullwireLumen, Reinforcement, Section } from "../../model/types";
import { makeLayer, minimumLumen, updateLayer, updateReinforcement, updateSection } from "../../model/designOps";
import { DENSITY_BAND_LABEL } from "../../physics/braid";
import { wireWidth, type ResolvedLayer, type ResolvedSection } from "../../physics/geometry";
import { formatNumber, formatQuantity, unitLabel } from "../../units/units";
import { NumberField } from "../components/NumberField";
import { Field } from "../components/Field";
import { MaterialSelect, WireFields } from "../components/WireFields";
import { BraidPreview } from "../svg/BraidPreview";

const TYPE_LABEL: Record<LayerType, string> = {
  polymer: "Polymer",
  braid: "Braid",
  triaxialBraid: "Triaxial braid",
  coil: "Coil",
  pullwireLayer: "Pullwires",
};

export function LayerEditor({ section, layer, resolved, rl }: { section: Section; layer: Layer; resolved: ResolvedSection; rl: ResolvedLayer }) {
  const { design, materials, edit } = useApp();
  const u = design.units;
  const L = unitLabel("length", u);
  const set = (patch: Partial<Layer>) => edit((d) => updateLayer(d, section.id, layer.id, patch));
  const setR = (patch: Partial<Reinforcement>) => edit((d) => updateReinforcement(d, section.id, layer.id, patch));
  const len = (v: number) => `${formatQuantity(v, "length", u)} ${L}`;
  const matrix = materials.find((m) => m.id === rl.matrixMaterialId);

  const changeType = (type: LayerType) => {
    if (type === layer.type || type === "pullwireLayer") return;
    const fresh = makeLayer(type, layer.materialId);
    const keepName = layer.name !== TYPE_LABEL[layer.type];
    const isReinf = (t: LayerType) => t !== "polymer";
    // braid ↔ triaxial keeps the wire settings
    const reinforcement =
      isReinf(type) && isReinf(layer.type) && type !== "coil" && layer.type !== "coil" && layer.reinforcement
        ? { ...fresh.reinforcement!, ...layer.reinforcement, axialWireCount: layer.reinforcement.axialWireCount ?? fresh.reinforcement!.axialWireCount, matchAxialToBias: layer.reinforcement.matchAxialToBias ?? true }
        : fresh.reinforcement;
    set({ ...fresh, id: layer.id, name: keepName ? layer.name : fresh.name, reinforcement, adaptive: type === "polymer" ? layer.adaptive : false, thickness: type === "polymer" ? layer.thickness || 0.1 : 0 });
  };

  return (
    <div className="card editor">
      <div className="form two">
        <Field label="Layer name">
          <input className="text" value={layer.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field label="Colour">
          <input type="color" value={layer.color} onChange={(e) => set({ color: e.target.value })} />
        </Field>
        {layer.type !== "pullwireLayer" && (
          <Field label="Type" wide>
            <select value={layer.type} onChange={(e) => changeType(e.target.value as LayerType)}>
              <option value="polymer">Polymer</option>
              <option value="braid">Braid</option>
              <option value="triaxialBraid">Triaxial braid</option>
              <option value="coil">Coil</option>
            </select>
          </Field>
        )}

        {layer.type === "polymer" && (
          <>
            <Field label="Material" wide>
              <MaterialSelect materials={materials} value={layer.materialId} families={["Polymer"]} onChange={(id) => set({ materialId: id })} />
            </Field>
            <Field label="Thickness" unit={L} hint={layer.adaptive ? "Calculated — this is the adaptive layer" : undefined}>
              {layer.adaptive ? (
                <input className="num" disabled value={formatQuantity(rl.thickness, "length", u)} />
              ) : (
                <NumberField value={layer.thickness} quantity="length" units={u} onCommit={(v) => (v === undefined || v <= 0 ? "Must be greater than 0" : set({ thickness: v }))} />
              )}
            </Field>
            {design.designMode === "fixedODandID" && (
              <label className="check">
                <input type="checkbox" checked={layer.adaptive} onChange={(e) => set({ adaptive: e.target.checked })} />
                Adaptive layer (takes up the wall between fixed ID and OD)
              </label>
            )}
          </>
        )}

        {layer.reinforcement && (
          <>
            <Field label="Wire material" wide>
              <MaterialSelect materials={materials} value={layer.reinforcement.wireMaterialId} families={["Metal", "Other"]} onChange={(id) => id && setR({ wireMaterialId: id })} />
            </Field>
            <WireFields wire={layer.reinforcement} units={u} onChange={setR} />
          </>
        )}

        {(layer.type === "braid" || layer.type === "triaxialBraid") && layer.reinforcement && (
          <>
            <Field label="Carriers (loaded ends)">
              <NumberField value={layer.reinforcement.carriers} quantity="none" units={u} onCommit={(v) => (v === undefined || v < 2 ? "At least 2" : setR({ carriers: Math.round(v) }))} />
            </Field>
            <Field label="Filars per carrier">
              <NumberField value={layer.reinforcement.filars} quantity="none" units={u} onCommit={(v) => (v === undefined || v < 1 || v > 10 ? "1 to 10" : setR({ filars: Math.round(v) }))} />
            </Field>
            <Field label="Pattern">
              <select value={layer.reinforcement.pattern} onChange={(e) => setR({ pattern: e.target.value as Reinforcement["pattern"] })}>
                <option value="fullLoad">Full load (2-over-2)</option>
                <option value="halfLoad">Half load (diamond geometry)</option>
                <option value="diamond">Diamond (1-over-1)</option>
              </select>
            </Field>
            <Field label="PPI (picks per inch)" hint={rl.braid?.jam.fits ? `Capped at the jamming limit, ${formatNumber(rl.braid.jam.ppiMax, 4)} PPI` : undefined}>
              <NumberField
                value={layer.reinforcement.ppi}
                quantity="none"
                units={u}
                onCommit={(v) => {
                  if (v === undefined || v <= 0) return "Must be greater than 0";
                  const max = rl.braid?.jam.fits ? Math.floor(rl.braid.jam.ppiMax * 10) / 10 : Infinity;
                  setR({ ppi: Math.min(v, max) });
                }}
              />
            </Field>
          </>
        )}

        {layer.type === "triaxialBraid" && layer.reinforcement && (
          <>
            <Field label="Axial wires">
              <NumberField value={layer.reinforcement.axialWireCount} quantity="none" units={u} onCommit={(v) => (v === undefined || v < 1 ? "At least 1" : setR({ axialWireCount: Math.round(v) }))} />
            </Field>
            <label className="check">
              <input
                type="checkbox"
                checked={layer.reinforcement.matchAxialToBias ?? true}
                onChange={(e) => {
                  const r = layer.reinforcement!;
                  setR({ matchAxialToBias: e.target.checked, axialWire: e.target.checked ? undefined : { wireShape: r.wireShape, wireDia: r.wireDia, wireThk: r.wireThk, wireWidth: r.wireWidth, materialId: r.wireMaterialId } });
                }}
              />
              Axial wire same as bias wire
            </label>
            {layer.reinforcement.axialWire && !layer.reinforcement.matchAxialToBias && (
              <>
                <Field label="Axial wire material" wide>
                  <MaterialSelect materials={materials} value={layer.reinforcement.axialWire.materialId} families={["Metal", "Other"]} onChange={(id) => id && setR({ axialWire: { ...layer.reinforcement!.axialWire!, materialId: id } })} />
                </Field>
                <WireFields wire={layer.reinforcement.axialWire} units={u} onChange={(p) => setR({ axialWire: { ...layer.reinforcement!.axialWire!, ...p } })} />
              </>
            )}
          </>
        )}

        {layer.type === "coil" && layer.reinforcement && (
          <>
            <Field label="Pitch (band centre to centre)" unit={L} hint={rl.coil ? `Closed pitch = ${len(rl.coil.minPitch)}` : undefined}>
              <NumberField
                value={layer.reinforcement.pitch}
                quantity="length"
                units={u}
                onCommit={(v) => {
                  if (v === undefined || v <= 0) return "Must be greater than 0";
                  const min = wireWidth(layer.reinforcement!) * (layer.reinforcement!.coilFilars ?? 1);
                  if (v < min * (1 - 1e-9)) return `Below closed pitch (${len(min)})`;
                  setR({ pitch: v });
                }}
              />
            </Field>
            <Field label="Starts (independent helices)">
              <NumberField value={layer.reinforcement.coilCarriers} quantity="none" units={u} onCommit={(v) => (v === undefined || v < 1 || v > 10 ? "1 to 10" : setR({ coilCarriers: Math.round(v) }))} />
            </Field>
            <Field label="Filars per band">
              <NumberField value={layer.reinforcement.coilFilars} quantity="none" units={u} onCommit={(v) => (v === undefined || v < 1 || v > 10 ? "1 to 10" : setR({ coilFilars: Math.round(v) }))} />
            </Field>
          </>
        )}

        {layer.type === "pullwireLayer" && section.pullwireLumen && <LumenFields section={section} lumen={section.pullwireLumen} />}
      </div>

      <div className="computed">
        <div className="kpi">
          <span>ID</span>
          <b>{len(rl.innerDia)}</b>
        </div>
        <div className="kpi">
          <span>OD</span>
          <b>{len(rl.outerDia)}</b>
        </div>
        <div className="kpi">
          <span>Thickness</span>
          <b>{len(rl.thickness)}</b>
        </div>
        {layer.type === "pullwireLayer" && resolved.pullwireOffset !== undefined && (
          <div className="kpi">
            <span>Pull-wire offset</span>
            <b>{len(resolved.pullwireOffset)}</b>
          </div>
        )}
      </div>

      {rl.braid && layer.reinforcement && (
        <div className="reinf">
          <div className="computed">
            <div className="kpi">
              <span>Braid angle (from axis)</span>
              <b>{formatNumber(rl.braid.alphaDeg, 3)}°</b>
            </div>
            <div className="kpi">
              <span>Coverage</span>
              <b>{formatNumber(rl.braid.coverage * 100, 3)}%</b>
            </div>
            <div className="kpi">
              <span>Fill factor</span>
              <b>{formatNumber(rl.braid.fill, 3)}</b>
            </div>
            <div className="kpi">
              <span>PPI max</span>
              <b>{rl.braid.jam.fits ? formatNumber(rl.braid.jam.ppiMax, 4) : "—"}</b>
            </div>
            <div className="kpi">
              <span>Lay length</span>
              <b>{len(rl.braid.layLength)}</b>
            </div>
          </div>
          <div className="chips">
            <span className={`chip band-${rl.braid.band}`}>{DENSITY_BAND_LABEL[rl.braid.band]}</span>
            {rl.braid.rideOver && <span className="chip">Ride-over allowance +10% wire thickness</span>}
            <span className="chip plain">Matrix: {matrix?.name ?? "—"}</span>
          </div>
          <BraidPreview
            kind="braid"
            Dm={rl.braid.Dm}
            lay={rl.braid.layLength}
            perDirection={(layer.reinforcement.carriers ?? 0) / 2}
            bandWidth={wireWidth(layer.reinforcement) * (layer.reinforcement.filars ?? 1)}
            pattern={layer.reinforcement.pattern}
          />
        </div>
      )}

      {rl.coil && layer.reinforcement && (
        <div className="reinf">
          <div className="computed">
            <div className="kpi">
              <span>Coil angle (from axis)</span>
              <b>{formatNumber(rl.coil.alphaDeg, 3)}°</b>
            </div>
            <div className="kpi">
              <span>Coverage</span>
              <b>{formatNumber(rl.coil.coverage * 100, 3)}%</b>
            </div>
            <div className="kpi">
              <span>Lead</span>
              <b>{len(rl.coil.lead)}</b>
            </div>
          </div>
          <div className="chips">
            {rl.coil.coverage >= 1 - 1e-9 && <span className="chip band-high">Closed pitch</span>}
            <span className="chip plain">Matrix: {matrix?.name ?? "—"}</span>
          </div>
          <BraidPreview
            kind="coil"
            Dm={rl.coil.Dm}
            lay={rl.coil.lead}
            perDirection={layer.reinforcement.coilCarriers ?? 1}
            bandWidth={wireWidth(layer.reinforcement) * (layer.reinforcement.coilFilars ?? 1)}
          />
        </div>
      )}
    </div>
  );
}

function LumenFields({ section, lumen }: { section: Section; lumen: PullwireLumen }) {
  const { design, materials, edit } = useApp();
  const u = design.units;
  const L = unitLabel("length", u);
  const min = minimumLumen(design.pullwires);
  const set = (patch: Partial<PullwireLumen>) => edit((d) => updateSection(d, section.id, { pullwireLumen: { ...lumen, ...patch } }));
  const atLeast = (v: number | undefined, m: number, apply: (v: number) => void) =>
    v === undefined || v < m - 1e-9 ? `Minimum ${formatQuantity(m, "length", u)} ${L} (wire + 0.025 mm)` : apply(v);

  return (
    <>
      {lumen.lumenID !== undefined ? (
        <Field label="Lumen ID" unit={L} hint={`Minimum ${formatQuantity(min.lumenID!, "length", u)} ${L}`}>
          <NumberField value={lumen.lumenID} quantity="length" units={u} onCommit={(v) => atLeast(v, min.lumenID!, (x) => set({ lumenID: x }))} />
        </Field>
      ) : (
        <>
          <Field label="Lumen thickness (radial)" unit={L}>
            <NumberField value={lumen.lumenThk} quantity="length" units={u} onCommit={(v) => atLeast(v, min.lumenThk!, (x) => set({ lumenThk: x }))} />
          </Field>
          <Field label="Lumen width" unit={L}>
            <NumberField value={lumen.lumenWidth} quantity="length" units={u} onCommit={(v) => atLeast(v, min.lumenWidth!, (x) => set({ lumenWidth: x }))} />
          </Field>
        </>
      )}
      <Field label="Lumen liner material">
        <MaterialSelect
          materials={materials}
          value={lumen.linerMaterialId}
          families={["Polymer"]}
          allowNone="No liner"
          onChange={(id) => set({ linerMaterialId: id, linerWall: id ? (lumen.linerWall ?? 0.0254) : undefined })}
        />
      </Field>
      {lumen.linerMaterialId && (
        <Field label="Liner wall" unit={L}>
          <NumberField value={lumen.linerWall} quantity="length" units={u} onCommit={(v) => (v === undefined || v <= 0 ? "Must be greater than 0" : set({ linerWall: v }))} />
        </Field>
      )}
      <Field label="Construction" wide>
        <select value={lumen.constructionType} onChange={(e) => set({ constructionType: e.target.value as PullwireLumen["constructionType"] })}>
          <option value="individualMandrels">Individual mandrels</option>
          <option value="multiLumenExtrusion">Multi-lumen extrusion</option>
        </select>
      </Field>
      <p className="small muted span2">Wire size, material and arrangement are set on the Design step. The lumen follows the wire shape.</p>
    </>
  );
}
