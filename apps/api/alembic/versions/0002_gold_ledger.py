"""Gold savings core: rates, customers, OTPs, payment orders, gold lots, ledger.

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-11
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql as pg

from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

UUID = pg.UUID(as_uuid=True)
TS = sa.DateTime(timezone=True)
GRAMS = sa.Numeric(14, 4)
MONEY = sa.Numeric(14, 2)
RATE = sa.Numeric(12, 2)

TENANT_TABLES = (
    "gold_rates",
    "customers",
    "customer_otps",
    "payment_orders",
    "gold_lots",
    "ledger_entries",
)


def _id() -> sa.Column:
    return sa.Column("id", UUID, primary_key=True, server_default=sa.text("gen_random_uuid()"))


def _tenant() -> sa.Column:
    return sa.Column(
        "tenant_id", UUID, sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
    )


def _created() -> sa.Column:
    return sa.Column("created_at", TS, server_default=sa.func.now(), nullable=False)


def _fk(name: str, target: str, ondelete: str = "RESTRICT", nullable: bool = False) -> sa.Column:
    return sa.Column(name, UUID, sa.ForeignKey(target, ondelete=ondelete), nullable=nullable)


def upgrade() -> None:
    op.add_column(
        "tenants",
        sa.Column("buying_paused", sa.Boolean, nullable=False, server_default=sa.false()),
    )

    op.create_table(
        "gold_rates",
        _id(),
        _tenant(),
        sa.Column("purity", sa.String(3), nullable=False),
        sa.Column("rate_per_gram", RATE, nullable=False),
        _fk("entered_by", "staff_users.id", "SET NULL", nullable=True),
        sa.Column("change_pct", sa.Numeric(7, 2)),
        sa.Column("large_change_confirmed", sa.Boolean, nullable=False, server_default=sa.false()),
        _created(),
        sa.CheckConstraint("purity IN ('22K', '24K')", name="purity"),
        sa.CheckConstraint("rate_per_gram > 0", name="positive"),
    )
    op.create_index(
        "ix_gold_rates_current", "gold_rates", ["tenant_id", "purity", sa.text("created_at DESC")]
    )

    op.create_table(
        "customers",
        _id(),
        _tenant(),
        sa.Column("phone", sa.String(15), nullable=False),
        sa.Column("name", sa.String(200), nullable=False, server_default=""),
        sa.Column("email", sa.String(254), nullable=False, server_default=""),
        sa.Column("pan", sa.String(10)),
        sa.Column("pan_verified", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("gold_grams", GRAMS, nullable=False, server_default="0"),
        sa.Column("rupee_balance_inr", MONEY, nullable=False, server_default="0"),
        sa.Column("total_paid_inr", MONEY, nullable=False, server_default="0"),
        sa.Column("last_login_at", TS),
        _created(),
        sa.Column("updated_at", TS, server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("tenant_id", "phone", name="uq_customers_tenant_phone"),
        sa.CheckConstraint("gold_grams >= 0 AND rupee_balance_inr >= 0", name="non_negative"),
    )
    op.execute("CREATE INDEX ix_customers_tenant_name ON customers (tenant_id, lower(name))")

    op.create_table(
        "customer_otps",
        _id(),
        _tenant(),
        sa.Column("phone", sa.String(15), nullable=False),
        sa.Column("purpose", sa.String(20), nullable=False),
        sa.Column("code_hash", sa.String(64), nullable=False),
        sa.Column("expires_at", TS, nullable=False),
        sa.Column("attempts", sa.Integer, nullable=False, server_default="0"),
        sa.Column("consumed_at", TS),
        _created(),
    )
    op.create_index(
        "ix_customer_otps_lookup",
        "customer_otps",
        ["tenant_id", "phone", "purpose", sa.text("created_at DESC")],
    )

    op.create_table(
        "customer_tokens",
        _id(),
        _fk("customer_id", "customers.id", "CASCADE"),
        sa.Column("token_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("expires_at", TS, nullable=False),
        sa.Column("used_at", TS),
        _created(),
    )
    op.create_index("ix_customer_tokens_customer_id", "customer_tokens", ["customer_id"])

    op.create_table(
        "payment_orders",
        _id(),
        _tenant(),
        _fk("customer_id", "customers.id"),
        sa.Column("amount_inr", MONEY, nullable=False),
        sa.Column("purity", sa.String(3), nullable=False),
        _fk("rate_id", "gold_rates.id"),
        sa.Column("rate_per_gram", RATE, nullable=False),
        sa.Column("quoted_grams", GRAMS, nullable=False),
        sa.Column("lock_expires_at", TS, nullable=False),
        sa.Column("status", sa.String(10), nullable=False, server_default="created"),
        sa.Column("provider", sa.String(20), nullable=False),
        sa.Column("provider_order_id", sa.String(100), nullable=False, server_default=""),
        sa.Column("provider_payment_id", sa.String(100), nullable=False, server_default=""),
        sa.Column("failure_reason", sa.String(300), nullable=False, server_default=""),
        sa.Column("paid_at", TS),
        _created(),
        sa.CheckConstraint("amount_inr > 0", name="positive"),
        sa.CheckConstraint("status IN ('created', 'pending', 'paid', 'failed')", name="status"),
    )
    op.create_index(
        "ix_payment_orders_tenant_created",
        "payment_orders",
        ["tenant_id", sa.text("created_at DESC")],
    )
    op.create_index("ix_payment_orders_customer", "payment_orders", ["customer_id"])

    op.create_table(
        "gold_lots",
        _id(),
        _tenant(),
        _fk("customer_id", "customers.id"),
        sa.Column(
            "order_id",
            UUID,
            sa.ForeignKey("payment_orders.id", ondelete="RESTRICT"),
            nullable=False,
            unique=True,
        ),
        sa.Column("grams", GRAMS, nullable=False),
        sa.Column("amount_inr", MONEY, nullable=False),
        sa.Column("rate_per_gram", RATE, nullable=False),
        sa.Column("purity", sa.String(3), nullable=False),
        sa.Column("paid_at", TS, nullable=False),
        sa.Column("redeemable_at", TS, nullable=False),
        sa.Column("expires_at", TS, nullable=False),
        sa.Column("status", sa.String(10), nullable=False, server_default="open"),
        sa.Column("closed_at", TS),
        sa.Column("last_reminded_on", sa.Date),
        sa.CheckConstraint("status IN ('open', 'redeemed', 'refunded')", name="status"),
        sa.CheckConstraint("grams >= 0", name="non_negative"),
    )
    op.create_index("ix_gold_lots_customer", "gold_lots", ["customer_id", "status"])
    op.execute(
        "CREATE INDEX ix_gold_lots_open_expiry ON gold_lots (tenant_id, expires_at) "
        "WHERE status = 'open'"
    )

    op.create_table(
        "ledger_entries",
        _id(),
        _tenant(),
        _fk("customer_id", "customers.id"),
        _fk("lot_id", "gold_lots.id", nullable=True),
        _fk("order_id", "payment_orders.id", nullable=True),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("grams", GRAMS, nullable=False),
        sa.Column("amount_inr", MONEY, nullable=False),
        sa.Column("rupee_balance_change", MONEY, nullable=False, server_default="0"),
        sa.Column("note", sa.String(300), nullable=False, server_default=""),
        _fk("created_by", "staff_users.id", "SET NULL", nullable=True),
        _created(),
        sa.CheckConstraint("kind IN ('credit', 'redeem', 'refund')", name="kind"),
    )
    op.create_index(
        "ix_ledger_entries_customer", "ledger_entries", ["customer_id", sa.text("created_at DESC")]
    )
    # The ledger is append-only: no updates or deletes, even by mistake in application code.
    op.execute(
        """
        CREATE FUNCTION ledger_entries_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
            RAISE EXCEPTION 'ledger_entries is append-only';
        END
        $$
        """
    )
    op.execute(
        "CREATE TRIGGER ledger_entries_append_only BEFORE UPDATE OR DELETE ON ledger_entries "
        "FOR EACH ROW EXECUTE FUNCTION ledger_entries_append_only()"
    )

    for table in TENANT_TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        op.execute(
            f"CREATE POLICY tenant_isolation ON {table} "
            "USING (app_tenant_visible(tenant_id)) WITH CHECK (app_tenant_visible(tenant_id))"
        )


def downgrade() -> None:
    for table in (
        "ledger_entries",
        "gold_lots",
        "payment_orders",
        "customer_tokens",
        "customer_otps",
        "customers",
        "gold_rates",
    ):
        op.drop_table(table)
    op.execute("DROP FUNCTION IF EXISTS ledger_entries_append_only()")
    op.drop_column("tenants", "buying_paused")
