"""The export worker: a separate process (and, in docker-compose, a
separate container) from the API, with no import of anything under
`apps/api`. It only knows about:

  1. the Redis "exports" queue (how work arrives)
  2. `core_py.jobs.export_job` (what to do with it)
  3. the same database the API writes to (where the result goes)

Run it with `python worker.py` (after `pip install -r requirements.txt`),
or via `docker compose up worker`. Scaling export throughput is just
running more of these — they don't share in-memory state, only the queue
and the DB.
"""

from __future__ import annotations

import logging
import os
import sys

from redis import Redis
from rq import Queue, SimpleWorker, Worker

from core_py.jobs import mark_export_failed

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("lps.worker")

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")


class ExportWorker(Worker):
    """Forks a child process per job (RQ's default), so a crash or OOM in
    one export can't take the worker down. If that child dies before
    `export_job` could record an outcome, mark the pattern failed here —
    otherwise it would stay `pending` forever and couldn't be retried."""

    def handle_work_horse_killed(self, job, retpid, ret_val, rusage):
        super().handle_work_horse_killed(job, retpid, ret_val, rusage)
        if job.args:
            mark_export_failed(
                job.args[0], "The export worker stopped unexpectedly. Retry the export."
            )


def worker_class() -> type[Worker]:
    # macOS aborts forked children that touch Objective-C runtime state
    # initialised by the parent, so run jobs in-process there for local
    # development. Linux (Docker, CI, production) keeps the forking worker.
    return SimpleWorker if sys.platform == "darwin" else ExportWorker


def main() -> None:
    conn = Redis.from_url(REDIS_URL)
    queue = Queue("exports", connection=conn)
    logger.info("Listening on Redis queue 'exports' at %s", REDIS_URL)
    worker = worker_class()([queue], connection=conn)
    worker.work(with_scheduler=False)


if __name__ == "__main__":
    main()
