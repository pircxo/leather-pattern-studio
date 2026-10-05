"""The pattern-geometry engine.

This is the single source of truth for turning a few human parameters
(finished width/height, corner radius, seam allowance) into an accurate
cutting pattern: an outer *cut outline* (what the knife follows) and an
inner *stitch guide* (the finished panel edge, before seam allowance is
added).

The same four numbers are also computed client-side in
`apps/web/src/geometry/panel.ts` for an instant live preview while the user
drags a slider — but a value is only ever treated as official (stored,
billed, exported to PDF/SVG for cutting) once the server has recomputed it
here. Two implementations of the same formulas is a real maintenance cost;
it is paid deliberately in exchange for a UI that feels instant instead of
round-tripping to the API on every slider tick. `ARCHITECTURE.md` discusses
the trade-off and how the duplication is kept in check (shared test
fixtures, in `apps/web/src/geometry/panel.test.ts` and
`apps/api/tests/test_geometry.py`, assert the two implementations agree on
the same inputs).
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field


@dataclass(frozen=True)
class PanelResult:
    """Everything derived from one set of panel parameters."""

    finished_width_mm: float
    finished_height_mm: float
    finished_corner_radius_mm: float
    seam_allowance_mm: float

    cut_width_mm: float
    cut_height_mm: float
    cut_corner_radius_mm: float

    finished_area_cm2: float
    finished_perimeter_cm: float
    cut_area_cm2: float
    cut_perimeter_cm: float

    stitch_guide_path: str  # SVG path `d` attribute, in a 0,0-origin coord space
    cut_outline_path: str  # SVG path `d` attribute, same coord space
    viewbox_width_mm: float
    viewbox_height_mm: float

    warnings: list[str] = field(default_factory=list)


def _rounded_rect_path(x: float, y: float, w: float, h: float, r: float) -> str:
    """Return an SVG path `d` string for a rounded rectangle.

    Standard four-arc construction, starting just right of the top-left
    corner and running clockwise. `r` must already be clamped to
    `<= min(w, h) / 2` by the caller.
    """
    if r <= 0:
        return f"M {x},{y} H {x + w} V {y + h} H {x} Z"

    return (
        f"M {x + r},{y} "
        f"H {x + w - r} "
        f"A {r},{r} 0 0 1 {x + w},{y + r} "
        f"V {y + h - r} "
        f"A {r},{r} 0 0 1 {x + w - r},{y + h} "
        f"H {x + r} "
        f"A {r},{r} 0 0 1 {x},{y + h - r} "
        f"V {y + r} "
        f"A {r},{r} 0 0 1 {x + r},{y} "
        f"Z"
    )


def _rounded_rect_area_cm2(w_mm: float, h_mm: float, r_mm: float) -> float:
    """Area of a rounded rectangle, in cm^2. A true rect minus 4 corner
    squares of side r, plus one circle of radius r back in (the 4 quarter
    circles the rounding leaves behind)."""
    area_mm2 = (w_mm * h_mm) - (4 - math.pi) * (r_mm**2)
    return round(area_mm2 / 100.0, 2)


def _rounded_rect_perimeter_cm(w_mm: float, h_mm: float, r_mm: float) -> float:
    """Perimeter of a rounded rectangle, in cm. Four straight edges
    shortened by the rounding, plus the four corner arcs (which together
    make exactly one full circle of radius r)."""
    perimeter_mm = 2 * (w_mm + h_mm) - 8 * r_mm + 2 * math.pi * r_mm
    return round(perimeter_mm / 10.0, 2)


def generate_panel(
    finished_width_mm: float,
    finished_height_mm: float,
    corner_radius_mm: float = 0.0,
    seam_allowance_mm: float = 5.0,
) -> PanelResult:
    """Compute a full cutting pattern for a single rectangular-family panel
    (a bag body, pocket, gusset, or strap end — anything that reduces to a
    rounded rectangle with an optional seam allowance).

    Raises ValueError for parameters that can never produce a usable
    pattern (non-positive dimensions, negative allowance/radius) rather
    than silently clamping those — a clamp there would hide a real input
    mistake. Corner radius *too large* for the panel is different: it is a
    common, harmless slider overshoot, so it is clamped with a warning
    instead of rejected.
    """
    if finished_width_mm <= 0 or finished_height_mm <= 0:
        raise ValueError("finished_width_mm and finished_height_mm must be > 0")
    if seam_allowance_mm < 0:
        raise ValueError("seam_allowance_mm must be >= 0")
    if corner_radius_mm < 0:
        raise ValueError("corner_radius_mm must be >= 0")

    warnings: list[str] = []

    max_finished_radius = min(finished_width_mm, finished_height_mm) / 2
    finished_radius = corner_radius_mm
    if finished_radius > max_finished_radius:
        warnings.append(
            f"corner_radius_mm clamped from {corner_radius_mm} to "
            f"{round(max_finished_radius, 2)} (can't exceed half the shorter side)"
        )
        finished_radius = max_finished_radius

    cut_width = finished_width_mm + 2 * seam_allowance_mm
    cut_height = finished_height_mm + 2 * seam_allowance_mm
    # The cut line follows the stitch line outward by the seam allowance,
    # so its corner radius grows by the same amount — capped the same way.
    max_cut_radius = min(cut_width, cut_height) / 2
    cut_radius = min(finished_radius + seam_allowance_mm, max_cut_radius)

    viewbox_w = cut_width
    viewbox_h = cut_height

    # Stitch guide sits inset by the seam allowance inside the cut outline,
    # in the same coordinate space, so both can be drawn on one canvas.
    stitch_path = _rounded_rect_path(
        x=seam_allowance_mm,
        y=seam_allowance_mm,
        w=finished_width_mm,
        h=finished_height_mm,
        r=finished_radius,
    )
    cut_path = _rounded_rect_path(x=0, y=0, w=cut_width, h=cut_height, r=cut_radius)

    return PanelResult(
        finished_width_mm=finished_width_mm,
        finished_height_mm=finished_height_mm,
        finished_corner_radius_mm=round(finished_radius, 2),
        seam_allowance_mm=seam_allowance_mm,
        cut_width_mm=round(cut_width, 2),
        cut_height_mm=round(cut_height, 2),
        cut_corner_radius_mm=round(cut_radius, 2),
        finished_area_cm2=_rounded_rect_area_cm2(
            finished_width_mm, finished_height_mm, finished_radius
        ),
        finished_perimeter_cm=_rounded_rect_perimeter_cm(
            finished_width_mm, finished_height_mm, finished_radius
        ),
        cut_area_cm2=_rounded_rect_area_cm2(cut_width, cut_height, cut_radius),
        cut_perimeter_cm=_rounded_rect_perimeter_cm(cut_width, cut_height, cut_radius),
        stitch_guide_path=stitch_path,
        cut_outline_path=cut_path,
        viewbox_width_mm=round(viewbox_w, 2),
        viewbox_height_mm=round(viewbox_h, 2),
        warnings=warnings,
    )


def render_panel_svg(panel: PanelResult, label: str | None = None) -> str:
    """A standalone, printable SVG document for one panel: solid cut
    outline, dashed stitch guide, and a mm scale so it can be printed
    1:1 and checked with a ruler."""
    pad = 10
    w = panel.viewbox_width_mm + 2 * pad
    h = panel.viewbox_height_mm + 2 * pad
    label_svg = (
        f'<text x="{pad}" y="{pad - 3}" font-size="4" font-family="sans-serif">'
        f"{label}</text>"
        if label
        else ""
    )
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="{w}mm" height="{h}mm"
     viewBox="0 0 {w} {h}">
  <g transform="translate({pad},{pad})">
    <path d="{panel.cut_outline_path}" fill="none" stroke="#1a1a1a" stroke-width="0.4" />
    <path d="{panel.stitch_guide_path}" fill="none" stroke="#b5542d"
          stroke-width="0.3" stroke-dasharray="2,1.5" />
  </g>
  {label_svg}
</svg>"""
