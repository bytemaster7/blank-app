import { describe, expect, it } from "vitest";
import { check } from "../testUtil";
import { formatNumber, fromDisplay, toDisplay, unitLabel, type Quantity } from "./units";

describe("Unit conversion (display only)", () => {
  it("converts internal mm–N–MPa values to inch–lbf–psi", () => {
    console.log("\nUnit conversions");
    check("25.4 mm → in", toDisplay(25.4, "length", "in"), 1, "in", 1e-9);
    check("1 MPa → psi", toDisplay(1, "pressure", "in"), 145.0377, "psi", 1e-6);
    check("193000 MPa → psi (28.0 Msi)", toDisplay(193000, "pressure", "in"), 27.992e6, "psi", 1e-4);
    check("4.44822 N → lbf", toDisplay(4.4482216, "force", "in"), 1, "lbf", 1e-6);
    check("8.00 g/cm³ → lb/in³", toDisplay(8, "density", "in"), 0.28902, "lb/in³", 1e-4);
    check("112.985 N·mm → lbf·in", toDisplay(112.985, "moment", "in"), 1, "lbf·in", 1e-5);
    check("2869.8 N·mm² → lbf·in²", toDisplay(2869.815, "stiffness", "in"), 1, "lbf·in²", 1e-5);
    check("strain 0.06 → %", toDisplay(0.06, "strain", "mm"), 6, "%", 1e-9);
  });

  it("is the identity in mm mode and round-trips in inch mode", () => {
    const qs: Quantity[] = ["length", "pressure", "force", "density", "moment", "stiffness", "strain", "none"];
    for (const q of qs) {
      if (q !== "strain") expect(toDisplay(3.21, q, "mm")).toBe(3.21);
      expect(fromDisplay(toDisplay(3.21, q, "in"), q, "in")).toBeCloseTo(3.21, 12);
    }
  });

  it("labels and formats", () => {
    expect(unitLabel("length", "in")).toBe("in");
    expect(unitLabel("pressure", "mm")).toBe("MPa");
    expect(formatNumber(193000)).toBe("193000");
    expect(formatNumber(0.0254, 4)).toBe("0.0254");
    expect(formatNumber(27992279.1, 4)).toBe("27990000");
    expect(formatNumber(1.02)).toBe("1.02");
    expect(formatNumber(0)).toBe("0");
  });
});
