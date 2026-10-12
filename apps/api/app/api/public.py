"""Unauthenticated endpoints read by the mobile app and website at start-up."""

from decimal import Decimal

from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy import select

from app.core.deps import Session
from app.models import Tenant
from app.schemas.tenant_config import Branding, Features, SchemeSettings, merged
from app.services import config_cache

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
