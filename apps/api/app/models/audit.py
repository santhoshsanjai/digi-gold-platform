from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, IdMixin


class AuditLog(IdMixin, Base):
    """Append-only record of who changed what. tenant_id is NULL for platform-level events."""

    __tablename__ = "audit_logs"

    tenant_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("tenants.id", ondelete="CASCADE"), index=True
    )
    actor_user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("staff_users.id", ondelete="SET NULL")
    )
    action: Mapped[str] = mapped_column(String(60))
    entity_type: Mapped[str] = mapped_column(String(40))
    entity_id: Mapped[str] = mapped_column(String(64), default="")
    changes: Mapped[dict] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
