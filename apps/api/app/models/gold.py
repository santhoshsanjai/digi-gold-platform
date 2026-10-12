from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import Date, DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, IdMixin


class GoldRate(IdMixin, Base):
    """A rate per gram (before GST) entered by staff. The newest one per purity is current."""

    __tablename__ = "gold_rates"

    tenant_id: Mapped[UUID] = mapped_column(ForeignKey("tenants.id", ondelete="CASCADE"))
    purity: Mapped[str] = mapped_column(String(3))
    rate_per_gram: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    entered_by: Mapped[UUID | None] = mapped_column(
        ForeignKey("staff_users.id", ondelete="SET NULL")
    )
    change_pct: Mapped[Decimal | None] = mapped_column(Numeric(7, 2))
    large_change_confirmed: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PaymentOrder(IdMixin, Base):
    """A customer's intent to pay, with the rate quoted and locked for a few minutes."""

    __tablename__ = "payment_orders"

    tenant_id: Mapped[UUID] = mapped_column(ForeignKey("tenants.id", ondelete="CASCADE"))
    customer_id: Mapped[UUID] = mapped_column(ForeignKey("customers.id", ondelete="RESTRICT"))
    amount_inr: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    purity: Mapped[str] = mapped_column(String(3))
    rate_id: Mapped[UUID] = mapped_column(ForeignKey("gold_rates.id", ondelete="RESTRICT"))
    rate_per_gram: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    quoted_grams: Mapped[Decimal] = mapped_column(Numeric(14, 4))
    lock_expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    # created -> pending | paid | failed
    status: Mapped[str] = mapped_column(String(10), default="created")
    provider: Mapped[str] = mapped_column(String(20))
    provider_order_id: Mapped[str] = mapped_column(String(100), default="")
    provider_payment_id: Mapped[str] = mapped_column(String(100), default="")
    failure_reason: Mapped[str] = mapped_column(String(300), default="")
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class GoldLot(IdMixin, Base):
    """Grams bought by one payment. Each lot must be used within the lot validity period."""

    __tablename__ = "gold_lots"

    tenant_id: Mapped[UUID] = mapped_column(ForeignKey("tenants.id", ondelete="CASCADE"))
    customer_id: Mapped[UUID] = mapped_column(ForeignKey("customers.id", ondelete="RESTRICT"))
    order_id: Mapped[UUID] = mapped_column(
        ForeignKey("payment_orders.id", ondelete="RESTRICT"), unique=True
    )
    grams: Mapped[Decimal] = mapped_column(Numeric(14, 4))
    amount_inr: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    rate_per_gram: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    purity: Mapped[str] = mapped_column(String(3))
    paid_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    redeemable_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    # open -> redeemed | refunded
    status: Mapped[str] = mapped_column(String(10), default="open")
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    redemption_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("redemptions.id", ondelete="RESTRICT")
    )
    last_reminded_on: Mapped[date | None] = mapped_column(Date)


class LedgerEntry(IdMixin, Base):
    """Append-only record of every gram and rupee movement for a customer.

    grams and amount_inr are signed: credits are positive, redemptions and refunds negative.
    The customer's running totals always equal the sum of these rows.
    """

    __tablename__ = "ledger_entries"

    tenant_id: Mapped[UUID] = mapped_column(ForeignKey("tenants.id", ondelete="CASCADE"))
    customer_id: Mapped[UUID] = mapped_column(ForeignKey("customers.id", ondelete="RESTRICT"))
    lot_id: Mapped[UUID | None] = mapped_column(ForeignKey("gold_lots.id", ondelete="RESTRICT"))
    order_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("payment_orders.id", ondelete="RESTRICT")
    )
    kind: Mapped[str] = mapped_column(String(20))  # credit | redeem | refund
    grams: Mapped[Decimal] = mapped_column(Numeric(14, 4))
    amount_inr: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    rupee_balance_change: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0"))
    note: Mapped[str] = mapped_column(String(300), default="")
    created_by: Mapped[UUID | None] = mapped_column(
        ForeignKey("staff_users.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Redemption(IdMixin, Base):
    """A store visit where the customer's whole balance is used for jewellery."""

    __tablename__ = "redemptions"

    tenant_id: Mapped[UUID] = mapped_column(ForeignKey("tenants.id", ondelete="CASCADE"))
    customer_id: Mapped[UUID] = mapped_column(ForeignKey("customers.id", ondelete="RESTRICT"))
    store_id: Mapped[UUID | None] = mapped_column(ForeignKey("stores.id", ondelete="SET NULL"))
    staff_user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("staff_users.id", ondelete="SET NULL")
    )
    slip_number: Mapped[str] = mapped_column(String(30))
    grams: Mapped[Decimal] = mapped_column(Numeric(14, 4))
    amount_paid_inr: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    lots_count: Mapped[int]
    purity: Mapped[str] = mapped_column(String(3))
    making_charge_discount_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
