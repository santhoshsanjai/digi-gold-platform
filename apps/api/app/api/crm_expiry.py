"""Lots close to or past their 365-day limit, highlighted for the client."""

from datetime import datetime, timedelta
from decimal import Decimal
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select

from app.api.common import Limit, Offset, Page
from app.core.clock import local_date, start_of_day, today
from app.core.deps import Session, Staff, require
from app.models import Customer, GoldLot, Tenant
from app.schemas.tenant_config import SchemeSettings, merged
from app.services import audit
from app.services.ledger import RedemptionRefused, refund_lot

router = APIRouter(prefix="/crm", tags=["crm expiry"])


class ExpiringLotOut(BaseModel):
    lot_id: UUID
    customer_id: UUID
    customer_name: str
    customer_phone: str
    grams: Decimal
    amount_inr: Decimal
    paid_at: datetime
    expires_at: datetime
    days_left: int
    last_reminded_on: str | None


class RefundIn(BaseModel):
    note: str = Field(min_length=3, max_length=300, description="How the money was returned")


@router.get("/expiry", response_model=Page[ExpiringLotOut])
async def expiring_lots(
    staff: Annotated[Staff, Depends(require("expiry:view"))],
    session: Session,
    state: Literal["expired", "expiring"] = "expired",
    within_days: int = 30,
    limit: Limit = 50,
    offset: Offset = 0,
):
    """Expired lots (oldest first), or lots expiring within the next N days."""
    start = start_of_day(today())
    query = (
        select(GoldLot, Customer)
        .join(Customer, Customer.id == GoldLot.customer_id)
        .where(GoldLot.tenant_id == staff.tenant_id, GoldLot.status == "open")
    )
    if state == "expired":
        query = query.where(GoldLot.expires_at < start + timedelta(days=1))
    else:
        query = query.where(
            GoldLot.expires_at >= start + timedelta(days=1),
            GoldLot.expires_at < start + timedelta(days=within_days + 1),
        )
    total = await session.scalar(select(func.count()).select_from(query.subquery()))
    rows = await session.execute(query.order_by(GoldLot.expires_at).limit(limit).offset(offset))
    items = [
        ExpiringLotOut(
            lot_id=lot.id,
            customer_id=customer.id,
            customer_name=customer.name,
            customer_phone=customer.phone,
            grams=lot.grams,
            amount_inr=lot.amount_inr,
            paid_at=lot.paid_at,
            expires_at=lot.expires_at,
            days_left=(local_date(lot.expires_at) - today()).days,
            last_reminded_on=lot.last_reminded_on.isoformat() if lot.last_reminded_on else None,
        )
        for lot, customer in rows
    ]
    return Page(items=items, total=total, limit=limit, offset=offset)


@router.post("/lots/{lot_id}/refund", status_code=204)
async def refund(
    lot_id: UUID,
    body: RefundIn,
    staff: Annotated[Staff, Depends(require("expiry:edit"))],
    session: Session,
):
    """Record a refund already paid to the customer. Off unless the client turns it on."""
    tenant = await session.get(Tenant, staff.tenant_id)
    if not merged(SchemeSettings, tenant.settings).manual_refund_enabled:
        raise HTTPException(403, "manual refunds are switched off in settings")
    lot = await session.get(GoldLot, lot_id)
    if lot is None or lot.tenant_id != tenant.id:
        raise HTTPException(404, "lot not found")
    try:
        await refund_lot(session, lot, staff.user.id, body.note)
    except RedemptionRefused as e:
        raise HTTPException(409, str(e)) from None
    audit.record(
        session,
        tenant_id=tenant.id,
        actor_id=staff.user.id,
        action="lot.refunded",
        entity_type="gold_lot",
        entity_id=lot.id,
        changes={"grams": str(lot.grams), "amount_inr": str(lot.amount_inr), "note": body.note},
    )
