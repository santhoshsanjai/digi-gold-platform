"""Sample data for trying the platform on a developer's machine. Never runs in production."""

from decimal import Decimal

from sqlalchemy import select

from app.core.config import get_settings
from app.core.db import SessionLocal, bypass_tenant_scope, engine
from app.core.security import hash_password, now
from app.models import GoldRate, SitePage, StaffUser, Store, Tenant
from app.schemas.website import WebsiteSettings
from app.services.tenants import create_tenant
from app.services.users import create_staff_user

PASSWORD = "Demo-pass-2026"
PLATFORM_ADMIN = "admin@platform.example.com"
OWNER = "owner@example.com"
SLUG = "demo"


async def seed_demo() -> list[str]:
    """Create (or refresh) the demo client, its owner, a platform admin, a published rate, a
    store and a live home page. Safe to run again: it resets the demo passwords."""
    if get_settings().env != "dev":
        raise SystemExit("seed-demo only runs with DG_ENV=dev")
    notes: list[str] = []
    async with SessionLocal() as session, session.begin():
        await bypass_tenant_scope(session)

        admin = await session.scalar(select(StaffUser).where(StaffUser.email == PLATFORM_ADMIN))
        if admin is None:
            admin, _ = await create_staff_user(
                session,
                tenant_id=None,
                email=PLATFORM_ADMIN,
                name="Platform Owner",
                role_id=None,
                is_platform_admin=True,
            )
            notes.append("created the platform admin")

        tenant = await session.scalar(select(Tenant).where(Tenant.slug == SLUG))
        if tenant is None:
            tenant, owner, _ = await create_tenant(
                session,
                slug=SLUG,
                name="Demo Jewellers",
                owner_email=OWNER,
                owner_name="Demo Owner",
                actor_id=None,
            )
            notes.append("created the demo client")
        else:
            owner = await session.scalar(select(StaffUser).where(StaffUser.email == OWNER))

        # Known passwords, and no forced change, so you can sign in straight away.
        for user in (admin, owner):
            user.password_hash = hash_password(PASSWORD)
            user.must_change_password = False
            user.failed_login_count = 0
            user.temp_password_expires_at = None
            user.locked_until = None

        if await session.scalar(select(GoldRate.id).where(GoldRate.tenant_id == tenant.id)) is None:
            session.add(
                GoldRate(
                    tenant_id=tenant.id,
                    purity="22K",
                    rate_per_gram=Decimal("7000.00"),
                    entered_by=owner.id,
                )
            )
            notes.append("published a 22K rate of 7,000.00 per gram")
        if await session.scalar(select(Store.id).where(Store.tenant_id == tenant.id)) is None:
            session.add(Store(tenant_id=tenant.id, name="Madurai Main", address="West Masi Street"))
            notes.append("added the store Madurai Main")

        tenant.website = WebsiteSettings.model_validate(
            {
                "tagline": "Save in gold from ₹100",
                "contact": {"phone": "+91 452 234 5678", "email": "care@demo.example"},
            }
        ).model_dump(mode="json")
        home = await session.scalar(
            select(SitePage).where(SitePage.tenant_id == tenant.id, SitePage.slug == "home")
        )
        if home is not None and home.published is None:
            home.published = home.draft
            home.published_at = now()
            notes.append("published the home page")
    await engine.dispose()
    return notes
