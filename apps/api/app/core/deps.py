from dataclasses import dataclass
from typing import Annotated
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import bypass_tenant_scope, get_session, scope_to_tenant
from app.core.security import ACCESS, decode_jwt
from app.models import Customer, Role, StaffUser, Tenant

# scope="function" ends the transaction (commit or rollback) before the response is sent. By
# default FastAPI does it afterwards, so a client that reads right after a write could miss it,
# and a failed commit would still have answered 200.
Session = Annotated[AsyncSession, Depends(get_session, scope="function")]
_bearer = HTTPBearer(auto_error=False)


async def tenant_active(session: AsyncSession, tenant_id: UUID | None) -> bool:
    """A suspended client's staff and customers lose access, including sessions already open."""
    if tenant_id is None:
        return True
    return await session.scalar(select(Tenant.status).where(Tenant.id == tenant_id)) == "active"


def unauthorized(detail: str = "not authenticated") -> HTTPException:
    return HTTPException(
        status.HTTP_401_UNAUTHORIZED, detail, headers={"WWW-Authenticate": "Bearer"}
    )


@dataclass(frozen=True)
class Staff:
    user: StaffUser
    permissions: frozenset[str]

    @property
    def tenant_id(self) -> UUID | None:
        return self.user.tenant_id

    @property
    def is_platform_admin(self) -> bool:
        return self.user.is_platform_admin


async def current_staff(
    session: Session,
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> Staff:
    """Authenticate the bearer token and scope the request's transaction to its tenant."""
    if creds is None:
        raise unauthorized()
    try:
        claims = decode_jwt(creds.credentials, ACCESS)
        user_id = UUID(claims["sub"])
        tenant_id = UUID(claims["tid"]) if claims.get("tid") else None
    except (jwt.InvalidTokenError, KeyError, ValueError):
        raise unauthorized("invalid or expired token") from None

    if tenant_id is None:
        await bypass_tenant_scope(session)
    else:
        await scope_to_tenant(session, tenant_id)

    row = (
        await session.execute(
            select(StaffUser, Role.permissions)
            .outerjoin(Role, Role.id == StaffUser.role_id)
            .where(StaffUser.id == user_id)
        )
    ).first()
    if row is None:
        raise unauthorized("user not found")
    user, perms = row
    if not user.is_active or user.must_change_password or user.tenant_id != tenant_id:
        raise unauthorized("account is not usable")
    if not await tenant_active(session, tenant_id):
        raise unauthorized("account is not usable")
    return Staff(user=user, permissions=frozenset(perms or ()))


CurrentStaff = Annotated[Staff, Depends(current_staff)]


def require(permission: str):
    """Dependency: the signed-in tenant user must hold this permission."""

    async def check(staff: CurrentStaff) -> Staff:
        if staff.tenant_id is None or permission not in staff.permissions:
            raise HTTPException(status.HTTP_403_FORBIDDEN, f"missing permission {permission}")
        return staff

    return check


async def platform_admin(staff: CurrentStaff) -> Staff:
    if not staff.is_platform_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "platform admins only")
    return staff


PlatformAdmin = Annotated[Staff, Depends(platform_admin)]


CUSTOMER = "customer"


async def current_customer(
    session: Session,
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> Customer:
    """Authenticate a mobile-app customer and scope the transaction to their jeweller."""
    if creds is None:
        raise unauthorized()
    try:
        claims = decode_jwt(creds.credentials, CUSTOMER)
        customer_id, tenant_id = UUID(claims["sub"]), UUID(claims["tid"])
    except (jwt.InvalidTokenError, KeyError, ValueError, TypeError):
        raise unauthorized("invalid or expired token") from None
    await scope_to_tenant(session, tenant_id)
    customer = await session.get(Customer, customer_id)
    if customer is None or not customer.is_active or not await tenant_active(session, tenant_id):
        raise unauthorized("account is not usable")
    return customer


CurrentCustomer = Annotated[Customer, Depends(current_customer)]
