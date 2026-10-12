"""Unauthenticated endpoints read by the mobile app and website at start-up."""

from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy import select

from app.core.db import scope_to_tenant
from app.core.deps import Session
from app.models import SitePage, Tenant
from app.schemas.tenant_config import Branding, Features, SchemeSettings, merged
from app.schemas.website import PageContent, WebsiteSettings
from app.services import config_cache, site_cache
from app.services.rates import buying_status

router = APIRouter(prefix="/public", tags=["public"])


class PublicScheme(BaseModel):
    purity: str
    min_payment_inr: Decimal
    max_payment_inr: Decimal
    redemption_threshold_grams: Decimal
    lot_validity_days: int
    price_lock_minutes: int


class PublicConfig(BaseModel):
    slug: str
    name: str
    version: int
    branding: Branding
    features: Features
    scheme: PublicScheme


@router.get("/tenants/{slug}/config", response_model=PublicConfig)
async def tenant_config(slug: str, session: Session, response: Response):
    response.headers["Cache-Control"] = "public, max-age=60"
    cached = config_cache.get(slug)
    if cached is not None:
        return cached
    tenant = await session.scalar(
        select(Tenant).where(Tenant.slug == slug, Tenant.status == "active")
    )
    if tenant is None:
        raise HTTPException(404, "unknown client")
    scheme = merged(SchemeSettings, tenant.settings)
    config = PublicConfig(
        slug=tenant.slug,
        name=tenant.name,
        version=tenant.config_version,
        branding=merged(Branding, tenant.branding),
        features=merged(Features, tenant.features),
        scheme=PublicScheme(**scheme.model_dump(include=set(PublicScheme.model_fields))),
    ).model_dump(mode="json")
    config_cache.put(slug, config)
    return config


async def _active_tenant(session, slug: str) -> Tenant:
    tenant = await session.scalar(
        select(Tenant).where(Tenant.slug == slug, Tenant.status == "active")
    )
    if tenant is None:
        raise HTTPException(404, "unknown client")
    await scope_to_tenant(session, tenant.id)
    return tenant


class NavItem(BaseModel):
    slug: str
    title: str


class PublicSite(BaseModel):
    name: str
    settings: WebsiteSettings
    nav: list[NavItem]
    pages: list[str]


class PublicPage(BaseModel):
    slug: str
    title: str
    seo_title: str
    seo_description: str
    content: PageContent
    published_at: datetime


@router.get("/tenants/{slug}/site", response_model=PublicSite)
async def website(slug: str, session: Session, response: Response):
    """Site-wide content and the menu, for the website's layout and pre-rendering."""
    response.headers["Cache-Control"] = "public, max-age=60"
    cached = site_cache.get(slug, "site")
    if cached is not None:
        return cached
    tenant = await _active_tenant(session, slug)
    pages = (
        await session.execute(
            select(SitePage.slug, SitePage.title, SitePage.show_in_nav)
            .where(SitePage.tenant_id == tenant.id, SitePage.published.is_not(None))
            .order_by(SitePage.nav_order, SitePage.title)
        )
    ).all()
    site = PublicSite(
        name=tenant.name,
        settings=WebsiteSettings.model_validate(tenant.website or {}),
        nav=[NavItem(slug=p.slug, title=p.title) for p in pages if p.show_in_nav],
        pages=[p.slug for p in pages],
    ).model_dump(mode="json")
    site_cache.put(slug, "site", site)
    return site


@router.get("/tenants/{slug}/pages/{page_slug}", response_model=PublicPage)
async def website_page(slug: str, page_slug: str, session: Session, response: Response):
    """A published page. Drafts are never served here."""
    response.headers["Cache-Control"] = "public, max-age=60"
    cache_key = f"page:{page_slug}"
    cached = site_cache.get(slug, cache_key)
    if cached is not None:
        return cached
    tenant = await _active_tenant(session, slug)
    page = await session.scalar(
        select(SitePage).where(
            SitePage.tenant_id == tenant.id,
            SitePage.slug == page_slug,
            SitePage.published.is_not(None),
        )
    )
    if page is None:
        raise HTTPException(404, "page not found")
    out = PublicPage(
        slug=page.slug,
        title=page.title,
        seo_title=page.seo_title,
        seo_description=page.seo_description,
        content=PageContent.model_validate(page.published),
        published_at=page.published_at,
    ).model_dump(mode="json")
    site_cache.put(slug, cache_key, out)
    return out


class PublicRate(BaseModel):
    purity: str
    rate_per_gram: Decimal | None
    updated_at: datetime | None
    buying_open: bool


@router.get("/tenants/{slug}/rate", response_model=PublicRate)
async def todays_rate(slug: str, session: Session, response: Response):
    """Today's rate for the website's gold rate section. Not cached server-side: rates
    change during the day, and this is one indexed read."""
    response.headers["Cache-Control"] = "public, max-age=30"
    tenant = await _active_tenant(session, slug)
    scheme = merged(SchemeSettings, tenant.settings)
    status = await buying_status(session, tenant, scheme)
    return PublicRate(
        purity=scheme.purity,
        rate_per_gram=status.rate.rate_per_gram if status.rate else None,
        updated_at=status.rate.created_at if status.rate else None,
        buying_open=status.open,
    )
