from __future__ import annotations

import os

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from core_py import geometry
from core_py.db import SessionLocal
from core_py.models import Pattern, Order

from ..events import enqueue_export_job
from ..schemas import PatternCreate, PatternList, PatternOut

router = APIRouter(prefix="/api/v1/patterns", tags=["patterns"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("", response_model=PatternOut, status_code=201)
def create_pattern(payload: PatternCreate, db: Session = Depends(get_db)):
    """Create a pattern. Geometry is computed synchronously (it's cheap —
    pure arithmetic) so the response already contains an accurate SVG path
    the frontend can draw immediately; the *export files* (SVG/PDF on
    disk, suitable for printing or attaching to an order) are generated
    asynchronously by the worker, which is the slower, I/O-bound part."""
    try:
        panel = geometry.generate_panel(
            finished_width_mm=payload.finished_width_mm,
            finished_height_mm=payload.finished_height_mm,
            corner_radius_mm=payload.corner_radius_mm,
            seam_allowance_mm=payload.seam_allowance_mm,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    pattern = Pattern(
        name=payload.name,
        material=payload.material,
        finished_width_mm=payload.finished_width_mm,
        finished_height_mm=payload.finished_height_mm,
        corner_radius_mm=panel.finished_corner_radius_mm,
        seam_allowance_mm=payload.seam_allowance_mm,
        cut_width_mm=panel.cut_width_mm,
        cut_height_mm=panel.cut_height_mm,
        finished_area_cm2=panel.finished_area_cm2,
        finished_perimeter_cm=panel.finished_perimeter_cm,
        stitch_guide_path=panel.stitch_guide_path,
        cut_outline_path=panel.cut_outline_path,
    )
    db.add(pattern)
    db.commit()
    db.refresh(pattern)

    enqueue_export_job(pattern.id)
    # If Redis was unreachable, enqueue_export_job already ran the export
    # inline (via a separate DB session) before returning — refresh so the
    # response reflects that rather than the stale pre-export row. When a
    # real queue picked it up, this is a no-op: still "pending", correctly.
    db.refresh(pattern)

    return pattern


@router.get("", response_model=PatternList)
def list_patterns(
    db: Session = Depends(get_db),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    q: str = Query("", max_length=120),
):
    query = db.query(Pattern)
    if q.strip():
        query = query.filter(Pattern.name.icontains(q.strip(), autoescape=True))
    total = query.count()
    items = query.order_by(Pattern.id.desc()).offset(offset).limit(limit).all()
    return PatternList(items=items, total=total)


@router.get("/{pattern_id}", response_model=PatternOut)
def get_pattern(pattern_id: int, db: Session = Depends(get_db)):
    pattern = db.get(Pattern, pattern_id)
    if pattern is None:
        raise HTTPException(status_code=404, detail="pattern not found")
    return pattern


@router.delete("/{pattern_id}", status_code=204)
def delete_pattern(pattern_id: int, db: Session = Depends(get_db)):
    pattern = db.get(Pattern, pattern_id)
    if pattern is None:
        raise HTTPException(404, "pattern not found")
    if pattern.export_status in ("pending", "processing"):
        raise HTTPException(409, "Wait until the export finishes before deleting this pattern.")
    if db.query(Order).filter(Order.pattern_id == pattern_id).first():
        raise HTTPException(
            409, "This pattern is linked to an order and must be kept for production history."
        )
    paths = [pattern.svg_export_path, pattern.pdf_export_path]
    db.delete(pattern)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            409, "This pattern is linked to an order and must be kept for production history."
        ) from exc
    for path in paths:
        if path:
            try:
                os.remove(path)
            except FileNotFoundError:
                pass
    return Response(status_code=204)


@router.post("/{pattern_id}/retry-export", response_model=PatternOut)
def retry_export(pattern_id: int, db: Session = Depends(get_db)):
    pattern = db.get(Pattern, pattern_id)
    if pattern is None:
        raise HTTPException(404, "pattern not found")
    if pattern.export_status != "failed":
        raise HTTPException(409, "Only failed exports can be retried.")
    pattern.export_status = "pending"
    pattern.export_error = None
    db.commit()
    enqueue_export_job(pattern_id)
    db.refresh(pattern)
    return pattern


@router.get("/{pattern_id}/export.svg")
def get_pattern_svg(pattern_id: int, db: Session = Depends(get_db)):
    pattern = db.get(Pattern, pattern_id)
    if pattern is None:
        raise HTTPException(status_code=404, detail="pattern not found")
    if (
        pattern.export_status != "ready"
        or not pattern.svg_export_path
        or not os.path.exists(pattern.svg_export_path)
    ):
        raise HTTPException(
            status_code=409,
            detail=f"export not ready yet (status={pattern.export_status})",
        )
    return FileResponse(
        pattern.svg_export_path,
        media_type="image/svg+xml",
        filename=f"pattern-{pattern_id}.svg",
        content_disposition_type="inline",
    )


@router.get("/{pattern_id}/export.pdf")
def get_pattern_pdf(pattern_id: int, db: Session = Depends(get_db)):
    pattern = db.get(Pattern, pattern_id)
    if pattern is None:
        raise HTTPException(status_code=404, detail="pattern not found")
    if (
        pattern.export_status != "ready"
        or not pattern.pdf_export_path
        or not os.path.exists(pattern.pdf_export_path)
    ):
        raise HTTPException(
            status_code=409,
            detail=f"export not ready yet (status={pattern.export_status})",
        )
    return FileResponse(
        pattern.pdf_export_path,
        media_type="application/pdf",
        filename=f"pattern-{pattern_id}.pdf",
        content_disposition_type="inline",
    )
