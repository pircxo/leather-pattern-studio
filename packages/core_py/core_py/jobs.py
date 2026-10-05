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
import math
import os
import tempfile

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

from . import geometry
from .db import session_scope
from .models import ExportStatus, Pattern

logger = logging.getLogger("lps.jobs")

EXPORTS_DIR = os.environ.get("EXPORTS_DIR", os.path.join(tempfile.gettempdir(), "lps-exports"))


TILE_WIDTH_MM = 190
TILE_HEIGHT_MM = 250
TILE_OVERLAP_MM = 10


def tile_layout(panel: geometry.PanelResult) -> tuple[int, int]:
    """Include 2mm padding around the knife line so strokes are never clipped."""
    cols = max(
        1, math.ceil((panel.cut_width_mm + 4 - TILE_OVERLAP_MM) / (TILE_WIDTH_MM - TILE_OVERLAP_MM))
    )
    rows = max(
        1,
        math.ceil((panel.cut_height_mm + 4 - TILE_OVERLAP_MM) / (TILE_HEIGHT_MM - TILE_OVERLAP_MM)),
    )
    return cols, rows


def _write_pdf(panel: geometry.PanelResult, out_path: str, label: str) -> None:
    """Tile at 1:1 scale onto A4, with overlap, assembly coordinates and a ruler."""
    c = canvas.Canvas(out_path, pagesize=A4)
    c.setTitle(f"Leather Pattern Studio - {label}")
    cols, rows = tile_layout(panel)
    for row in range(rows):
        for col in range(cols):
            c.setFillColorRGB(1, 1, 1)
            c.rect(0, 0, *A4, fill=1, stroke=0)
            c.setFillColorRGB(0.1, 0.1, 0.1)
            c.setFont("Helvetica-Bold", 10)
            title = f"Leather Pattern Studio - {label}"
            while c.stringWidth(title, "Helvetica-Bold", 10) > 190 * mm:
                title = title[:-4] + "..."
            c.drawString(10 * mm, 285 * mm, title)
            c.setFont("Helvetica", 7)
            c.drawString(
                10 * mm,
                279 * mm,
                f"Cut {panel.cut_width_mm:g} x {panel.cut_height_mm:g} mm | "
                f"Seam {panel.seam_allowance_mm:g} mm | "
                f"Row {row + 1}/{rows}, column {col + 1}/{cols}",
            )
            x, y, w, h = 10 * mm, 25 * mm, TILE_WIDTH_MM * mm, TILE_HEIGHT_MM * mm
            c.setStrokeColorRGB(0.7, 0.7, 0.7)
            c.setLineWidth(0.25)
            c.rect(x, y, w, h)
            c.saveState()
            clip = c.beginPath()
            clip.rect(x, y, w, h)
            c.clipPath(clip, stroke=0)
            origin_x = x + (2 - col * (TILE_WIDTH_MM - TILE_OVERLAP_MM)) * mm
            origin_y = (
                y + h - (2 + panel.cut_height_mm - row * (TILE_HEIGHT_MM - TILE_OVERLAP_MM)) * mm
            )
            c.setStrokeColorRGB(0.1, 0.1, 0.1)
            c.setLineWidth(0.4 * mm)
            c.roundRect(
                origin_x,
                origin_y,
                panel.cut_width_mm * mm,
                panel.cut_height_mm * mm,
                panel.cut_corner_radius_mm * mm,
                stroke=1,
                fill=0,
            )
            c.setStrokeColorRGB(0.55, 0.25, 0.13)
            c.setDash(2 * mm, 1.5 * mm)
            c.setLineWidth(0.3 * mm)
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
            c.restoreState()
            c.setStrokeColorRGB(0.1, 0.1, 0.1)
            c.setLineWidth(0.5)
            c.line(10 * mm, 14 * mm, 60 * mm, 14 * mm)
            for tick in range(6):
                tx = (10 + tick * 10) * mm
                c.line(tx, 12 * mm, tx, 16 * mm)
            c.setFont("Helvetica", 7)
            c.drawString(10 * mm, 8 * mm, "50 mm scale check - print at 100% / actual size")
            c.drawRightString(200 * mm, 15 * mm, f"Page {row * cols + col + 1} of {rows * cols}")
            c.drawRightString(
                200 * mm, 8 * mm, "Trim frame; align the 10 mm overlap between sheets"
            )
            c.showPage()
    c.save()


def _write_svg(panel: geometry.PanelResult, path: str, label: str) -> None:
    with open(path, "w", encoding="utf-8") as stream:
        stream.write(geometry.render_panel_svg(panel, label=label))


def write_export_files(pattern: Pattern) -> tuple[str, str]:
    """Render a pattern's SVG and PDF from its stored parameters into
    EXPORTS_DIR and return their paths. Each file is written to a temporary
    name and atomically moved into place, so a reader never sees a
    partially written export."""
    os.makedirs(EXPORTS_DIR, exist_ok=True)
    panel = geometry.generate_panel(
        finished_width_mm=pattern.finished_width_mm,
        finished_height_mm=pattern.finished_height_mm,
        corner_radius_mm=pattern.corner_radius_mm,
        seam_allowance_mm=pattern.seam_allowance_mm,
    )
    svg_path = os.path.join(EXPORTS_DIR, f"pattern-{pattern.id}.svg")
    pdf_path = os.path.join(EXPORTS_DIR, f"pattern-{pattern.id}.pdf")
    for target, render in (
        (svg_path, lambda path: _write_svg(panel, path, pattern.name)),
        (pdf_path, lambda path: _write_pdf(panel, path, pattern.name)),
    ):
        fd, temporary = tempfile.mkstemp(dir=EXPORTS_DIR)
        os.close(fd)
        try:
            render(temporary)
            os.replace(temporary, target)
        finally:
            if os.path.exists(temporary):
                os.remove(temporary)
    return svg_path, pdf_path


def export_job(pattern_id: int) -> None:
    """Render exports for one pattern and persist the result. Safe to
    retry: it always recomputes from the stored parameters and overwrites
    whatever partial output a previous attempt left behind."""
    with session_scope() as db:
        pattern = db.get(Pattern, pattern_id)
        if pattern is None:
            logger.warning("export_job: pattern %s no longer exists, skipping", pattern_id)
            return

        pattern.export_status = ExportStatus.PROCESSING.value
        db.commit()

        try:
            svg_path, pdf_path = write_export_files(pattern)

            pattern.svg_export_path = svg_path
            pattern.pdf_export_path = pdf_path
            pattern.export_status = ExportStatus.READY.value
            pattern.export_error = None
        except Exception as exc:  # noqa: BLE001 — a failed export must not crash the worker
            logger.exception("export_job failed for pattern %s", pattern_id)
            pattern.export_status = ExportStatus.FAILED.value
            pattern.export_error = str(exc)


def mark_export_failed(pattern_id: int, message: str) -> None:
    """Record a failure that happened outside `export_job` itself — e.g. the
    worker process running it was killed — so the pattern doesn't sit in
    `pending`/`processing` forever and can be retried from the library."""
    with session_scope() as db:
        pattern = db.get(Pattern, pattern_id)
        if pattern is None or pattern.export_status == ExportStatus.READY.value:
            return
        pattern.export_status = ExportStatus.FAILED.value
        pattern.export_error = message
