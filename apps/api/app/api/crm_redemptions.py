"""In-store redemption: staff take the customer's code and close the whole balance."""

from datetime import datetime
from decimal import Decimal
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import func, select

from app.api.common import Limit, Offset, Page
from app.core.deps import Session, Staff, require
from app.models import Customer, Redemption, StaffUser, Store, Tenant
from app.schemas.tenant_config import SchemeSettings, merged
from app.services import audit, otp
from app.services.ledger import RedemptionRefused, redeem_all
from app.services.phone import normalise_phone

router = APIRouter(prefix="/crm/redemptions", tags=["crm redemptions"])


class RedeemIn(BaseModel):
    phone: str
    code: str = Field(pattern=r"^\d{6}$")
    store_id: UUID | None = None

    @field_validator("phone")
    @classmethod
    def _phone(cls, v: str) -> str:
        return normalise_phone(v)


class RedemptionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    slip_number: str
    customer_id: UUID
    store_id: UUID | None
    staff_user_id: UUID | None
    grams: Decimal
    amount_paid_inr: Decimal
    lots_count: int
    purity: str
    making_charge_discount_pct: Decimal
    created_at: datetime


class SlipOut(BaseModel):
    """Everything the CRM prints on the redemption slip."""

    redemption: RedemptionOut
    jeweller_name: str
    customer_name: str
    customer_phone: str
    store_name: str
    staff_name: str


@router.post("", response_model=RedemptionOut, status_code=201)
async def redeem(
    body: RedeemIn,
    staff: Annotated[Staff, Depends(require("redemptions:create"))],
    session: Session,
):
    tenant = await session.get(Tenant, staff.tenant_id)
    customer = await session.scalar(
        select(Customer).where(Customer.tenant_id == tenant.id, Customer.phone == body.phone)
    )
    if customer is None or not await otp.verify(
        session, tenant.id, body.phone, "redeem", body.code
    ):
        # Returned, not raised, so a wrong code still counts as an attempt.
        return JSONResponse(status_code=422, content={"detail": "incorrect or expired code"})
    # Staff tied to a store always redeem in that store.
    store_id = staff.user.store_id or body.store_id
    if store_id and await session.get(Store, store_id) is None:
        raise HTTPException(422, "store not found")
    try:
        redemption = await redeem_all(
            session, customer, merged(SchemeSettings, tenant.settings), staff.user.id, store_id
        )
    except RedemptionRefused as e:
        return JSONResponse(status_code=409, content={"detail": str(e)})
    audit.record(
        session,
        tenant_id=tenant.id,
        actor_id=staff.user.id,
        action="redemption.created",
        entity_type="redemption",
        entity_id=redemption.id,
        changes={"grams": str(redemption.grams), "slip": redemption.slip_number},
    )
    await session.refresh(redemption)
    return redemption


@router.get("", response_model=Page[RedemptionOut])
async def list_redemptions(
    staff: Annotated[Staff, Depends(require("redemptions:view"))],
    session: Session,
    customer_id: UUID | None = None,
    limit: Limit = 20,
    offset: Offset = 0,
):
    query = select(Redemption).where(Redemption.tenant_id == staff.tenant_id)
    if customer_id:
        query = query.where(Redemption.customer_id == customer_id)
    total = await session.scalar(select(func.count()).select_from(query.subquery()))
    rows = await session.scalars(
        query.order_by(Redemption.created_at.desc()).limit(limit).offset(offset)
    )
    return Page(items=list(rows), total=total, limit=limit, offset=offset)


@router.get("/{redemption_id}/slip", response_model=SlipOut)
async def slip(
    redemption_id: UUID,
    staff: Annotated[Staff, Depends(require("redemptions:view"))],
    session: Session,
):
    redemption = await session.get(Redemption, redemption_id)
    if redemption is None or redemption.tenant_id != staff.tenant_id:
        raise HTTPException(404, "redemption not found")
    tenant = await session.get(Tenant, staff.tenant_id)
    customer = await session.get(Customer, redemption.customer_id)
    store = await session.get(Store, redemption.store_id) if redemption.store_id else None
    by = (
        await session.get(StaffUser, redemption.staff_user_id) if redemption.staff_user_id else None
    )
    return SlipOut(
        redemption=RedemptionOut.model_validate(redemption),
        jeweller_name=tenant.branding.get("display_name") or tenant.name,
        customer_name=customer.name,
        customer_phone=customer.phone,
        store_name=store.name if store else "",
        staff_name=by.name if by else "",
    )
