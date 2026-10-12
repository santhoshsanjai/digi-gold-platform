from sqlalchemy import select

from app.core.db import SessionLocal, scope_to_tenant
from app.models import Role, Tenant
from tests.conftest import API, create_tenant, customer_sign_in, sign_in_first_time


async def _two_tenants(client, admin_headers):
    await create_tenant(client, admin_headers, "sri-gold", "owner@sri.example.com")
    await create_tenant(client, admin_headers, "lakshmi", "owner@lakshmi.example.com")
    a = await sign_in_first_time(client, "sri-gold", "owner@sri.example.com")
    b = await sign_in_first_time(client, "lakshmi", "owner@lakshmi.example.com")
    return a, b


async def test_database_hides_other_tenants_rows_without_any_filter(client, admin_headers):
    await _two_tenants(client, admin_headers)
    async with SessionLocal() as s, s.begin():
        sri = await s.scalar(select(Tenant).where(Tenant.slug == "sri-gold"))
        await scope_to_tenant(s, sri.id)
        roles = (await s.scalars(select(Role))).all()  # deliberately no tenant filter
    assert roles and all(r.tenant_id == sri.id for r in roles)


async def test_unscoped_session_sees_no_tenant_rows(client, admin_headers):
    await _two_tenants(client, admin_headers)
    async with SessionLocal() as s, s.begin():
        assert (await s.scalars(select(Role))).all() == []


async def test_owner_cannot_touch_another_tenants_user_or_role(client, admin_headers):
    a, b = await _two_tenants(client, admin_headers)
    b_users = (await client.get(f"{API}/crm/users", headers=b)).json()["items"]
    b_roles = (await client.get(f"{API}/crm/roles", headers=b)).json()

    a_users = (await client.get(f"{API}/crm/users", headers=a)).json()["items"]
    assert {u["id"] for u in a_users}.isdisjoint({u["id"] for u in b_users})

    r = await client.patch(f"{API}/crm/users/{b_users[0]['id']}", json={"name": "x"}, headers=a)
    assert r.status_code == 404
    r = await client.post(
        f"{API}/crm/users",
        json={"email": "new@sri.example.com", "name": "New", "role_id": b_roles[0]["id"]},
        headers=a,
    )
    assert r.status_code == 422


async def test_same_email_can_exist_in_two_tenants(client, admin_headers):
    await create_tenant(client, admin_headers, "sri-gold", "shared@example.com")
    await create_tenant(client, admin_headers, "lakshmi", "shared@example.com")


async def test_tenant_staff_cannot_use_the_platform_console(client, owner_headers):
    r = await client.get(f"{API}/console/tenants", headers=owner_headers)
    assert r.status_code == 403


async def test_platform_admin_cannot_use_crm_endpoints(client, admin_headers):
    assert (await client.get(f"{API}/crm/users", headers=admin_headers)).status_code == 403


async def test_duplicate_slug_is_rejected(client, admin_headers):
    await create_tenant(client, admin_headers)
    r = await client.post(
        f"{API}/console/tenants",
        json={
            "slug": "sri-gold",
            "name": "Again",
            "owner_email": "x@example.com",
            "owner_name": "X",
        },
        headers=admin_headers,
    )
    assert r.status_code == 409


async def test_suspended_tenant_cannot_sign_in(client, admin_headers):
    tenant = await create_tenant(client, admin_headers)
    await sign_in_first_time(client, "sri-gold", "owner@sri.example.com")
    r = await client.patch(
        f"{API}/console/tenants/{tenant['id']}", json={"status": "suspended"}, headers=admin_headers
    )
    assert r.status_code == 200
    r = await client.post(
        f"{API}/auth/login",
        json={"tenant": "sri-gold", "email": "owner@sri.example.com", "password": "Strong-pass-1"},
    )
    assert r.status_code == 401


async def test_suspending_ends_open_sessions(client, admin_headers):
    tenant = await create_tenant(client, admin_headers)
    staff = await sign_in_first_time(client, "sri-gold", "owner@sri.example.com")
    customer = await customer_sign_in(client)
    r = await client.post(
        f"{API}/auth/login",
        json={"tenant": "sri-gold", "email": "owner@sri.example.com", "password": "Strong-pass-1"},
    )
    refresh_token = r.json()["refresh_token"]

    async def set_status(value):
        r = await client.patch(
            f"{API}/console/tenants/{tenant['id']}", json={"status": value}, headers=admin_headers
        )
        assert r.status_code == 200

    await set_status("suspended")
    assert (await client.get(f"{API}/auth/me", headers=staff)).status_code == 401
    assert (await client.get(f"{API}/app/me", headers=customer)).status_code == 401
    r = await client.post(f"{API}/auth/refresh", json={"refresh_token": refresh_token})
    assert r.status_code == 401
    # The platform admin is not tied to a client and keeps working.
    assert (await client.get(f"{API}/auth/me", headers=admin_headers)).status_code == 200

    await set_status("active")
    assert (await client.get(f"{API}/auth/me", headers=staff)).status_code == 200
    assert (await client.get(f"{API}/app/me", headers=customer)).status_code == 200
