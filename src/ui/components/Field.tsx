import type { ReactNode } from "react";

/** Material-style outlined field: small label above the control, optional unit and hint. */
export function Field({ label, unit, hint, children, wide }: { label: string; unit?: string; hint?: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <label className={`field ${wide ? "span2" : ""}`}>
      <span className="field-label">
        {label}
        {unit && <span className="unit"> ({unit})</span>}
      </span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}
