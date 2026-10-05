/**
 * Client-side mirror of `packages/core_py/core_py/geometry.py`.
 *
 * This exists purely so the UI can redraw the pattern instantly on every
 * slider tick without a network round trip. It is NOT the source of
 * truth — `apps/api` recomputes the same geometry server-side on every
 * `POST /api/v1/patterns`, and that server value is what gets stored,
 * exported, and billed. See `fixtures/panel-cases.json` and
 * `ARCHITECTURE.md` for how the two implementations are kept honest
 * about agreeing with each other.
 */

export interface PanelResult {
  finishedWidthMm: number;
  finishedHeightMm: number;
  finishedCornerRadiusMm: number;
  seamAllowanceMm: number;

  cutWidthMm: number;
  cutHeightMm: number;
  cutCornerRadiusMm: number;

  finishedAreaCm2: number;
  finishedPerimeterCm: number;
  cutAreaCm2: number;
  cutPerimeterCm: number;

  stitchGuidePath: string;
  cutOutlinePath: string;
  viewboxWidthMm: number;
  viewboxHeightMm: number;

  warnings: string[];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function roundedRectPath(x: number, y: number, w: number, h: number, r: number): string {
  if (r <= 0) {
    return `M ${x},${y} H ${x + w} V ${y + h} H ${x} Z`;
  }
  return (
    `M ${x + r},${y} ` +
    `H ${x + w - r} ` +
    `A ${r},${r} 0 0 1 ${x + w},${y + r} ` +
    `V ${y + h - r} ` +
    `A ${r},${r} 0 0 1 ${x + w - r},${y + h} ` +
    `H ${x + r} ` +
    `A ${r},${r} 0 0 1 ${x},${y + h - r} ` +
    `V ${y + r} ` +
    `A ${r},${r} 0 0 1 ${x + r},${y} ` +
    `Z`
  );
}

function roundedRectAreaCm2(wMm: number, hMm: number, rMm: number): number {
  const areaMm2 = wMm * hMm - (4 - Math.PI) * (rMm * rMm);
  return round2(areaMm2 / 100);
}

function roundedRectPerimeterCm(wMm: number, hMm: number, rMm: number): number {
  const perimeterMm = 2 * (wMm + hMm) - 8 * rMm + 2 * Math.PI * rMm;
  return round2(perimeterMm / 10);
}

export function generatePanel(
  finishedWidthMm: number,
  finishedHeightMm: number,
  cornerRadiusMm: number = 0,
  seamAllowanceMm: number = 5
): PanelResult {
  if (finishedWidthMm <= 0 || finishedHeightMm <= 0) {
    throw new Error("finishedWidthMm and finishedHeightMm must be > 0");
  }
  if (seamAllowanceMm < 0) {
    throw new Error("seamAllowanceMm must be >= 0");
  }
  if (cornerRadiusMm < 0) {
    throw new Error("cornerRadiusMm must be >= 0");
  }

  const warnings: string[] = [];

  const maxFinishedRadius = Math.min(finishedWidthMm, finishedHeightMm) / 2;
  let finishedRadius = cornerRadiusMm;
  if (finishedRadius > maxFinishedRadius) {
    warnings.push(
      `corner_radius_mm clamped from ${cornerRadiusMm} to ${round2(maxFinishedRadius)} ` +
        `(can't exceed half the shorter side)`
    );
    finishedRadius = maxFinishedRadius;
  }

  const cutWidth = finishedWidthMm + 2 * seamAllowanceMm;
  const cutHeight = finishedHeightMm + 2 * seamAllowanceMm;
  const maxCutRadius = Math.min(cutWidth, cutHeight) / 2;
  const cutRadius = Math.min(finishedRadius + seamAllowanceMm, maxCutRadius);

  const stitchPath = roundedRectPath(
    seamAllowanceMm,
    seamAllowanceMm,
    finishedWidthMm,
    finishedHeightMm,
    finishedRadius
  );
  const cutPath = roundedRectPath(0, 0, cutWidth, cutHeight, cutRadius);

  return {
    finishedWidthMm,
    finishedHeightMm,
    finishedCornerRadiusMm: round2(finishedRadius),
    seamAllowanceMm,
    cutWidthMm: round2(cutWidth),
    cutHeightMm: round2(cutHeight),
    cutCornerRadiusMm: round2(cutRadius),
    finishedAreaCm2: roundedRectAreaCm2(finishedWidthMm, finishedHeightMm, finishedRadius),
    finishedPerimeterCm: roundedRectPerimeterCm(finishedWidthMm, finishedHeightMm, finishedRadius),
    cutAreaCm2: roundedRectAreaCm2(cutWidth, cutHeight, cutRadius),
    cutPerimeterCm: roundedRectPerimeterCm(cutWidth, cutHeight, cutRadius),
    stitchGuidePath: stitchPath,
    cutOutlinePath: cutPath,
    viewboxWidthMm: round2(cutWidth),
    viewboxHeightMm: round2(cutHeight),
    warnings,
  };
}
