import { describe, expect, it } from "vitest";
import { generatePanel } from "./panel";
import fixtureCases from "../../../../fixtures/panel-cases.json";

interface FixtureCase {
  input: {
    finished_width_mm: number;
    finished_height_mm: number;
    corner_radius_mm: number;
    seam_allowance_mm: number;
  };
  expected: {
    cut_width_mm: number;
    cut_height_mm: number;
    finished_corner_radius_mm: number;
    cut_corner_radius_mm: number;
    finished_area_cm2: number;
    finished_perimeter_cm: number;
    cut_area_cm2: number;
    cut_perimeter_cm: number;
    warning_count: number;
  };
}

describe("generatePanel", () => {
  it("matches the shared cross-language fixture (see fixtures/README.md)", () => {
    const cases = fixtureCases as FixtureCase[];
    expect(cases.length).toBeGreaterThan(0);

    for (const { input, expected } of cases) {
      const panel = generatePanel(
        input.finished_width_mm,
        input.finished_height_mm,
        input.corner_radius_mm,
        input.seam_allowance_mm,
      );

      expect(panel.cutWidthMm).toBe(expected.cut_width_mm);
      expect(panel.cutHeightMm).toBe(expected.cut_height_mm);
      expect(panel.finishedCornerRadiusMm).toBe(
        expected.finished_corner_radius_mm,
      );
      expect(panel.cutCornerRadiusMm).toBe(expected.cut_corner_radius_mm);
      expect(panel.finishedAreaCm2).toBe(expected.finished_area_cm2);
      expect(panel.finishedPerimeterCm).toBe(expected.finished_perimeter_cm);
      expect(panel.cutAreaCm2).toBe(expected.cut_area_cm2);
      expect(panel.cutPerimeterCm).toBe(expected.cut_perimeter_cm);
      expect(panel.warnings.length).toBe(expected.warning_count);
    }
  });

  it("rejects non-positive dimensions", () => {
    expect(() => generatePanel(0, 10)).toThrow();
    expect(() => generatePanel(10, -5)).toThrow();
  });

  it("produces well-formed SVG path strings", () => {
    const panel = generatePanel(50, 30, 5, 4);
    expect(panel.cutOutlinePath.startsWith("M ")).toBe(true);
    expect(panel.cutOutlinePath.endsWith("Z")).toBe(true);
  });
});
