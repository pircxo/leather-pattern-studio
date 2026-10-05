import os
import xml.etree.ElementTree as ET
from unittest.mock import patch
import pytest
from fastapi.testclient import TestClient
from pypdf import PdfReader
from app.main import app
from core_py.db import session_scope
from core_py.geometry import generate_panel, render_panel_svg
from core_py.jobs import _write_pdf, tile_layout
from core_py.models import Pattern

client = TestClient(app)


def create(**overrides):
    data = {"name": "Workflow panel", "finished_width_mm": 110, "finished_height_mm": 90}
    return client.post("/api/v1/patterns", json=data | overrides)


@pytest.mark.parametrize("query", ["limit=0", "limit=101", "offset=-1"])
def test_pagination_is_bounded(query):
    response = client.get(f"/api/v1/patterns?{query}")
    assert response.status_code == 422
    assert response.json()["error"] == "validation_error"
    assert isinstance(response.json()["detail"], str)


def test_search_treats_wildcards_literally():
    create(name="Specific 100% panel")
    response = client.get("/api/v1/patterns", params={"q": "100%"})
    assert response.json()["total"] == 1
    assert response.json()["items"][0]["name"] == "Specific 100% panel"


@pytest.mark.parametrize(
    "field,value",
    [
        ("name", "   "),
        ("material", " "),
        ("finished_width_mm", "NaN"),
        ("seam_allowance_mm", "Infinity"),
        ("extra", 1),
    ],
)
def test_rejects_invalid_input(field, value):
    response = create(**{field: value})
    assert response.status_code == 422
    assert response.json()["error"] == "validation_error"


def test_delete_removes_record_and_exports():
    pattern = create().json()
    paths = [pattern["svg_export_path"], pattern["pdf_export_path"]]
    assert all(os.path.exists(p) for p in paths)
    assert client.delete(f"/api/v1/patterns/{pattern['id']}").status_code == 204
    assert client.get(f"/api/v1/patterns/{pattern['id']}").status_code == 404
    assert all(not os.path.exists(p) for p in paths)


def test_order_history_protects_pattern_and_enforces_lifecycle():
    pattern = create().json()
    order = client.post("/api/v1/orders", json={"pattern_id": pattern["id"], "quantity": 2}).json()
    url = f"/api/v1/orders/{order['id']}"
    assert client.delete(f"/api/v1/patterns/{pattern['id']}").status_code == 409
    assert client.patch(url, json={"status": "shipped"}).status_code == 409
    assert client.patch(url, json={"status": "in_production"}).json()["status"] == "in_production"
    assert client.patch(url, json={"status": "shipped"}).json()["status"] == "shipped"
    assert client.patch(url, json={"status": "received"}).status_code == 409
    assert any(o["id"] == order["id"] for o in client.get("/api/v1/orders").json()["items"])


def test_pending_pattern_cannot_start_production_or_be_deleted():
    pattern = create().json()
    with session_scope() as db:
        db.get(Pattern, pattern["id"]).export_status = "pending"
    order = client.post("/api/v1/orders", json={"pattern_id": pattern["id"]}).json()
    assert (
        client.patch(f"/api/v1/orders/{order['id']}", json={"status": "in_production"}).status_code
        == 409
    )
    assert client.delete(f"/api/v1/patterns/{pattern['id']}").status_code == 409


def test_failed_export_can_be_retried():
    pattern = create().json()
    with session_scope() as db:
        row = db.get(Pattern, pattern["id"])
        row.export_status = "failed"
        row.export_error = "Simulated failure"
    response = client.post(f"/api/v1/patterns/{pattern['id']}/retry-export")
    assert response.json()["export_status"] == "ready"
    assert response.json()["export_error"] is None
    assert client.post(f"/api/v1/patterns/{pattern['id']}/retry-export").status_code == 409


def test_queue_outage_is_recoverable_in_queued_mode():
    with (
        patch.dict(os.environ, {"EXPORT_MODE": "queued"}),
        patch("app.events._get_queue", side_effect=ConnectionError),
    ):
        pattern = create().json()
    assert pattern["export_status"] == "failed"
    assert "queue is unavailable" in pattern["export_error"]
    assert (
        client.post(f"/api/v1/patterns/{pattern['id']}/retry-export").json()["export_status"]
        == "ready"
    )


def test_svg_name_cannot_inject_markup():
    label = '<script>alert("x")</script> & wallet'
    document = ET.fromstring(render_panel_svg(generate_panel(50, 50), label))
    assert document.find("{http://www.w3.org/2000/svg}title").text == label
    assert document.find("{http://www.w3.org/2000/svg}script") is None


@pytest.mark.parametrize("values", [(float("nan"), 10, 0, 5), (10, 10, float("inf"), 5)])
def test_geometry_rejects_nonfinite_values(values):
    with pytest.raises(ValueError, match="finite"):
        generate_panel(*values)


@pytest.mark.parametrize(
    "width,height,expected",
    [(110, 90, (1, 1)), (250, 25, (2, 1)), (320, 360, (2, 2)), (500, 500, (3, 3))],
)
def test_pdf_is_tiled_at_actual_scale(tmp_path, width, height, expected):
    panel = generate_panel(width, height)
    assert tile_layout(panel) == expected
    path = str(tmp_path / "panel.pdf")
    _write_pdf(panel, path, "A long name " * 12)
    reader = PdfReader(path)
    assert len(reader.pages) == expected[0] * expected[1]
    for page in reader.pages:
        text = page.extract_text()
        assert "50 mm scale check" in text
        assert "100% / actual size" in text
        assert float(page.mediabox.width) == pytest.approx(210 * 72 / 25.4, abs=0.01)
        assert float(page.mediabox.height) == pytest.approx(297 * 72 / 25.4, abs=0.01)
    assert b"1 0 0 1 0 0 cm" in reader.pages[0].get_contents().get_data()


def test_pdf_endpoint_is_valid_pdf():
    pattern = create().json()
    response = client.get(f"/api/v1/patterns/{pattern['id']}/export.pdf")
    assert response.headers["content-type"] == "application/pdf"
    assert response.content.startswith(b"%PDF-")
