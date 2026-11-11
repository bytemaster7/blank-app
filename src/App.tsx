import { TABS, useApp, type TabName } from "./state/store";
import { loadDesignFromFile, saveDesignToFile } from "./ui/designFile";
import { Icon } from "./ui/components/Icon";
import { MaterialsTab } from "./ui/tabs/MaterialsTab";
import { SetupTab } from "./ui/tabs/SetupTab";

/** Tabs that need a built model before they can show anything. */
const NEEDS_MODEL: TabName[] = ["Analysis", "Steering", "Kink Radius", "Pushability", "Design Sweep", "Reflow"];
const PHASE: Partial<Record<TabName, number>> = {
  Analysis: 3,
  Steering: 4,
  "Kink Radius": 6,
  Pushability: 7,
  "Design Sweep": 8,
  Reflow: 5,
  "Braid Transfer": 5,
};

export function App() {
  const { tab, setTab, design, modelBuilt, setUnits, notice, setNotice } = useApp();

  return (
    <div className="app">
      <header>
        <div className="brand">
          <span className="logo" />
          CathSim
        </div>
        <div className="design-name" title="Current design">
          {design.name}
        </div>
        <span className="spacer" />
        <button onClick={saveDesignToFile}>
          <Icon name="save" /> Save Design
        </button>
        <button onClick={loadDesignFromFile}>
          <Icon name="open" /> Load Design
        </button>
        <div className="segmented" role="group" aria-label="Units">
          <button className={design.units === "mm" ? "on" : ""} onClick={() => setUnits("mm")} title="mm · N · MPa · g/cm³">
            mm
          </button>
          <button className={design.units === "in" ? "on" : ""} onClick={() => setUnits("in")} title="in · lbf · psi · lb/in³">
            inch
          </button>
        </div>
      </header>

      <nav>
        {TABS.map((t) => (
          <button key={t} className={t === tab ? "on" : ""} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </nav>

      {notice && (
        <div className={`message ${notice.kind} global`} role={notice.kind === "error" ? "alert" : "status"}>
          <div>
            {notice.lines.map((l, i) => (
              <div key={i}>{l}</div>
            ))}
          </div>
          <button className="icon" onClick={() => setNotice(null)} aria-label="Dismiss">
            <Icon name="close" />
          </button>
        </div>
      )}

      <main>
        {tab === "Setup" && <SetupTab />}
        {tab === "Materials" && <MaterialsTab />}
        {tab !== "Setup" && tab !== "Materials" && (
          <div className="empty">
            {NEEDS_MODEL.includes(tab) && !modelBuilt ? (
              <>
                <h2>Build the model first</h2>
                <p>The {tab} tab works on a built model. Define the shaft in Setup and press Build Model.</p>
                <button className="primary" onClick={() => setTab("Setup")}>
                  Go to Setup
                </button>
              </>
            ) : (
              <h2>{NEEDS_MODEL.includes(tab) ? `Model built — ${tab}` : tab}</h2>
            )}
            <p className="muted">This tab is built in Phase {PHASE[tab]}.</p>
          </div>
        )}
      </main>

      <footer>Screening estimates from simplified mechanics. Not a substitute for bench testing or V&amp;V.</footer>
    </div>
  );
}
