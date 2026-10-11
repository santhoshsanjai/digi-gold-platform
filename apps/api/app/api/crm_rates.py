"""Daily gold rate entry, with guards against typing mistakes."""

from datetime import datetime
from decimal import Decimal
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, select

from app.api.common import Limit, Offset, Page
from app.core.deps import Session, Staff, require
from app.models import GoldRate, Tenant
from app.schemas.tenant_config import SchemeSettings, merged
from app.services import audit
from app.services.gold_math import change_pct
from app.services.rates import buying_status, latest_rate

router = APIRouter(prefix="/crm/rates", tags=["crm gold rate"])


class RateIn(BaseModel):
    purity: Literal["22K", "24K"]
    rate_per_gram: Decimal = Field(gt=0, le=1_000_000, max_digits=12, decimal_places=2)
    confirm_large_change: bool = False


class RateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    purity: str
    rate_per_gram: Decimal
    change_pct: Decimal | None
    large_change_confirmed: bool
    entered_by: UUID | None
    created_at: datetime


class CurrentRatesOut(BaseModel):
    scheme_purity: str
    rates: dict[str, RateOut | None]
    buying_open: bool
    buying_paused: bool
    reason: str


class PauseIn(BaseModel):
    paused: bool
    reason: str = Field("", max_length=200)


async def _current(session, tenant: Tenant) -> CurrentRatesOut:
    scheme = merged(SchemeSettings, tenant.settings)
    status = await buying_status(session, tenant, scheme)
    rates = {p: await latest_rate(session, tenant.id, p) for p in ("22K", "24K")}
    return CurrentRatesOut(
        scheme_purity=scheme.purity,
        rates={p: RateOut.model_validate(r) if r else None for p, r in rates.items()},
        buying_open=status.open,
        buying_paused=tenant.buying_paused,
        reason=status.reason,
    )


@router.get("/current", response_model=CurrentRatesOut)
async def current_rates(staff: Annotated[Staff, Depends(require("rates:view"))], session: Session):
    return await _current(session, await session.get(Tenant, staff.tenant_id))


@router.get("", response_model=Page[RateOut])
async def rate_history(
    staff: Annotated[Staff, Depends(require("rates:view"))],
    session: Session,
    purity: Literal["22K", "24K"] | None = None,
    limit: Limit = 30,
    offset: Offset = 0,
):
    query = select(GoldRate).where(GoldRate.tenant_id == staff.tenant_id)
    if purity:
        query = query.where(GoldRate.purity == purity)
    total = await session.scalar(select(func.count()).select_from(query.subquery()))
    rows = await session.scalars(
        query.order_by(GoldRate.created_at.desc()).limit(limit).offset(offset)
    )
    return Page(items=list(rows), total=total, limit=limit, offset=offset)


@router.post("", response_model=RateOut, status_code=201, responses={409: {}})
async def publish_rate(
    body: RateIn, staff: Annotated[Staff, Depends(require("rates:create"))], session: Session
):
    """Publish a new rate. A change larger than the configured percentage is refused
    unless confirm_large_change is sent, so a typo cannot sell gold at the wrong price."""
    tenant = await session.get(Tenant, staff.tenant_id)
    scheme = merged(SchemeSettings, tenant.settings)
    previous = await latest_rate(session, tenant.id, body.purity)
    pct = change_pct(previous.rate_per_gram, body.rate_per_gram) if previous else None
    large = pct is not None and abs(pct) > scheme.rate_change_confirm_pct
    if large and not body.confirm_large_change:
        return JSONResponse(
            status_code=409,
            content={
                "detail": "this rate differs a lot from the previous one; confirm to publish",
                "code": "confirm_large_change",
                "previous_rate": str(previous.rate_per_gram),
                "change_pct": str(pct),
            },
        )
    rate = GoldRate(
        tenant_id=tenant.id,
        purity=body.purity,
        rate_per_gram=body.rate_per_gram,
        entered_by=staff.user.id,
        change_pct=pct,
        large_change_confirmed=large,
    )
    session.add(rate)
    await session.flush()
    await session.refresh(rate)
    audit.record(
        session,
        tenant_id=tenant.id,
        actor_id=staff.user.id,
        action="rate.published",
        entity_type="gold_rate",
        entity_id=rate.id,
        changes={
            "purity": body.purity,
            "rate_per_gram": str(body.rate_per_gram),
            "previous": str(previous.rate_per_gram) if previous else None,
        },
    )
    return rate


@router.post("/pause", response_model=CurrentRatesOut)
async def pause_buying(
    body: PauseIn, staff: Annotated[Staff, Depends(require("rates:edit"))], session: Session
):
    """Stop or restart all buying in the app at once."""
    tenant = await session.get(Tenant, staff.tenant_id)
    if tenant.buying_paused == body.paused:
        raise HTTPException(409, "buying is already " + ("paused" if body.paused else "open"))
    tenant.buying_paused = body.paused
    audit.record(
        session,
        tenant_id=tenant.id,
        actor_id=staff.user.id,
        action="buying.paused" if body.paused else "buying.resumed",
        entity_type="tenant",
        entity_id=tenant.id,
        changes={"reason": body.reason},
    )
    return await _current(session, tenant)
