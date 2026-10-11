from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import DEFAULT_ROLES, OWNER_ROLE
from app.models import Role, StaffUser, Tenant
from app.schemas.tenant_config import Branding, Features, SchemeSettings
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
