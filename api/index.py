"""Vercel entry point: serves the FastAPI app (apps/api) as one Python
function under /api. See docs/DEPLOYMENT.md ("Vercel").

Serverless differences from the Docker stack:
- No long-running worker, so exports render inline (EXPORT_MODE=inline).
- Local disk only lives as long as one function instance, so exports go to
  /tmp and the download endpoints re-render them when they're missing.
- Data lives in hosted Postgres via DATABASE_URL. Without it this falls
  back to SQLite in /tmp, which works but resets whenever the instance does.
"""

import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path[:0] = [os.path.join(ROOT, "apps", "api"), os.path.join(ROOT, "packages", "core_py")]

os.environ.setdefault("EXPORT_MODE", "inline")
os.environ.setdefault("EXPORTS_DIR", "/tmp/lps-exports")
os.environ.setdefault("DATABASE_URL", "sqlite:////tmp/patterns.db")

from core_py.db import init_db  # noqa: E402

# Lifespan events aren't guaranteed on serverless; create tables on cold start.
init_db()

from app.main import app  # noqa: E402,F401
