from datetime import datetime
from uuid import UUID

from sqlalchemy import ARRAY, DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, IdMixin, TimestampMixin


class Role(IdMixin, TimestampMixin, Base):
    """A named set of permissions such as "customers:view". Editable per tenant."""

    __tablename__ = "roles"

    tenant_id: Mapped[UUID] = mapped_column(
        ForeignKey("tenants.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(String(300), default="")
    permissions: Mapped[list[str]] = mapped_column(ARRAY(String(50)), default=list)
    # System roles (Owner) cannot be deleted or stripped of permissions.
    is_system: Mapped[bool] = mapped_column(default=False)


class StaffUser(IdMixin, TimestampMixin, Base):
    """A CRM user (tenant staff) or, with tenant_id NULL, a Platform Console admin."""

    __tablename__ = "staff_users"

    tenant_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("tenants.id", ondelete="CASCADE"), index=True
    )
    role_id: Mapped[UUID | None] = mapped_column(ForeignKey("roles.id", ondelete="RESTRICT"))
    store_id: Mapped[UUID | None] = mapped_column(ForeignKey("stores.id", ondelete="SET NULL"))
    email: Mapped[str] = mapped_column(String(254))
    name: Mapped[str] = mapped_column(String(200))
    phone: Mapped[str] = mapped_column(String(20), default="")
    password_hash: Mapped[str] = mapped_column(String(255))
    must_change_password: Mapped[bool] = mapped_column(default=True)
    temp_password_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    failed_login_count: Mapped[int] = mapped_column(default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_active: Mapped[bool] = mapped_column(default=True)
    is_platform_admin: Mapped[bool] = mapped_column(default=False)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class AuthToken(IdMixin, Base):
    """Opaque single-use or rotating secrets (refresh tokens, password reset links).

    Only a SHA-256 hash of the secret is stored. Not tenant-scoped by row-level security,
    because the token itself is what identifies the user before the tenant is known.
    """

    __tablename__ = "auth_tokens"

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("staff_users.id", ondelete="CASCADE"), index=True
    )
    kind: Mapped[str] = mapped_column(String(20))  # "refresh" | "reset"
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
