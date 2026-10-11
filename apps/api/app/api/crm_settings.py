"""The CRM settings page: every scheme limit the client controls."""

from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.deps import Session, Staff, require
from app.models import Tenant
from app.schemas.tenant_config import SchemeSettings, merged
from app.services import audit, config_cache

router = APIRouter(prefix="/crm/settings", tags=["crm settings"])


@router.get("", response_model=SchemeSettings)
async def get_settings_page(
    staff: Annotated[Staff, Depends(require("settings:view"))], session: Session
):
    tenant = await session.get(Tenant, staff.tenant_id)
    return merged(SchemeSettings, tenant.settings)


@router.put("", response_model=SchemeSettings)
async def save_settings_page(
    body: SchemeSettings,
    staff: Annotated[Staff, Depends(require("settings:edit"))],
    session: Session,
):
    """Replace the settings. Changes apply to new payments only; past lots keep their terms."""
    tenant = await session.get(Tenant, staff.tenant_id)
    before = merged(SchemeSettings, tenant.settings).model_dump(mode="json")
    after = body.model_dump(mode="json")
    changes = audit.diff(before, after)
    if changes:
        tenant.settings = after
        tenant.config_version += 1
        config_cache.invalidate(tenant.slug)
        audit.record(
            session,
            tenant_id=tenant.id,
            actor_id=staff.user.id,
            action="settings.updated",
            entity_type="tenant",
            entity_id=tenant.id,
            changes=changes,
        )
    return body
