from datetime import timedelta

from sqlalchemy import update

from app.core import email
from app.core.db import SessionLocal, bypass_tenant_scope
from app.core.security import now
from app.models import StaffUser
from tests.conftest import (
    ADMIN_EMAIL,
    ADMIN_PASSWORD,
    API,
    bearer,
    create_tenant,
    last_temp_password,
    login,
    make_platform_admin,
)


async def test_platform_admin_signs_in_without_tenant(client):
    await make_platform_admin()
    r = await login(client, ADMIN_EMAIL, ADMIN_PASSWORD)
    assert r.status_code == 200
    me = (await client.get(f"{API}/auth/me", headers=bearer(r.json()["access_token"]))).json()
    assert me["is_platform_admin"] is True
    assert me["tenant_id"] is None
    assert me["menu"] == []


async def test_new_owner_must_change_temporary_password(client, admin_headers):
    await create_tenant(client, admin_headers)
    temp = last_temp_password("owner@sri.example.com")

    r = await login(client, "owner@sri.example.com", temp, "sri-gold")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "password_change_required"
    assert "access_token" not in body

    # The temporary password cannot be kept.
    r2 = await client.post(
        f"{API}/auth/first-login",
        json={"password_change_token": body["password_change_token"], "new_password": temp},
    )
    assert r2.status_code == 422

    r3 = await client.post(
        f"{API}/auth/first-login",
        json={
            "password_change_token": body["password_change_token"],
            "new_password": "Strong-pass-1",
        },
    )
    assert r3.status_code == 200
    me = (await client.get(f"{API}/auth/me", headers=bearer(r3.json()["access_token"]))).json()
    assert {m["key"] for m in me["menu"]} >= {"dashboard", "users", "roles", "settings"}

    # The old temporary password no longer works; the new one does.
    assert (await login(client, "owner@sri.example.com", temp, "sri-gold")).status_code == 401
    r4 = await login(client, "owner@sri.example.com", "Strong-pass-1", "sri-gold")
    assert r4.json()["status"] == "ok"


async def test_weak_new_password_is_rejected(client, admin_headers):
    await create_tenant(client, admin_headers)
    r = await login(
        client, "owner@sri.example.com", last_temp_password("owner@sri.example.com"), "sri-gold"
    )
    r2 = await client.post(
        f"{API}/auth/first-login",
        json={"password_change_token": r.json()["password_change_token"], "new_password": "short"},
    )
    assert r2.status_code == 422


async def test_expired_temporary_password(client, admin_headers):
    await create_tenant(client, admin_headers)
    async with SessionLocal() as s, s.begin():
        await bypass_tenant_scope(s)
        await s.execute(
            update(StaffUser)
            .where(StaffUser.email == "owner@sri.example.com")
            .values(temp_password_expires_at=now() - timedelta(minutes=1))
        )
    r = await login(
        client, "owner@sri.example.com", last_temp_password("owner@sri.example.com"), "sri-gold"
    )
    assert r.status_code == 401
    assert "expired" in r.json()["detail"]


async def test_unknown_user_and_unknown_tenant_look_the_same(client, admin_headers):
    await create_tenant(client, admin_headers)
    a = await login(client, "nobody@sri.example.com", "whatever-1", "sri-gold")
    b = await login(client, "owner@sri.example.com", "whatever-1", "no-such-shop")
    assert a.status_code == b.status_code == 401
    assert a.json() == b.json()


async def test_lockout_after_repeated_failures(client):
    await make_platform_admin()
    for _ in range(5):
        assert (await login(client, ADMIN_EMAIL, "wrong-pass-1")).status_code == 401
    # Even the right password is refused while locked.
    assert (await login(client, ADMIN_EMAIL, ADMIN_PASSWORD)).status_code == 423


async def test_refresh_rotates_and_detects_reuse(client):
    await make_platform_admin()
    first = (await login(client, ADMIN_EMAIL, ADMIN_PASSWORD)).json()["refresh_token"]
    r = await client.post(f"{API}/auth/refresh", json={"refresh_token": first})
    assert r.status_code == 200
    second = r.json()["refresh_token"]
    assert second != first

    # Replaying the first token revokes every session, including the second token.
    assert (
        await client.post(f"{API}/auth/refresh", json={"refresh_token": first})
    ).status_code == 401
    assert (
        await client.post(f"{API}/auth/refresh", json={"refresh_token": second})
    ).status_code == 401


async def test_logout_revokes_refresh_token(client):
    await make_platform_admin()
    token = (await login(client, ADMIN_EMAIL, ADMIN_PASSWORD)).json()["refresh_token"]
    assert (
        await client.post(f"{API}/auth/logout", json={"refresh_token": token})
    ).status_code == 204
    assert (
        await client.post(f"{API}/auth/refresh", json={"refresh_token": token})
    ).status_code == 401


async def test_forgot_and_reset_password(client, admin_headers):
    await create_tenant(client, admin_headers)
    r = await client.post(
        f"{API}/auth/forgot-password", json={"tenant": "sri-gold", "email": "owner@sri.example.com"}
    )
    assert r.status_code == 202
    link = next(line for line in email.outbox[-1].body.splitlines() if "token=" in line)
    token = link.split("token=", 1)[1]

    r = await client.post(
        f"{API}/auth/reset-password", json={"token": token, "new_password": "Brand-new-pass-9"}
    )
    assert r.status_code == 204
    # Single use.
    r = await client.post(
        f"{API}/auth/reset-password", json={"token": token, "new_password": "Another-pass-9"}
    )
    assert r.status_code == 400
    # Reset also clears the forced change: the user signs straight in.
    assert (await login(client, "owner@sri.example.com", "Brand-new-pass-9", "sri-gold")).json()[
        "status"
    ] == "ok"


async def test_forgot_password_does_not_reveal_accounts(client):
    r = await client.post(
        f"{API}/auth/forgot-password",
        json={"tenant": "sri-gold", "email": "nobody@sri.example.com"},
    )
    assert r.status_code == 202
    assert email.outbox == []


async def test_change_password_needs_current_password(client):
    await make_platform_admin()
    headers = bearer((await login(client, ADMIN_EMAIL, ADMIN_PASSWORD)).json()["access_token"])
    bad = await client.post(
        f"{API}/auth/change-password",
        json={"current_password": "wrong-pass-1", "new_password": "Next-pass-123"},
        headers=headers,
    )
    assert bad.status_code == 400
    ok = await client.post(
        f"{API}/auth/change-password",
        json={"current_password": ADMIN_PASSWORD, "new_password": "Next-pass-123"},
        headers=headers,
    )
    assert ok.status_code == 204
    assert (await login(client, ADMIN_EMAIL, "Next-pass-123")).status_code == 200


async def test_requests_without_token_are_rejected(client):
    assert (await client.get(f"{API}/auth/me")).status_code == 401
    assert (await client.get(f"{API}/auth/me", headers=bearer("junk"))).status_code == 401
