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

from redis import Redis
from rq import Queue, Worker

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("lps.worker")

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")


def main() -> None:
    conn = Redis.from_url(REDIS_URL)
    queue = Queue("exports", connection=conn)
    logger.info("Listening on Redis queue 'exports' at %s", REDIS_URL)
    worker = Worker([queue], connection=conn)
    worker.work(with_scheduler=False)


if __name__ == "__main__":
    main()
