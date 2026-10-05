"""Exercises the actual payload the Redis queue runs
(`core_py.jobs.export_job`) directly, without going through the API or a
real Redis connection — this is what `apps/worker` calls on every job."""

import os

from core_py.db import session_scope
from core_py.jobs import EXPORTS_DIR, export_job
from core_py.models import ExportStatus, Pattern


def _make_pattern(**overrides) -> int:
    defaults = dict(
        name="Test panel",
        material="veg-tan leather",
        finished_width_mm=50.0,
        finished_height_mm=30.0,
        corner_radius_mm=4.0,
        seam_allowance_mm=5.0,
        cut_width_mm=60.0,
        cut_height_mm=40.0,
        finished_area_cm2=14.0,
        finished_perimeter_cm=15.0,
        stitch_guide_path="M 0,0 Z",
        cut_outline_path="M 0,0 Z",
    )
    defaults.update(overrides)
    with session_scope() as db:
        pattern = Pattern(**defaults)
        db.add(pattern)
        db.flush()
        return pattern.id


def test_export_job_writes_files_and_marks_ready():
    pattern_id = _make_pattern()

    export_job(pattern_id)

    with session_scope() as db:
        pattern = db.get(Pattern, pattern_id)
        assert pattern.export_status == ExportStatus.READY.value
        assert pattern.svg_export_path and os.path.exists(pattern.svg_export_path)
        assert pattern.pdf_export_path and os.path.exists(pattern.pdf_export_path)
        assert pattern.svg_export_path.startswith(EXPORTS_DIR)
        svg_path = pattern.svg_export_path

    with open(svg_path, encoding="utf-8") as f:
        assert "<svg" in f.read()


def test_export_job_on_missing_pattern_is_a_noop():
    # Should log and return, not raise — a deleted pattern racing with a
    # queued job must not crash the worker process.
    export_job(999_999)
