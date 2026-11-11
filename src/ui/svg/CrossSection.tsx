import type { Design } from "../../model/types";
import { wireThk, wireWidth, type ResolvedSection } from "../../physics/geometry";

const WIRE = "#3c4043";

/** Scaled cross-section: every layer as an annulus in its colour, pull-wire lumens cut through the stack. */
export function CrossSection({ resolved, design, size = 320, selectedLayerId }: { resolved: ResolvedSection; design: Design; size?: number; selectedLayerId?: string }) {
  const R = resolved.outerDia / 2;
  if (!(R > 0) || !Number.isFinite(R)) return <div className="svg-empty" style={{ width: size, height: size }}>No geometry yet</div>;
  const V = R * 1.22;
  const hair = (2 * V) / size; // one screen pixel in mm
  const pw = design.pullwires;
  const outside = [...resolved.layers].reverse();

  return (
    <svg className="xsec" width={size} height={size} viewBox={`${-V} ${-V} ${2 * V} ${2 * V}`} role="img" aria-label="Cross-section">
      {outside.map((rl) => {
        const ro = rl.outerDia / 2;
        const selected = rl.layer.id === selectedLayerId;
        const mid = (rl.innerDia + rl.outerDia) / 4;
        return (
          <g key={rl.layer.id}>
            <circle r={Math.max(ro, 0)} fill={rl.layer.color} stroke={selected ? "#0b57d0" : "rgba(0,0,0,0.35)"} strokeWidth={hair * (selected ? 2 : 0.75)} />
            {(rl.braid || rl.coil) && rl.thickness > 0 && (
              <circle
                r={mid}
                fill="none"
                stroke={WIRE}
                strokeWidth={Math.max(rl.thickness * 0.7, hair)}
                strokeDasharray={rl.braid ? `${Math.max(hair * 3, mid * 0.09)} ${Math.max(hair * 2, mid * 0.05)}` : undefined}
                opacity={rl.coil ? 0.8 : 1}
              />
            )}
          </g>
        );
      })}
      <circle r={Math.max(resolved.innerDia / 2, 0)} fill="#fff" stroke="rgba(0,0,0,0.45)" strokeWidth={hair * 0.75} />

      {resolved.lumens.map((lu) => {
        const outerT = lu.boreThk + 2 * lu.linerWall;
        const outerW = lu.boreWidth + 2 * lu.linerWall;
        // rotate(-angle): local +x points radially outward at the lumen's angular position (screen y is down)
        return (
          <g key={lu.angleDeg} transform={`rotate(${-lu.angleDeg}) translate(${lu.rp} 0)`}>
            {lu.shape === "round" ? (
              <>
                <circle r={outerT / 2} fill="#fff" stroke="rgba(0,0,0,0.6)" strokeWidth={hair * 0.75} />
                {lu.linerWall > 0 && <circle r={lu.boreThk / 2} fill="#fff" stroke="rgba(0,0,0,0.35)" strokeWidth={hair * 0.5} />}
              </>
            ) : (
              <>
                <rect x={-outerT / 2} y={-outerW / 2} width={outerT} height={outerW} fill="#fff" stroke="rgba(0,0,0,0.6)" strokeWidth={hair * 0.75} />
                {lu.linerWall > 0 && <rect x={-lu.boreThk / 2} y={-lu.boreWidth / 2} width={lu.boreThk} height={lu.boreWidth} fill="#fff" stroke="rgba(0,0,0,0.35)" strokeWidth={hair * 0.5} />}
              </>
            )}
            {pw.wireShape === "round" ? (
              <circle r={wireThk(pw) / 2} fill={WIRE} />
            ) : (
              <rect x={-wireThk(pw) / 2} y={-wireWidth(pw) / 2} width={wireThk(pw)} height={wireWidth(pw)} fill={WIRE} />
            )}
          </g>
        );
      })}

      <g fontSize={hair * 11} fill="#5f6368" fontFamily="Roboto, sans-serif">
        <text x={0} y={-V + hair * 12} textAnchor="middle">
          +Y
        </text>
        <text x={V - hair * 4} y={hair * 4} textAnchor="end">
          +X
        </text>
      </g>
    </svg>
  );
}
