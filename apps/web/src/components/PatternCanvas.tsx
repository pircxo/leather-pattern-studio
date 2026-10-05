import type { PanelResult } from "../geometry/panel";
import "./PatternCanvas.css";
export interface PatternCanvasProps {
  panel: PanelResult;
  fillHex: string;
  label: string;
  showGuides?: boolean;
  zoom?: number;
}
export function PatternCanvas({
  panel,
  fillHex,
  label,
  showGuides = true,
  zoom = 1,
}: PatternCanvasProps) {
  const pad = Math.max(
    15,
    Math.min(panel.cutWidthMm, panel.cutHeightMm) * 0.15,
  );
  const w = panel.viewboxWidthMm + pad * 2;
  const h = panel.viewboxHeightMm + pad * 2;
  const summary = `${label}: finished size ${panel.finishedWidthMm} by ${panel.finishedHeightMm} millimeters, cut size ${panel.cutWidthMm} by ${panel.cutHeightMm} millimeters with ${panel.seamAllowanceMm} millimeter seam allowance.`;
  return (
    <figure className="lps-canvas">
      <div className="lps-canvas__viewport">
        <div
          className="lps-canvas__sheet"
          style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%` }}
        >
          <span className="lps-canvas__coordinate" aria-hidden="true">
            0,0 · mm
          </span>
          <svg
            role="img"
            aria-label={summary}
            viewBox={`0 0 ${w} ${h}`}
            className="lps-canvas__svg"
          >
            <g transform={`translate(${pad}, ${pad})`}>
              <path
                d={panel.cutOutlinePath}
                className="lps-canvas__cut"
                fill={fillHex}
              />
              {showGuides && (
                <path
                  d={panel.stitchGuidePath}
                  className="lps-canvas__stitch"
                  fill="none"
                />
              )}
            </g>
          </svg>
        </div>
      </div>
      <figcaption className="lps-canvas__caption">
        {panel.finishedWidthMm}×{panel.finishedHeightMm}mm finished · cut{" "}
        {panel.cutWidthMm}×{panel.cutHeightMm}mm · {panel.finishedAreaCm2}cm²
      </figcaption>
      {panel.warnings.map((w) => (
        <p role="status" className="lps-canvas__warning" key={w}>
          {w}
        </p>
      ))}
    </figure>
  );
}
