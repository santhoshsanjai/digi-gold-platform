from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select

from app.core.deps import Session, Staff, require
from app.models import Store
from app.services import audit

router = APIRouter(prefix="/crm/stores", tags=["crm stores"])


class StoreIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    address: str = Field("", max_length=500)
    phone: str = Field("", max_length=20)


class StoreUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    address: str | None = Field(None, max_length=500)
    phone: str | None = Field(None, max_length=20)
    is_active: bool | None = None


class StoreOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    address: str
    phone: str
    is_active: bool


@router.get("", response_model=list[StoreOut])
async def list_stores(staff: Annotated[Staff, Depends(require("stores:view"))], session: Session):
    rows = await session.scalars(
        select(Store).where(Store.tenant_id == staff.tenant_id).order_by(Store.name)
    )
    return list(rows)


@router.post("", response_model=StoreOut, status_code=201)
async def create_store(
    body: StoreIn, staff: Annotated[Staff, Depends(require("stores:create"))], session: Session
):
    store = Store(tenant_id=staff.tenant_id, **body.model_dump())
    session.add(store)
    await session.flush()
    audit.record(
        session,
        tenant_id=staff.tenant_id,
        actor_id=staff.user.id,
        action="store.created",
        entity_type="store",
        entity_id=store.id,
        changes=body.model_dump(),
    )
    return store


@router.patch("/{store_id}", response_model=StoreOut)
async def update_store(
    store_id: UUID,
    body: StoreUpdate,
    staff: Annotated[Staff, Depends(require("stores:edit"))],
    session: Session,
):
    store = await session.get(Store, store_id)
    if store is None or store.tenant_id != staff.tenant_id:
        raise HTTPException(404, "store not found")
    fields = body.model_dump(exclude_unset=True, exclude_none=True)
    before = {k: getattr(store, k) for k in fields}
    for key, value in fields.items():
        setattr(store, key, value)
    audit.record(
        session,
        tenant_id=staff.tenant_id,
        actor_id=staff.user.id,
        action="store.updated",
        entity_type="store",
        entity_id=store.id,
        changes=audit.diff(before, fields),
    )
    return store
