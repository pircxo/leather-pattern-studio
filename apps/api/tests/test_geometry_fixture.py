"""Checks the Python geometry engine against the shared cross-language
fixture described in `fixtures/README.md`. The TypeScript implementation
in `apps/web/src/geometry/panel.ts` is checked against the exact same
file independently, in `apps/web/src/geometry/panel.test.ts`."""

import json
import os

import pytest

from core_py.geometry import generate_panel

FIXTURE_PATH = os.path.join(
    os.path.dirname(__file__), "..", "..", "..", "fixtures", "panel-cases.json"
)


def _load_cases():
    with open(FIXTURE_PATH) as f:
        return json.load(f)


@pytest.mark.parametrize("case", _load_cases())
def test_matches_shared_fixture(case):
    panel = generate_panel(**case["input"])
    expected = case["expected"]

    assert panel.cut_width_mm == expected["cut_width_mm"]
    assert panel.cut_height_mm == expected["cut_height_mm"]
    assert panel.finished_corner_radius_mm == expected["finished_corner_radius_mm"]
    assert panel.cut_corner_radius_mm == expected["cut_corner_radius_mm"]
    assert panel.finished_area_cm2 == expected["finished_area_cm2"]
    assert panel.finished_perimeter_cm == expected["finished_perimeter_cm"]
    assert panel.cut_area_cm2 == expected["cut_area_cm2"]
    assert panel.cut_perimeter_cm == expected["cut_perimeter_cm"]
    assert len(panel.warnings) == expected["warning_count"]
