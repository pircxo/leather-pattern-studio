# REST API contract

The API uses `/api/v1`. Interactive schemas and examples are served at `/docs`.

| Method | Endpoint | Behavior |
| --- | --- | --- |
| GET | `/healthz` | Process liveness |
| POST | `/api/v1/patterns` | Validate parameters, calculate geometry, persist and enqueue exports; 201 |
| GET | `/api/v1/patterns?limit=12&offset=0&q=wallet` | Newest-first patterns; `{items, total}` |
| GET | `/api/v1/patterns/{id}` | Pattern including export status |
| DELETE | `/api/v1/patterns/{id}` | Delete a completed, unreferenced pattern and its files; 204 |
| POST | `/api/v1/patterns/{id}/retry-export` | Retry a failed export |
| GET | `/api/v1/patterns/{id}/export.svg` | Millimetre-sized SVG template |
| GET | `/api/v1/patterns/{id}/export.pdf` | True-scale tiled A4 PDF |
| POST | `/api/v1/orders` | Create an order referencing a saved pattern; 201 |
| GET | `/api/v1/orders?limit=12&offset=0` | Newest-first orders; `{items, total}` |
| GET | `/api/v1/orders/{id}` | Fetch an order |
| PATCH | `/api/v1/orders/{id}` | Move to the next production state |

## Create a pattern

```json
{
  "name": "Wallet panel",
  "material": "Veg-tan leather",
  "finished_width_mm": 110,
  "finished_height_mm": 90,
  "corner_radius_mm": 8,
  "seam_allowance_mm": 4
}
```

Dimensions must be finite and positive, up to 2,000 mm. Radius is 0–1,000 mm and seam allowance is 0–50 mm. The actual radius is limited to half the shorter side. Names and materials are trimmed, cannot be blank, and reject control characters. Unknown input fields are rejected. Names have a 120-character limit and materials have an 80-character limit.

Saved patterns are immutable. Reopen one in the studio and save a new record to revise it. This preserves production history without mutating dimensions used by existing orders.

## Export lifecycle

`pending → processing → ready` or `failed`. The frontend polls every two seconds while visible patterns or its latest saved pattern need an export. A failed export can be retried. Files are replaced atomically; the renderer recomputes from stored parameters on every run.

`EXPORT_MODE=inline` executes exports synchronously for a local demo. `queued` uses Redis and records a recoverable failure if enqueueing fails. `auto` (the API default) attempts Redis, then falls back to inline when it cannot connect. If a worker is stopped after a job was accepted, the pattern remains queued until a worker consumes it.

Downloads return 409 if a file is not ready, and 404 if the pattern does not exist. SVG/PDF filenames use the pattern ID. SVG labels are XML-escaped. The PDF uses a 190 × 250 mm drawing frame, 10 mm overlaps, page coordinates and a 50 mm ruler. Print at actual size / 100%, never fit to page.

Deletion is blocked while an export is queued/processing or when any order references the pattern. This keeps queued workers and production history consistent.

## Orders

```json
{"pattern_id": 1, "quantity": 3, "customer_note": "Natural tan, gift order"}
```

Quantity is an integer from 1 to 10,000; notes are limited to 500 characters. The referenced pattern must exist.

```json
{"status": "in_production"}
```

Allowed transitions are `received → in_production → shipped`. Setting the current status is idempotent; skipping ahead or moving backwards returns 409. Production cannot start until the cutting export is ready.

## Errors and pagination

All errors use a consistent envelope:

```json
{"error": "validation_error", "detail": "finished_width_mm: Input should be greater than 0"}
```

Common codes are `validation_error` (422), `not_found` (404), `conflict` (409), and `internal_error` (500). Unexpected errors are logged server-side and expose a generic message to clients.

Lists accept a limit of 1–100 (default 50) and a nonnegative offset. `total` counts all matches. Pattern search is a case-insensitive literal substring: SQL wildcard characters are escaped. Pattern creation intentionally creates a new resource each time; it has no idempotency key.
