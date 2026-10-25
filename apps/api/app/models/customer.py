from datetime import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, IdMixin, TimestampMixin


class Customer(IdMixin, TimestampMixin, Base):
    """A jeweller's customer, signed in to the app by email and password or by phone OTP.

    password_hash is set when the customer registers with an email; their mobile number is
    verified by SMS at that point. A forgotten password gets a temporary one, kept apart in
    temp_password_hash so a stranger asking for a reset cannot lock the real owner out.
    must_change_password is set after signing in with it and blocks every session until a
    new password is chosen.

    gold_grams, rupee_balance_inr and total_paid_inr are running totals updated in the
    same transaction as each ledger entry, so screens never re-add the full history.
    """

    __tablename__ = "customers"

    tenant_id: Mapped[UUID] = mapped_column(ForeignKey("tenants.id", ondelete="CASCADE"))
    phone: Mapped[str] = mapped_column(String(15))
    name: Mapped[str] = mapped_column(String(200), default="")
    email: Mapped[str] = mapped_column(String(254), default="")
    pan: Mapped[str | None] = mapped_column(String(10))
    pan_verified: Mapped[bool] = mapped_column(default=False)
    is_active: Mapped[bool] = mapped_column(default=True)
    password_hash: Mapped[str | None] = mapped_column(String(255))
    temp_password_hash: Mapped[str | None] = mapped_column(String(255))
    temp_password_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    must_change_password: Mapped[bool] = mapped_column(default=False)
    failed_login_count: Mapped[int] = mapped_column(default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    gold_grams: Mapped[Decimal] = mapped_column(Numeric(14, 4), default=Decimal("0"))
    rupee_balance_inr: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0"))
    total_paid_inr: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0"))
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class CustomerOtp(IdMixin, Base):
    __tablename__ = "customer_otps"

    tenant_id: Mapped[UUID] = mapped_column(ForeignKey("tenants.id", ondelete="CASCADE"))
    phone: Mapped[str] = mapped_column(String(15))
    purpose: Mapped[str] = mapped_column(String(20))  # "login" | "register" | "redeem"
    code_hash: Mapped[str] = mapped_column(String(64))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    attempts: Mapped[int] = mapped_column(default=0)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CustomerToken(IdMixin, Base):
    """Rotating refresh tokens for the mobile app; only the hash is stored."""

    __tablename__ = "customer_tokens"

    customer_id: Mapped[UUID] = mapped_column(ForeignKey("customers.id", ondelete="CASCADE"))
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
