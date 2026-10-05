# Architecture notes

This document exists for two overlapping reasons: it's the real design
log for this project, and it's organised around the specific questions
Canonical's written interview asks about web engineering and software
engineering experience, so I can point at concrete decisions instead of
answering those questions in the abstract.

## System shape, and why it's several small services instead of one app

```
apps/web (React+TS) --REST--> apps/api (FastAPI) --enqueue--> apps/worker (RQ)
                                    |                                |
                                    v                                v
                              Postgres/SQLite                  exports/*.svg,*.pdf
apps/mobile_flutter (Flutter) --REST------------------------------^
```

`apps/api` and `apps/worker` are separate processes (separate containers,
in `docker-compose.yml`) that share no code of their own — both depend
on `packages/core_py`, a small shared domain package with the geometry
engine, the ORM models, and the one background job (`export_job`).
Neither imports the other directly. The API never generates a PDF on the
request thread; it writes a row and enqueues a job, and returns. The
worker never serves HTTP; it drains a Redis queue and writes files plus
a status column.

Why split it at all, for a project this small? Because the two things
genuinely have different failure modes and different scaling needs: the
API needs to answer in milliseconds and scale with request volume;
export rendering is CPU/I-O bound and benefits from running more workers
independently of request traffic (`docker compose up --scale worker=2`
adds throughput without touching the API). Keeping them separate from
day one, even at toy scale, means the boundary is never load-bearing on
"this used to be fine because it was all in-process."

**What I'd change before this served real traffic:** right now the API
and worker share one database schema directly (`core_py.models`), not
just a queue. That's an honest simplification for a two-person-sized
system — at real scale, or with multiple teams owning each service, I'd
tighten that to "the worker only ever touches the DB through the API,"
either by having the worker call back into the API over HTTP to report
results, or by splitting into genuinely separate databases with events
as the only integration point. I'd rather state that trade-off than hide
it.

## The duplicated geometry engine, and how it's kept honest

`packages/core_py/core_py/geometry.py` (Python) and
`apps/web/src/geometry/panel.ts` (TypeScript) implement the exact same
formulas twice, once per language. This is deliberate duplication, not
an oversight: the web app needs to redraw the pattern instantly on every
slider tick, and a network round trip on every tick would feel laggy;
but the server value is what's actually stored, exported, and (in a
real version of this product) billed, so it has to be recomputed
independently rather than trusted from the client.

Duplicated logic drifting apart silently is a real risk, so
`fixtures/panel-cases.json` is a small, shared, language-agnostic
contract: a list of input/expected-output pairs. `apps/api/tests/
test_geometry_fixture.py` and `apps/web/src/geometry/panel.test.ts` each
load the same file and assert their own implementation against it,
independently. Neither test calls into the other language. If someone
changes the rounding rule in one implementation and forgets the other,
CI fails on whichever one drifted — see `.github/workflows/ci.yml`,
where the API, UI kit, web, and (when a Flutter SDK is available)
mobile-companion test suites all run on every push.

## Reliability: the async export path

`apps/api/app/events.py` wraps the only call a route handler is allowed
to make to kick off export rendering. If Redis is reachable, the job
goes on a queue and the request returns immediately — the designed
path. If Redis is unreachable (e.g. someone runs `apps/api` alone for a
quick local demo, without `docker compose`), it falls back to running
the job inline rather than failing the request. That fallback is logged
loudly specifically so it's never mistaken for the real async path. At
real production traffic, a failed Redis connection should alert someone,
not silently degrade every request's latency — this fallback is a
development-experience choice, not a reliability feature, and the
comment in `events.py` says so.

`core_py.jobs.export_job` is written to be safely re-run: it always
recomputes geometry from the stored parameters and overwrites whatever a
previous, possibly-crashed attempt left on disk, and it catches its own
exceptions to mark the pattern `failed` rather than let a bad render take
the whole worker process down.

## Maintainability

A few choices that are specifically about keeping this changeable later,
not about making it work today:

- **Pydantic schemas are separate from SQLAlchemy models**
  (`apps/api/app/schemas.py` vs. `core_py/models.py`). The public API
  contract and the storage shape are allowed to diverge — e.g. storage
  could denormalise something for a query, or the API could hide an
  internal column — without that becoming a breaking API change.
- **The UI kit (`packages/ui`) centralises design tokens** (colours,
  spacing, the focus ring) in one CSS file. Changing a brand colour is a
  one-line change, not a grep-and-replace across every screen — this is
  the same reasoning behind Canonical's own Vanilla Framework existing
  as a shared layer instead of every product re-deriving its own styles.
- **Native controls over custom ARIA widgets, by default.** The slider
  is a real `<input type="range">`, the colour picker is real
  `<input type="radio">` elements visually styled as swatches, not
  `role="slider"` or `role="radio"` divs with hand-written keyboard
  handlers. Every one of those native elements already has correct
  keyboard support and screen-reader semantics; re-implementing that by
  hand is a common source of subtly broken accessibility, and it's more
  code to maintain for a worse result.

## Performance

For a project at this scale, the performance decisions that matter are
less about micro-optimisation and more about not doing unnecessary work
in the first place:

- Geometry is O(1) arithmetic — generating a pattern preview is bounded
  by React's render, not by computation, so the slider stays responsive
  at 60fps without memoisation tricks (though `App.tsx` does memoise the
  panel computation with `useMemo` so a slider drag doesn't recompute on
  every unrelated re-render).
- The pattern is rendered as actual SVG, not a rasterised image, so it
  stays crisp at any zoom and the browser never has to re-request a
  higher-resolution bitmap.
- The slow part of the system (rendering a print-quality PDF) is
  explicitly moved off the request path and onto a worker that can be
  scaled independently — see "Reliability" above. That's the real lever
  for keeping the product fast under load: not making the slow thing
  faster, but making sure it never blocks something that needs to be
  fast.
- At real scale, the next performance work I'd do is adding database
  indexes once query patterns are known (none are needed yet — the
  tables are tiny) and adding HTTP caching headers to the SVG/PDF export
  endpoints, which never change once `export_status` is `ready`.

## Quality practices used in this repo

- **A real test suite per service**, not just happy-path smoke tests:
  input validation (negative dimensions, blank names), 404s, the async
  fallback path, and a dedicated accessibility test (`jest-axe`) per
  interactive UI component — 23 Python tests, 21 TypeScript/React tests
  (15 in the UI kit, 6 in the web app), plus Flutter widget tests for
  the companion app.
- **The cross-language fixture** (above) is a lightweight form of
  contract testing between two independently-maintained implementations
  of the same business logic.
- **CI runs every suite on every push** (`.github/workflows/ci.yml`),
  including a dedicated accessibility check job — accessibility bugs are
  caught the same way any other regression is, automatically, not left
  to manual review.
- **Honesty about scope.** The `README.md` "Status" section says
  plainly what this MVP does and doesn't cover (panel shapes beyond
  rounded rectangles; a deeper Flutter app; auth) instead of implying a
  bigger surface than what's actually built and tested. I'd rather ship
  a smaller thing that's fully true than a bigger one with gaps I'm
  hoping nobody asks about.

## Open source framing

This started as a closed, internal tool for my own leather-goods
business (My Star Georgia) and is published here under the MIT license
specifically because the underlying problem — turning a few numbers into
an accurate cutting pattern — is useful to other small makers, and
because Canonical's own engineering culture (Vanilla Framework,
react-components) treats building reusable, accessible open tooling as
part of the job, not a side project. `CONTRIBUTING.md` sets out the
ground rules I'd want from a contributor: tests travel with code,
accessibility is not optional for new interactive components, and PRs
stay small.
