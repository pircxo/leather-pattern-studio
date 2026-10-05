# Verification record

Verified locally on 2026-10-05, on macOS with Python 3.12 and Node.js 26.

| Check | Result |
| --- | --- |
| Backend/geometry/export suite | 57 passed, including the actual Redis/RQ integration and worker crash recovery |
| Shared React UI suite | 17 passed, including component axe checks |
| Web app suite | 14 passed, including automatic export polling |
| Desktop and phone browser workflows | 6 passed |
| TypeScript + production frontend build | Passed |
| Editor, library and order WCAG browser checks | Passed |
| Frontend npm dependency audit | 0 reported vulnerabilities |
| Prettier / Ruff / whitespace checks | Passed |
| Compose and workflow YAML parsing | Passed |
| Tiled PDF visual review | All four tote pages rendered and inspected |
| Live local proxy/API/export smoke test | Passed |
| API + separate worker on PostgreSQL and Redis (`scripts/smoke_stack.py`, queued mode) | Passed |

The queue checks used an isolated Redis instance on port 16379 and a unique test queue. The service smoke test ran the API and `apps/worker/worker.py` as separate processes against a throwaway local PostgreSQL database, which was dropped afterwards. Browser tests and screenshots used separate temporary SQLite databases and export directories. No test records were added to the local working library by those runs.

The checked-in screenshots show disposable sample data. Generate them again with `npm run screenshots` after installing the Playwright browser.

Docker and Flutter were not installed in the local environment, so their container builds and companion tests/build were not executed locally. The CI workflow includes those checks, a PostgreSQL/Redis service-stack smoke test and a separate Redis integration test. A passing CI run is still needed to establish those platform results; this record does not claim it has run.

For ordinary local `npm run test:api`, the Redis test skips when `TEST_REDIS_URL` is absent. To include it, supply the URL of an isolated Redis instance, for example:

```bash
TEST_REDIS_URL=redis://127.0.0.1:16379/15 npm run test:api
```

The app has not been published to an external host by this work. See `DEPLOYMENT.md` for hosting configuration.
