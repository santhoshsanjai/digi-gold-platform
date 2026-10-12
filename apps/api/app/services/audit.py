from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AuditLog


def record(
    session: AsyncSession,
    *,
    tenant_id: UUID | None,
    actor_id: UUID | None,
    action: str,
    entity_type: str,
    entity_id: Any = "",
    changes: dict | None = None,
) -> None:
    """Add an audit entry to the current transaction (written with the change itself)."""
    session.add(
        AuditLog(
            tenant_id=tenant_id,
            actor_user_id=actor_id,
            action=action,
            entity_type=entity_type,
            entity_id=str(entity_id),
            changes=changes or {},
        )
    )


def diff(before: dict, after: dict) -> dict:
    """Only the keys that changed, as {key: [old, new]}."""
    keys = before.keys() | after.keys()
    return {k: [before.get(k), after.get(k)] for k in sorted(keys) if before.get(k) != after.get(k)}
