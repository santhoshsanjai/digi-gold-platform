"""Customers and payments as the jeweller's staff see them."""

from datetime import datetime
from decimal import Decimal
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy import func, or_, select

from app.api.app_gold import LedgerOut, LotOut
from app.api.common import Limit, Offset, Page
from app.core.deps import Session, Staff, require
from app.models import Customer, GoldLot, LedgerEntry, PaymentOrder

router = APIRouter(prefix="/crm", tags=["crm customers"])


class CustomerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    phone: str
    name: str
    email: str
    pan: str | None
    pan_verified: bool
    is_active: bool
    gold_grams: Decimal
    rupee_balance_inr: Decimal
    total_paid_inr: Decimal
    last_login_at: datetime | None
    created_at: datetime


class CustomerDetailOut(BaseModel):
    customer: CustomerOut
    open_lots: list[LotOut]
    recent_entries: list[LedgerOut]


class PaymentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    customer_id: UUID
    amount_inr: Decimal
    purity: str
    rate_per_gram: Decimal
    quoted_grams: Decimal
    status: str
    provider: str
    provider_payment_id: str
    failure_reason: str
    paid_at: datetime | None
    created_at: datetime


@router.get("/customers", response_model=Page[CustomerOut])
async def list_customers(
    staff: Annotated[Staff, Depends(require("customers:view"))],
    session: Session,
    q: str | None = None,
    limit: Limit = 20,
    offset: Offset = 0,
):
    """Search by phone (any part) or name."""
    query = select(Customer).where(Customer.tenant_id == staff.tenant_id)
    if q:
        term = q.strip().lower()
        query = query.where(
            or_(Customer.phone.contains(term), func.lower(Customer.name).contains(term))
        )
    total = await session.scalar(select(func.count()).select_from(query.subquery()))
    rows = await session.scalars(
        query.order_by(Customer.created_at.desc()).limit(limit).offset(offset)
    )
    return Page(items=list(rows), total=total, limit=limit, offset=offset)


@router.get("/customers/{customer_id}", response_model=CustomerDetailOut)
async def customer_detail(
    customer_id: UUID,
    staff: Annotated[Staff, Depends(require("customers:view"))],
    session: Session,
):
    customer = await session.get(Customer, customer_id)
    if customer is None or customer.tenant_id != staff.tenant_id:
        raise HTTPException(404, "customer not found")
    lots = await session.scalars(
        select(GoldLot)
        .where(GoldLot.customer_id == customer.id, GoldLot.status == "open")
        .order_by(GoldLot.expires_at)
    )
    entries = await session.scalars(
        select(LedgerEntry)
        .where(LedgerEntry.customer_id == customer.id)
        .order_by(LedgerEntry.created_at.desc())
        .limit(20)
    )
    return CustomerDetailOut(
        customer=CustomerOut.model_validate(customer),
        open_lots=[LotOut.model_validate(lot) for lot in lots],
        recent_entries=[LedgerOut.model_validate(e) for e in entries],
    )


@router.get("/payments", response_model=Page[PaymentOut])
async def list_payments(
    staff: Annotated[Staff, Depends(require("payments:view"))],
    session: Session,
    status: Literal["created", "pending", "paid", "failed"] | None = None,
    customer_id: UUID | None = None,
    limit: Limit = 20,
    offset: Offset = 0,
):
    query = select(PaymentOrder).where(PaymentOrder.tenant_id == staff.tenant_id)
    if status:
        query = query.where(PaymentOrder.status == status)
    if customer_id:
        query = query.where(PaymentOrder.customer_id == customer_id)
    total = await session.scalar(select(func.count()).select_from(query.subquery()))
    rows = await session.scalars(
        query.order_by(PaymentOrder.created_at.desc()).limit(limit).offset(offset)
    )
    return Page(items=list(rows), total=total, limit=limit, offset=offset)
