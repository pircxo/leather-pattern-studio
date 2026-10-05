# Running and hosting

## Local portfolio demo

Use `npm run setup` then `npm run dev`. This is the quickest route for a demo: SQLite and inline exports require no external services. The draft is recovered from browser local storage; saved patterns are in the API database.

If port 8000 is occupied, use `API_PORT=8001 npm run dev`. `WEB_PORT` changes the web port. The runner automatically configures the proxy to reach the chosen API port.

## Compose deployment

```bash
docker compose up --build -d
```

The stack serves the built frontend on port 5173, the API/OpenAPI docs on 8000, PostgreSQL on 5432 and Redis on 6379. Internal services communicate by Compose service names. The web container proxies `/api` to `api:8000`.

Persistent named volumes are `pg-data` and `exports`. Stopping with `docker compose down` preserves them. Do not remove volumes unless you intend to erase saved patterns and exports.

For a host deployment, put the web service behind an HTTPS reverse proxy and restrict direct API/database/Redis ports to the host or private network. This app intentionally has no user-account layer; use private access or a disposable public demo dataset. Customer information does not belong in an unrestricted portfolio instance.

## Configuration

| Variable | Default / purpose |
| --- | --- |
| `DATABASE_URL` | API default `sqlite:///./patterns.db`; local runner uses an absolute repository path; Compose uses PostgreSQL |
| `EXPORTS_DIR` | API default temporary `lps-exports`; runner uses `apps/api/exports`; Compose shares `/data/exports` |
| `EXPORT_MODE` | `auto`, `inline` or `queued`; runner uses inline, Compose uses queued |
| `REDIS_URL` | `redis://localhost:6379/0`; Compose uses `redis://redis:6379/0` |
| `CORS_ORIGINS` | Comma-separated allowlist, default localhost/127.0.0.1 on 5173 |
| `API_PORT` / `WEB_PORT` | Local runner ports, default 8000 / 5173 |
| `VITE_API_PROXY_TARGET` | Development proxy target; local runner fills this automatically |
| `VITE_API_BASE_URL` | Frontend build-time API prefix, default `/api/v1` |
| `API_BASE_URL` | Flutter `--dart-define` argument including `/api/v1` |

To use the Flutter browser companion at localhost:8080, include that exact origin in `CORS_ORIGINS` when starting the API. A phone uses your machine's network address rather than localhost; its API URL must be reachable from the device.

## Worker behavior

Scale workers with `docker compose up --scale worker=2`. They use the same queue, database and export volume. If queue dispatch fails in queued mode, the pattern is marked failed and can be retried from the library. If the process running an export dies (crash, out-of-memory kill), the worker marks the pattern failed so it can be retried. If a job was accepted while workers are stopped, resume a worker to process it.

On Linux (Docker, CI) each job runs in a forked child process, isolating crashes from the worker. On macOS the worker runs jobs in-process, because macOS aborts forked children that inherit Objective-C runtime state.

## Validation

`python3 scripts/smoke_stack.py` checks the running Compose stack at `http://127.0.0.1:5173`: save, poll until exported, download SVG/PDF, delete the smoke pattern. Use `STUDIO_URL` to point it at a different local test stack. Run it only against a demo/test deployment because it creates a temporary record.

CI runs this after a full Docker build, alongside unit and browser checks. No deployment to an external host is performed automatically.
