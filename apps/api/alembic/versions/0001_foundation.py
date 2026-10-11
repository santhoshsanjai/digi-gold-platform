"""Foundation: tenants, stores, roles, staff users, auth tokens, audit log, row-level security.

Revision ID: 0001
Revises:
Create Date: 2026-10-11
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql as pg

from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

UUID = pg.UUID(as_uuid=True)
TS = sa.DateTime(timezone=True)

# Tables whose rows belong to one tenant. Row-level security hides other tenants' rows
# even if application code forgets a filter.
TENANT_TABLES = ("stores", "roles", "staff_users", "audit_logs")


def _id() -> sa.Column:
    return sa.Column("id", UUID, primary_key=True, server_default=sa.text("gen_random_uuid()"))


def _timestamps() -> list[sa.Column]:
    return [
        sa.Column("created_at", TS, server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", TS, server_default=sa.func.now(), nullable=False),
    ]


def _tenant_fk(nullable: bool = False) -> sa.Column:
    return sa.Column(
        "tenant_id", UUID, sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=nullable
    )


def upgrade() -> None:
    op.create_table(
        "tenants",
        _id(),
        sa.Column("slug", sa.String(63), nullable=False, unique=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("branding", pg.JSONB, nullable=False, server_default="{}"),
        sa.Column("features", pg.JSONB, nullable=False, server_default="{}"),
        sa.Column("settings", pg.JSONB, nullable=False, server_default="{}"),
        sa.Column("config_version", sa.Integer, nullable=False, server_default="1"),
        *_timestamps(),
        sa.CheckConstraint("status IN ('active', 'suspended')", name="status"),
    )
    op.create_table(
        "stores",
        _id(),
        _tenant_fk(),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("address", sa.String(500), nullable=False, server_default=""),
        sa.Column("phone", sa.String(20), nullable=False, server_default=""),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        *_timestamps(),
    )
    op.create_index("ix_stores_tenant_id", "stores", ["tenant_id"])

    op.create_table(
        "roles",
        _id(),
        _tenant_fk(),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.String(300), nullable=False, server_default=""),
        sa.Column("permissions", pg.ARRAY(sa.String(50)), nullable=False, server_default="{}"),
        sa.Column("is_system", sa.Boolean, nullable=False, server_default=sa.false()),
        *_timestamps(),
    )
    op.create_index("ix_roles_tenant_id", "roles", ["tenant_id"])
    op.execute("CREATE UNIQUE INDEX uq_roles_tenant_name ON roles (tenant_id, lower(name))")

    op.create_table(
        "staff_users",
        _id(),
        _tenant_fk(nullable=True),
        sa.Column("role_id", UUID, sa.ForeignKey("roles.id", ondelete="RESTRICT")),
        sa.Column("store_id", UUID, sa.ForeignKey("stores.id", ondelete="SET NULL")),
        sa.Column("email", sa.String(254), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("phone", sa.String(20), nullable=False, server_default=""),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("must_change_password", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("temp_password_expires_at", TS),
        sa.Column("failed_login_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("locked_until", TS),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("is_platform_admin", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("last_login_at", TS),
        *_timestamps(),
        # Platform admins have no tenant; tenant staff always have a role.
        sa.CheckConstraint(
            "(is_platform_admin AND tenant_id IS NULL) OR "
            "(NOT is_platform_admin AND tenant_id IS NOT NULL AND role_id IS NOT NULL)",
            name="kind",
        ),
        sa.CheckConstraint("email = lower(email)", name="email_lower"),
    )
    op.create_index("ix_staff_users_tenant_id", "staff_users", ["tenant_id"])
    op.execute(
        "CREATE UNIQUE INDEX uq_staff_users_tenant_email ON staff_users (tenant_id, email) "
        "NULLS NOT DISTINCT"
    )

    op.create_table(
        "auth_tokens",
        _id(),
        sa.Column(
            "user_id", UUID, sa.ForeignKey("staff_users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("expires_at", TS, nullable=False),
        sa.Column("used_at", TS),
        sa.Column("created_at", TS, server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("kind IN ('refresh', 'reset')", name="kind"),
    )
    op.create_index("ix_auth_tokens_user_id", "auth_tokens", ["user_id"])

    op.create_table(
        "audit_logs",
        _id(),
        _tenant_fk(nullable=True),
        sa.Column("actor_user_id", UUID, sa.ForeignKey("staff_users.id", ondelete="SET NULL")),
        sa.Column("action", sa.String(60), nullable=False),
        sa.Column("entity_type", sa.String(40), nullable=False),
        sa.Column("entity_id", sa.String(64), nullable=False, server_default=""),
        sa.Column("changes", pg.JSONB, nullable=False, server_default="{}"),
        sa.Column("created_at", TS, server_default=sa.func.now(), nullable=False),
    )
    op.create_index(
        "ix_audit_logs_tenant_created", "audit_logs", ["tenant_id", sa.text("created_at DESC")]
    )

    # Row-level security. The API sets app.tenant_id per transaction; Platform Console
    # requests set app.bypass_rls. FORCE applies the policy to the table owner too, so the
    # app must connect as a non-superuser role (superusers always bypass RLS).
    op.execute(
        """
        CREATE FUNCTION app_tenant_visible(row_tenant uuid) RETURNS boolean
        LANGUAGE sql STABLE AS $$
            SELECT coalesce(current_setting('app.bypass_rls', true), '') = 'on'
                OR row_tenant = nullif(current_setting('app.tenant_id', true), '')::uuid
        $$
        """
    )
    for table in TENANT_TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        op.execute(
            f"CREATE POLICY tenant_isolation ON {table} "
            "USING (app_tenant_visible(tenant_id)) WITH CHECK (app_tenant_visible(tenant_id))"
        )


def downgrade() -> None:
    for table in ("audit_logs", "auth_tokens", "staff_users", "roles", "stores", "tenants"):
        op.drop_table(table)
    op.execute("DROP FUNCTION IF EXISTS app_tenant_visible(uuid)")
