"""Customer app: profile, today's rate, buying gold, lots and statement."""

import re
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from sqlalchemy import func, select

from app.api.common import Limit, Offset, Page
from app.core.config import get_settings
from app.core.deps import CurrentCustomer, Session
from app.core.security import now, verify_password
from app.models import Customer, GoldLot, LedgerEntry, PaymentOrder, Tenant
from app.schemas.tenant_config import Features, SchemeSettings, merged
from app.services import otp
from app.services.gold_math import grams_for
from app.services.ledger import OrderClosed, settle_order
from app.services.payments import provider_for
from app.services.rates import buying_status

router = APIRouter(prefix="/app", tags=["app"])

_PAN = re.compile(r"^[A-Z]{5}[0-9]{4}[A-Z]$")


class MeOut(BaseModel):
    id: UUID
    phone: str
    name: str
    email: str
    has_password: bool
    member_since: datetime
    pan_provided: bool
    gold_grams: Decimal
    rupee_balance_inr: Decimal
    total_paid_inr: Decimal
    open_lots: int
    next_expiry_at: datetime | None
    redemption_threshold_grams: Decimal
    can_redeem: bool


class ProfileIn(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    email: EmailStr | None = None
    # Needed to change the email of an account that signs in with it.
    current_password: str | None = Field(None, max_length=128)


class PanIn(BaseModel):
    pan: str

    @field_validator("pan")
    @classmethod
    def _pan(cls, v: str) -> str:
        v = v.strip().upper()
        if not _PAN.match(v):
            raise ValueError("enter a valid 10-character PAN")
        return v


class RateOut(BaseModel):
    purity: str
    rate_per_gram: Decimal | None
    updated_at: datetime | None
    buying_open: bool
    reason: str
    min_payment_inr: Decimal
    max_payment_inr: Decimal
    price_lock_minutes: int
    test_payments: bool


class OrderIn(BaseModel):
    amount_inr: Decimal = Field(gt=0, max_digits=12, decimal_places=2)


class OrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    amount_inr: Decimal
    purity: str
    rate_per_gram: Decimal
    quoted_grams: Decimal
    lock_expires_at: datetime
    status: str
    provider: str
    provider_order_id: str
    failure_reason: str
    paid_at: datetime | None
    created_at: datetime
    credited_grams: Decimal | None = None
    repriced: bool = False


class TestOutcomeIn(BaseModel):
    outcome: Literal["success", "failure", "pending"]


class LotOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    grams: Decimal
    amount_inr: Decimal
    rate_per_gram: Decimal
    purity: str
    paid_at: datetime
    redeemable_at: datetime
    expires_at: datetime
    status: str


class LedgerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    kind: str
    grams: Decimal
    amount_inr: Decimal
    lot_id: UUID | None
    note: str
    created_at: datetime


async def _tenant_and_scheme(session, customer: Customer) -> tuple[Tenant, SchemeSettings]:
    tenant = await session.get(Tenant, customer.tenant_id)
    return tenant, merged(SchemeSettings, tenant.settings)


@router.get("/me", response_model=MeOut)
async def me(customer: CurrentCustomer, session: Session):
    _, scheme = await _tenant_and_scheme(session, customer)
    open_lots, next_expiry = (
        await session.execute(
            select(func.count(), func.min(GoldLot.expires_at)).where(
                GoldLot.customer_id == customer.id, GoldLot.status == "open"
            )
        )
    ).one()
    return MeOut(
        id=customer.id,
        phone=customer.phone,
        name=customer.name,
        email=customer.email,
        has_password=customer.password_hash is not None,
        member_since=customer.created_at,
        pan_provided=customer.pan is not None,
        gold_grams=customer.gold_grams,
        rupee_balance_inr=customer.rupee_balance_inr,
        total_paid_inr=customer.total_paid_inr,
        open_lots=open_lots,
        next_expiry_at=next_expiry,
        redemption_threshold_grams=scheme.redemption_threshold_grams,
        can_redeem=customer.gold_grams >= scheme.redemption_threshold_grams,
    )


@router.patch("/me", status_code=204)
async def update_profile(body: ProfileIn, customer: CurrentCustomer, session: Session):
    email = str(body.email).strip().lower() if body.email is not None else None
    if email is not None and email != customer.email and customer.password_hash is not None:
        # The email is where password resets go, so changing it needs the password.
        if not body.current_password or not verify_password(
            customer.password_hash, body.current_password
        ):
            return JSONResponse(
                status_code=400,
                content={
                    "detail": "enter your current password to change your email",
                    "code": "bad_password",
                },
            )
        taken = await session.scalar(
            select(func.count()).where(
                Customer.tenant_id == customer.tenant_id,
                Customer.email == email,
                Customer.password_hash.is_not(None),
                Customer.id != customer.id,
            )
        )
        if taken:
            return JSONResponse(
                status_code=409,
                content={
                    "detail": "this email is already used by another account",
                    "code": "email_taken",
                },
            )
    if body.name is not None:
        customer.name = body.name.strip()
    if email is not None:
        customer.email = email


@router.post("/me/pan", status_code=204)
async def save_pan(body: PanIn, customer: CurrentCustomer):
    """PAN is stored now and verified with a KYC provider later."""
    customer.pan = body.pan
    customer.pan_verified = False


@router.get("/rate", response_model=RateOut)
async def rate(customer: CurrentCustomer, session: Session):
    tenant, scheme = await _tenant_and_scheme(session, customer)
    status = await buying_status(session, tenant, scheme)
    return RateOut(
        purity=scheme.purity,
        rate_per_gram=status.rate.rate_per_gram if status.rate else None,
        updated_at=status.rate.created_at if status.rate else None,
        buying_open=status.open,
        reason=status.reason,
        min_payment_inr=scheme.min_payment_inr,
        max_payment_inr=scheme.max_payment_inr,
        price_lock_minutes=scheme.price_lock_minutes,
        test_payments=merged(Features, tenant.features).test_payments,
    )


def _refuse(code: str, detail: str, status: int = 422) -> JSONResponse:
    return JSONResponse(status_code=status, content={"detail": detail, "code": code})


@router.post("/orders", response_model=OrderOut, status_code=201)
async def create_order(body: OrderIn, customer: CurrentCustomer, session: Session):
    """Quote grams for an amount and lock the rate for a few minutes."""
    tenant, scheme = await _tenant_and_scheme(session, customer)
    features = merged(Features, tenant.features)
    if not features.savings_scheme:
        return _refuse("scheme_disabled", "the savings scheme is not available", 403)
    status = await buying_status(session, tenant, scheme)
    if not status.open:
        return _refuse("buying_closed", status.reason, 409)
    if not scheme.min_payment_inr <= body.amount_inr <= scheme.max_payment_inr:
        return _refuse(
            "amount_out_of_range",
            f"amount must be between ₹{scheme.min_payment_inr} and ₹{scheme.max_payment_inr}",
        )
    if (
        customer.pan is None
        and customer.total_paid_inr + body.amount_inr > scheme.pan_required_above_inr
    ):
        return _refuse("pan_required", "please add your PAN to continue")

    try:
        provider = provider_for(features.test_payments)
    except NotImplementedError:
        return _refuse("payments_unavailable", "online payments are not set up yet", 503)
    grams, _ = grams_for(body.amount_inr + customer.rupee_balance_inr, status.rate.rate_per_gram)
    provider_order = provider.create_order(body.amount_inr, receipt=str(customer.id))
    order = PaymentOrder(
        tenant_id=tenant.id,
        customer_id=customer.id,
        amount_inr=body.amount_inr,
        purity=scheme.purity,
        rate_id=status.rate.id,
        rate_per_gram=status.rate.rate_per_gram,
        quoted_grams=grams,
        lock_expires_at=now() + timedelta(minutes=scheme.price_lock_minutes),
        provider=provider_order.provider,
        provider_order_id=provider_order.provider_order_id,
    )
    session.add(order)
    await session.flush()
    await session.refresh(order)
    return order


async def _own_order(session, customer: Customer, order_id: UUID) -> PaymentOrder:
    order = await session.get(PaymentOrder, order_id)
    if order is None or order.customer_id != customer.id:
        raise HTTPException(404, "order not found")
    return order


@router.get("/orders/{order_id}", response_model=OrderOut)
async def get_order(order_id: UUID, customer: CurrentCustomer, session: Session):
    order = await _own_order(session, customer, order_id)
    lot = await session.scalar(select(GoldLot).where(GoldLot.order_id == order.id))
    return OrderOut.model_validate(order).model_copy(
        update={"credited_grams": lot.grams if lot else None}
    )


@router.post("/orders/{order_id}/test-outcome", response_model=OrderOut)
async def test_outcome(
    order_id: UUID, body: TestOutcomeIn, customer: CurrentCustomer, session: Session
):
    """Test payments only: the mock checkout's success, failure and pending buttons."""
    order = await _own_order(session, customer, order_id)
    tenant, scheme = await _tenant_and_scheme(session, customer)
    if order.provider != "mock" or not merged(Features, tenant.features).test_payments:
        raise HTTPException(403, "test payments are switched off for this client")
    try:
        result = await settle_order(
            session,
            order,
            tenant,
            scheme,
            body.outcome,
            provider_payment_id=f"mock_pay_{order.id.hex[:12]}"
            if body.outcome == "success"
            else "",
            failure_reason="test payment marked as failed" if body.outcome == "failure" else "",
        )
    except OrderClosed as e:
        raise HTTPException(409, str(e)) from None
    return OrderOut.model_validate(result.order).model_copy(
        update={
            "credited_grams": result.lot.grams if result.lot else None,
            "repriced": result.repriced,
        }
    )


@router.get("/lots", response_model=list[LotOut])
async def lots(
    customer: CurrentCustomer,
    session: Session,
    status: Literal["open", "redeemed", "refunded"] | None = "open",
):
    query = select(GoldLot).where(GoldLot.customer_id == customer.id)
    if status:
        query = query.where(GoldLot.status == status)
    return list(await session.scalars(query.order_by(GoldLot.expires_at)))


@router.get("/ledger", response_model=Page[LedgerOut])
async def statement(
    customer: CurrentCustomer, session: Session, limit: Limit = 20, offset: Offset = 0
):
    query = select(LedgerEntry).where(LedgerEntry.customer_id == customer.id)
    total = await session.scalar(select(func.count()).select_from(query.subquery()))
    rows = await session.scalars(
        query.order_by(LedgerEntry.created_at.desc()).limit(limit).offset(offset)
    )
    return Page(items=list(rows), total=total, limit=limit, offset=offset)


class RedemptionCodeOut(BaseModel):
    code: str
    expires_at: datetime
    grams: Decimal


@router.post("/redemption-code", response_model=RedemptionCodeOut)
async def redemption_code(customer: CurrentCustomer, session: Session):
    """A short-lived code (shown as a number and a QR code) the customer gives store staff."""
    _, scheme = await _tenant_and_scheme(session, customer)
    if customer.gold_grams < scheme.redemption_threshold_grams:
        return _refuse(
            "below_threshold",
            f"you need at least {scheme.redemption_threshold_grams} g to redeem",
        )
    try:
        code = await otp.issue(session, customer.tenant_id, customer.phone, "redeem")
    except otp.OtpError as e:
        raise HTTPException(429, str(e)) from None
    return RedemptionCodeOut(
        code=code,
        expires_at=now() + timedelta(minutes=get_settings().otp_minutes),
        grams=customer.gold_grams,
    )
