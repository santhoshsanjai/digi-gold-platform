from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.clock import local_date, local_now
from app.models import GoldRate, Tenant
from app.schemas.tenant_config import SchemeSettings


async def latest_rate(session: AsyncSession, tenant_id: UUID, purity: str) -> GoldRate | None:
    return await session.scalar(
        select(GoldRate)
        .where(GoldRate.tenant_id == tenant_id, GoldRate.purity == purity)
        .order_by(GoldRate.created_at.desc())
        .limit(1)
    )


@dataclass(frozen=True)
class BuyingStatus:
    rate: GoldRate | None
    open: bool
    reason: str = ""


async def buying_status(
    session: AsyncSession, tenant: Tenant, scheme: SchemeSettings
) -> BuyingStatus:
    """Whether customers can buy right now, and at which rate.

    Buying stops when staff pause it, when no rate exists, or when today's rate has not
    been entered by the daily deadline (yesterday's rate is never sold after it).
    """
    rate = await latest_rate(session, tenant.id, scheme.purity)
    if tenant.buying_paused:
        return BuyingStatus(rate, False, "buying is paused by the store")
    if rate is None:
        return BuyingStatus(None, False, "no gold rate has been published yet")
    current = local_now()
    if (
        local_date(rate.created_at) < current.date()
        and current.time() >= scheme.daily_rate_deadline
    ):
        return BuyingStatus(rate, False, "today's gold rate has not been published yet")
    return BuyingStatus(rate, True)
