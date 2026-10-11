"""In-store redemptions.

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-11
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql as pg

from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

UUID = pg.UUID(as_uuid=True)
TS = sa.DateTime(timezone=True)


def upgrade() -> None:
    op.create_table(
        "redemptions",
        sa.Column("id", UUID, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "tenant_id", UUID, sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column(
            "customer_id", UUID, sa.ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False
        ),
        sa.Column("store_id", UUID, sa.ForeignKey("stores.id", ondelete="SET NULL")),
        sa.Column("staff_user_id", UUID, sa.ForeignKey("staff_users.id", ondelete="SET NULL")),
        sa.Column("slip_number", sa.String(30), nullable=False),
        sa.Column("grams", sa.Numeric(14, 4), nullable=False),
        sa.Column("amount_paid_inr", sa.Numeric(14, 2), nullable=False),
        sa.Column("lots_count", sa.Integer, nullable=False),
        sa.Column("purity", sa.String(3), nullable=False),
        sa.Column("making_charge_discount_pct", sa.Numeric(5, 2), nullable=False),
        sa.Column("created_at", TS, server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("tenant_id", "slip_number", name="uq_redemptions_tenant_slip"),
    )
    op.create_index(
        "ix_redemptions_tenant_created", "redemptions", ["tenant_id", sa.text("created_at DESC")]
    )
    op.add_column(
        "gold_lots",
        sa.Column("redemption_id", UUID, sa.ForeignKey("redemptions.id", ondelete="RESTRICT")),
    )
    op.execute("ALTER TABLE redemptions ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE redemptions FORCE ROW LEVEL SECURITY")
    op.execute(
        "CREATE POLICY tenant_isolation ON redemptions "
        "USING (app_tenant_visible(tenant_id)) WITH CHECK (app_tenant_visible(tenant_id))"
    )


def downgrade() -> None:
    op.drop_column("gold_lots", "redemption_id")
    op.drop_table("redemptions")
