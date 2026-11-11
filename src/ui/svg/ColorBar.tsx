import type { Design } from "../../model/types";

/** Sections drawn to scale, proximal on the left. Optional black tick at the pull-wire anchor point. */
export function ColorBar({ design, selectedId, onSelect, showAnchor }: { design: Design; selectedId?: string; onSelect?: (id: string) => void; showAnchor?: boolean }) {
  const total = design.sections.reduce((a, s) => a + Math.max(s.length, 0), 0) || 1;
  let anchorPct: number | undefined;
  if (showAnchor && design.pullwires.arrangement !== "none") {
    let run = 0;
    for (const s of design.sections) {
      run += s.length;
      if (s.id === design.pullwires.anchorAfterSectionId) anchorPct = (run / total) * 100;
    }
  }
  return (
    <div className="colorbar-wrap">
      <div className="colorbar">
        {design.sections.map((s) => (
          <button
            key={s.id}
            className={`colorbar-seg ${s.id === selectedId ? "sel" : ""}`}
            style={{ flexGrow: Math.max(s.length, 0.001), background: s.color }}
            title={`${s.label} — ${s.length} mm`}
            onClick={() => onSelect?.(s.id)}
          >
            <span>{s.label}</span>
          </button>
        ))}
        {anchorPct !== undefined && <div className="anchor-tick" style={{ left: `clamp(2px, ${anchorPct}%, calc(100% - 2px))` }} title="Pull-wire anchor" />}
      </div>
      <div className="colorbar-ends">
        <span>Proximal</span>
        <span>Distal tip</span>
      </div>
    </div>
  );
}
