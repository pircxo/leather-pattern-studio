"""Smoke-test a disposable stack through the frontend proxy."""

import json
import os
import time
import urllib.request

BASE = os.environ.get("STUDIO_URL", "http://127.0.0.1:5173").rstrip("/")


def request(path, method="GET", data=None):
    payload = json.dumps(data).encode() if data is not None else None
    req = urllib.request.Request(
        BASE + path, data=payload, method=method, headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=15) as response:
        return response.read()


def main():
    for _ in range(60):
        try:
            request("/api/v1/patterns?limit=1")
            break
        except (OSError, TimeoutError):
            time.sleep(1)
    else:
        raise SystemExit("Web service did not become ready.")
    pattern = json.loads(
        request(
            "/api/v1/patterns",
            "POST",
            {
                "name": f"Stack smoke {time.time_ns()}",
                "finished_width_mm": 320,
                "finished_height_mm": 360,
                "corner_radius_mm": 20,
                "seam_allowance_mm": 6,
            },
        )
    )
    path = f"/api/v1/patterns/{pattern['id']}"
    for _ in range(60):
        pattern = json.loads(request(path))
        if pattern["export_status"] == "failed":
            raise SystemExit(f"Export failed: {pattern['export_error']}")
        if pattern["export_status"] == "ready":
            break
        time.sleep(1)
    else:
        raise SystemExit("Worker did not produce exports within 60 seconds.")
    assert b"<svg" in request(path + "/export.svg")
    assert request(path + "/export.pdf").startswith(b"%PDF-")
    request(path, "DELETE")
    print("Studio verified: proxy -> API -> saved pattern -> SVG/PDF downloads.")


if __name__ == "__main__":
    main()
