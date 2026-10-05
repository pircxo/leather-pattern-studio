"""Database session setup, shared by apps/api and apps/worker.

Defaults to a local SQLite file so the project runs with zero external
setup. `docker-compose.yml` points `DATABASE_URL` at Postgres for anything
closer to a production shape. Swapping the backend never touches
`models.py` or `jobs.py` — that's the point of going through SQLAlchemy
instead of hand-rolled SQL here.
"""

from __future__ import annotations

import os
from contextlib import contextmanager

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./patterns.db")

_connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=_connect_args, future=True)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False, future=True)


class Base(DeclarativeBase):
    pass


def init_db() -> None:
    """Create tables if they don't exist. Fine for an MVP; a real
    production service would use Alembic migrations instead — noted in
    ARCHITECTURE.md under 'what I'd change before this hits real users'."""
    from . import models  # noqa: F401  (ensure models are registered on Base)

    Base.metadata.create_all(bind=engine)


def get_db_session() -> Session:
    """For scripts/workers that want a plain session they manage themselves."""
    return SessionLocal()


@contextmanager
def session_scope():
    """For code that wants commit/rollback handled for it."""
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
