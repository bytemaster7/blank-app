import { useMemo, useState } from "react";
import { useApp } from "../../state/store";
import { MAX_TOTAL_LENGTH } from "../../model/types";
import { resolveDesign } from "../../physics/geometry";
import { referencedMaterialIds } from "../../model/materials";
import { Icon } from "../components/Icon";
import { DesignStep } from "../setup/DesignStep";
import { ConstructionStep } from "../setup/ConstructionStep";
import { ReviewStep } from "../setup/ReviewStep";

/** Setup wizard (spec 5.1): Design → Construction (one step per section) → Review & Build. */
export function SetupTab() {
  const { design, materials, step, setStep, buildModel } = useApp();
  const resolved = useMemo(() => resolveDesign(design), [design]);
  const [selectedSection, setSelectedSection] = useState(design.sections[0]?.id ?? "");

  const order = ["design", ...design.sections.map((s) => s.id), "review"];
  const current = order.includes(step) ? step : "design";
  const idx = order.indexOf(current);
  const sectionIdx = design.sections.findIndex((s) => s.id === current);

  const designProblems = useMemo(() => {
    const out: string[] = [];
    const total = design.sections.reduce((a, s) => a + s.length, 0);
    if (total > MAX_TOTAL_LENGTH) out.push(`Total length ${total} mm exceeds the ${MAX_TOTAL_LENGTH} mm limit.`);
    const known = new Set(materials.map((m) => m.id));
    if (referencedMaterialIds(design).some((id) => !known.has(id))) out.push("The design uses a material that is no longer in the library.");
    if (design.designMode === "multiLumenCore") out.push("Multi-lumen core designs arrive in Phase 9 — choose another design mode.");
    return out;
  }, [design, materials]);
  const totalProblems = designProblems.length + resolved.reduce((a, r) => a + r.problems.length, 0);

  return (
    <div className="wizard">
      <aside className="rail">
        <button className={`rail-item ${current === "design" ? "on" : ""}`} onClick={() => setStep("design")}>
          <span className="rail-num">1</span> Design
          {designProblems.length > 0 && <span className="badge">{designProblems.length}</span>}
        </button>
        <div className="rail-group">
          <span className="rail-num">2</span> Construction
        </div>
        {design.sections.map((s, i) => (
          <button key={s.id} className={`rail-item sub ${current === s.id ? "on" : ""}`} onClick={() => setStep(s.id)}>
            <span className="dot" style={{ background: s.color }} /> {s.label}
            {resolved[i].problems.length > 0 && <span className="badge">{resolved[i].problems.length}</span>}
          </button>
        ))}
        <button className={`rail-item ${current === "review" ? "on" : ""}`} onClick={() => setStep("review")}>
          <span className="rail-num">3</span> Review &amp; Build
        </button>
      </aside>

      <section className="wizard-main">
        <div className="wizard-body">
          {current === "design" && <DesignStep selected={selectedSection} onSelect={setSelectedSection} />}
          {sectionIdx >= 0 && <ConstructionStep key={current} section={design.sections[sectionIdx]} resolved={resolved[sectionIdx]} />}
          {current === "review" && <ReviewStep resolved={resolved} designProblems={designProblems} />}
        </div>
        <div className="wizard-foot">
          <button disabled={idx === 0} onClick={() => setStep(order[idx - 1])}>
            <Icon name="left" /> Back
          </button>
          <span className="spacer" />
          {current === "review" ? (
            <button className="primary" disabled={totalProblems > 0} onClick={buildModel}>
              <Icon name="build" /> Build Model
            </button>
          ) : (
            <button className="primary" onClick={() => setStep(order[idx + 1])}>
              Next <Icon name="right" />
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
