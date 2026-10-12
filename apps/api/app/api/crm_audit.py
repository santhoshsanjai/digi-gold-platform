from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict
from sqlalchemy import func, select

from app.api.common import Limit, Offset, Page
from app.core.deps import Session, Staff, require
from app.models import AuditLog

router = APIRouter(prefix="/crm/audit-logs", tags=["crm audit"])


class AuditOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    actor_user_id: UUID | None
    action: str
    entity_type: str
    entity_id: str
    changes: dict
    created_at: datetime


@router.get("", response_model=Page[AuditOut])
async def list_audit(
    staff: Annotated[Staff, Depends(require("settings:view"))],
    session: Session,
    entity_type: str | None = None,
    limit: Limit = 50,
    offset: Offset = 0,
):
    query = select(AuditLog).where(AuditLog.tenant_id == staff.tenant_id)
    if entity_type:
        query = query.where(AuditLog.entity_type == entity_type)
    total = await session.scalar(select(func.count()).select_from(query.subquery()))
    rows = await session.scalars(
        query.order_by(AuditLog.created_at.desc()).limit(limit).offset(offset)
    )
    return Page(items=list(rows), total=total, limit=limit, offset=offset)
