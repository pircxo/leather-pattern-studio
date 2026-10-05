import type { PanelResult } from "../geometry/panel";
import "./PatternCanvas.css";

export interface PatternCanvasProps {
  panel: PanelResult;
  fillHex: string;
  label: string;
}

/**
 * Renders the live pattern preview as actual SVG — not a raster image —
 * so it stays crisp at any zoom level and the exact path data the user
 * sees is the same path data (modulo re-computation) the server will
 * store and export. `role="img"` plus an `aria-label` give screen-reader
 * users a textual summary instead of silence, since the visual detail
 * itself isn't meaningfully describable.
 */
export function PatternCanvas({ panel, fillHex, label }: PatternCanvasProps) {
  const pad = 10;
  const w = panel.viewboxWidthMm + pad * 2;
  const h = panel.viewboxHeightMm + pad * 2;

  const summary =
    `${label}: finished size ${panel.finishedWidthMm} by ${panel.finishedHeightMm} millimeters, ` +
    `cut size ${panel.cutWidthMm} by ${panel.cutHeightMm} millimeters with ` +
    `${panel.seamAllowanceMm} millimeter seam allowance.`;

  return (
    <figure className="lps-canvas">
      <svg
        role="img"
        aria-label={summary}
        viewBox={`0 0 ${w} ${h}`}
        className="lps-canvas__svg"
      >
        <g transform={`translate(${pad}, ${pad})`}>
          <path d={panel.cutOutlinePath} className="lps-canvas__cut" fill={fillHex} />
          <path d={panel.stitchGuidePath} className="lps-canvas__stitch" fill="none" />
        </g>
      </svg>
      <figcaption className="lps-canvas__caption">
        {panel.finishedWidthMm}&times;{panel.finishedHeightMm}mm finished &middot; cut{" "}
        {panel.cutWidthMm}&times;{panel.cutHeightMm}mm &middot; {panel.finishedAreaCm2}cm&sup2;
      </figcaption>
      {panel.warnings.map((w) => (
        <p role="status" className="lps-canvas__warning" key={w}>
          {w}
        </p>
      ))}
    </figure>
  );
}
