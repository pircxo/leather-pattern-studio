"""The worker's recovery path when the process running an export dies
before `export_job` could record an outcome (crash, OOM kill)."""

import importlib.util
import os
from types import SimpleNamespace

from fastapi.testclient import TestClient

from app.main import app
from core_py.db import session_scope
from core_py.jobs import mark_export_failed
from core_py.models import ExportStatus, Pattern

client = TestClient(app)

_spec = importlib.util.spec_from_file_location(
    "lps_worker",
    os.path.join(os.path.dirname(__file__), "..", "..", "worker", "worker.py"),
)
worker = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(worker)


def _pattern_with_status(status: ExportStatus) -> int:
    created = client.post(
        "/api/v1/patterns",
        json={"name": "Worker panel", "finished_width_mm": 80, "finished_height_mm": 50},
    ).json()
    with session_scope() as db:
        db.get(Pattern, created["id"]).export_status = status.value
    return created["id"]


def test_killed_work_horse_marks_pattern_failed_and_retryable():
    pattern_id = _pattern_with_status(ExportStatus.PROCESSING)
    # Worker.__init__ connects to Redis; the hook under test doesn't need it.
    export_worker = worker.ExportWorker.__new__(worker.ExportWorker)
    export_worker._work_horse_killed_handler = None

    export_worker.handle_work_horse_killed(SimpleNamespace(args=(pattern_id,)), 1234, 6, None)

    pattern = client.get(f"/api/v1/patterns/{pattern_id}").json()
    assert pattern["export_status"] == "failed"
    assert "stopped unexpectedly" in pattern["export_error"]
    retried = client.post(f"/api/v1/patterns/{pattern_id}/retry-export")
    assert retried.json()["export_status"] == "ready"


def test_mark_export_failed_never_overwrites_a_ready_export():
    pattern_id = _pattern_with_status(ExportStatus.READY)
    mark_export_failed(pattern_id, "late failure")
    assert client.get(f"/api/v1/patterns/{pattern_id}").json()["export_status"] == "ready"


def test_mark_export_failed_ignores_deleted_patterns():
    mark_export_failed(999_999, "gone")  # must not raise
