"""Roles and permissions. The CRM side menu follows the permissions in a user's role."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import func, select

from app.core.deps import Session, Staff, require
from app.core.permissions import ACTIONS, MENU, MODULES, validate_permissions
from app.models import Role, StaffUser
from app.services import audit

router = APIRouter(prefix="/crm", tags=["crm roles"])


class RoleIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str = Field("", max_length=300)
    permissions: list[str]

    @field_validator("permissions")
    @classmethod
    def _known(cls, v: list[str]) -> list[str]:
        return validate_permissions(v)


class RoleUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    description: str | None = Field(None, max_length=300)
    permissions: list[str] | None = None

    @field_validator("permissions")
    @classmethod
    def _known(cls, v: list[str] | None) -> list[str] | None:
        return None if v is None else validate_permissions(v)


class RoleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: str
    permissions: list[str]
    is_system: bool
    user_count: int = 0


class CatalogueOut(BaseModel):
    modules: list[str]
    actions: list[str]
    menu: list[dict]


@router.get("/permissions", response_model=CatalogueOut)
async def permission_catalogue(staff: Annotated[Staff, Depends(require("roles:view"))]):
    """Everything the role editor needs to draw its permission grid."""
    return CatalogueOut(
        modules=list(MODULES),
        actions=list(ACTIONS),
        menu=[{"key": m.key, "label": m.label, "permission": m.permission} for m in MENU],
    )


@router.get("/roles", response_model=list[RoleOut])
async def list_roles(staff: Annotated[Staff, Depends(require("roles:view"))], session: Session):
    counts = (
        select(StaffUser.role_id, func.count().label("n"))
        .where(StaffUser.tenant_id == staff.tenant_id)
        .group_by(StaffUser.role_id)
        .subquery()
    )
    rows = await session.execute(
        select(Role, func.coalesce(counts.c.n, 0))
        .outerjoin(counts, counts.c.role_id == Role.id)
        .where(Role.tenant_id == staff.tenant_id)
        .order_by(Role.is_system.desc(), Role.name)
    )
    return [RoleOut.model_validate(role).model_copy(update={"user_count": n}) for role, n in rows]


async def _name_free(session, staff: Staff, name: str, exclude: UUID | None = None) -> None:
    q = select(Role.id).where(
        Role.tenant_id == staff.tenant_id, func.lower(Role.name) == name.lower()
    )
    if exclude:
        q = q.where(Role.id != exclude)
    if await session.scalar(q):
        raise HTTPException(409, "a role with this name already exists")


@router.post("/roles", response_model=RoleOut, status_code=201)
async def create_role(
    body: RoleIn, staff: Annotated[Staff, Depends(require("roles:create"))], session: Session
):
    await _name_free(session, staff, body.name)
    role = Role(tenant_id=staff.tenant_id, **body.model_dump())
    session.add(role)
    await session.flush()
    audit.record(
        session,
        tenant_id=staff.tenant_id,
        actor_id=staff.user.id,
        action="role.created",
        entity_type="role",
        entity_id=role.id,
        changes=body.model_dump(),
    )
    return role


async def _get_role(session, staff: Staff, role_id: UUID) -> Role:
    role = await session.get(Role, role_id)
    if role is None or role.tenant_id != staff.tenant_id:
        raise HTTPException(404, "role not found")
    return role


@router.patch("/roles/{role_id}", response_model=RoleOut)
async def update_role(
    role_id: UUID,
    body: RoleUpdate,
    staff: Annotated[Staff, Depends(require("roles:edit"))],
    session: Session,
):
    role = await _get_role(session, staff, role_id)
    fields = body.model_dump(exclude_unset=True, exclude_none=True)
    if role.is_system and ("permissions" in fields or "name" in fields):
        raise HTTPException(422, "the Owner role's name and permissions cannot be changed")
    if "name" in fields:
        await _name_free(session, staff, fields["name"], exclude=role.id)
    before = {k: getattr(role, k) for k in fields}
    for key, value in fields.items():
        setattr(role, key, value)
    audit.record(
        session,
        tenant_id=staff.tenant_id,
        actor_id=staff.user.id,
        action="role.updated",
        entity_type="role",
        entity_id=role.id,
        changes=audit.diff(before, fields),
    )
    return role


@router.delete("/roles/{role_id}", status_code=204)
async def delete_role(
    role_id: UUID, staff: Annotated[Staff, Depends(require("roles:delete"))], session: Session
):
    role = await _get_role(session, staff, role_id)
    if role.is_system:
        raise HTTPException(422, "the Owner role cannot be deleted")
    if await session.scalar(select(func.count()).where(StaffUser.role_id == role.id)):
        raise HTTPException(409, "move this role's users to another role first")
    await session.delete(role)
    audit.record(
        session,
        tenant_id=staff.tenant_id,
        actor_id=staff.user.id,
        action="role.deleted",
        entity_type="role",
        entity_id=role.id,
        changes={"name": role.name},
    )
