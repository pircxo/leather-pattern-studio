from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from core_py.db import SessionLocal
from core_py.models import Order, Pattern

from ..schemas import OrderCreate, OrderOut

router = APIRouter(prefix="/api/v1/orders", tags=["orders"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("", response_model=OrderOut, status_code=201)
def create_order(payload: OrderCreate, db: Session = Depends(get_db)):
    """An order references a pattern by id — this is the one place the
    'product' side of the system (patterns) and the 'commerce' side
    (orders) integrate. In a bigger version of this system these would
    likely be two separate services talking over this same kind of
    foreign reference plus an event ('pattern.ready' -> order fulfillment
    can proceed), rather than two tables in one database — see
    ARCHITECTURE.md."""
    pattern = db.get(Pattern, payload.pattern_id)
    if pattern is None:
        raise HTTPException(status_code=404, detail="pattern not found")

    order = Order(
        pattern_id=payload.pattern_id,
        quantity=payload.quantity,
        customer_note=payload.customer_note,
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    return order


@router.get("/{order_id}", response_model=OrderOut)
def get_order(order_id: int, db: Session = Depends(get_db)):
    order = db.get(Order, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="order not found")
    return order
