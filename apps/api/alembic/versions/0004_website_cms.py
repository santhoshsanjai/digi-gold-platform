"""Website content: pages, site settings and uploaded images.

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-12
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql as pg

from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

UUID = pg.UUID(as_uuid=True)
TS = sa.DateTime(timezone=True)
JSONB = pg.JSONB


def _isolate(table: str) -> None:
    op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
    op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
    op.execute(
        f"CREATE POLICY tenant_isolation ON {table} "
        "USING (app_tenant_visible(tenant_id)) WITH CHECK (app_tenant_visible(tenant_id))"
    )


def upgrade() -> None:
    op.add_column(
        "tenants",
        sa.Column("website", JSONB, server_default=sa.text("'{}'::jsonb"), nullable=False),
    )
    op.create_table(
        "site_pages",
        sa.Column("id", UUID, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "tenant_id", UUID, sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("slug", sa.String(80), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("seo_title", sa.String(200), nullable=False, server_default=""),
        sa.Column("seo_description", sa.String(300), nullable=False, server_default=""),
        sa.Column("show_in_nav", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("nav_order", sa.Integer, nullable=False, server_default="0"),
        sa.Column("draft", JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("published", JSONB),
        sa.Column("published_at", TS),
        sa.Column("draft_changed_at", TS),
        sa.Column("created_at", TS, server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", TS, server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("tenant_id", "slug", name="uq_site_pages_tenant_slug"),
    )
    op.create_index("ix_site_pages_tenant_id", "site_pages", ["tenant_id"])
    op.create_table(
        "media_assets",
        sa.Column("id", UUID, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "tenant_id", UUID, sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("storage_key", sa.String(300), nullable=False, unique=True),
        sa.Column("filename", sa.String(200), nullable=False),
        sa.Column("content_type", sa.String(50), nullable=False),
        sa.Column("size_bytes", sa.Integer, nullable=False),
        sa.Column("created_at", TS, server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_media_assets_tenant_id", "media_assets", ["tenant_id"])
    _isolate("site_pages")
    _isolate("media_assets")


def downgrade() -> None:
    op.drop_table("media_assets")
    op.drop_table("site_pages")
    op.drop_column("tenants", "website")
