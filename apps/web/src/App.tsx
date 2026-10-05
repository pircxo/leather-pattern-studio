import { useEffect, useMemo, useState } from "react";
import { Button, NumberField, TextField } from "@lps/ui";
import { generatePanel } from "./geometry/panel";
import { DRAFT_KEY, initialDraft, type Draft } from "./studio";
import { Mark, Status, Pagination } from "./components/StudioControls";
import { PatternEditor } from "./components/PatternEditor";
import { PatternLibrary } from "./components/PatternLibrary";
import * as api from "./api/client";
import "./App.css";

function errorText(error: unknown) {
  return error instanceof api.ApiError
    ? error.message
    : "Could not connect to the studio API. Check the server and try again.";
}
export function App() {
  const [tab, setTab] = useState<"editor" | "library" | "orders">("editor");
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [patterns, setPatterns] = useState<api.PatternOut[]>([]);
  const [patternTotal, setPatternTotal] = useState(0);
  const [orders, setOrders] = useState<api.OrderOut[]>([]);
  const [orderTotal, setOrderTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [orderOffset, setOrderOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);
  const [lastSaved, setLastSaved] = useState<api.PatternOut | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [orderPattern, setOrderPattern] = useState<api.PatternOut | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [showGuides, setShowGuides] = useState(true);
  const [zoom, setZoom] = useState(1);
  const patch = (values: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...values }));
    setLastSaved(null);
  };
  const panel = useMemo(() => {
    try {
      if (
        draft.width > 2000 ||
        draft.height > 2000 ||
        draft.radius > 1000 ||
        draft.seam > 50
      )
        throw new Error(
          "Use dimensions up to 2,000 mm, a radius up to 1,000 mm, and a seam up to 50 mm.",
        );
      return {
        result: generatePanel(
          draft.width,
          draft.height,
          draft.radius,
          draft.seam,
        ),
        error: null,
      };
    } catch (e) {
      return {
        result: null,
        error: e instanceof Error ? e.message : "Check your dimensions.",
      };
    }
  }, [draft.width, draft.height, draft.radius, draft.seam]);
  const refresh = () => setReload((r) => r + 1);
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      /* Optional draft recovery. */
    }
  }, [draft]);
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search);
      setOffset(0);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    api
      .listPatterns(offset, query, controller.signal)
      .then((page) => {
        if (controller.signal.aborted) return;
        setPatterns(page.items);
        setPatternTotal(page.total);
        setLoadError(null);
        if (page.items.length === 0 && offset > 0)
          setOffset(Math.max(0, offset - 12));
      })
      .catch((e) => {
        if (!controller.signal.aborted) setLoadError(errorText(e));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [offset, query, reload]);
  useEffect(() => {
    const controller = new AbortController();
    api
      .listOrders(orderOffset, controller.signal)
      .then((page) => {
        if (controller.signal.aborted) return;
        setOrders(page.items);
        setOrderTotal(page.total);
        setOrderError(null);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setOrderError(errorText(e));
      });
    return () => controller.abort();
  }, [orderOffset, reload]);
  useEffect(() => {
    const hasPending =
      patterns.some((p) =>
        ["pending", "processing"].includes(p.export_status),
      ) ||
      (lastSaved &&
        ["pending", "processing"].includes(lastSaved.export_status));
    if (!hasPending) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (
        lastSaved &&
        ["pending", "processing"].includes(lastSaved.export_status)
      ) {
        try {
          const updated = await api.getPattern(lastSaved.id);
          if (!cancelled) setLastSaved(updated);
        } catch {
          /* The list refresh reports connection failures. */
        }
      }
      if (!cancelled) refresh();
    }, 2000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [patterns, lastSaved]);
  async function save() {
    if (!panel.result || !draft.name.trim() || !draft.material.trim()) return;
    setBusy(true);
    setMessage(null);
    try {
      const created = await api.createPattern({
        name: draft.name.trim(),
        material: draft.material.trim(),
        finished_width_mm: draft.width,
        finished_height_mm: draft.height,
        corner_radius_mm: draft.radius,
        seam_allowance_mm: draft.seam,
      });
      setLastSaved(created);
      setMessage({
        tone: "success",
        text: `Saved "${created.name}" (#${created.id}).`,
      });
      refresh();
    } catch (e) {
      setMessage({ tone: "error", text: errorText(e) });
    } finally {
      setBusy(false);
    }
  }
  function openPattern(p: api.PatternOut) {
    setDraft({
      name: p.name,
      material: p.material,
      width: p.finished_width_mm,
      height: p.finished_height_mm,
      radius: p.corner_radius_mm,
      seam: p.seam_allowance_mm,
      color: draft.color,
    });
    setLastSaved(p);
    setTab("editor");
    setZoom(1);
    setMessage({
      tone: "success",
      text: `Opened "${p.name}". Save your changes as a new pattern.`,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function act(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      setMessage({ tone: "success", text: success });
      refresh();
      return true;
    } catch (e) {
      setMessage({ tone: "error", text: errorText(e) });
      return false;
    } finally {
      setBusy(false);
    }
  }
  const validName = Boolean(draft.name.trim() && draft.material.trim());
  return (
    <div className="lps-app">
      <a className="lps-skip-link" href="#lps-main">
        Skip to workspace
      </a>
      <header className="lps-topbar">
        <div className="lps-brand">
          <Mark />
          <div>
            <h1>Leather Pattern Studio</h1>
            <span>THE MAKER’S WORKSPACE</span>
          </div>
        </div>
        <span className="lps-topbar-note">Designed for the craft.</span>
      </header>
      <div className="lps-nav-wrap">
        <nav aria-label="Workspace">
          <button
            aria-current={tab === "editor" ? "page" : undefined}
            onClick={() => setTab("editor")}
          >
            Pattern editor
          </button>
          <button
            aria-current={tab === "library" ? "page" : undefined}
            onClick={() => setTab("library")}
          >
            Pattern library <span>{patternTotal}</span>
          </button>
          <button
            aria-current={tab === "orders" ? "page" : undefined}
            onClick={() => setTab("orders")}
          >
            Production orders <span>{orderTotal}</span>
          </button>
        </nav>
        <span className="lps-units">ALL DIMENSIONS IN MM</span>
      </div>
      <main id="lps-main">
        <div className="lps-page-heading">
          <div>
            <p className="lps-eyebrow">
              {tab === "editor"
                ? "FROM IDEA TO CUTTING TABLE"
                : tab === "library"
                  ? "YOUR COLLECTION"
                  : "FROM PATTERN TO PRODUCT"}
            </p>
            <h2>
              {tab === "editor"
                ? "A good pattern is a good beginning."
                : tab === "library"
                  ? "Made once. Ready for the next time."
                  : "Keep the workshop moving."}
            </h2>
            <p>
              {tab === "editor"
                ? "Dial in the details, preview your panel, and export a template at true scale."
                : tab === "library"
                  ? "Reopen a design, download a template, or put it into production."
                  : "Track quantities and workshop notes, from a new order to a finished piece."}
            </p>
          </div>
          <span className="lps-page-number" aria-hidden="true">
            {tab === "editor" ? "01" : tab === "library" ? "02" : "03"}
            <span> / STUDIO</span>
          </span>
        </div>
        {message && (
          <div
            className="lps-notice"
            data-tone={message.tone}
            role={message.tone === "error" ? "alert" : "status"}
          >
            {message.text}
            <button
              onClick={() => setMessage(null)}
              aria-label="Dismiss notification"
            >
              ×
            </button>
          </div>
        )}
        {tab === "editor" && (
          <PatternEditor
            draft={draft}
            panel={panel}
            busy={busy}
            lastSaved={lastSaved}
            zoom={zoom}
            showGuides={showGuides}
            validName={validName}
            patch={patch}
            setZoom={setZoom}
            setShowGuides={setShowGuides}
            save={save}
            onRetry={async () => {
              if (lastSaved)
                await act(
                  async () => setLastSaved(await api.retryExport(lastSaved.id)),
                  "Export retried.",
                );
            }}
          />
        )}
        {tab === "library" && (
          <PatternLibrary
            patterns={patterns}
            patternTotal={patternTotal}
            loading={loading}
            loadError={loadError}
            query={query}
            search={search}
            offset={offset}
            busy={busy}
            deleteId={deleteId}
            setSearch={setSearch}
            refresh={refresh}
            openPattern={openPattern}
            setDeleteId={setDeleteId}
            setOffset={setOffset}
            onCreate={() => setTab("editor")}
            onDelete={async (p) => {
              if (
                await act(() => api.deletePattern(p.id), "Pattern deleted.")
              ) {
                setDeleteId(null);
                if (lastSaved?.id === p.id) setLastSaved(null);
              }
            }}
            onOrder={(p) => {
              setOrderPattern(p);
              setQuantity(1);
              setNote("");
              setTab("orders");
            }}
            onRetry={(p) => {
              void act(() => api.retryExport(p.id), "Export retried.");
            }}
          />
        )}
        {tab === "orders" && (
          <section aria-labelledby="orders-heading">
            <div className="lps-library-toolbar">
              <h3 id="orders-heading">
                Production orders{" "}
                <span className="lps-count">{orderTotal}</span>
              </h3>
              <Button variant="secondary" onClick={refresh}>
                Refresh
              </Button>
            </div>
            {orderPattern && (
              <form
                className="lps-panel lps-order-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (
                    await act(
                      () =>
                        api.createOrder(
                          orderPattern.id,
                          quantity,
                          note.trim() || undefined,
                        ),
                      `Production order created for "${orderPattern.name}".`,
                    )
                  )
                    setOrderPattern(null);
                }}
              >
                <div>
                  <p className="lps-eyebrow">
                    NEW ORDER · PATTERN #{orderPattern.id}
                  </p>
                  <h3>{orderPattern.name}</h3>
                </div>
                <NumberField
                  label="Quantity"
                  value={quantity}
                  onChange={setQuantity}
                  min={1}
                  max={10000}
                  step={1}
                />
                <TextField
                  label="Workshop note"
                  value={note}
                  onChange={setNote}
                  maxLength={500}
                />
                <div className="lps-order-buttons">
                  <Button
                    type="submit"
                    busy={busy}
                    disabled={
                      !Number.isInteger(quantity) ||
                      quantity < 1 ||
                      quantity > 10000
                    }
                  >
                    Create order
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setOrderPattern(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            )}
            {orderError ? (
              <div className="lps-empty" role="alert">
                <h3>Orders couldn’t load.</h3>
                <p>{orderError}</p>
                <Button onClick={refresh}>Try again</Button>
              </div>
            ) : !orders.length ? (
              <div className="lps-empty">
                <h3>Room for your next piece.</h3>
                <p>Create an order from a saved pattern in your library.</p>
                <Button onClick={() => setTab("library")}>
                  Choose a pattern
                </Button>
              </div>
            ) : (
              <div className="lps-orders">
                {orders.map((o) => (
                  <article className="lps-order-row" key={o.id}>
                    <div>
                      <span className="lps-eyebrow">
                        ORDER #{String(o.id).padStart(3, "0")}
                      </span>
                      <h4>
                        {o.pattern_name || `Pattern #${o.pattern_id}`}{" "}
                        <span>
                          × {o.quantity} {o.quantity === 1 ? "piece" : "pieces"}
                        </span>
                      </h4>
                      <p>{o.customer_note || "No workshop notes."}</p>
                    </div>
                    <div>
                      <Status value={o.status} />
                      {o.status !== "shipped" && (
                        <Button
                          variant="secondary"
                          disabled={busy}
                          onClick={() =>
                            act(
                              () =>
                                api.updateOrder(
                                  o.id,
                                  o.status === "received"
                                    ? "in_production"
                                    : "shipped",
                                ),
                              `Order #${o.id} updated.`,
                            )
                          }
                        >
                          {o.status === "received"
                            ? "Start production"
                            : "Mark shipped"}
                        </Button>
                      )}
                      <a
                        href={api.patternPdfUrl(o.pattern_id)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Cutting template ↗
                      </a>
                    </div>
                  </article>
                ))}
              </div>
            )}
            <Pagination
              offset={orderOffset}
              total={orderTotal}
              onChange={setOrderOffset}
            />
          </section>
        )}
      </main>
      <footer className="lps-footer">
        <span>
          <strong>Leather Pattern Studio</strong> · A tool for thoughtful
          making.
        </span>
        <span>Millimetres matter. Details do too.</span>
      </footer>
    </div>
  );
}
