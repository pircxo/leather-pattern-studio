# Architecture

Leather Pattern Studio separates interactive drafting, authoritative geometry/persistence, and export rendering. The project is designed as a complete workshop workflow with a low-friction local demo and a separate service stack.

```text
React + TypeScript ── REST ── FastAPI ── RQ queue ── Export worker
       │                       │                       │
       │                       └──── SQLAlchemy ───────┘
       │                          PostgreSQL / SQLite
       │                                               │
       └── Live SVG preview                    SVG + tiled PDF files

Flutter companion ── same REST API ── saved pattern + SVG
```

## Boundaries

`apps/web` owns interaction and client state. `packages/ui` supplies labelled native controls, keyboard behavior, focus styles and accessible colour swatches. The web app imports the UI source through a Vite alias; React is explicitly deduplicated so there is one runtime even with two package installations.

`apps/api` owns request validation, geometry recomputation, patterns and production-order transitions. Pydantic schemas define the external contract separately from the SQLAlchemy storage models. Unknown fields and nonfinite dimensions are rejected. HTTP and validation errors share one machine-readable envelope.

`packages/core_py` is the only shared Python domain package. It contains the geometry engine, ORM models, session management and export job. `apps/worker` imports this package, not the FastAPI application. Multiple workers can consume the same queue independently.

`apps/mobile_flutter` is a read-only companion. It loads a saved pattern by ID and displays its export. It has a web entry point and can acquire native platform wrappers with Flutter's project-generation command. It does not duplicate the editor or production board.

## Instant preview and authoritative geometry

Python and TypeScript implement the same rounded-rectangle formulas. The client can update immediately without network requests; the API independently recomputes every value before storage. Client-generated SVG paths are never accepted as authoritative input.

`fixtures/panel-cases.json` is a shared language-independent contract, consumed by both geometry test suites. It exercises cut dimensions, radius clamping, rounded areas and perimeters. Separate tests reject invalid and nonfinite inputs.

This duplication is a deliberate maintenance cost. The fixture checks the agreed numerical outputs; it does not claim to prove every possible floating-point input identical across languages. The editor uses millimetre inputs with 0.1 mm steps, and displayed dimensions and summary metrics are rounded to two decimal places.

## Saved patterns and production history

Saved patterns are immutable. Reopening copies their parameters into the editor; saving creates a new record. Orders continue referencing the original pattern, so changing a draft cannot silently change a production job.

Patterns with orders cannot be deleted. Patterns still exporting cannot be deleted either. Completed unreferenced patterns can be removed, with an explicit confirmation in the UI; their export files are then removed. This is a focused alternative to implementing revision tables and audit logs for a small workshop.

Order status transitions are enforced by the API: received → in production → shipped. Moving to the current status is idempotent; backwards and skipped transitions fail. Production requires ready cutting exports.

## Export lifecycle and recovery

The API persists a pattern as pending, then dispatches `core_py.jobs.export_job`. The job commits processing status before rendering, recomputes geometry from saved inputs, writes SVG/PDF files to temporary files, atomically replaces the final paths, and commits ready status. Rendering failures leave a failed status and an error, which the UI can retry.

Three dispatch modes support different environments:

- `inline`: local demos and deterministic tests; no Redis needed.
- `queued`: Compose; queue outages mark the saved pattern failed for a later retry.
- `auto`: API default; try Redis and fall back to inline if unavailable.

The frontend polls while its visible patterns or latest saved pattern are pending/processing. Requests are cancelled when their query or page changes; stale responses do not overwrite a newer library result. If the forked process running a job dies, the worker marks the pattern failed so it can be retried. A worker stopped after accepting a job leaves it pending until workers resume; recovering lost queues remains an operations concern, not a guarantee of this implementation.

## Printable templates

SVG exports have physical millimetre dimensions, escaped labels, a cut outline, dashed stitch guide and a calibration line. PDF exports are tiled at actual scale onto A4. Each sheet has a 190 × 250 mm drawing frame; adjacent tiles overlap by 10 mm. A 2 mm padding around the complete pattern prevents clipping strokes on the outer edge.

Each page identifies its row and column, page number, dimensions, assembly instructions and a 50 mm calibration ruler. Large panels gain pages instead of being shrunk or clipped. Tests check tile counts, A4 page sizes, scale instructions and valid PDF responses. Printer settings still matter: actual size / 100% and a physical ruler check are part of the intended workflow.

## Persistence and serving

The local runner uses an absolute SQLite path and an absolute export directory, and starts/stops both services together. Browser tests use completely separate temporary storage and ports.

Compose uses PostgreSQL and persistent export/database volumes. The web image builds the frontend with Node and serves only built assets with Nginx. `/api` is proxied to FastAPI on the same origin. The worker waits for its database to be available. CORS is explicit and configurable for separate clients.

The database currently creates its schema on startup. There are no schema migrations because this release preserves the original table shapes. A future persisted-schema change should introduce migrations before changing deployed databases.

## Quality and CI

- Pytest: geometry contracts, validation/errors, persistence, export jobs, tiled PDF output, pagination, literal search, deletion guards and order transitions.
- Vitest + Testing Library: native controls, axe accessibility checks, preview/presets, error states, saving/reopening, draft recovery and deletion confirmation.
- Playwright: real create/download/reopen/order/ship workflows at desktop and phone sizes; keyboard entry, validation, layout overflow and WCAG checks.
- Flutter: widget tests, API handling, static analysis and a web build.
- Docker smoke test: build the stack, create a pattern through the Nginx proxy, wait for the separate worker and download both exports.
- TypeScript production build, Prettier checks and Ruff checks.

## Deliberate limits

This is a shared/local workshop app, not a multi-tenant SaaS product. It has no accounts, payment processing or shipping integration. Rectangular-family panels are supported; complete multi-piece products and irregular shapes are outside this release. Offset pagination is sufficient here; cursor pagination and indexes would be justified by a larger dataset. The API and worker share a database schema and export volume, trading deployment simplicity for tighter coupling.
