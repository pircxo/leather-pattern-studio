import math

import pytest

from core_py.geometry import generate_panel


def test_simple_rectangle_no_rounding():
    panel = generate_panel(
        finished_width_mm=100, finished_height_mm=50, corner_radius_mm=0, seam_allowance_mm=5
    )
    assert panel.cut_width_mm == 110
    assert panel.cut_height_mm == 60
    # Plain rectangle area/perimeter, no rounding correction.
    assert panel.finished_area_cm2 == pytest.approx(100 * 50 / 100, rel=1e-6)
    assert panel.finished_perimeter_cm == pytest.approx(2 * (100 + 50) / 10, rel=1e-6)
    assert panel.warnings == []


def test_rounded_rectangle_area_and_perimeter():
    w, h, r = 80, 40, 10
    panel = generate_panel(
        finished_width_mm=w, finished_height_mm=h, corner_radius_mm=r, seam_allowance_mm=0
    )
    expected_area_mm2 = (w * h) - (4 - math.pi) * (r**2)
    expected_perimeter_mm = 2 * (w + h) - 8 * r + 2 * math.pi * r
    # generate_panel() rounds to 2 decimal places for display, so compare
    # with an absolute tolerance rather than a tight relative one.
    assert panel.finished_area_cm2 == pytest.approx(expected_area_mm2 / 100, abs=0.01)
    assert panel.finished_perimeter_cm == pytest.approx(expected_perimeter_mm / 10, abs=0.01)


def test_oversized_corner_radius_is_clamped_with_warning():
    panel = generate_panel(
        finished_width_mm=20, finished_height_mm=10, corner_radius_mm=100, seam_allowance_mm=2
    )
    # Radius can never exceed half the shorter finished side (5mm here).
    assert panel.finished_corner_radius_mm == 5
    assert len(panel.warnings) == 1
    assert "clamped" in panel.warnings[0]


def test_seam_allowance_grows_the_cut_outline_corner_radius():
    panel = generate_panel(
        finished_width_mm=60, finished_height_mm=60, corner_radius_mm=5, seam_allowance_mm=5
    )
    assert panel.cut_corner_radius_mm == 10  # 5mm finished radius + 5mm seam allowance


@pytest.mark.parametrize(
    "width,height,radius,allowance",
    [(-1, 10, 0, 5), (10, -1, 0, 5), (10, 10, -1, 5), (10, 10, 0, -1)],
)
def test_invalid_inputs_raise(width, height, radius, allowance):
    with pytest.raises(ValueError):
        generate_panel(width, height, radius, allowance)


def test_svg_paths_are_well_formed_strings():
    panel = generate_panel(50, 30, 5, 4)
    assert panel.cut_outline_path.startswith("M ")
    assert panel.cut_outline_path.endswith("Z")
    assert panel.stitch_guide_path.startswith("M ")
    assert panel.stitch_guide_path.endswith("Z")
