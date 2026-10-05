# REST API design notes

This is the reasoning behind `apps/api`'s shape, not just a list of
endpoints (the interactive list is at `/docs` once the API is running).
Referenced from the written-interview answer on REST API design.

## Versioning

Every route is under `/api/v1/...`. The version lives in the URL path
rather than in a header (e.g. `Accept: application/vnd.lps.v1+json`)
because this API has exactly one kind of client today (a browser SPA and
a mobile app, both easy to point at a new path) and no proxies or caches
in front of it that would benefit from content negotiation. A path
version is the simplest thing that lets `v2` exist side-by-side with
`v1` later without breaking `apps/web` or `apps/mobile_flutter` on their
own release schedule.

## Resource shape

Two resources: `patterns` and `orders`. `orders` references `patterns` by
id rather than embedding the pattern — the caller who already has a
pattern loaded shouldn't have to re-fetch it to place an order, and the
caller placing an order doesn't need every pattern field (SVG path data,
warnings) inlined into the order response.

## Error shape

Every error response is `{"error": "<machine-readable code>", "detail":
"<human-readable message>"}` (`schemas.ErrorResponse`), whether it's a
422 validation error, a 404, or an unhandled 500 (caught by the global
exception handler in `app/main.py`). One shape, not a different one per
status code, means `apps/web`'s `ApiError` and `apps/mobile_flutter`'s
`PatternApiException` can both have one, boring error-handling path
instead of several.

## Idempotency and side effects

`POST /patterns` is not idempotent — calling it twice creates two
patterns, which is correct (two users, or the same user twice, really do
want two rows). What it *is* careful about is not doing slow work on the
request thread: geometry is computed synchronously (cheap, pure
arithmetic, worth returning immediately) but the SVG/PDF export is
handed to a queue (`events.enqueue_export_job`) so a slow render never
makes a `POST` hang. A client polls `GET /patterns/{id}` (or `apps/web`
does, via its "Refresh" button) to see `export_status` move from
`pending` to `ready`.

## What's intentionally not here yet

- **Pagination cursor, not just limit/offset** on `GET /patterns` — fine
  at this data volume, would need revisiting before this ever had
  thousands of rows per user.
- **Auth.** There's no concept of "whose pattern is this" yet — every
  pattern is visible to every caller. Fine for a portfolio demo; the
  first thing to add before this touched real customer data.
- **Rate limiting** on pattern creation.

All three are called out again in `ARCHITECTURE.md`, which is where the
written-interview answer on reliability and maintainability draws from.
