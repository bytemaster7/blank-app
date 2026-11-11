import { useMemo } from "react";

interface Props {
  /** Mean diameter, mm. */
  Dm: number;
  /** Axial advance per turn of one wire (braid lay length, or coil lead), mm. */
  lay: number;
  /** Wires (bands) per helix direction: N/2 for a braid, number of starts for a coil. */
  perDirection: number;
  /** Width of one band = wire width × filars, mm. */
  bandWidth: number;
  kind: "braid" | "coil";
  pattern?: "fullLoad" | "halfLoad" | "diamond";
  width?: number;
  height?: number;
  /** Axial window length in mm (so two previews can share a scale). Default 2.6 × Dm. */
  windowLength?: number;
  background?: string;
}

const TWO_PI = Math.PI * 2;

/**
 * Side view of the reinforcement on its tube, to scale: helices at ±α for a braid (with the over/under
 * interlace of the chosen pattern) or one hand of helix for a coil. Only the front half is drawn.
 */
export function BraidPreview({ Dm, lay, perDirection, bandWidth, kind, pattern = "fullLoad", width = 340, height = 150, windowLength, background = "#e8eaed" }: Props) {
  const R = Dm / 2;
  const Lw = windowLength ?? Dm * 2.6;
  const ok = R > 0 && lay > 0 && perDirection >= 1 && bandWidth > 0 && Number.isFinite(lay);

  const paths = useMemo(() => {
    if (!ok) return null;
    const k = TWO_PI / lay;
    const turns = Lw / lay;
    const steps = Math.round(Math.min(2400, Math.max(160, turns * 28)));
    const dx = Lw / steps;
    const helix = (phase: number, dir: 1 | -1) => {
      let d = "";
      let pen = false;
      for (let s = 0; s <= steps; s++) {
        const x = s * dx;
        const th = phase + dir * k * x;
        if (Math.cos(th) > 0.02) {
          d += `${pen ? "L" : "M"}${x.toFixed(4)} ${(-R * Math.sin(th)).toFixed(4)}`;
          pen = true;
        } else pen = false;
      }
      return d;
    };
    const a: string[] = [];
    const b: string[] = [];
    for (let i = 0; i < perDirection; i++) {
      const phase = (TWO_PI * i) / perDirection;
      a.push(helix(phase, 1));
      if (kind === "braid") b.push(helix(phase, -1));
    }
    // Interlace: redraw short pieces of family A where it passes OVER family B.
    const over: string[] = [];
    if (kind === "braid") {
      const perLay = 2 * perDirection; // crossings met by one wire per lay length
      const total = perDirection * perLay * turns;
      if (total < 5000) {
        const sinA = Math.sin(Math.atan((Math.PI * Dm) / lay));
        const half = Math.min((bandWidth / Math.max(sinA, 0.05)) * 0.75, lay / (2 * perLay));
        const twoOverTwo = pattern === "fullLoad";
        for (let i = 0; i < perDirection; i++) {
          const phaseA = (TWO_PI * i) / perDirection;
          const qMax = Math.ceil((2 * k * Lw) / (TWO_PI / perDirection)) + 1;
          for (let q = 0; q <= qMax; q++) {
            // crossing q along wire A_i: θ_A = θ_B  →  x = q·(2π/n) / (2k)
            const x = (q * (TWO_PI / perDirection)) / (2 * k);
            if (x > Lw) break;
            const aOver = twoOverTwo ? Math.floor(q / 2) % 2 === 0 : q % 2 === 0;
            if (!aOver) continue;
            const th = phaseA + k * x;
            if (Math.cos(th) <= 0.05) continue;
            const x1 = Math.max(0, x - half);
            const x2 = Math.min(Lw, x + half);
            over.push(`M${x1.toFixed(4)} ${(-R * Math.sin(phaseA + k * x1)).toFixed(4)}L${x.toFixed(4)} ${(-R * Math.sin(th)).toFixed(4)}L${x2.toFixed(4)} ${(-R * Math.sin(phaseA + k * x2)).toFixed(4)}`);
          }
        }
      }
    }
    return { a: a.join(""), b: b.join(""), over: over.join("") };
  }, [ok, Dm, R, lay, perDirection, bandWidth, kind, pattern, Lw]);

  if (!ok || !paths) return <div className="svg-empty" style={{ width, height }}>Enter the wire and pitch values to see the preview</div>;

  const pad = bandWidth;
  const vbH = 2 * R + 2 * pad;
  const px = Math.max(Lw / width, vbH / height); // mm per pixel
  const edge = Math.max(bandWidth * 0.18, px * 0.6);
  const strand = (d: string, key: string) => (
    <g key={key} fill="none" strokeLinecap="butt">
      <path d={d} stroke="#202124" strokeWidth={bandWidth + edge} />
      <path d={d} stroke="#9aa0a6" strokeWidth={Math.max(bandWidth - edge, px * 0.5)} />
    </g>
  );

  return (
    <svg className="braid-preview" width={width} height={height} viewBox={`0 ${-R - pad} ${Lw} ${vbH}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={`${kind} preview`}>
      <defs>
        <linearGradient id="tubeShade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0.28" />
          <stop offset="0.35" stopColor="#fff" stopOpacity="0.25" />
          <stop offset="1" stopColor="#000" stopOpacity="0.34" />
        </linearGradient>
        <clipPath id="tubeClip">
          <rect x={0} y={-R - pad} width={Lw} height={vbH} />
        </clipPath>
      </defs>
      <rect x={0} y={-R} width={Lw} height={2 * R} fill={background} />
      <g clipPath="url(#tubeClip)">
        {strand(paths.b, "b")}
        {strand(paths.a, "a")}
        {paths.b && strand(paths.b, "b2")}
        {paths.over && strand(paths.over, "over")}
        {!paths.b && null}
      </g>
      <rect x={0} y={-R - pad} width={Lw} height={vbH} fill="url(#tubeShade)" pointerEvents="none" />
    </svg>
  );
}
