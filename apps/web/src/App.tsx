import { useEffect, useMemo, useState } from "react";
import { Button, ColorSwatchGroup, Slider, TextField } from "@lps/ui";
import { generatePanel } from "./geometry/panel";
import { PatternCanvas } from "./components/PatternCanvas";
import {
  ApiError,
  createPattern,
  listPatterns,
  patternPdfUrl,
  patternSvgUrl,
  type PatternOut,
} from "./api/client";
import "./App.css";

const COLOR_OPTIONS = [
  { value: "chestnut", label: "Chestnut", hex: "#7a3b1e" },
  { value: "black", label: "Black", hex: "#1a1a1a" },
  { value: "burgundy", label: "Burgundy", hex: "#5c1f2e" },
  { value: "tan", label: "Natural tan", hex: "#c99a5b" },
];

export function App() {
  const [name, setName] = useState("Crossbody strap");
  const [width, setWidth] = useState(250);
  const [height, setHeight] = useState(25);
  const [cornerRadius, setCornerRadius] = useState(3);
  const [seamAllowance, setSeamAllowance] = useState(5);
  const [color, setColor] = useState("chestnut");

  const [patterns, setPatterns] = useState<PatternOut[]>([]);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<
    { tone: "success" | "error"; text: string } | null
  >(null);

  const colorHex = COLOR_OPTIONS.find((c) => c.value === color)?.hex ?? "#7a3b1e";

  const panel = useMemo(() => {
    try {
      return {
        result: generatePanel(width, height, cornerRadius, seamAllowance),
        error: null as string | null,
      };
    } catch (err) {
      return { result: null, error: err instanceof Error ? err.message : "Invalid dimensions" };
    }
  }, [width, height, cornerRadius, seamAllowance]);

  async function refreshPatterns() {
    try {
      const { items } = await listPatterns();
      setPatterns(items);
    } catch {
      // Listing is best-effort on load; the save flow below surfaces
      // real errors to the user, so a silent failure here is acceptable.
    }
  }

  useEffect(() => {
    refreshPatterns();
  }, []);

  async function handleSave() {
    setSaving(true);
    setStatusMessage(null);
    try {
      const created = await createPattern({
        name,
        finished_width_mm: width,
        finished_height_mm: height,
        corner_radius_mm: cornerRadius,
        seam_allowance_mm: seamAllowance,
      });
      setStatusMessage({ tone: "success", text: `Saved "${created.name}" (#${created.id}).` });
      await refreshPatterns();
    } catch (err) {
      const text = err instanceof ApiError ? err.message : "Could not reach the API — is it running?";
      setStatusMessage({ tone: "error", text });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="lps-app">
      <a className="lps-skip-link" href="#lps-main">
        Skip to pattern editor
      </a>

      <header className="lps-app__header">
        <h1>Leather Pattern Studio</h1>
        <p>
          Describe a panel in millimetres and get back an accurate cutting pattern — the same
          geometry engine that runs on the server, running here too for instant feedback while
          you drag a slider.
        </p>
      </header>

      <main id="lps-main" className="lps-layout">
        <section className="lps-panel" aria-labelledby="lps-form-heading">
          <h2 id="lps-form-heading">Panel parameters</h2>

          <TextField label="Pattern name" value={name} onChange={setName} maxLength={120} />

          <Slider
            label="Finished width"
            value={width}
            onChange={setWidth}
            min={10}
            max={500}
            unit="mm"
          />
          <Slider
            label="Finished height"
            value={height}
            onChange={setHeight}
            min={10}
            max={500}
            unit="mm"
          />
          <Slider
            label="Corner radius"
            value={cornerRadius}
            onChange={setCornerRadius}
            min={0}
            max={Math.floor(Math.min(width, height) / 2)}
            unit="mm"
            hint="Clamped automatically if it exceeds half the shorter side."
          />
          <Slider
            label="Seam allowance"
            value={seamAllowance}
            onChange={setSeamAllowance}
            min={0}
            max={20}
            unit="mm"
            hint="Typical range for veg-tan leather: 4–6mm."
          />

          <ColorSwatchGroup
            legend="Leather colour (preview only)"
            options={COLOR_OPTIONS}
            value={color}
            onChange={setColor}
          />

          <Button onClick={handleSave} busy={saving} disabled={!panel.result}>
            {saving ? "Saving…" : "Save pattern"}
          </Button>

          {statusMessage && (
            <p className="lps-status-message" data-tone={statusMessage.tone} role="status">
              {statusMessage.text}
            </p>
          )}
        </section>

        <section className="lps-preview-stack" aria-labelledby="lps-preview-heading">
          <div className="lps-panel" style={{ width: "100%" }}>
            <h2 id="lps-preview-heading">Live preview</h2>
            {panel.result ? (
              <PatternCanvas panel={panel.result} fillHex={colorHex} label={name || "Pattern"} />
            ) : (
              <p className="lps-status-message" data-tone="error" role="alert">
                {panel.error}
              </p>
            )}
          </div>

          <div className="lps-panel" style={{ width: "100%" }}>
            <h2>Saved patterns</h2>
            {patterns.length === 0 ? (
              <p className="lps-status-message">
                No patterns saved yet — fill in the form and click "Save pattern".
              </p>
            ) : (
              <ul className="lps-pattern-list">
                {patterns.map((p) => (
                  <li key={p.id}>
                    <span>
                      #{p.id} {p.name} — {p.finished_width_mm}&times;{p.finished_height_mm}mm
                    </span>
                    <span className="lps-pattern-list__links">
                      <span className="lps-badge" data-status={p.export_status}>
                        {p.export_status}
                      </span>
                      {p.export_status === "ready" && (
                        <>
                          <a href={patternSvgUrl(p.id)} target="_blank" rel="noreferrer">
                            SVG
                          </a>
                          <a href={patternPdfUrl(p.id)} target="_blank" rel="noreferrer">
                            PDF
                          </a>
                        </>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Button variant="secondary" onClick={refreshPatterns} style={{ marginTop: 12 }}>
              Refresh
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}
