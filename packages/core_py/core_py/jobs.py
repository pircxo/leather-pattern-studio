"""The one background job in this system: render a pattern's SVG and PDF
exports and write the result back onto the `Pattern` row.

This function is the actual payload enqueued onto the Redis queue (see
`apps/api/app/events.py`) and it is also what `apps/worker/worker.py` calls
when it pops a job off that queue. It never imports anything from
`apps/api` or `apps/worker` — only from this shared package — which is
what lets the worker run as a separate process/container with no
dependency on the FastAPI app at all.
"""

from __future__ import annotations

import logging
import os
import tempfile

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

from . import geometry
from .db import session_scope
from .models import ExportStatus, Pattern

logger = logging.getLogger("lps.jobs")

EXPORTS_DIR = os.environ.get(
    "EXPORTS_DIR", os.path.join(tempfile.gettempdir(), "lps-exports")
)


def _write_pdf(panel: geometry.PanelResult, out_path: str, label: str) -> None:
    c = canvas.Canvas(out_path, pagesize=A4)
    page_w, page_h = A4
    margin = 20 * mm

    c.setFont("Helvetica", 10)
    c.drawString(margin, page_h - margin + 4 * mm, f"Leather Pattern Studio — {label}")
    c.setFont("Helvetica", 7)
    c.drawString(
        margin,
        page_h - margin,
        f"Finished {panel.finished_width_mm}x{panel.finished_height_mm}mm   "
        f"Seam allowance {panel.seam_allowance_mm}mm   "
        f"Cut size {panel.cut_width_mm}x{panel.cut_height_mm}mm",
    )

    # Origin for the drawing, below the header text.
    origin_x = margin
    origin_y = page_h - margin - 10 * mm - panel.cut_height_mm * mm

    c.setStrokeColorRGB(0.1, 0.1, 0.1)
    c.setLineWidth(0.6)
    c.roundRect(
        origin_x,
        origin_y,
        panel.cut_width_mm * mm,
        panel.cut_height_mm * mm,
        panel.cut_corner_radius_mm * mm,
        stroke=1,
        fill=0,
    )

    c.setStrokeColorRGB(0.71, 0.33, 0.18)
    c.setDash(2, 1.5)
    c.setLineWidth(0.4)
    inset = panel.seam_allowance_mm * mm
    c.roundRect(
        origin_x + inset,
        origin_y + inset,
        panel.finished_width_mm * mm,
        panel.finished_height_mm * mm,
        panel.finished_corner_radius_mm * mm,
        stroke=1,
        fill=0,
    )

    c.showPage()
    c.save()


def export_job(pattern_id: int) -> None:
    """Render exports for one pattern and persist the result. Safe to
    retry: it always recomputes from the stored parameters and overwrites
    whatever partial output a previous attempt left behind."""
    os.makedirs(EXPORTS_DIR, exist_ok=True)

    with session_scope() as db:
        pattern = db.get(Pattern, pattern_id)
        if pattern is None:
            logger.warning("export_job: pattern %s no longer exists, skipping", pattern_id)
            return

        pattern.export_status = ExportStatus.PROCESSING.value
        db.flush()

        try:
            panel = geometry.generate_panel(
                finished_width_mm=pattern.finished_width_mm,
                finished_height_mm=pattern.finished_height_mm,
                corner_radius_mm=pattern.corner_radius_mm,
                seam_allowance_mm=pattern.seam_allowance_mm,
            )

            svg_path = os.path.join(EXPORTS_DIR, f"pattern-{pattern_id}.svg")
            pdf_path = os.path.join(EXPORTS_DIR, f"pattern-{pattern_id}.pdf")

            with open(svg_path, "w", encoding="utf-8") as f:
                f.write(geometry.render_panel_svg(panel, label=pattern.name))

            _write_pdf(panel, pdf_path, label=pattern.name)

            pattern.svg_export_path = svg_path
            pattern.pdf_export_path = pdf_path
            pattern.export_status = ExportStatus.READY.value
            pattern.export_error = None
        except Exception as exc:  # noqa: BLE001 — a failed export must not crash the worker
            logger.exception("export_job failed for pattern %s", pattern_id)
            pattern.export_status = ExportStatus.FAILED.value
            pattern.export_error = str(exc)
