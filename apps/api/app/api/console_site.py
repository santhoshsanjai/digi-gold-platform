"""Platform Console: each client's website content and image library."""

from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, select

from app.api.common import Limit, Offset, Page
from app.core.deps import PlatformAdmin, Session
from app.core.security import now
from app.models import MediaAsset, SitePage, Tenant
from app.schemas.website import SECTION_TYPES, PageContent, WebsiteSettings
from app.services import audit, media, site_cache

router = APIRouter(prefix="/console/tenants/{tenant_id}", tags=["platform console: website"])

Slug = Annotated[str, Field(pattern=r"^(?:home|[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?)$")]


class PageMeta(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    seo_title: str = Field("", max_length=200)
    seo_description: str = Field("", max_length=300)
    show_in_nav: bool = True
    nav_order: int = Field(0, ge=0, le=1000)


class PageCreate(PageMeta):
    slug: Slug


class PageUpdate(BaseModel):
    """Fields left out keep their value. Saving content changes the draft only."""

    slug: Slug | None = None
    title: str | None = Field(None, min_length=1, max_length=200)
    seo_title: str | None = Field(None, max_length=200)
    seo_description: str | None = Field(None, max_length=300)
    show_in_nav: bool | None = None
    nav_order: int | None = Field(None, ge=0, le=1000)
    content: PageContent | None = None


class PageSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    slug: str
    title: str
    show_in_nav: bool
    nav_order: int
    published_at: datetime | None
    draft_changed_at: datetime | None
    updated_at: datetime
    status: str = ""


class PageOut(PageSummary):
    seo_title: str
    seo_description: str
    content: PageContent
    published_content: PageContent | None


class MediaOut(BaseModel):
    id: UUID
    url: str
    filename: str
    content_type: str
    size_bytes: int
    created_at: datetime


class SectionTypesOut(BaseModel):
    types: list[str]


def _status(page: SitePage) -> str:
    if page.published is None:
        return "draft"
    if page.draft_changed_at and page.published_at and page.draft_changed_at > page.published_at:
        return "changed"
    return "published"


def _summary(page: SitePage) -> PageSummary:
    return PageSummary.model_validate(page).model_copy(update={"status": _status(page)})


def _out(page: SitePage) -> PageOut:
    return PageOut(
        **_summary(page).model_dump(),
        seo_title=page.seo_title,
        seo_description=page.seo_description,
        content=PageContent.model_validate(page.draft or {}),
        published_content=PageContent.model_validate(page.published)
        if page.published is not None
        else None,
    )


async def _tenant(session, tenant_id: UUID) -> Tenant:
    tenant = await session.get(Tenant, tenant_id)
    if tenant is None:
        raise HTTPException(404, "tenant not found")
    return tenant


async def _page(session, tenant: Tenant, page_id: UUID) -> SitePage:
    page = await session.get(SitePage, page_id)
    if page is None or page.tenant_id != tenant.id:
        raise HTTPException(404, "page not found")
    return page


async def _slug_free(session, tenant: Tenant, slug: str, exclude: UUID | None = None) -> None:
    query = select(SitePage.id).where(SitePage.tenant_id == tenant.id, SitePage.slug == slug)
    if exclude:
        query = query.where(SitePage.id != exclude)
    if await session.scalar(query):
        raise HTTPException(409, "another page already uses this address")


def _record(session, admin, tenant: Tenant, action: str, page: SitePage | None, changes=None):
    audit.record(
        session,
        tenant_id=tenant.id,
        actor_id=admin.user.id,
        action=action,
        entity_type="site_page" if page else "tenant",
        entity_id=page.id if page else tenant.id,
        changes=changes or {},
    )


@router.get("/website/section-types", response_model=SectionTypesOut)
async def section_types(tenant_id: UUID, admin: PlatformAdmin):
    return SectionTypesOut(types=SECTION_TYPES)


@router.get("/website", response_model=WebsiteSettings)
async def get_website(tenant_id: UUID, admin: PlatformAdmin, session: Session):
    tenant = await _tenant(session, tenant_id)
    return WebsiteSettings.model_validate(tenant.website or {})


@router.put("/website", response_model=WebsiteSettings)
async def save_website(
    tenant_id: UUID, body: WebsiteSettings, admin: PlatformAdmin, session: Session
):
    tenant = await _tenant(session, tenant_id)
    after = body.model_dump(mode="json")
    changes = audit.diff(tenant.website or {}, after)
    tenant.website = after
    site_cache.invalidate(tenant.slug)
    _record(session, admin, tenant, "website.settings_updated", None, changes)
    return body


@router.get("/pages", response_model=list[PageSummary])
async def list_pages(tenant_id: UUID, admin: PlatformAdmin, session: Session):
    tenant = await _tenant(session, tenant_id)
    pages = await session.scalars(
        select(SitePage)
        .where(SitePage.tenant_id == tenant.id)
        .order_by(SitePage.nav_order, SitePage.title)
    )
    return [_summary(p) for p in pages]


@router.post("/pages", response_model=PageOut, status_code=201)
async def create_page(tenant_id: UUID, body: PageCreate, admin: PlatformAdmin, session: Session):
    tenant = await _tenant(session, tenant_id)
    await _slug_free(session, tenant, body.slug)
    page = SitePage(
        tenant_id=tenant.id,
        **body.model_dump(),
        draft=PageContent().model_dump(mode="json"),
        draft_changed_at=now(),
    )
    session.add(page)
    await session.flush()
    await session.refresh(page)
    _record(session, admin, tenant, "website.page_created", page, {"slug": page.slug})
    return _out(page)


@router.get("/pages/{page_id}", response_model=PageOut)
async def get_page(tenant_id: UUID, page_id: UUID, admin: PlatformAdmin, session: Session):
    tenant = await _tenant(session, tenant_id)
    return _out(await _page(session, tenant, page_id))


@router.patch("/pages/{page_id}", response_model=PageOut)
async def update_page(
    tenant_id: UUID, page_id: UUID, body: PageUpdate, admin: PlatformAdmin, session: Session
):
    tenant = await _tenant(session, tenant_id)
    page = await _page(session, tenant, page_id)
    fields = body.model_dump(exclude_unset=True, exclude={"content"})
    if fields.get("slug") and fields["slug"] != page.slug:
        await _slug_free(session, tenant, fields["slug"], exclude=page.id)
    for key, value in fields.items():
        if value is not None:
            setattr(page, key, value)
    if body.content is not None:
        page.draft = body.content.model_dump(mode="json")
        page.draft_changed_at = now()
    if page.published is not None:
        # Title, address and menu settings are live at once; only content waits for Publish.
        site_cache.invalidate(tenant.slug)
    await session.flush()
    await session.refresh(page)
    return _out(page)


@router.post("/pages/{page_id}/publish", response_model=PageOut)
async def publish_page(tenant_id: UUID, page_id: UUID, admin: PlatformAdmin, session: Session):
    tenant = await _tenant(session, tenant_id)
    page = await _page(session, tenant, page_id)
    page.published = page.draft
    page.published_at = now()
    site_cache.invalidate(tenant.slug)
    _record(session, admin, tenant, "website.page_published", page, {"slug": page.slug})
    await session.flush()
    await session.refresh(page)
    return _out(page)


@router.post("/pages/{page_id}/unpublish", response_model=PageOut)
async def unpublish_page(tenant_id: UUID, page_id: UUID, admin: PlatformAdmin, session: Session):
    tenant = await _tenant(session, tenant_id)
    page = await _page(session, tenant, page_id)
    page.published = None
    page.published_at = None
    site_cache.invalidate(tenant.slug)
    _record(session, admin, tenant, "website.page_unpublished", page, {"slug": page.slug})
    await session.flush()
    await session.refresh(page)
    return _out(page)


@router.delete("/pages/{page_id}", status_code=204)
async def delete_page(tenant_id: UUID, page_id: UUID, admin: PlatformAdmin, session: Session):
    tenant = await _tenant(session, tenant_id)
    page = await _page(session, tenant, page_id)
    if page.slug == "home":
        raise HTTPException(422, "the home page cannot be deleted")
    await session.delete(page)
    site_cache.invalidate(tenant.slug)
    _record(session, admin, tenant, "website.page_deleted", page, {"slug": page.slug})


def _media_out(asset: MediaAsset, request: Request) -> MediaOut:
    return MediaOut(
        id=asset.id,
        url=media.public_url(asset.storage_key, str(request.base_url)),
        filename=asset.filename,
        content_type=asset.content_type,
        size_bytes=asset.size_bytes,
        created_at=asset.created_at,
    )


@router.get("/media", response_model=Page[MediaOut])
async def list_media(
    tenant_id: UUID,
    request: Request,
    admin: PlatformAdmin,
    session: Session,
    limit: Limit = 40,
    offset: Offset = 0,
):
    tenant = await _tenant(session, tenant_id)
    query = select(MediaAsset).where(MediaAsset.tenant_id == tenant.id)
    total = await session.scalar(select(func.count()).select_from(query.subquery()))
    rows = await session.scalars(
        query.order_by(MediaAsset.created_at.desc()).limit(limit).offset(offset)
    )
    return Page(
        items=[_media_out(a, request) for a in rows], total=total, limit=limit, offset=offset
    )


@router.post("/media", response_model=MediaOut, status_code=201)
async def upload_media(
    tenant_id: UUID,
    request: Request,
    admin: PlatformAdmin,
    session: Session,
    file: Annotated[UploadFile, File()],
):
    tenant = await _tenant(session, tenant_id)
    # Read one byte past the limit so an oversized file is refused without reading it all.
    data = await file.read(media.max_bytes() + 1)
    try:
        content_type, ext = media.validate(data)
    except media.MediaError as e:
        raise HTTPException(422, str(e)) from None
    key = media.new_key(tenant.slug, ext)
    media.storage().save(key, data)
    asset = MediaAsset(
        tenant_id=tenant.id,
        storage_key=key,
        filename=(file.filename or f"image.{ext}")[:200],
        content_type=content_type,
        size_bytes=len(data),
    )
    session.add(asset)
    await session.flush()
    await session.refresh(asset)
    return _media_out(asset, request)


@router.delete("/media/{media_id}", status_code=204)
async def delete_media(tenant_id: UUID, media_id: UUID, admin: PlatformAdmin, session: Session):
    """Removes the file. Pages still pointing at it show a broken image until edited."""
    tenant = await _tenant(session, tenant_id)
    asset = await session.get(MediaAsset, media_id)
    if asset is None or asset.tenant_id != tenant.id:
        raise HTTPException(404, "image not found")
    await session.delete(asset)
    await session.flush()
    media.storage().delete(asset.storage_key)
