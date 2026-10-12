"""Customer sign-in for the mobile app: phone number and a one-time SMS code."""

from datetime import timedelta
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select, update

from app.core.config import get_settings
from app.core.db import bypass_tenant_scope, scope_to_tenant
from app.core.deps import CUSTOMER, Session
from app.core.security import create_jwt, hash_token, new_opaque_token, now
from app.core.sms import Sms, send_sms
from app.models import Customer, CustomerToken, Tenant
from app.services import otp
from app.services.phone import normalise_phone

router = APIRouter(prefix="/app/auth", tags=["app auth"])
settings = get_settings()


class PhoneIn(BaseModel):
    tenant: str
    phone: str

    @field_validator("phone")
    @classmethod
    def _phone(cls, v: str) -> str:
        return normalise_phone(v)


class VerifyIn(PhoneIn):
    code: str = Field(pattern=r"^\d{6}$")


class CustomerTokensOut(BaseModel):
    access_token: str
    refresh_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int
    is_new_customer: bool = False


class RefreshIn(BaseModel):
    refresh_token: str


async def _tenant(session, slug: str) -> Tenant:
    tenant = await session.scalar(
        select(Tenant).where(Tenant.slug == slug, Tenant.status == "active")
    )
    if tenant is None:
        raise HTTPException(404, "unknown client")
    await scope_to_tenant(session, tenant.id)
    return tenant


async def _issue(session, customer: Customer, is_new: bool = False) -> CustomerTokensOut:
    secret, digest = new_opaque_token()
    session.add(
        CustomerToken(
            customer_id=customer.id,
            token_hash=digest,
            expires_at=now() + timedelta(days=settings.customer_refresh_days),
        )
    )
    customer.last_login_at = now()
    return CustomerTokensOut(
        access_token=create_jwt(
            customer.id, customer.tenant_id, CUSTOMER, settings.customer_access_minutes
        ),
        refresh_token=secret,
        expires_in=settings.customer_access_minutes * 60,
        is_new_customer=is_new,
    )


@router.post("/otp", status_code=202)
async def request_code(body: PhoneIn, session: Session, tasks: BackgroundTasks):
    tenant = await _tenant(session, body.tenant)
    try:
        code = await otp.issue(session, tenant.id, body.phone, "login")
    except otp.OtpError as e:
        raise HTTPException(429, str(e)) from None
    name = tenant.branding.get("display_name") or tenant.name
    tasks.add_task(
        send_sms,
        Sms(
            body.phone,
            f"{code} is your {name} sign-in code. Valid for {settings.otp_minutes} minutes.",
        ),
    )
    return {"status": "sent"}


@router.post("/verify", response_model=CustomerTokensOut)
async def verify_code(body: VerifyIn, session: Session):
    """Sign in, creating the customer on their first successful code."""
    tenant = await _tenant(session, body.tenant)
    if not await otp.verify(session, tenant.id, body.phone, "login", body.code):
        # Return instead of raising so the failed attempt count is saved.
        return JSONResponse(status_code=401, content={"detail": "incorrect or expired code"})
    customer = await session.scalar(
        select(Customer).where(Customer.tenant_id == tenant.id, Customer.phone == body.phone)
    )
    is_new = customer is None
    if is_new:
        customer = Customer(tenant_id=tenant.id, phone=body.phone)
        session.add(customer)
        await session.flush()
    elif not customer.is_active:
        return JSONResponse(status_code=403, content={"detail": "this account is disabled"})
    return await _issue(session, customer, is_new)


async def _revoke_all(session, customer_id) -> None:
    await session.execute(
        update(CustomerToken)
        .where(CustomerToken.customer_id == customer_id, CustomerToken.used_at.is_(None))
        .values(used_at=now())
    )


@router.post("/refresh", response_model=CustomerTokensOut)
async def refresh(body: RefreshIn, session: Session):
    await bypass_tenant_scope(session)
    token = await session.scalar(
        select(CustomerToken).where(CustomerToken.token_hash == hash_token(body.refresh_token))
    )
    if token is None or token.expires_at < now():
        return JSONResponse(status_code=401, content={"detail": "invalid or expired refresh token"})
    if token.used_at is not None:
        await _revoke_all(session, token.customer_id)
        return JSONResponse(status_code=401, content={"detail": "invalid or expired refresh token"})
    customer = await session.get(Customer, token.customer_id)
    if customer is None or not customer.is_active:
        return JSONResponse(status_code=401, content={"detail": "invalid or expired refresh token"})
    token.used_at = now()
    return await _issue(session, customer)


@router.post("/logout", status_code=204)
async def logout(body: RefreshIn, session: Session):
    await session.execute(
        update(CustomerToken)
        .where(
            CustomerToken.token_hash == hash_token(body.refresh_token),
            CustomerToken.used_at.is_(None),
        )
        .values(used_at=now())
    )
