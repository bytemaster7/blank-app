import { useId, useRef, useState } from "react";
import type { Design } from "../../model/types";
import type { ResolvedSection } from "../../physics/geometry";
import { copySvgAsPng } from "./copyPng";
import { safeFilename } from "../files";

const MIN_PX = 6; // thinnest layer drawn, so liners and braids stay visible (illustration, radially exaggerated)

/**
 * Parametric peel-away illustration: the jacket is full on the left (proximal) and each layer is cut
 * back in steps towards the distal end, with pull-wires emerging on the right.
 * Radial thicknesses are exaggerated where needed; it is an illustration, not a scale drawing.
 */
export function PeelAway({ resolved, design, width = 560 }: { resolved: ResolvedSection; design: Design; width?: number }) {
  const uid = useId().replace(/:/g, "");
  const ref = useRef<SVGSVGElement>(null);
  const [toast, setToast] = useState<string | null>(null);
  const layers = resolved.layers;
  const n = layers.length;
  if (!n || !(resolved.outerDia > 0)) return <div className="svg-empty" style={{ width, height: 120 }}>No geometry yet</div>;

  const scale = 46 / (resolved.outerDia / 2);
  const rBore = Math.max((resolved.innerDia / 2) * scale, 8);
  const rOut: number[] = [];
  let r = rBore;
  for (const l of layers) {
    r += Math.max(l.thickness * scale, MIN_PX);
    rOut.push(r);
  }
  const Rmax = rOut[n - 1];
  const labelH = 34;
  const H = 2 * Rmax + 24 + labelH;
  const cy = Rmax + 12;
  const x0 = 10;
  const tail = 46; // pull-wires / bore stub beyond the liner
  const step = (width - x0 - tail - 10) / (n + 0.6);
  const xEnd = (i: number) => x0 + step * (n - i + 0.6); // innermost extends farthest
  const startOf = (i: number) => (i === n - 1 ? x0 : xEnd(i + 1));

  const onContext = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!ref.current) return;
    try {
      const how = await copySvgAsPng(ref.current, `${safeFilename(resolved.section.label)}-peel-away.png`);
      setToast(how === "copied" ? "Copied as PNG" : "Saved as PNG");
    } catch (err) {
      setToast((err as Error).message);
    }
    setTimeout(() => setToast(null), 2200);
  };

  const pwLayerIdx = layers.findIndex((l) => l.layer.type === "pullwireLayer");
  const wires = pwLayerIdx >= 0 ? resolved.lumens.filter((lu) => lu.angleDeg !== 180) : [];
  const rWire = pwLayerIdx >= 0 ? (rOut[pwLayerIdx] + (pwLayerIdx ? rOut[pwLayerIdx - 1] : rBore)) / 2 : 0;
  const wireY = (angleDeg: number) => cy - rWire * Math.sin((angleDeg * Math.PI) / 180);
  const wirePx = Math.max(1.6, Math.min(4, (design.pullwires.wireShape === "round" ? (design.pullwires.wireDia ?? 0) : (design.pullwires.wireThk ?? 0)) * scale));

  return (
    <div className="peel" onContextMenu={onContext} title="Right-click to copy as PNG">
      <svg ref={ref} width={width} height={H} viewBox={`0 0 ${width} ${H}`} role="img" aria-label={`Peel-away of ${resolved.section.label}`}>
        <defs>
          <linearGradient id={`sh${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#000" stopOpacity="0.30" />
            <stop offset="0.32" stopColor="#fff" stopOpacity="0.38" />
            <stop offset="0.6" stopColor="#fff" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity="0.36" />
          </linearGradient>
          {layers.map((l, i) => {
            const a = l.braid?.alphaDeg ?? l.coil?.alphaDeg;
            if (a === undefined) return null;
            const spacing = l.coil ? 5 : 7;
            return [1, -1].map((dir) => (
              <pattern key={`${i}${dir}`} id={`p${uid}_${i}_${dir}`} width={spacing} height={spacing} patternUnits="userSpaceOnUse" patternTransform={`rotate(${dir * a})`}>
                <line x1="0" y1={spacing / 2} x2={spacing} y2={spacing / 2} stroke="#3c4043" strokeWidth={l.coil ? 2.4 : 1.6} />
              </pattern>
            ));
          })}
        </defs>

        {/* outermost first; each inner layer emerges from the end face of the one outside it */}
        {[...layers.keys()].reverse().map((i) => {
          const l = layers[i];
          const ro = rOut[i];
          const xs = startOf(i);
          const xe = xEnd(i);
          const reinforced = !!(l.braid || l.coil);
          return (
            <g key={l.layer.id}>
              <rect x={xs} y={cy - ro} width={xe - xs} height={2 * ro} fill={l.layer.color} />
              {reinforced && <rect x={xs} y={cy - ro} width={xe - xs} height={2 * ro} fill={`url(#p${uid}_${i}_1)`} />}
              {l.braid && <rect x={xs} y={cy - ro} width={xe - xs} height={2 * ro} fill={`url(#p${uid}_${i}_-1)`} />}
              <rect x={xs} y={cy - ro} width={xe - xs} height={2 * ro} fill={`url(#sh${uid})`} />
              <ellipse cx={xe} cy={cy} rx={ro * 0.16} ry={ro} fill={l.layer.color} />
              <ellipse cx={xe} cy={cy} rx={ro * 0.16} ry={ro} fill="rgba(0,0,0,0.22)" stroke="rgba(0,0,0,0.45)" strokeWidth="0.7" />
              <line x1={xs} y1={cy - ro} x2={xe} y2={cy - ro} stroke="rgba(0,0,0,0.45)" strokeWidth="0.7" />
              <line x1={xs} y1={cy + ro} x2={xe} y2={cy + ro} stroke="rgba(0,0,0,0.45)" strokeWidth="0.7" />
            </g>
          );
        })}
        {/* bore */}
        <ellipse cx={xEnd(0)} cy={cy} rx={rBore * 0.16} ry={rBore} fill="#fff" stroke="rgba(0,0,0,0.5)" strokeWidth="0.7" />

        {/* pull-wires emerging at the distal end */}
        {wires.map((lu) => (
          <line key={lu.angleDeg} x1={xEnd(pwLayerIdx)} y1={wireY(lu.angleDeg)} x2={width - 6} y2={wireY(lu.angleDeg)} stroke="#202124" strokeWidth={wirePx} strokeLinecap="round" />
        ))}

        {/* labels under each exposed step */}
        <g fontSize="10.5" fontFamily="Roboto, sans-serif" fill="#3c4043">
          {layers.map((l, i) => {
            const xm = (startOf(i) + xEnd(i)) / 2;
            const row = (n - 1 - i) % 2;
            return (
              <g key={l.layer.id}>
                <line x1={xm} y1={cy + rOut[i] + 1} x2={xm} y2={cy + Rmax + 8 + row * 13} stroke="#9aa0a6" strokeWidth="0.6" />
                <text x={xm} y={cy + Rmax + 18 + row * 13} textAnchor="middle">
                  {l.layer.name}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
