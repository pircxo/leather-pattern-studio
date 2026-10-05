"""Error-envelope and listing details not covered by test_workflows.py."""

import os

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _create(name="Card slot"):
    payload = {"name": name, "finished_width_mm": 90, "finished_height_mm": 60}
    resp = client.post("/api/v1/patterns", json=payload)
    assert resp.status_code == 201, resp.text
    return resp.json()


def test_404_uses_error_envelope():
    resp = client.get("/api/v1/patterns/999999")
    assert resp.status_code == 404
    assert resp.json() == {"error": "not_found", "detail": "pattern not found"}


def test_validation_error_names_every_bad_field():
    resp = client.post("/api/v1/patterns", json={"name": "x", "finished_width_mm": -5})
    assert resp.status_code == 422
    body = resp.json()
    assert body["error"] == "validation_error"
    assert "finished_width_mm" in body["detail"]
    assert "finished_height_mm" in body["detail"]


def test_conflict_uses_error_envelope():
    pattern = _create()
    resp = client.post(f"/api/v1/patterns/{pattern['id']}/retry-export")
    assert resp.status_code == 409
    assert resp.json()["error"] == "conflict"


def test_delete_missing_pattern_is_404():
    assert client.delete("/api/v1/patterns/999999").status_code == 404


def test_search_is_case_insensitive():
    target = _create("Zebra-print pocket")
    _create("Plain gusset")
    body = client.get("/api/v1/patterns", params={"q": "zEBRA"}).json()
    assert [p["id"] for p in body["items"]] == [target["id"]]
    assert body["total"] == 1


def test_order_patch_rejects_unknown_status():
    pattern = _create()
    order = client.post("/api/v1/orders", json={"pattern_id": pattern["id"]}).json()
    resp = client.patch(f"/api/v1/orders/{order['id']}", json={"status": "lost"})
    assert resp.status_code == 422


def test_order_patch_missing_order_is_404():
    resp = client.patch("/api/v1/orders/999999", json={"status": "shipped"})
    assert resp.status_code == 404


def test_list_orders_newest_first():
    pattern = _create()
    first = client.post("/api/v1/orders", json={"pattern_id": pattern["id"]}).json()
    second = client.post("/api/v1/orders", json={"pattern_id": pattern["id"]}).json()
    ids = [o["id"] for o in client.get("/api/v1/orders").json()["items"]]
    assert ids.index(second["id"]) < ids.index(first["id"])


def test_missing_export_files_are_regenerated_on_download():
    # Serverless hosts lose local disk between requests; a ready pattern
    # must still be downloadable.
    pattern = _create("Regenerated panel")
    for path in (pattern["svg_export_path"], pattern["pdf_export_path"]):
        os.remove(path)
    pdf = client.get(f"/api/v1/patterns/{pattern['id']}/export.pdf")
    assert pdf.status_code == 200
    assert pdf.content.startswith(b"%PDF-")
    svg = client.get(f"/api/v1/patterns/{pattern['id']}/export.svg")
    assert svg.status_code == 200
    assert "Regenerated panel" in svg.text
