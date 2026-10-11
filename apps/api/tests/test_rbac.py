from tests.conftest import API, last_temp_password, sign_in_first_time


async def _role_id(client, headers, name):
    roles = (await client.get(f"{API}/crm/roles", headers=headers)).json()
    return next(r["id"] for r in roles if r["name"] == name)


async def _add_user(client, headers, email, role):
    r = await client.post(
        f"{API}/crm/users",
        json={"email": email, "name": "Staff", "role_id": await _role_id(client, headers, role)},
        headers=headers,
    )
    assert r.status_code == 201, r.text
    return r.json()


async def test_default_roles_are_seeded(client, owner_headers):
    roles = (await client.get(f"{API}/crm/roles", headers=owner_headers)).json()
    assert {r["name"] for r in roles} == {
        "Owner",
        "Manager",
        "Rate manager",
        "Store staff",
        "Viewer",
    }
    owner = next(r for r in roles if r["name"] == "Owner")
    assert owner["is_system"] and owner["user_count"] == 1


async def test_menu_follows_role_permissions(client, owner_headers):
    user = await _add_user(client, owner_headers, "staff@sri.example.com", "Store staff")
    assert user["must_change_password"] is True
    staff = await sign_in_first_time(client, "sri-gold", "staff@sri.example.com")

    me = (await client.get(f"{API}/auth/me", headers=staff)).json()
    assert [m["key"] for m in me["menu"]] == ["dashboard", "customers", "redemptions"]
    assert (await client.get(f"{API}/crm/users", headers=staff)).status_code == 403
    assert (await client.get(f"{API}/crm/settings", headers=staff)).status_code == 403


async def test_role_change_applies_immediately(client, owner_headers):
    user = await _add_user(client, owner_headers, "staff@sri.example.com", "Store staff")
    staff = await sign_in_first_time(client, "sri-gold", "staff@sri.example.com")
    viewer = await _role_id(client, owner_headers, "Viewer")
    await client.patch(
        f"{API}/crm/users/{user['id']}", json={"role_id": viewer}, headers=owner_headers
    )
    me = (await client.get(f"{API}/auth/me", headers=staff)).json()
    assert "redemptions:create" not in me["permissions"]


async def test_deactivated_user_is_signed_out(client, owner_headers):
    user = await _add_user(client, owner_headers, "staff@sri.example.com", "Viewer")
    staff = await sign_in_first_time(client, "sri-gold", "staff@sri.example.com")
    r = await client.patch(
        f"{API}/crm/users/{user['id']}", json={"is_active": False}, headers=owner_headers
    )
    assert r.status_code == 200
    assert (await client.get(f"{API}/auth/me", headers=staff)).status_code == 401


async def test_custom_role_and_its_guards(client, owner_headers):
    r = await client.post(
        f"{API}/crm/roles",
        json={"name": "Auditor", "permissions": ["reports:view", "no:such"]},
        headers=owner_headers,
    )
    assert r.status_code == 422
    r = await client.post(
        f"{API}/crm/roles",
        json={"name": "Auditor", "permissions": ["reports:view", "dashboard:view"]},
        headers=owner_headers,
    )
    assert r.status_code == 201
    role = r.json()
    dup = await client.post(
        f"{API}/crm/roles", json={"name": "auditor", "permissions": []}, headers=owner_headers
    )
    assert dup.status_code == 409

    await client.post(
        f"{API}/crm/users",
        json={"email": "a@sri.example.com", "name": "A", "role_id": role["id"]},
        headers=owner_headers,
    )
    assert (
        await client.delete(f"{API}/crm/roles/{role['id']}", headers=owner_headers)
    ).status_code == 409


async def test_owner_role_is_protected(client, owner_headers):
    owner_role = await _role_id(client, owner_headers, "Owner")
    r = await client.patch(
        f"{API}/crm/roles/{owner_role}", json={"permissions": []}, headers=owner_headers
    )
    assert r.status_code == 422
    assert (
        await client.delete(f"{API}/crm/roles/{owner_role}", headers=owner_headers)
    ).status_code == 422


async def test_owner_cannot_demote_or_deactivate_self(client, owner_headers):
    me = (await client.get(f"{API}/auth/me", headers=owner_headers)).json()
    r = await client.patch(
        f"{API}/crm/users/{me['id']}", json={"is_active": False}, headers=owner_headers
    )
    assert r.status_code == 422


async def test_resend_password_forces_a_new_change(client, owner_headers):
    user = await _add_user(client, owner_headers, "staff@sri.example.com", "Viewer")
    await sign_in_first_time(client, "sri-gold", "staff@sri.example.com")
    r = await client.post(f"{API}/crm/users/{user['id']}/resend-password", headers=owner_headers)
    assert r.status_code == 204
    r = await client.post(
        f"{API}/auth/login",
        json={
            "tenant": "sri-gold",
            "email": "staff@sri.example.com",
            "password": last_temp_password("staff@sri.example.com"),
        },
    )
    assert r.json()["status"] == "password_change_required"


async def test_duplicate_user_email(client, owner_headers):
    await _add_user(client, owner_headers, "staff@sri.example.com", "Viewer")
    r = await client.post(
        f"{API}/crm/users",
        json={
            "email": "STAFF@sri.example.com",
            "name": "Dup",
            "role_id": await _role_id(client, owner_headers, "Viewer"),
        },
        headers=owner_headers,
    )
    assert r.status_code == 409
