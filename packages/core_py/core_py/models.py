"""SQLAlchemy ORM models shared by the API and the worker.

`Pattern.export_status` is the hinge of the async-export flow: the API
writes a row with status `pending` inside the same request that creates
it, and returns immediately; the worker is the only thing that ever moves
it to `ready` or `failed`. Neither service guesses at the other's
internal state — they agree only on this column.
"""

from __future__ import annotations

import enum
from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ExportStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    READY = "ready"
    FAILED = "failed"


class Pattern(Base):
    __tablename__ = "patterns"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    material: Mapped[str] = mapped_column(String(80), default="veg-tan leather")

    finished_width_mm: Mapped[float] = mapped_column(Float)
    finished_height_mm: Mapped[float] = mapped_column(Float)
    corner_radius_mm: Mapped[float] = mapped_column(Float, default=0.0)
    seam_allowance_mm: Mapped[float] = mapped_column(Float, default=5.0)

    cut_width_mm: Mapped[float] = mapped_column(Float)
    cut_height_mm: Mapped[float] = mapped_column(Float)
    finished_area_cm2: Mapped[float] = mapped_column(Float)
    finished_perimeter_cm: Mapped[float] = mapped_column(Float)

    stitch_guide_path: Mapped[str] = mapped_column(Text)
    cut_outline_path: Mapped[str] = mapped_column(Text)

    export_status: Mapped[str] = mapped_column(String(20), default=ExportStatus.PENDING.value)
    svg_export_path: Mapped[str | None] = mapped_column(String(255), nullable=True)
    pdf_export_path: Mapped[str | None] = mapped_column(String(255), nullable=True)
    export_error: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    orders: Mapped[list["Order"]] = relationship(back_populates="pattern")


class OrderStatus(str, enum.Enum):
    RECEIVED = "received"
    IN_PRODUCTION = "in_production"
    SHIPPED = "shipped"


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    pattern_id: Mapped[int] = mapped_column(ForeignKey("patterns.id"))
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    customer_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default=OrderStatus.RECEIVED.value)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    pattern: Mapped["Pattern"] = relationship(back_populates="orders")

    @property
    def pattern_name(self) -> str:
        return self.pattern.name
