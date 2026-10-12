"""Sign-in for CRM staff (with a tenant) and Platform Console admins (without one)."""

from datetime import timedelta
from typing import Literal
from uuid import UUID

import jwt
from fastapi import APIRouter, BackgroundTasks, HTTPException, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.db import bypass_tenant_scope, scope_to_tenant
from app.core.deps import CurrentStaff, Session, tenant_active
from app.core.email import reset_link_email, send_email
from app.core.permissions import menu_for
from app.core.security import (
    ACCESS,
    DUMMY_HASH,
    PASSWORD_CHANGE,
    check_password_policy,
    create_jwt,
    decode_jwt,
    hash_password,
    hash_token,
    new_opaque_token,
    now,
    verify_password,
)
from app.models import AuthToken, StaffUser, Tenant
from app.services import audit
from app.services.users import normalise_email

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()

INVALID_LOGIN = "invalid email or password"


class LoginIn(BaseModel):
    tenant: str | None = Field(None, description="Client slug; omit for Platform Console admins")
    email: EmailStr
    password: str = Field(max_length=128)


class TokensOut(BaseModel):
    status: Literal["ok"] = "ok"
    access_token: str
    refresh_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int


class PasswordChangeRequiredOut(BaseModel):
    status: Literal["password_change_required"] = "password_change_required"
    password_change_token: str


class NewPassword(BaseModel):
    new_password: str = Field(max_length=128)

    @field_validator("new_password")
    @classmethod
    def _policy(cls, v: str) -> str:
        check_password_policy(v)
        return v


class FirstLoginIn(NewPassword):
    password_change_token: str


class ChangePasswordIn(NewPassword):
    current_password: str = Field(max_length=128)


class RefreshIn(BaseModel):
    refresh_token: str


class ForgotIn(BaseModel):
    tenant: str | None = None
    email: EmailStr


class ResetIn(NewPassword):
    token: str


def _error(code: int, detail: str) -> JSONResponse:
    """An error response that still lets the transaction commit (e.g. failed-login counts)."""
    return JSONResponse(status_code=code, content={"detail": detail})


async def _find_user(
    session: AsyncSession, tenant_slug: str | None, email: str
) -> tuple[StaffUser | None, Tenant | None]:
    if tenant_slug is None:
        await bypass_tenant_scope(session)
        user = await session.scalar(
            select(StaffUser).where(
                StaffUser.tenant_id.is_(None),
                StaffUser.is_platform_admin.is_(True),
                StaffUser.email == normalise_email(email),
            )
        )
        return user, None
    tenant = await session.scalar(
        select(Tenant).where(Tenant.slug == tenant_slug, Tenant.status == "active")
    )
    if tenant is None:
        return None, None
    await scope_to_tenant(session, tenant.id)
    user = await session.scalar(
        select(StaffUser).where(
            StaffUser.tenant_id == tenant.id, StaffUser.email == normalise_email(email)
        )
    )
    return user, tenant


async def _issue_tokens(session: AsyncSession, user: StaffUser) -> TokensOut:
    secret, digest = new_opaque_token()
    session.add(
        AuthToken(
            user_id=user.id,
            kind="refresh",
            token_hash=digest,
            expires_at=now() + timedelta(days=settings.refresh_token_days),
        )
    )
    user.last_login_at = now()
    return TokensOut(
        access_token=create_jwt(user.id, user.tenant_id, ACCESS, settings.access_token_minutes),
        refresh_token=secret,
        expires_in=settings.access_token_minutes * 60,
    )


async def _revoke_refresh_tokens(session: AsyncSession, user_id: UUID) -> None:
    await session.execute(
        update(AuthToken)
        .where(
            AuthToken.user_id == user_id, AuthToken.kind == "refresh", AuthToken.used_at.is_(None)
        )
        .values(used_at=now())
    )


@router.post(
    "/login",
    response_model=TokensOut | PasswordChangeRequiredOut,
    responses={401: {}, 423: {}},
)
async def login(body: LoginIn, session: Session):
    user, _ = await _find_user(session, body.tenant, body.email)
    if user is None:
        verify_password(DUMMY_HASH, body.password)  # same timing as a real check
        return _error(401, INVALID_LOGIN)
    if user.locked_until and user.locked_until > now():
        return _error(423, "too many failed attempts; try again later")
    if not verify_password(user.password_hash, body.password):
        user.failed_login_count += 1
        if user.failed_login_count >= settings.max_failed_logins:
            user.failed_login_count = 0
            user.locked_until = now() + timedelta(minutes=settings.lockout_minutes)
        return _error(401, INVALID_LOGIN)
    if not user.is_active:
        return _error(401, INVALID_LOGIN)

    user.failed_login_count = 0
    user.locked_until = None
    if user.must_change_password:
        if user.temp_password_expires_at and user.temp_password_expires_at < now():
            return _error(401, "temporary password has expired; ask your admin to resend it")
        return PasswordChangeRequiredOut(
            password_change_token=create_jwt(
                user.id, user.tenant_id, PASSWORD_CHANGE, settings.password_change_token_minutes
            )
        )
    return await _issue_tokens(session, user)


@router.post("/first-login", response_model=TokensOut)
async def complete_first_login(body: FirstLoginIn, session: Session):
    """Set a permanent password after signing in with a temporary one; signs the user in."""
    try:
        claims = decode_jwt(body.password_change_token, PASSWORD_CHANGE)
        user_id = UUID(claims["sub"])
    except (jwt.InvalidTokenError, KeyError, ValueError):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid or expired token") from None
    await bypass_tenant_scope(session)
    user = await session.get(StaffUser, user_id)
    if user is None or not user.is_active or not user.must_change_password:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid or expired token")
    if verify_password(user.password_hash, body.new_password):
        raise HTTPException(422, "choose a password different from the temporary one")
    user.password_hash = hash_password(body.new_password)
    user.must_change_password = False
    user.temp_password_expires_at = None
    audit.record(
        session,
        tenant_id=user.tenant_id,
        actor_id=user.id,
        action="user.password_set",
        entity_type="staff_user",
        entity_id=user.id,
    )
    return await _issue_tokens(session, user)


@router.post("/change-password", status_code=204)
async def change_password(body: ChangePasswordIn, staff: CurrentStaff, session: Session):
    user = staff.user
    if not verify_password(user.password_hash, body.current_password):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "current password is incorrect")
    user.password_hash = hash_password(body.new_password)
    await _revoke_refresh_tokens(session, user.id)
    audit.record(
        session,
        tenant_id=user.tenant_id,
        actor_id=user.id,
        action="user.password_changed",
        entity_type="staff_user",
        entity_id=user.id,
    )


@router.post("/refresh", response_model=TokensOut)
async def refresh(body: RefreshIn, session: Session):
    await bypass_tenant_scope(session)
    token = await session.scalar(
        select(AuthToken).where(
            AuthToken.token_hash == hash_token(body.refresh_token), AuthToken.kind == "refresh"
        )
    )
    if token is None or token.expires_at < now():
        return _error(401, "invalid or expired refresh token")
    if token.used_at is not None:
        # A rotated token was replayed: assume theft and end every session of this user.
        await _revoke_refresh_tokens(session, token.user_id)
        return _error(401, "invalid or expired refresh token")
    user = await session.get(StaffUser, token.user_id)
    if user is None or not user.is_active or user.must_change_password:
        return _error(401, "invalid or expired refresh token")
    if not await tenant_active(session, user.tenant_id):
        return _error(401, "invalid or expired refresh token")
    token.used_at = now()
    return await _issue_tokens(session, user)


@router.post("/logout", status_code=204)
async def logout(body: RefreshIn, session: Session):
    await session.execute(
        update(AuthToken)
        .where(AuthToken.token_hash == hash_token(body.refresh_token), AuthToken.used_at.is_(None))
        .values(used_at=now())
    )


@router.post("/forgot-password", status_code=202)
async def forgot_password(body: ForgotIn, session: Session, tasks: BackgroundTasks):
    """Always answers 202 so the response never reveals whether an account exists."""
    user, tenant = await _find_user(session, body.tenant, body.email)
    if user is None or not user.is_active:
        return {"status": "accepted"}
    secret, digest = new_opaque_token()
    session.add(
        AuthToken(
            user_id=user.id,
            kind="reset",
            token_hash=digest,
            expires_at=now() + timedelta(minutes=settings.reset_link_minutes),
        )
    )
    base = settings.crm_base_url if tenant else settings.console_base_url
    org = tenant.name if tenant else "Digi Gold Platform"
    tasks.add_task(
        send_email,
        reset_link_email(
            user.email,
            user.name,
            org,
            f"{base}/reset-password?token={secret}",
            settings.reset_link_minutes,
        ),
    )
    return {"status": "accepted"}


@router.post("/reset-password", status_code=204)
async def reset_password(body: ResetIn, session: Session):
    await bypass_tenant_scope(session)
    token = await session.scalar(
        select(AuthToken).where(
            AuthToken.token_hash == hash_token(body.token), AuthToken.kind == "reset"
        )
    )
    if token is None or token.used_at is not None or token.expires_at < now():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "reset link is invalid or has expired")
    user = await session.get(StaffUser, token.user_id)
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "reset link is invalid or has expired")
    token.used_at = now()
    user.password_hash = hash_password(body.new_password)
    user.must_change_password = False
    user.temp_password_expires_at = None
    user.failed_login_count = 0
    user.locked_until = None
    await _revoke_refresh_tokens(session, user.id)
    audit.record(
        session,
        tenant_id=user.tenant_id,
        actor_id=user.id,
        action="user.password_reset",
        entity_type="staff_user",
        entity_id=user.id,
    )


class MenuItemOut(BaseModel):
    key: str
    label: str
    path: str
    icon: str


class MeOut(BaseModel):
    id: UUID
    name: str
    email: str
    tenant_id: UUID | None
    is_platform_admin: bool
    permissions: list[str]
    menu: list[MenuItemOut]


@router.get("/me", response_model=MeOut)
async def me(staff: CurrentStaff):
    """The signed-in user, their permissions and the side menu their role allows."""
    return MeOut(
        id=staff.user.id,
        name=staff.user.name,
        email=staff.user.email,
        tenant_id=staff.tenant_id,
        is_platform_admin=staff.is_platform_admin,
        permissions=sorted(staff.permissions),
        menu=[
            MenuItemOut(key=m.key, label=m.label, path=m.path, icon=m.icon)
            for m in menu_for(set(staff.permissions))
        ],
    )
