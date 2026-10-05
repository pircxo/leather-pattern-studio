"""Exercise the actual RQ queue and worker when CI supplies an isolated Redis."""

import os
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from redis import Redis
from rq import Queue, SimpleWorker

from app.main import app


@pytest.mark.skipif(not os.environ.get("TEST_REDIS_URL"), reason="Requires isolated test Redis")
def test_real_queue_to_export_worker(monkeypatch):
    connection = Redis.from_url(os.environ["TEST_REDIS_URL"])
    queue = Queue(f"lps-test-{uuid4().hex}", connection=connection)
    monkeypatch.setenv("EXPORT_MODE", "queued")
    monkeypatch.setattr("app.events._get_queue", lambda: queue)
    with TestClient(app) as client:
        created = client.post(
            "/api/v1/patterns",
            json={"name": "Queued tote", "finished_width_mm": 320, "finished_height_mm": 360},
        ).json()
        assert created["export_status"] == "pending"
        assert queue.count == 1
        try:
            worker = SimpleWorker([queue], connection=connection)
            worker.work(burst=True, with_scheduler=False)
            pattern = client.get(f"/api/v1/patterns/{created['id']}").json()
            assert pattern["export_status"] == "ready"
            assert client.get(f"/api/v1/patterns/{created['id']}/export.pdf").content.startswith(
                b"%PDF-"
            )
        finally:
            queue.delete(delete_jobs=True)
