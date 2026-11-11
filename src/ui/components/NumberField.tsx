import { useState } from "react";
import type { UnitSystem } from "../../model/types";
import { formatQuantity, fromDisplay, type Quantity } from "../../units/units";

interface Props {
  /** Value in internal units (mm, N, MPa, g/cm³, strain fraction). */
  value: number | undefined;
  quantity: Quantity;
  units: UnitSystem;
  /** Called with the new internal value; return an error message to reject the edit. */
  onCommit: (value: number | undefined) => string | void;
  optional?: boolean;
  disabled?: boolean;
  sig?: number;
  className?: string;
  ariaLabel?: string;
}

/**
 * Numeric input shown in display units. The stored value only changes when the user actually types
 * something different, so toggling units never alters the data.
 */
export function NumberField({ value, quantity, units, onCommit, optional, disabled, sig = 5, className, ariaLabel }: Props) {
  const shown = formatQuantity(value, quantity, units, sig);
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const commit = () => {
    if (draft === null) return;
    const text = draft.trim();
    setDraft(null);
    if (text === shown) return;
    if (text === "") {
      if (optional) setError(onCommit(undefined) || null);
      return;
    }
    const n = Number(text);
    if (!Number.isFinite(n)) {
      setError("Not a number");
      return;
    }
    setError(onCommit(fromDisplay(n, quantity, units)) || null);
  };

  return (
    <input
      className={`num ${error ? "invalid" : ""} ${className ?? ""}`}
      aria-label={ariaLabel}
      title={error ?? undefined}
      disabled={disabled}
      inputMode="decimal"
      value={draft ?? shown}
      placeholder={optional ? "—" : ""}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => {
        setDraft(e.target.value);
        setError(null);
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setDraft(null);
          setError(null);
        }
      }}
    />
  );
}
