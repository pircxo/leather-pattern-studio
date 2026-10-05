"""The API's only touchpoint with the event-processing side of the system.

`enqueue_export_job` is deliberately the *only* thing a route handler is
allowed to know about how exports get generated. A route never calls
`core_py.jobs.export_job` directly in the happy path — it hands the work
off and returns, so a slow render (or a future one: nesting multiple
patterns onto one hide, say) never makes a client wait on the request
thread.

If Redis is not reachable (e.g. someone running `apps/api` alone, without
`docker compose`, for a quick demo), this falls back to running the job
inline rather than failing the request — a deliberate choice to keep local
development friction-free, logged loudly so it's never silently mistaken
for the real async path. `ARCHITECTURE.md` discusses why this fallback is
acceptable here and where it would stop being acceptable (at real
production traffic, a failed enqueue should alert, not silently degrade).
"""

from __future__ import annotations

import logging
import os

from redis import Redis
from rq import Queue

from core_py.jobs import export_job
from core_py.db import session_scope
from core_py.models import Pattern

logger = logging.getLogger("lps.events")

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

_redis: Redis | None = None
_queue: Queue | None = None


def _get_queue() -> Queue:
    global _redis, _queue
    if _queue is None:
        _redis = Redis.from_url(REDIS_URL, socket_connect_timeout=0.5, socket_timeout=1)
        _queue = Queue("exports", connection=_redis)
    return _queue


def enqueue_export_job(pattern_id: int) -> str:
    """Enqueue async export rendering for a pattern. Returns 'queued' if
    it genuinely went onto Redis, or 'inline' if it fell back to running
    synchronously (Redis unreachable)."""
    mode = os.environ.get("EXPORT_MODE", "auto")
    if mode == "inline":
        export_job(pattern_id)
        return "inline"
    try:
        queue = _get_queue()
        queue.enqueue(export_job, pattern_id, job_timeout=60)
        return "queued"
    except Exception:
        if mode == "queued":
            logger.exception("Could not enqueue export for pattern %s", pattern_id)
            with session_scope() as db:
                pattern = db.get(Pattern, pattern_id)
                if pattern:
                    pattern.export_status = "failed"
                    pattern.export_error = (
                        "The export queue is unavailable. Retry when the worker is running."
                    )
            return "failed"
        logger.warning(
            "Redis unavailable, running export_job(%s) inline instead of queuing. "
            "This is fine for local development without `docker compose`, but means "
            "this request is no longer decoupled from render time.",
            pattern_id,
        )
        export_job(pattern_id)
        return "inline"
