"""CRM user management. New users get a temporary password by email."""

from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from sqlalchemy import func, or_, select

from app.api.common import Limit, Offset, Page
from app.core.config import get_settings
from app.core.deps import Session, Staff, require
from app.core.email import send_email, temp_password_email
from app.models import Role, StaffUser, Store, Tenant
from app.services import audit
from app.services.users import EmailTaken, create_staff_user, issue_temp_password

router = APIRouter(prefix="/crm/users", tags=["crm users"])
settings = get_settings()


class UserCreate(BaseModel):
    email: EmailStr
    name: str = Field(min_length=1, max_length=200)
    phone: str = Field("", max_length=20)
    role_id: UUID
    store_id: UUID | None = None


class UserUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    phone: str | None = Field(None, max_length=20)
    role_id: UUID | None = None
    store_id: UUID | None = None
    is_active: bool | None = None


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    name: str
    phone: str
    role_id: UUID | None
    store_id: UUID | None
    is_active: bool
    must_change_password: bool
    last_login_at: datetime | None
    created_at: datetime


async def _check_refs(session, role_id: UUID | None, store_id: UUID | None) -> None:
    # Row-level security hides other tenants' rows, so a foreign id is simply not found.
    if role_id is not None and await session.get(Role, role_id) is None:
        raise HTTPException(422, "role not found")
    if store_id is not None and await session.get(Store, store_id) is None:
        raise HTTPException(422, "store not found")


async def _email_password(session, tasks: BackgroundTasks, user: StaffUser, password: str) -> None:
    tenant = await session.get(Tenant, user.tenant_id)
    tasks.add_task(
        send_email,
        temp_password_email(
            user.email,
            user.name,
            tenant.name,
            password,
            settings.temp_password_hours,
            settings.crm_base_url,
        ),
    )


@router.get("", response_model=Page[UserOut])
async def list_users(
    staff: Annotated[Staff, Depends(require("users:view"))],
    session: Session,
    q: str | None = None,
    limit: Limit = 20,
    offset: Offset = 0,
):
    query = select(StaffUser).where(StaffUser.tenant_id == staff.tenant_id)
    if q:
        like = f"%{q.lower()}%"
        query = query.where(or_(StaffUser.email.like(like), func.lower(StaffUser.name).like(like)))
    total = await session.scalar(select(func.count()).select_from(query.subquery()))
    rows = await session.scalars(query.order_by(StaffUser.name).limit(limit).offset(offset))
    return Page(items=list(rows), total=total, limit=limit, offset=offset)


@router.post("", response_model=UserOut, status_code=201)
async def create_user(
    body: UserCreate,
    staff: Annotated[Staff, Depends(require("users:create"))],
    session: Session,
    tasks: BackgroundTasks,
):
    await _check_refs(session, body.role_id, body.store_id)
    try:
        user, password = await create_staff_user(
            session,
            tenant_id=staff.tenant_id,
            email=body.email,
            name=body.name,
            phone=body.phone,
            role_id=body.role_id,
            store_id=body.store_id,
        )
    except EmailTaken:
        raise HTTPException(409, "a user with this email already exists") from None
    audit.record(
        session,
        tenant_id=staff.tenant_id,
        actor_id=staff.user.id,
        action="user.created",
        entity_type="staff_user",
        entity_id=user.id,
        changes={"email": user.email, "role_id": str(body.role_id)},
    )
    await _email_password(session, tasks, user, password)
    await session.refresh(user)
    return user


async def _get_user(session, staff: Staff, user_id: UUID) -> StaffUser:
    user = await session.get(StaffUser, user_id)
    if user is None or user.tenant_id != staff.tenant_id:
        raise HTTPException(404, "user not found")
    return user


@router.patch("/{user_id}", response_model=UserOut)
async def update_user(
    user_id: UUID,
    body: UserUpdate,
    staff: Annotated[Staff, Depends(require("users:edit"))],
    session: Session,
):
    user = await _get_user(session, staff, user_id)
    fields = body.model_dump(exclude_unset=True)
    if user.id == staff.user.id and ("role_id" in fields or fields.get("is_active") is False):
        raise HTTPException(422, "you cannot change your own role or deactivate yourself")
    if "role_id" in fields and fields["role_id"] is None:
        raise HTTPException(422, "role_id cannot be empty")
    await _check_refs(session, fields.get("role_id"), fields.get("store_id"))
    before = {k: str(getattr(user, k)) for k in fields}
    for key, value in fields.items():
        setattr(user, key, value)
    audit.record(
        session,
        tenant_id=staff.tenant_id,
        actor_id=staff.user.id,
        action="user.updated",
        entity_type="staff_user",
        entity_id=user.id,
        changes=audit.diff(before, {k: str(v) for k, v in fields.items()}),
    )
    return user


@router.post("/{user_id}/resend-password", status_code=204)
async def resend_password(
    user_id: UUID,
    staff: Annotated[Staff, Depends(require("users:edit"))],
    session: Session,
    tasks: BackgroundTasks,
):
    """Issue a fresh temporary password; the user must set a new one at next sign-in."""
    user = await _get_user(session, staff, user_id)
    if not user.is_active:
        raise HTTPException(422, "user is deactivated")
    password = issue_temp_password(user)
    audit.record(
        session,
        tenant_id=staff.tenant_id,
        actor_id=staff.user.id,
        action="user.temp_password_issued",
        entity_type="staff_user",
        entity_id=user.id,
    )
    await _email_password(session, tasks, user, password)
