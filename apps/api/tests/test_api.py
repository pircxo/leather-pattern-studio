from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_healthz():
    resp = client.get("/healthz")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_create_and_fetch_pattern():
    payload = {
        "name": "Crossbody strap, 25mm",
        "finished_width_mm": 250,
        "finished_height_mm": 25,
        "corner_radius_mm": 3,
        "seam_allowance_mm": 4,
    }
    created = client.post("/api/v1/patterns", json=payload)
    assert created.status_code == 201
    body = created.json()
    assert body["cut_width_mm"] == 258  # 250 + 2*4
    assert body["cut_height_mm"] == 33  # 25 + 2*4
    # Redis is unreachable in tests, so the export fallback runs inline —
    # by the time the request returns, the export is already done.
    assert body["export_status"] == "ready"
    assert body["svg_export_path"]

    pattern_id = body["id"]
    fetched = client.get(f"/api/v1/patterns/{pattern_id}")
    assert fetched.status_code == 200
    assert fetched.json()["name"] == payload["name"]


def test_create_pattern_validation_error():
    resp = client.post(
        "/api/v1/patterns",
        json={"name": "", "finished_width_mm": 10, "finished_height_mm": 10},
    )
    assert resp.status_code == 422


def test_get_missing_pattern_is_404():
    resp = client.get("/api/v1/patterns/999999")
    assert resp.status_code == 404


def test_svg_export_is_served_after_creation():
    created = client.post(
        "/api/v1/patterns",
        json={"name": "Wallet panel", "finished_width_mm": 90, "finished_height_mm": 110},
    )
    pattern_id = created.json()["id"]
    svg_resp = client.get(f"/api/v1/patterns/{pattern_id}/export.svg")
    assert svg_resp.status_code == 200
    assert svg_resp.headers["content-type"].startswith("image/svg+xml")
    assert b"<svg" in svg_resp.content


def test_order_requires_existing_pattern():
    resp = client.post("/api/v1/orders", json={"pattern_id": 999999, "quantity": 1})
    assert resp.status_code == 404


def test_order_lifecycle():
    pattern = client.post(
        "/api/v1/patterns",
        json={"name": "Keychain fob", "finished_width_mm": 40, "finished_height_mm": 60},
    ).json()

    order = client.post(
        "/api/v1/orders",
        json={"pattern_id": pattern["id"], "quantity": 3, "customer_note": "gift wrap please"},
    )
    assert order.status_code == 201
    order_body = order.json()
    assert order_body["status"] == "received"

    fetched = client.get(f"/api/v1/orders/{order_body['id']}")
    assert fetched.status_code == 200
    assert fetched.json()["quantity"] == 3
