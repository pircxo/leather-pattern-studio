import { Button } from "@lps/ui";
import type * as api from "../api/client";
import { Mark, Status, Pagination, PatternDownloads } from "./StudioControls";
interface Props {
  patterns: api.PatternOut[];
  patternTotal: number;
  loading: boolean;
  loadError: string | null;
  query: string;
  search: string;
  offset: number;
  busy: boolean;
  deleteId: number | null;
  setSearch: (value: string) => void;
  refresh: () => void;
  openPattern: (pattern: api.PatternOut) => void;
  setDeleteId: (id: number | null) => void;
  setOffset: (offset: number) => void;
  onCreate: () => void;
  onDelete: (pattern: api.PatternOut) => void;
  onOrder: (pattern: api.PatternOut) => void;
  onRetry: (pattern: api.PatternOut) => void;
}
export function PatternLibrary({
  patterns,
  patternTotal,
  loading,
  loadError,
  query,
  search,
  offset,
  busy,
  deleteId,
  setSearch,
  refresh,
  openPattern,
  setDeleteId,
  setOffset,
  onCreate,
  onDelete,
  onOrder,
  onRetry,
}: Props) {
  return (
    <section aria-labelledby="library-heading">
      <div className="lps-library-toolbar">
        <h3 id="library-heading">
          Saved patterns <span className="lps-count">{patternTotal}</span>
        </h3>
        <div>
          <label className="lps-search">
            <span className="sr-only">Search patterns</span>
            <input
              type="search"
              placeholder="Find a pattern…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <Button variant="secondary" onClick={refresh} disabled={loading}>
            Refresh
          </Button>
        </div>
      </div>
      {loadError ? (
        <div className="lps-empty" role="alert">
          <h3>The library couldn’t load.</h3>
          <p>{loadError}</p>
          <Button variant="secondary" onClick={refresh}>
            Try again
          </Button>
        </div>
      ) : loading && !patterns.length ? (
        <p role="status">Loading your patterns…</p>
      ) : !patterns.length ? (
        <div className="lps-empty">
          <Mark />
          <h3>
            {query ? "No matching patterns" : "Your first pattern starts here."}
          </h3>
          <p>
            {query
              ? "Try a different name or clear your search."
              : "No patterns saved yet. Create a panel and build your collection."}
          </p>
          <Button onClick={() => (query ? setSearch("") : onCreate())}>
            {query ? "Clear search" : "Create a pattern"}
          </Button>
        </div>
      ) : (
        <div className="lps-pattern-grid">
          {patterns.map((p) => (
            <article key={p.id} className="lps-pattern-card">
              <div className="lps-card-preview">
                <svg
                  role="img"
                  aria-label={`${p.name}, ${p.finished_width_mm} by ${p.finished_height_mm} millimeters`}
                  viewBox={`-10 -10 ${p.cut_width_mm + 20} ${p.cut_height_mm + 20}`}
                >
                  <path
                    d={p.cut_outline_path}
                    fill="#c7a383"
                    fillOpacity=".38"
                    stroke="#6e4932"
                    strokeWidth=".8"
                  />
                  <path
                    d={p.stitch_guide_path}
                    fill="none"
                    stroke="#6e4932"
                    strokeWidth=".6"
                    strokeDasharray="2 2"
                  />
                </svg>
                <span className="lps-card-id">
                  #{String(p.id).padStart(3, "0")}
                </span>
              </div>
              <div className="lps-card-body">
                <Status value={p.export_status} />
                <h4>{p.name}</h4>
                <p>
                  {p.finished_width_mm} × {p.finished_height_mm} mm ·{" "}
                  {p.material}
                </p>
                {p.export_status === "failed" && (
                  <p className="lps-error">
                    The export could not be generated. Retry to create the
                    files.
                  </p>
                )}
                <div className="lps-card-actions">
                  <Button variant="secondary" onClick={() => openPattern(p)}>
                    Open
                  </Button>
                  <PatternDownloads pattern={p} />
                  <button
                    className="lps-text-button"
                    disabled={
                      busy ||
                      ["pending", "processing"].includes(p.export_status)
                    }
                    aria-label={`Delete ${p.name}`}
                    onClick={() => setDeleteId(p.id)}
                  >
                    Delete
                  </button>
                </div>
                {deleteId === p.id && (
                  <div className="lps-delete-confirm">
                    <p>Delete “{p.name}” and its exports?</p>
                    <Button
                      variant="danger"
                      disabled={busy}
                      onClick={() => onDelete(p)}
                    >
                      Confirm delete
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => setDeleteId(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
                <div className="lps-card-bottom">
                  <button disabled={busy} onClick={() => onOrder(p)}>
                    Create production order →
                  </button>
                  {p.export_status === "failed" && (
                    <button disabled={busy} onClick={() => onRetry(p)}>
                      Retry export
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      <Pagination offset={offset} total={patternTotal} onChange={setOffset} />
    </section>
  );
}
