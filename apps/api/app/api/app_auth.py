"""Customer sign-in for the mobile app.

Customers register with name, email, mobile number and password; the mobile number is
confirmed with an SMS code, which also links the account to any history the jeweller already
holds for that number. They then sign in with email and password. A one-time SMS code still
signs in by mobile number alone.

A forgotten password gets a temporary one by email. Signing in with it returns a short-lived
password-change token instead of a session, and no session works until a new password is set.
"""

from datetime import timedelta
from typing import Literal
from uuid import UUID

import jwt
from fastapi import APIRouter, BackgroundTasks, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy import delete, func, select

from app.core.config import get_settings
from app.core.db import bypass_tenant_scope, scope_to_tenant
from app.core.deps import CUSTOMER, CurrentCustomer, Session, tenant_active
from app.core.email import send_email
from app.core.security import (
    DUMMY_HASH,
    check_password_policy,
    create_jwt,
    decode_jwt,
    hash_password,
    hash_token,
    new_opaque_token,
    now,
    verify_password,
)
from app.core.sms import Sms, send_sms
from app.models import Customer, CustomerToken, Tenant
from app.services import otp
from app.services.customer_auth import code_email, issue_temp_password, shop_name
from app.services.phone import normalise_phone
from app.services.users import normalise_email

router = APIRouter(prefix="/app/auth", tags=["app auth"])
settings = get_settings()

CUSTOMER_PASSWORD_CHANGE = "customer_pwd_change"
INVALID_LOGIN = "incorrect email or password"


class PhoneIn(BaseModel):
    tenant: str
    phone: str

    @field_validator("phone")
    @classmethod
    def _phone(cls, v: str) -> str:
        return normalise_phone(v)


class VerifyIn(PhoneIn):
    code: str = Field(pattern=r"^\d{6}$")


class NewPassword(BaseModel):
    new_password: str = Field(max_length=128)

    @field_validator("new_password")
    @classmethod
    def _policy(cls, v: str) -> str:
        check_password_policy(v)
        return v


class RegisterIn(PhoneIn):
    name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    password: str = Field(max_length=128)

    @field_validator("name")
    @classmethod
    def _name(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("enter your full name")
        return v.strip()

    @field_validator("password")
    @classmethod
    def _policy(cls, v: str) -> str:
        check_password_policy(v)
        return v


class RegisterVerifyIn(RegisterIn):
    code: str = Field(pattern=r"^\d{6}$")


class LoginIn(BaseModel):
    tenant: str
    email: EmailStr
    password: str = Field(max_length=128)


class SetPasswordIn(NewPassword):
    password_change_token: str


class ChangePasswordIn(NewPassword):
    current_password: str | None = Field(None, max_length=128)


class ForgotIn(BaseModel):
    tenant: str
    email: EmailStr


class CustomerTokensOut(BaseModel):
    status: Literal["ok"] = "ok"
    access_token: str
    refresh_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int
    is_new_customer: bool = False


class PasswordChangeRequiredOut(BaseModel):
    status: Literal["password_change_required"] = "password_change_required"
    password_change_token: str


class RefreshIn(BaseModel):
    refresh_token: str


def _error(status: int, detail: str, code: str | None = None) -> JSONResponse:
    """An error response that still lets the transaction commit (attempt counts, lockouts)."""
    content = {"detail": detail}
    if code:
        content["code"] = code
    return JSONResponse(status_code=status, content=content)


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


async def _revoke_all(session, customer_id) -> None:
    """End every session. Live tokens are deleted rather than marked used, so a device that
    later tries its revoked token gets a plain 401 instead of looking like a replayed one
    (which would end the session just started on this device)."""
    await session.execute(
        delete(CustomerToken).where(
            CustomerToken.customer_id == customer_id, CustomerToken.used_at.is_(None)
        )
    )


def _clear_recovery(customer: Customer) -> None:
    customer.temp_password_hash = None
    customer.temp_password_expires_at = None
    customer.must_change_password = False
    customer.failed_login_count = 0
    customer.locked_until = None


async def _email_taken(session, tenant_id: UUID, email: str, exclude: UUID | None = None) -> bool:
    q = select(func.count()).where(
        Customer.tenant_id == tenant_id,
        Customer.email == email,
        Customer.password_hash.is_not(None),
    )
    if exclude is not None:
        q = q.where(Customer.id != exclude)
    return (await session.scalar(q)) > 0


async def _registration_problem(session, tenant_id: UUID, body: RegisterIn) -> JSONResponse | None:
    """Refuse an email or mobile number that already has a password account."""
    if await _email_taken(session, tenant_id, normalise_email(body.email)):
        return _error(409, "this email is already registered; sign in instead", "email_taken")
    existing = await session.scalar(
        select(Customer).where(Customer.tenant_id == tenant_id, Customer.phone == body.phone)
    )
    if existing is not None and existing.password_hash is not None:
        return _error(
            409, "this mobile number already has an account; sign in instead", "phone_taken"
        )
    if existing is not None and not existing.is_active:
        return _error(403, "this account is disabled", "account_disabled")
    return None


def _send_code(
    tenant: Tenant, phone: str, email: str, code: str, what: str, tasks: BackgroundTasks
) -> None:
    """Text the code, and email it too when there is an address: SMS delivery is not set up
    for every client yet, so email is the channel that is sure to arrive."""
    name = shop_name(tenant)
    tasks.add_task(
        send_sms,
        Sms(phone, f"{code} is your {name} {what} code. Valid for {settings.otp_minutes} minutes."),
    )
    if email:
        tasks.add_task(send_email, code_email(email, name, code, what))


@router.post("/otp", status_code=202)
async def request_code(body: PhoneIn, session: Session, tasks: BackgroundTasks):
    tenant = await _tenant(session, body.tenant)
    try:
        code = await otp.issue(session, tenant.id, body.phone, "login")
    except otp.OtpError as e:
        raise HTTPException(429, str(e)) from None
    email = await session.scalar(
        select(Customer.email).where(
            Customer.tenant_id == tenant.id, Customer.phone == body.phone, Customer.is_active
        )
    )
    _send_code(tenant, body.phone, email or "", code, "sign-in", tasks)
    return {"status": "sent"}


@router.post("/verify", response_model=CustomerTokensOut)
async def verify_code(body: VerifyIn, session: Session):
    """Sign in, creating the customer on their first successful code."""
    tenant = await _tenant(session, body.tenant)
    if not await otp.verify(session, tenant.id, body.phone, "login", body.code):
        # Return instead of raising so the failed attempt count is saved.
        return _error(401, "incorrect or expired code")
    customer = await session.scalar(
        select(Customer).where(Customer.tenant_id == tenant.id, Customer.phone == body.phone)
    )
    is_new = customer is None
    if is_new:
        customer = Customer(tenant_id=tenant.id, phone=body.phone)
        session.add(customer)
        await session.flush()
    elif not customer.is_active:
        return _error(403, "this account is disabled", "account_disabled")
    else:
        # The code proves the owner holds the phone, so a pending reset no longer applies.
        _clear_recovery(customer)
    return await _issue(session, customer, is_new)


@router.post("/register/otp", status_code=202)
async def request_registration_code(body: RegisterIn, session: Session, tasks: BackgroundTasks):
    """Check the details, then text a code that confirms the mobile number."""
    tenant = await _tenant(session, body.tenant)
    if problem := await _registration_problem(session, tenant.id, body):
        return problem
    try:
        code = await otp.issue(session, tenant.id, body.phone, "register")
    except otp.OtpError as e:
        raise HTTPException(429, str(e)) from None
    _send_code(tenant, body.phone, normalise_email(body.email), code, "verification", tasks)
    return {"status": "sent"}


@router.post("/register", status_code=201)
async def register(body: RegisterVerifyIn, session: Session):
    """Create the account, or add email sign-in to the customer already known by this number.

    The customer signs in afterwards with their email and password."""
    tenant = await _tenant(session, body.tenant)
    if problem := await _registration_problem(session, tenant.id, body):
        return problem
    if not await otp.verify(session, tenant.id, body.phone, "register", body.code):
        return _error(401, "incorrect or expired code", "bad_code")
    customer = await session.scalar(
        select(Customer).where(Customer.tenant_id == tenant.id, Customer.phone == body.phone)
    )
    if customer is None:
        customer = Customer(tenant_id=tenant.id, phone=body.phone)
        session.add(customer)
    customer.name = body.name
    customer.email = normalise_email(body.email)
    customer.password_hash = hash_password(body.password)
    _clear_recovery(customer)
    await session.flush()
    return {"status": "registered"}


@router.post(
    "/login",
    response_model=CustomerTokensOut | PasswordChangeRequiredOut,
    responses={401: {}, 403: {}, 423: {}},
)
async def login(body: LoginIn, session: Session):
    tenant = await _tenant(session, body.tenant)
    customer = await session.scalar(
        select(Customer).where(
            Customer.tenant_id == tenant.id,
            Customer.email == normalise_email(body.email),
            Customer.password_hash.is_not(None),
        )
    )
    if customer is None:
        verify_password(DUMMY_HASH, body.password)  # same timing as a real check
        return _error(401, INVALID_LOGIN, "invalid_login")
    if customer.locked_until and customer.locked_until > now():
        return _error(423, "too many failed attempts; try again in a few minutes", "locked")

    if verify_password(customer.password_hash, body.password):
        if not customer.is_active:
            return _error(403, "this account is disabled", "account_disabled")
        _clear_recovery(customer)  # they remembered it, so any emailed password is void
        return await _issue(session, customer)

    if customer.temp_password_hash and verify_password(customer.temp_password_hash, body.password):
        if customer.temp_password_expires_at is None or customer.temp_password_expires_at < now():
            return _error(
                401, "this temporary password has expired; request a new one", "temp_expired"
            )
        if not customer.is_active:
            return _error(403, "this account is disabled", "account_disabled")
        customer.failed_login_count = 0
        customer.locked_until = None
        customer.must_change_password = True
        await _revoke_all(session, customer.id)
        return PasswordChangeRequiredOut(
            password_change_token=create_jwt(
                customer.id,
                customer.tenant_id,
                CUSTOMER_PASSWORD_CHANGE,
                settings.password_change_token_minutes,
            )
        )

    customer.failed_login_count += 1
    if customer.failed_login_count >= settings.max_failed_logins:
        customer.failed_login_count = 0
        customer.locked_until = now() + timedelta(minutes=settings.lockout_minutes)
    return _error(401, INVALID_LOGIN, "invalid_login")


@router.post("/set-password", status_code=204)
async def set_password(body: SetPasswordIn, session: Session):
    """Replace a temporary password. The customer then signs in with the new one."""
    try:
        claims = decode_jwt(body.password_change_token, CUSTOMER_PASSWORD_CHANGE)
        customer_id, tenant_id = UUID(claims["sub"]), UUID(claims["tid"])
    except (jwt.InvalidTokenError, KeyError, ValueError, TypeError):
        raise HTTPException(401, "this step has expired; sign in again") from None
    await scope_to_tenant(session, tenant_id)
    customer = await session.get(Customer, customer_id)
    if (
        customer is None
        or not customer.is_active
        or not customer.must_change_password
        or customer.temp_password_hash is None
    ):
        raise HTTPException(401, "this step has expired; sign in again")
    if verify_password(customer.temp_password_hash, body.new_password):
        raise HTTPException(422, "choose a password different from the temporary one")
    customer.password_hash = hash_password(body.new_password)
    _clear_recovery(customer)
    await _revoke_all(session, customer.id)


@router.post("/forgot-password", status_code=202)
async def forgot_password(body: ForgotIn, session: Session, tasks: BackgroundTasks):
    """Email a temporary password. Always answers 202, so it never reveals who has an account."""
    tenant = await _tenant(session, body.tenant)
    customer = await session.scalar(
        select(Customer).where(
            Customer.tenant_id == tenant.id,
            Customer.email == normalise_email(body.email),
            Customer.password_hash.is_not(None),
        )
    )
    if customer is None or not customer.is_active:
        return {"status": "accepted"}
    lifetime = timedelta(minutes=settings.customer_temp_password_minutes)
    expires = customer.temp_password_expires_at
    if expires and expires - lifetime > now() - timedelta(seconds=settings.otp_resend_seconds):
        return {"status": "accepted"}  # one was just sent; don't flood their inbox
    tasks.add_task(send_email, issue_temp_password(customer, tenant))
    return {"status": "accepted"}


@router.post("/change-password", response_model=CustomerTokensOut)
async def change_password(body: ChangePasswordIn, customer: CurrentCustomer, session: Session):
    """Change (or, for customers who only used SMS codes, create) the password.

    Every other device is signed out; this one gets a fresh session."""
    if customer.password_hash is not None:
        if not body.current_password or not verify_password(
            customer.password_hash, body.current_password
        ):
            return _error(400, "your current password is incorrect", "bad_password")
        if verify_password(customer.password_hash, body.new_password):
            return _error(422, "choose a password different from your current one")
    else:
        if not customer.email:
            return _error(422, "add your email to your profile first", "email_required")
        if await _email_taken(session, customer.tenant_id, customer.email, exclude=customer.id):
            return _error(409, "this email is already used by another account", "email_taken")
    customer.password_hash = hash_password(body.new_password)
    _clear_recovery(customer)
    await _revoke_all(session, customer.id)
    return await _issue(session, customer)


@router.post("/refresh", response_model=CustomerTokensOut)
async def refresh(body: RefreshIn, session: Session):
    await bypass_tenant_scope(session)
    token = await session.scalar(
        select(CustomerToken).where(CustomerToken.token_hash == hash_token(body.refresh_token))
    )
    if token is None or token.expires_at < now():
        return _error(401, "invalid or expired refresh token")
    if token.used_at is not None:
        # A rotated token was replayed: assume theft and end every session of this customer.
        await _revoke_all(session, token.customer_id)
        return _error(401, "invalid or expired refresh token")
    customer = await session.get(Customer, token.customer_id)
    if (
        customer is None
        or not customer.is_active
        or customer.must_change_password
        or not await tenant_active(session, customer.tenant_id)
    ):
        return _error(401, "invalid or expired refresh token")
    token.used_at = now()
    return await _issue(session, customer)


@router.post("/logout", status_code=204)
async def logout(body: RefreshIn, session: Session):
    await session.execute(
        delete(CustomerToken).where(
            CustomerToken.token_hash == hash_token(body.refresh_token),
            CustomerToken.used_at.is_(None),
        )
    )
