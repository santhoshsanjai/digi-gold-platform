"""Email and password sign-in for app customers.

Revision ID: 0005
Revises: 0004
Create Date: 2026-10-25
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TS = sa.DateTime(timezone=True)


def upgrade() -> None:
    op.add_column("customers", sa.Column("password_hash", sa.String(255)))
    op.add_column("customers", sa.Column("temp_password_hash", sa.String(255)))
    op.add_column("customers", sa.Column("temp_password_expires_at", TS))
    op.add_column(
        "customers",
        sa.Column("must_change_password", sa.Boolean, server_default=sa.false(), nullable=False),
    )
    op.add_column(
        "customers",
        sa.Column("failed_login_count", sa.Integer, server_default="0", nullable=False),
    )
    op.add_column("customers", sa.Column("locked_until", TS))
    # Email is the sign-in name only for customers with a password; others may share one.
    op.execute(
        "CREATE UNIQUE INDEX uq_customers_tenant_login_email ON customers (tenant_id, email) "
        "WHERE password_hash IS NOT NULL"
    )


def downgrade() -> None:
    op.execute("DROP INDEX uq_customers_tenant_login_email")
    for column in (
        "locked_until",
        "failed_login_count",
        "must_change_password",
        "temp_password_expires_at",
        "temp_password_hash",
        "password_hash",
    ):
        op.drop_column("customers", column)
