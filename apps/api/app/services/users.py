from datetime import timedelta
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import generate_temp_password, hash_password, now
from app.models import StaffUser


class EmailTaken(Exception):
    pass


def normalise_email(email: str) -> str:
    return email.strip().lower()


def issue_temp_password(user: StaffUser) -> str:
    """Give the user a new temporary password that must be changed on first sign-in."""
    password = generate_temp_password()
    user.password_hash = hash_password(password)
    user.must_change_password = True
    user.temp_password_expires_at = now() + timedelta(hours=get_settings().temp_password_hours)
    user.failed_login_count = 0
    user.locked_until = None
    return password


async def email_exists(session: AsyncSession, tenant_id: UUID | None, email: str) -> bool:
    tenant_match = (
        StaffUser.tenant_id.is_(None) if tenant_id is None else StaffUser.tenant_id == tenant_id
    )
    q = select(func.count()).where(tenant_match, StaffUser.email == normalise_email(email))
    return (await session.scalar(q)) > 0


async def create_staff_user(
    session: AsyncSession,
    *,
    tenant_id: UUID | None,
    email: str,
    name: str,
    role_id: UUID | None,
    phone: str = "",
    store_id: UUID | None = None,
    is_platform_admin: bool = False,
) -> tuple[StaffUser, str]:
    if await email_exists(session, tenant_id, email):
        raise EmailTaken(email)
    user = StaffUser(
        tenant_id=tenant_id,
        email=normalise_email(email),
        name=name.strip(),
        phone=phone,
        role_id=role_id,
        store_id=store_id,
        is_platform_admin=is_platform_admin,
    )
    password = issue_temp_password(user)
    session.add(user)
    await session.flush()
    return user, password
