import { useApp } from "../../state/store";
import type { ResolvedSection } from "../../physics/geometry";
import { formatNumber, formatQuantity, unitLabel } from "../../units/units";
import { Icon } from "../components/Icon";
import { ColorBar } from "../svg/ColorBar";
import { CrossSection } from "../svg/CrossSection";
import { PeelAway } from "../svg/PeelAway";
import { saveDesignToFile } from "../designFile";

export function ReviewStep({ resolved, designProblems }: { resolved: ResolvedSection[]; designProblems: string[] }) {
  const { design, materials, setStep, buildModel } = useApp();
  const u = design.units;
  const L = unitLabel("length", u);
  const len = (v: number) => `${formatQuantity(v, "length", u)} ${L}`;
  const matName = (id?: string) => materials.find((m) => m.id === id)?.name ?? "—";
  const problemCount = designProblems.length + resolved.reduce((a, r) => a + r.problems.length, 0);
  const pw = design.pullwires;

  return (
    <div>
      <div className="card">
        <div className="card-head">
          <h3>{design.name}</h3>
          <span className="muted small">
            Total length {len(design.sections.reduce((a, s) => a + s.length, 0))} ·{" "}
            {pw.arrangement === "none" ? "no pull-wires" : `${{ single: 1, two: 2, four: 4 }[pw.arrangement]} pull-wire(s), ${matName(pw.materialId)}`}
          </span>
        </div>
        <ColorBar design={design} onSelect={setStep} showAnchor />
        {pw.arrangement !== "none" && <p className="small muted">The black tick marks the pull-wire anchor.</p>}
        {designProblems.length > 0 && (
          <ul className="problems">
            {designProblems.map((p) => (
              <li key={p}>
                <Icon name="error" size={16} /> {p}{" "}
                <button className="link" onClick={() => setStep("design")}>
                  Edit
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {resolved.map((r) => {
        const s = r.section;
        return (
          <div className="card review" key={s.id} style={{ borderLeft: `6px solid ${s.color}` }}>
            <div className="card-head">
              <h3>
                {s.label} <span className="muted normal">— {len(s.length)}</span>
              </h3>
              <button className="text-btn" onClick={() => setStep(s.id)}>
                <Icon name="edit" /> Edit
              </button>
            </div>
            {s.mode === "layered" ? (
              <div className="review-body">
                <div>
                  <div className="computed">
                    <div className="kpi">
                      <span>OD</span>
                      <b>{len(r.outerDia)}</b>
                    </div>
                    <div className="kpi">
                      <span>ID</span>
                      <b>{len(r.innerDia)}</b>
                    </div>
                    <div className="kpi">
                      <span>Wall</span>
                      <b>{len(r.wall)}</b>
                    </div>
                    {r.pullwireOffset !== undefined && (
                      <div className="kpi">
                        <span>Pull-wire offset</span>
                        <b>{len(r.pullwireOffset)}</b>
                      </div>
                    )}
                  </div>
                  <table className="kv small">
                    <tbody>
                      {r.layers.map((l) => (
                        <tr key={l.layer.id}>
                          <td>
                            <span className="dot" style={{ background: l.layer.color }} />
                          </td>
                          <td>{l.layer.name}</td>
                          <td className="muted">
                            {l.layer.type === "polymer" && matName(l.layer.materialId)}
                            {l.braid && `${l.layer.reinforcement?.carriers} ends, ${formatNumber(l.layer.reinforcement?.ppi ?? 0, 4)} PPI, ${formatNumber(l.braid.alphaDeg, 3)}°, ${formatNumber(l.braid.coverage * 100, 3)}% coverage`}
                            {l.coil && `${formatNumber(l.coil.alphaDeg, 3)}°, ${formatNumber(l.coil.coverage * 100, 3)}% coverage`}
                            {l.layer.type === "pullwireLayer" && `${r.lumens.length} lumen(s)`}
                          </td>
                          <td className="right">{len(l.thickness)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <PeelAway resolved={r} design={design} />
                </div>
                <CrossSection resolved={r} design={design} size={190} />
              </div>
            ) : (
              <p className="muted">{s.mode === "rigid" ? "Rigid body." : `Manual stiffness — EI ${formatQuantity(s.manual?.EI, "stiffness", u)} ${unitLabel("stiffness", u)}, GJ ${formatQuantity(s.manual?.GJ, "stiffness", u)} ${unitLabel("stiffness", u)}, EA ${formatQuantity(s.manual?.EA, "force", u)} ${unitLabel("force", u)}.`}</p>
            )}
            {r.problems.length > 0 && (
              <ul className="problems">
                {r.problems.map((p) => (
                  <li key={p}>
                    <Icon name="error" size={16} /> {p}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}

      <div className="build-bar">
        {problemCount > 0 ? (
          <span className="bad">
            <Icon name="error" size={16} /> {problemCount} problem{problemCount === 1 ? "" : "s"} to fix before the model can be built
          </span>
        ) : (
          <span className="ok-line">
            <Icon name="check" size={16} /> Ready to build
          </span>
        )}
        <span className="spacer" />
        <button onClick={saveDesignToFile}>
          <Icon name="save" /> Save Design
        </button>
        <button className="primary" disabled={problemCount > 0} onClick={buildModel}>
          <Icon name="build" /> Build Model
        </button>
      </div>
    </div>
  );
}
