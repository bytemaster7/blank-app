import type { Material, UnitSystem, WireDims } from "../../model/types";
import { COMMON_RIBBON_IN, COMMON_ROUND_IN } from "../../model/seedMaterials";
import { unitLabel } from "../../units/units";
import { Field } from "./Field";
import { NumberField } from "./NumberField";

const IN = 25.4;
const near = (a: number | undefined, b: number) => a !== undefined && Math.abs(a - b) < 1e-6;

/** Wire shape + size inputs with the common-size dropdown (sizes listed in inches, spec Section 6). */
export function WireFields({ wire, units, onChange }: { wire: WireDims; units: UnitSystem; onChange: (patch: Partial<WireDims>) => void }) {
  const L = unitLabel("length", units);
  const round = wire.wireShape === "round";
  const positive = (v: number | undefined, apply: (v: number) => void) => (v === undefined || !(v > 0) ? "Must be greater than 0" : apply(v));
  const common = round
    ? COMMON_ROUND_IN.findIndex((d) => near(wire.wireDia, d * IN))
    : COMMON_RIBBON_IN.findIndex(([t, w]) => near(wire.wireThk, t * IN) && near(wire.wireWidth, w * IN));

  return (
    <>
      <Field label="Wire shape">
        <select
          value={wire.wireShape}
          onChange={(e) => {
            if (e.target.value === "round") onChange({ wireShape: "round", wireDia: wire.wireDia ?? wire.wireThk ?? 0.002 * IN });
            else onChange({ wireShape: "flat", wireThk: wire.wireThk ?? 0.001 * IN, wireWidth: wire.wireWidth ?? 0.003 * IN });
          }}
        >
          <option value="round">Round</option>
          <option value="flat">Flat (ribbon)</option>
        </select>
      </Field>
      <Field label="Common sizes">
        <select
          value={common}
          onChange={(e) => {
            const i = Number(e.target.value);
            if (i < 0) return;
            if (round) onChange({ wireDia: COMMON_ROUND_IN[i] * IN });
            else onChange({ wireThk: COMMON_RIBBON_IN[i][0] * IN, wireWidth: COMMON_RIBBON_IN[i][1] * IN });
          }}
        >
          <option value={-1}>Custom</option>
          {round
            ? COMMON_ROUND_IN.map((d, i) => (
                <option key={d} value={i}>
                  {d}" ({(d * IN).toFixed(4)} mm)
                </option>
              ))
            : COMMON_RIBBON_IN.map(([t, w], i) => (
                <option key={`${t}x${w}`} value={i}>
                  {t}" × {w}"
                </option>
              ))}
        </select>
      </Field>
      {round ? (
        <Field label="Wire diameter" unit={L}>
          <NumberField value={wire.wireDia} quantity="length" units={units} onCommit={(v) => positive(v, (x) => onChange({ wireDia: x }))} />
        </Field>
      ) : (
        <>
          <Field label="Wire thickness" unit={L}>
            <NumberField value={wire.wireThk} quantity="length" units={units} onCommit={(v) => positive(v, (x) => onChange({ wireThk: x }))} />
          </Field>
          <Field label="Wire width" unit={L}>
            <NumberField value={wire.wireWidth} quantity="length" units={units} onCommit={(v) => positive(v, (x) => onChange({ wireWidth: x }))} />
          </Field>
        </>
      )}
    </>
  );
}

/** Material dropdown. `prefer` lists the usual families; "More materials…" reveals the whole library. */
export function MaterialSelect({
  materials,
  value,
  onChange,
  families,
  allowNone,
}: {
  materials: Material[];
  value: string | undefined;
  onChange: (id: string | undefined) => void;
  families: Material["family"][];
  allowNone?: string;
}) {
  const current = materials.find((m) => m.id === value);
  const showAll = current !== undefined && !families.includes(current.family);
  const main = materials.filter((m) => families.includes(m.family));
  const rest = materials.filter((m) => !families.includes(m.family));
  return (
    <select
      value={value ?? ""}
      className={!value && !allowNone ? "invalid" : ""}
      onChange={(e) => onChange(e.target.value || undefined)}
    >
      {(allowNone || !value) && <option value="">{allowNone ?? "Choose…"}</option>}
      {main.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name}
        </option>
      ))}
      {rest.length > 0 && (
        <optgroup label={showAll ? "Other materials" : "More materials…"}>
          {rest.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </optgroup>
      )}
    </select>
  );
}
