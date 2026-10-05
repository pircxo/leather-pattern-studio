"""Point the app at a throwaway SQLite DB and exports dir, and at an
unreachable Redis address with a short timeout, *before* `app.main` (and
therefore `core_py.db.engine`) gets imported by any test module. That
makes `events.enqueue_export_job` fall back to its synchronous path
immediately in tests, instead of hitting a real queue."""

import os
import tempfile

_tmp = tempfile.mkdtemp(prefix="lps-test-")
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp}/test.db"
os.environ["EXPORTS_DIR"] = os.path.join(_tmp, "exports")
os.environ.setdefault("REDIS_URL", "redis://127.0.0.1:1/0")  # deliberately unreachable

# The FastAPI app normally creates tables in its `startup` event, which
# only fires if TestClient is used as a context manager. Our tests use
# the plain `client = TestClient(app)` form for brevity, so create the
# schema here instead, once, before any test imports app.main.
from core_py.db import init_db  # noqa: E402

init_db()
