from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, IdMixin, TimestampMixin


class SitePage(IdMixin, TimestampMixin, Base):
    """One website page. Edits go to the draft; the website shows the published copy."""

    __tablename__ = "site_pages"
    __table_args__ = (UniqueConstraint("tenant_id", "slug", name="uq_site_pages_tenant_slug"),)

    tenant_id: Mapped[UUID] = mapped_column(
        ForeignKey("tenants.id", ondelete="CASCADE"), index=True
    )
    slug: Mapped[str] = mapped_column(String(80))
    title: Mapped[str] = mapped_column(String(200))
    seo_title: Mapped[str] = mapped_column(String(200), default="")
    seo_description: Mapped[str] = mapped_column(String(300), default="")
    show_in_nav: Mapped[bool] = mapped_column(default=True)
    nav_order: Mapped[int] = mapped_column(default=0)
    # Validated by app.schemas.website.PageContent before they are stored.
    draft: Mapped[dict] = mapped_column(JSONB, default=dict)
    # SQL NULL (not JSON null) when unpublished, so "IS NOT NULL" means live.
    published: Mapped[dict | None] = mapped_column(JSONB(none_as_null=True))
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    draft_changed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class MediaAsset(IdMixin, Base):
    """An uploaded image (logo, banner, gallery photo)."""

    __tablename__ = "media_assets"

    tenant_id: Mapped[UUID] = mapped_column(
        ForeignKey("tenants.id", ondelete="CASCADE"), index=True
    )
    storage_key: Mapped[str] = mapped_column(String(300), unique=True)
    filename: Mapped[str] = mapped_column(String(200))
    content_type: Mapped[str] = mapped_column(String(50))
    size_bytes: Mapped[int]
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
