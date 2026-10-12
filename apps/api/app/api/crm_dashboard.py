from datetime import timedelta
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select

from app.core.clock import start_of_day, today
from app.core.deps import Session, Staff, require
from app.models import Customer, GoldLot, PaymentOrder, Tenant
from app.schemas.tenant_config import SchemeSettings, merged
from app.services.rates import buying_status

router = APIRouter(prefix="/crm/dashboard", tags=["crm dashboard"])


class DashboardOut(BaseModel):
    customers: int
    outstanding_grams: Decimal
    outstanding_value_inr: Decimal | None
    rate_per_gram: Decimal | None
    purity: str
    buying_open: bool
    buying_reason: str
    collections_today_inr: Decimal
    payments_today: int
    lots_expiring_30_days: int
    lots_expired: int


@router.get("", response_model=DashboardOut)
async def dashboard(staff: Annotated[Staff, Depends(require("dashboard:view"))], session: Session):
    """Outstanding grams are what the jeweller owes customers; their value at today's rate
    shows the exposure to gold price changes."""
    tenant = await session.get(Tenant, staff.tenant_id)
    scheme = merged(SchemeSettings, tenant.settings)
    status = await buying_status(session, tenant, scheme)
    customers, grams = (
        await session.execute(
            select(func.count(), func.coalesce(func.sum(Customer.gold_grams), 0)).where(
                Customer.tenant_id == tenant.id
            )
        )
    ).one()
    day = start_of_day(today())
    collected, payments = (
        await session.execute(
            select(func.coalesce(func.sum(PaymentOrder.amount_inr), 0), func.count()).where(
                PaymentOrder.tenant_id == tenant.id,
                PaymentOrder.status == "paid",
                PaymentOrder.paid_at >= day,
            )
        )
    ).one()
    open_lots = select(func.count()).where(GoldLot.tenant_id == tenant.id, GoldLot.status == "open")
    tomorrow = day + timedelta(days=1)
    expired = await session.scalar(open_lots.where(GoldLot.expires_at < tomorrow))
    expiring = await session.scalar(
        open_lots.where(
            GoldLot.expires_at >= tomorrow, GoldLot.expires_at < tomorrow + timedelta(days=30)
        )
    )
    rate = status.rate.rate_per_gram if status.rate else None
    return DashboardOut(
        customers=customers,
        outstanding_grams=grams,
        outstanding_value_inr=(grams * rate).quantize(Decimal("0.01")) if rate else None,
        rate_per_gram=rate,
        purity=scheme.purity,
        buying_open=status.open,
        buying_reason=status.reason,
        collections_today_inr=collected,
        payments_today=payments,
        lots_expiring_30_days=expiring,
        lots_expired=expired,
    )
