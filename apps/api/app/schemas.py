"""Pydantic request/response schemas.

Kept separate from the SQLAlchemy models on purpose: the API's public
contract (what a client can send and what it gets back) and the storage
shape are allowed to drift from each other without that becoming a
breaking change for clients — see `docs/API.md` for the versioning
rationale.
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import Literal


class PatternCreate(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False, extra="forbid")
    name: str = Field(min_length=1, max_length=120, examples=["Crossbody strap, 25mm"])
    material: str = Field(default="veg-tan leather", max_length=80)
    finished_width_mm: float = Field(gt=0, le=2000)
    finished_height_mm: float = Field(gt=0, le=2000)
    corner_radius_mm: float = Field(default=0.0, ge=0, le=1000)
    seam_allowance_mm: float = Field(default=5.0, ge=0, le=50)

    @field_validator("name", "material")
    @classmethod
    def strip_name(cls, v: str) -> str:
        v = v.strip()
        if any(ord(char) < 32 for char in v):
            raise ValueError("Control characters are not allowed")
        if not v:
            raise ValueError("name cannot be blank")
        return v


class PatternOut(BaseModel):
    id: int
    name: str
    material: str

    finished_width_mm: float
    finished_height_mm: float
    corner_radius_mm: float
    seam_allowance_mm: float

    cut_width_mm: float
    cut_height_mm: float
    finished_area_cm2: float
    finished_perimeter_cm: float

    stitch_guide_path: str
    cut_outline_path: str

    export_status: str
    svg_export_path: str | None = None
    pdf_export_path: str | None = None
    export_error: str | None = None

    created_at: datetime

    model_config = {"from_attributes": True}


class PatternList(BaseModel):
    items: list[PatternOut]
    total: int


class OrderCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    pattern_id: int = Field(gt=0)
    quantity: int = Field(default=1, ge=1, le=10_000)
    customer_note: str | None = Field(default=None, max_length=500)


class OrderOut(BaseModel):
    id: int
    pattern_name: str
    pattern_id: int
    quantity: int
    customer_note: str | None
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class OrderList(BaseModel):
    items: list[OrderOut]
    total: int


class OrderUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: Literal["received", "in_production", "shipped"]


class ErrorResponse(BaseModel):
    """The one error shape every endpoint returns on failure — see
    docs/API.md ('Error shape'). A thin, consistent envelope is easier for
    `apps/web` and `apps/mobile_flutter` to handle than a different shape
    per error type."""

    error: str
    detail: str | None = None
