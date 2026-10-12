from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import DEFAULT_ROLES, OWNER_ROLE
from app.core.security import now
from app.models import Role, SitePage, StaffUser, Tenant
from app.schemas.tenant_config import Branding, Features, SchemeSettings
from app.schemas.website import PageContent
from app.services import audit
from app.services.users import create_staff_user


async def create_tenant(
    session: AsyncSession,
    *,
    slug: str,
    name: str,
    owner_email: str,
    owner_name: str,
    actor_id: UUID | None,
) -> tuple[Tenant, StaffUser, str]:
    """Create a client with default config and roles, plus its Owner user.

    Returns the owner's temporary password so it can be emailed. Caller must have
    bypassed tenant scoping (Platform Console).
    """
    tenant = Tenant(
        slug=slug,
        name=name,
        branding=Branding(display_name=name).model_dump(mode="json"),
        features=Features().model_dump(mode="json"),
        settings=SchemeSettings().model_dump(mode="json"),
    )
    session.add(tenant)
    await session.flush()

    owner_role = None
    for role_name, (description, perms) in DEFAULT_ROLES.items():
        role = Role(
            tenant_id=tenant.id,
            name=role_name,
            description=description,
            permissions=perms,
            is_system=role_name == OWNER_ROLE,
        )
        session.add(role)
        if role_name == OWNER_ROLE:
            owner_role = role
    await session.flush()

    session.add(
        SitePage(
            tenant_id=tenant.id,
            slug="home",
            title="Home",
            draft=starter_home_page(name).model_dump(mode="json"),
            draft_changed_at=now(),
        )
    )

    owner, password = await create_staff_user(
        session, tenant_id=tenant.id, email=owner_email, name=owner_name, role_id=owner_role.id
    )
    audit.record(
        session,
        tenant_id=tenant.id,
        actor_id=actor_id,
        action="tenant.created",
        entity_type="tenant",
        entity_id=tenant.id,
        changes={"slug": slug, "name": name},
    )
    return tenant, owner, password


def starter_home_page(name: str) -> PageContent:
    """A draft home page every new client starts from; edited and published in the Console."""
    return PageContent.model_validate(
        {
            "sections": [
                {
                    "id": "hero",
                    "type": "hero",
                    "heading": f"Save in gold with {name}",
                    "subheading": "Buy gold from ₹100 at today's rate and redeem it at our store.",
                    "cta_label": "Get the app",
                    "cta_url": "#app",
                },
                {"id": "rate", "type": "gold_rate", "heading": "Today's gold rate"},
                {
                    "id": "how",
                    "type": "steps",
                    "heading": "How it works",
                    "items": [
                        {"title": "Pay any amount", "text": "Start from ₹100, whenever you like."},
                        {
                            "title": "Get gold in grams",
                            "text": "Each payment buys gold at the day's rate.",
                        },
                        {"title": "Redeem in store", "text": "Turn your balance into jewellery."},
                    ],
                },
                {"id": "faq", "type": "faq", "heading": "Questions", "items": []},
                {"id": "contact", "type": "contact", "heading": "Visit us"},
            ]
        }
    )
