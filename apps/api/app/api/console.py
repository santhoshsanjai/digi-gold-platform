"""Platform Console: endpoints only the platform owner (you) can use."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from sqlalchemy import func, select

from app.api.common import Limit, Offset, Page
from app.core.config import get_settings
from app.core.deps import PlatformAdmin, Session
from app.core.email import send_email, temp_password_email
from app.models import Tenant
from app.schemas.tenant_config import Branding, Features
from app.services import audit, config_cache
from app.services.tenants import create_tenant
from app.services.users import EmailTaken

router = APIRouter(prefix="/console", tags=["platform console"])
settings = get_settings()


class TenantCreate(BaseModel):
    slug: str = Field(pattern=r"^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$")
    name: str = Field(min_length=2, max_length=200)
    owner_email: EmailStr
    owner_name: str = Field(min_length=1, max_length=200)


class TenantUpdate(BaseModel):
    name: str | None = Field(None, min_length=2, max_length=200)
    status: Literal["active", "suspended"] | None = None


class TenantOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    slug: str
    name: str
    status: str
    branding: Branding
    features: Features
    config_version: int
    created_at: datetime


async def _get(session, tenant_id: UUID) -> Tenant:
    tenant = await session.get(Tenant, tenant_id)
    if tenant is None:
        raise HTTPException(404, "tenant not found")
    return tenant


def _changed(tenant: Tenant) -> None:
    tenant.config_version += 1
    config_cache.invalidate(tenant.slug)


@router.post("/tenants", response_model=TenantOut, status_code=201)
async def create(
    body: TenantCreate, admin: PlatformAdmin, session: Session, tasks: BackgroundTasks
):
    if await session.scalar(select(Tenant.id).where(Tenant.slug == body.slug)):
        raise HTTPException(409, "slug already in use")
    try:
        tenant, owner, password = await create_tenant(
            session,
            slug=body.slug,
            name=body.name,
            owner_email=body.owner_email,
            owner_name=body.owner_name,
            actor_id=admin.user.id,
        )
    except EmailTaken:
        raise HTTPException(409, "owner email already in use") from None
    tasks.add_task(
        send_email,
        temp_password_email(
            owner.email,
            owner.name,
            tenant.name,
            password,
            settings.temp_password_hours,
            settings.crm_base_url,
        ),
    )
    await session.refresh(tenant)
    return tenant


@router.get("/tenants", response_model=Page[TenantOut])
async def list_tenants(
    admin: PlatformAdmin, session: Session, limit: Limit = 20, offset: Offset = 0
):
    total = await session.scalar(select(func.count()).select_from(Tenant))
    rows = await session.scalars(select(Tenant).order_by(Tenant.name).limit(limit).offset(offset))
    return Page(items=list(rows), total=total, limit=limit, offset=offset)


@router.get("/tenants/{tenant_id}", response_model=TenantOut)
async def get_tenant(tenant_id: UUID, admin: PlatformAdmin, session: Session):
    return await _get(session, tenant_id)


@router.patch("/tenants/{tenant_id}", response_model=TenantOut)
async def update_tenant(
    tenant_id: UUID, body: TenantUpdate, admin: PlatformAdmin, session: Session
):
    tenant = await _get(session, tenant_id)
    before = {"name": tenant.name, "status": tenant.status}
    for key, value in body.model_dump(exclude_none=True).items():
        setattr(tenant, key, value)
    _changed(tenant)
    audit.record(
        session,
        tenant_id=tenant.id,
        actor_id=admin.user.id,
        action="tenant.updated",
        entity_type="tenant",
        entity_id=tenant.id,
        changes=audit.diff(before, {"name": tenant.name, "status": tenant.status}),
    )
    return tenant


@router.put("/tenants/{tenant_id}/branding", response_model=TenantOut)
async def set_branding(tenant_id: UUID, body: Branding, admin: PlatformAdmin, session: Session):
    tenant = await _get(session, tenant_id)
    after = body.model_dump(mode="json")
    changes = audit.diff(tenant.branding, after)
    tenant.branding = after
    _changed(tenant)
    audit.record(
        session,
        tenant_id=tenant.id,
        actor_id=admin.user.id,
        action="tenant.branding_updated",
        entity_type="tenant",
        entity_id=tenant.id,
        changes=changes,
    )
    return tenant


@router.put("/tenants/{tenant_id}/features", response_model=TenantOut)
async def set_features(tenant_id: UUID, body: Features, admin: PlatformAdmin, session: Session):
    tenant = await _get(session, tenant_id)
    after = body.model_dump(mode="json")
    changes = audit.diff(tenant.features, after)
    tenant.features = after
    _changed(tenant)
    audit.record(
        session,
        tenant_id=tenant.id,
        actor_id=admin.user.id,
        action="tenant.features_updated",
        entity_type="tenant",
        entity_id=tenant.id,
        changes=changes,
    )
    return tenant
