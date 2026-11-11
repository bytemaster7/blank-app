import { expect } from "vitest";

/**
 * Checks a computed value against a hand-calculated one and prints both,
 * so the test output can be read like a calculation sheet.
 * `relTol` is the allowed relative error (default 0.5%, i.e. agreement to the digits quoted in the spec).
 */
export function check(label: string, computed: number, expected: number, unit = "", relTol = 0.005): void {
  const err = expected === 0 ? Math.abs(computed) : Math.abs(computed / expected - 1);
  const pct = (err * 100).toFixed(3);
  console.log(
    `  ${label.padEnd(34)} computed ${computed.toPrecision(5).padStart(11)}   expected ${String(Number(expected.toPrecision(6))).padStart(9)} ${unit.padEnd(7)} (diff ${pct}%)`,
  );
  expect(err, `${label}: computed ${computed}, expected ${expected}`).toBeLessThanOrEqual(relTol);
}
