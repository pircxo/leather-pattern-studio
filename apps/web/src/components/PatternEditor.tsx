import type { Dispatch, SetStateAction } from "react";
import { Button, ColorSwatchGroup, NumberField, TextField } from "@lps/ui";
import type * as api from "../api/client";
import type { PanelResult } from "../geometry/panel";
import { COLORS, PRESETS, type Draft } from "../studio";
import { PatternCanvas } from "./PatternCanvas";
import { Status, PatternDownloads } from "./StudioControls";
interface Props {
  draft: Draft;
  panel: { result: PanelResult | null; error: string | null };
  busy: boolean;
  lastSaved: api.PatternOut | null;
  zoom: number;
  showGuides: boolean;
  validName: boolean;
  patch: (values: Partial<Draft>) => void;
  setZoom: Dispatch<SetStateAction<number>>;
  setShowGuides: (value: boolean) => void;
  save: () => void;
  onRetry: () => void;
}
export function PatternEditor({
  draft,
  panel,
  busy,
  lastSaved,
  zoom,
  showGuides,
  validName,
  patch,
  setZoom,
  setShowGuides,
  save,
  onRetry,
}: Props) {
  return (
    <>
      <div className="lps-presets">
        <span className="lps-eyebrow">START WITH A SHAPE</span>
        {PRESETS.map((p) => (
          <button
            key={p.kind}
            onClick={() => {
              patch({
                name: p.name,
                width: p.w,
                height: p.h,
                radius: p.r,
                seam: p.s,
              });
              setZoom(1);
            }}
            title={p.note}
          >
            <svg aria-hidden="true" width="34" height="30" viewBox="0 0 34 30">
              <rect
                x={p.kind === "Strap" ? 2 : 7}
                y={p.kind === "Strap" ? 11 : 4}
                width={p.kind === "Strap" ? 30 : 20}
                height={p.kind === "Strap" ? 8 : 22}
                rx="3"
                fill="none"
                stroke="currentColor"
              />
              <rect
                x={p.kind === "Strap" ? 5 : 10}
                y={p.kind === "Strap" ? 13 : 7}
                width={p.kind === "Strap" ? 24 : 14}
                height={p.kind === "Strap" ? 4 : 16}
                rx="2"
                fill="none"
                stroke="currentColor"
                strokeDasharray="2 2"
              />
            </svg>
            {p.kind}
          </button>
        ))}
      </div>
      <div className="lps-editor-layout">
        <section
          className="lps-panel lps-parameters"
          aria-labelledby="parameters-heading"
        >
          <div className="lps-section-title">
            <h3 id="parameters-heading">Panel details</h3>
            <span>01 — CONFIGURE</span>
          </div>
          <TextField
            label="Pattern name"
            value={draft.name}
            onChange={(name) => patch({ name })}
            maxLength={120}
            error={!draft.name.trim() ? "Give your pattern a name." : undefined}
          />
          <TextField
            label="Material"
            value={draft.material}
            onChange={(material) => patch({ material })}
            maxLength={80}
            error={!draft.material.trim() ? "Enter a material." : undefined}
          />
          <div className="lps-divider" />
          <div className="lps-dimension-grid">
            <NumberField
              label="Finished width"
              value={draft.width}
              onChange={(width) => patch({ width })}
              min={0.1}
              max={2000}
              step={0.1}
              unit="mm"
            />
            <NumberField
              label="Finished height"
              value={draft.height}
              onChange={(height) => patch({ height })}
              min={0.1}
              max={2000}
              step={0.1}
              unit="mm"
            />
          </div>
          <NumberField
            label="Corner radius"
            value={draft.radius}
            onChange={(radius) => patch({ radius })}
            min={0}
            max={1000}
            step={0.1}
            unit="mm"
            hint="Automatically limited to half the shorter side."
          />
          <NumberField
            label="Seam allowance"
            value={draft.seam}
            onChange={(seam) => patch({ seam })}
            min={0}
            max={50}
            step={0.1}
            unit="mm"
            hint="Added around every edge. Usually 4–6 mm."
          />
          <div className="lps-divider" />
          <ColorSwatchGroup
            legend="Leather colour (preview only)"
            options={COLORS}
            value={draft.color}
            onChange={(color) => patch({ color })}
          />
          <Button
            className="lps-save"
            onClick={save}
            busy={busy}
            disabled={!panel.result || !validName}
          >
            {busy
              ? "Saving…"
              : lastSaved
                ? "Save as new pattern"
                : "Save pattern"}
            <span aria-hidden="true">↗</span>
          </Button>
          <p className="lps-small-note">
            Your draft stays here when you return.
          </p>
        </section>
        <section
          className="lps-preview-stack"
          aria-labelledby="preview-heading"
        >
          <div className="lps-panel lps-preview-panel">
            <div className="lps-section-title">
              <h3 id="preview-heading">Live preview</h3>
              <span>02 — REFINE</span>
            </div>
            <div className="lps-canvas-toolbar">
              <label>
                <input
                  type="checkbox"
                  checked={showGuides}
                  onChange={(e) => setShowGuides(e.target.checked)}
                />
                Stitch guide
              </label>
              <div>
                <button
                  aria-label="Zoom out"
                  disabled={zoom <= 0.5}
                  onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                >
                  −
                </button>
                <span>{Math.round(zoom * 100)}%</span>
                <button
                  aria-label="Zoom in"
                  disabled={zoom >= 3}
                  onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
                >
                  +
                </button>
                <button onClick={() => setZoom(1)}>Fit</button>
              </div>
            </div>
            {panel.result ? (
              <PatternCanvas
                panel={panel.result}
                fillHex={
                  COLORS.find((c) => c.value === draft.color)?.hex ??
                  COLORS[0].hex
                }
                label={draft.name || "Untitled pattern"}
                showGuides={showGuides}
                zoom={zoom}
              />
            ) : (
              <div className="lps-invalid" role="alert">
                <h4>Check your dimensions</h4>
                <p>{panel.error}</p>
              </div>
            )}
            <div className="lps-canvas-legend">
              <span>
                <i />
                Cut outline
              </span>
              <span>
                <i className="lps-dashed" />
                Stitch guide
              </span>
              <span>Preview fitted to screen</span>
            </div>
          </div>
          {panel.result && (
            <div className="lps-stats">
              <div>
                <span>CUT SIZE</span>
                <strong>
                  {panel.result.cutWidthMm} × {panel.result.cutHeightMm}
                  <small> mm</small>
                </strong>
              </div>
              <div>
                <span>FINISHED AREA</span>
                <strong>
                  {panel.result.finishedAreaCm2}
                  <small> cm²</small>
                </strong>
              </div>
              <div>
                <span>STITCH LENGTH</span>
                <strong>
                  {panel.result.finishedPerimeterCm}
                  <small> cm</small>
                </strong>
              </div>
            </div>
          )}
          <div className="lps-export-strip">
            <div>
              <p className="lps-eyebrow">03 — TAKE IT TO THE TABLE</p>
              <h3>{lastSaved ? "Your template" : "Ready when you are."}</h3>
              <p>
                Save to generate SVG and tiled A4 PDF templates.
                <br />
                Print at 100% and check the 50 mm calibration line.
              </p>
            </div>
            {lastSaved ? (
              <div>
                <Status value={lastSaved.export_status} />
                <PatternDownloads pattern={lastSaved} />
                {lastSaved.export_status === "failed" && (
                  <Button variant="secondary" disabled={busy} onClick={onRetry}>
                    Retry export
                  </Button>
                )}
              </div>
            ) : (
              <span className="lps-export-icon" aria-hidden="true">
                ↧
              </span>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
