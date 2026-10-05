"""Shared domain logic for Leather Pattern Studio.

Both `apps/api` (the REST service) and `apps/worker` (the async export
consumer) depend on this package instead of on each other. Neither service
imports the other's code — they only communicate over the Redis queue and a
shared database — which keeps the service boundary honest even though, for
an MVP of this size, they currently share one Postgres/SQLite instance.
"""

from . import geometry, models, db, jobs  # noqa: F401
