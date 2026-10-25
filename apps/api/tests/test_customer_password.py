from datetime import timedelta

from sqlalchemy import update

from app.core import email
from app.core.db import SessionLocal, bypass_tenant_scope
from app.core.security import now
from app.models import Customer
from tests.conftest import API, bearer, customer_sign_in, last_otp

AUTH = f"{API}/app/auth"
DETAILS = {
    "tenant": "sri-gold",
    "name": "Priya Raman",
    "email": "Priya@Example.com",
    "phone": "9876543210",
    "password": "Gold-pass-1",
}


async def _register(client, **changes):
    body = {**DETAILS, **changes}
    r = await client.post(f"{AUTH}/register/otp", json=body)
    assert r.status_code == 202, r.text
    r = await client.post(
        f"{AUTH}/register", json={**body, "code": last_otp("+91" + body["phone"][-10:])}
    )
    assert r.status_code == 201, r.text


async def _login(client, password="Gold-pass-1", email_="priya@example.com"):
    return await client.post(
        f"{AUTH}/login", json={"tenant": "sri-gold", "email": email_, "password": password}
    )


def _temp_password(to: str) -> str:
    msg = next(m for m in reversed(email.outbox) if m.to == to)
    line = next(line for line in msg.body.splitlines() if line.startswith("Temporary password:"))
    return line.split(":", 1)[1].strip()


async def test_register_then_sign_in(client, owner_headers):
    await _register(client)
    r = await _login(client)
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "ok"
    me = (await client.get(f"{API}/app/me", headers=bearer(r.json()["access_token"]))).json()
    assert me["email"] == "priya@example.com" and me["name"] == "Priya Raman"
    assert me["has_password"] is True and me["phone"] == "+919876543210"


async def test_registration_needs_the_sms_code(client, owner_headers):
    assert (await client.post(f"{AUTH}/register/otp", json=DETAILS)).status_code == 202
    r = await client.post(f"{AUTH}/register", json={**DETAILS, "code": "000000"})
    if last_otp("+919876543210") != "000000":
        assert r.status_code == 401
    assert (await _login(client)).status_code == 401


async def test_registration_validation(client, owner_headers):
    for bad in (
        {"email": "not-an-email"},
        {"password": "short1"},
        {"password": "lettersonly"},
        {"phone": "12345"},
        {"name": "  "},
    ):
        r = await client.post(f"{AUTH}/register/otp", json={**DETAILS, **bad})
        assert r.status_code == 422, bad


async def test_duplicate_email_and_phone_are_refused(client, owner_headers):
    await _register(client)
    r = await client.post(f"{AUTH}/register/otp", json={**DETAILS, "phone": "9876500000"})
    assert r.status_code == 409 and r.json()["code"] == "email_taken"
    r = await client.post(f"{AUTH}/register/otp", json={**DETAILS, "email": "new@example.com"})
    assert r.status_code == 409 and r.json()["code"] == "phone_taken"


async def test_registering_links_an_existing_sms_customer(client, owner_headers):
    headers = await customer_sign_in(client)
    first_id = (await client.get(f"{API}/app/me", headers=headers)).json()["id"]
    await _register(client)
    r = await _login(client)
    me = (await client.get(f"{API}/app/me", headers=bearer(r.json()["access_token"]))).json()
    assert me["id"] == first_id


async def test_wrong_password_and_lockout(client, owner_headers):
    await _register(client)
    unknown = await _login(client, email_="nobody@example.com")
    wrong = await _login(client, password="Wrong-pass-1")
    assert unknown.status_code == wrong.status_code == 401
    assert unknown.json()["detail"] == wrong.json()["detail"]
    for _ in range(4):
        await _login(client, password="Wrong-pass-1")
    assert (await _login(client)).status_code == 423


async def test_disabled_account(client, owner_headers):
    await _register(client)
    async with SessionLocal() as s, s.begin():
        await bypass_tenant_scope(s)
        await s.execute(update(Customer).values(is_active=False))
    r = await _login(client)
    assert r.status_code == 403 and r.json()["code"] == "account_disabled"


async def test_forgot_password_flow(client, owner_headers):
    await _register(client)
    old = await _login(client)
    old_refresh = old.json()["refresh_token"]

    r = await client.post(
        f"{AUTH}/forgot-password", json={"tenant": "sri-gold", "email": "nobody@example.com"}
    )
    assert r.status_code == 202 and not [m for m in email.outbox if m.to == "nobody@example.com"]
    r = await client.post(
        f"{AUTH}/forgot-password", json={"tenant": "sri-gold", "email": "priya@example.com"}
    )
    assert r.status_code == 202
    temp = _temp_password("priya@example.com")

    # The old password still works until the temporary one is used.
    r = await _login(client, password=temp)
    assert r.json()["status"] == "password_change_required"
    change_token = r.json()["password_change_token"]
    # Signing in with the temporary password ends existing sessions and blocks new ones.
    r = await client.post(f"{AUTH}/refresh", json={"refresh_token": old_refresh})
    assert r.status_code == 401
    # The change token is not an app session.
    assert (await client.get(f"{API}/app/me", headers=bearer(change_token))).status_code == 401

    r = await client.post(
        f"{AUTH}/set-password", json={"password_change_token": change_token, "new_password": temp}
    )
    assert r.status_code == 422
    r = await client.post(
        f"{AUTH}/set-password",
        json={"password_change_token": change_token, "new_password": "Brand-new-2"},
    )
    assert r.status_code == 204
    # Single use: neither the token nor the temporary password works again.
    r = await client.post(
        f"{AUTH}/set-password",
        json={"password_change_token": change_token, "new_password": "Another-3x"},
    )
    assert r.status_code == 401
    assert (await _login(client, password=temp)).status_code == 401
    assert (await _login(client, password="Gold-pass-1")).status_code == 401
    assert (await _login(client, password="Brand-new-2")).json()["status"] == "ok"


async def test_expired_temporary_password(client, owner_headers):
    await _register(client)
    await client.post(
        f"{AUTH}/forgot-password", json={"tenant": "sri-gold", "email": "priya@example.com"}
    )
    temp = _temp_password("priya@example.com")
    async with SessionLocal() as s, s.begin():
        await bypass_tenant_scope(s)
        await s.execute(update(Customer).values(temp_password_expires_at=now() - timedelta(1)))
    r = await _login(client, password=temp)
    assert r.status_code == 401 and r.json()["code"] == "temp_expired"


async def test_remembered_password_cancels_the_reset(client, owner_headers):
    await _register(client)
    await client.post(
        f"{AUTH}/forgot-password", json={"tenant": "sri-gold", "email": "priya@example.com"}
    )
    temp = _temp_password("priya@example.com")
    assert (await _login(client)).json()["status"] == "ok"
    assert (await _login(client, password=temp)).status_code == 401


async def test_change_password_keeps_this_device_only(client, owner_headers):
    await _register(client)
    a = (await _login(client)).json()
    b = (await _login(client)).json()
    r = await client.post(
        f"{AUTH}/change-password",
        json={"current_password": "Nope-pass-1", "new_password": "Next-pass-2"},
        headers=bearer(a["access_token"]),
    )
    assert r.status_code == 400
    r = await client.post(
        f"{AUTH}/change-password",
        json={"current_password": "Gold-pass-1", "new_password": "Next-pass-2"},
        headers=bearer(a["access_token"]),
    )
    assert r.status_code == 200
    assert (
        await client.post(f"{AUTH}/refresh", json={"refresh_token": b["refresh_token"]})
    ).status_code == 401
    assert (
        await client.post(f"{AUTH}/refresh", json={"refresh_token": r.json()["refresh_token"]})
    ).status_code == 200
    assert (await _login(client, password="Next-pass-2")).status_code == 200


async def test_changing_email_needs_the_password(client, owner_headers):
    await _register(client)
    h = bearer((await _login(client)).json()["access_token"])
    r = await client.patch(f"{API}/app/me", json={"email": "p2@example.com"}, headers=h)
    assert r.status_code == 400
    r = await client.patch(f"{API}/app/me", json={"name": "Priya R"}, headers=h)
    assert r.status_code == 204
    r = await client.patch(
        f"{API}/app/me",
        json={"email": "p2@example.com", "current_password": "Gold-pass-1"},
        headers=h,
    )
    assert r.status_code == 204
    assert (await _login(client, email_="p2@example.com")).status_code == 200


async def test_sms_customer_can_add_a_password(client, owner_headers):
    h = await customer_sign_in(client)
    r = await client.post(
        f"{AUTH}/change-password", json={"new_password": "First-pass-1"}, headers=h
    )
    assert r.status_code == 422 and r.json()["code"] == "email_required"
    await client.patch(f"{API}/app/me", json={"email": "sms@example.com"}, headers=h)
    r = await client.post(
        f"{AUTH}/change-password", json={"new_password": "First-pass-1"}, headers=h
    )
    assert r.status_code == 200
    assert (
        await _login(client, password="First-pass-1", email_="sms@example.com")
    ).status_code == 200


async def test_codes_are_emailed_as_well(client, owner_headers):
    r = await client.post(f"{AUTH}/register/otp", json=DETAILS)
    assert r.status_code == 202
    msg = email.outbox[-1]
    assert msg.to == "priya@example.com" and last_otp("+919876543210") in msg.body
    await _register(client, phone="9876500001", email="second@example.com")
    r = await client.post(f"{AUTH}/otp", json={"tenant": "sri-gold", "phone": "9876500001"})
    assert r.status_code == 202
    assert email.outbox[-1].to == "second@example.com"
    assert last_otp("+919876500001") in email.outbox[-1].body


async def test_store_sends_a_temporary_password(client, owner_headers):
    await _register(client)
    customers = (await client.get(f"{API}/crm/customers", headers=owner_headers)).json()
    cid = customers["items"][0]["id"]
    assert customers["items"][0]["has_password"] is True
    r = await client.post(f"{API}/crm/customers/{cid}/send-temp-password", headers=owner_headers)
    assert r.status_code == 200 and r.json()["sent_to"] == "priya@example.com"
    temp = _temp_password("priya@example.com")
    assert "has sent you a temporary password" in email.outbox[-1].body
    r = await _login(client, password=temp)
    assert r.json()["status"] == "password_change_required"


async def test_store_temp_password_for_an_sms_customer(client, owner_headers):
    h = await customer_sign_in(client)
    cid = (await client.get(f"{API}/app/me", headers=h)).json()["id"]
    url = f"{API}/crm/customers/{cid}/send-temp-password"
    r = await client.post(url, headers=owner_headers)
    assert r.status_code == 422  # no email yet
    await client.patch(f"{API}/app/me", json={"email": "sms@example.com"}, headers=h)
    assert (await client.post(url, headers=owner_headers)).status_code == 200
    r = await _login(client, password=_temp_password("sms@example.com"), email_="sms@example.com")
    assert r.json()["status"] == "password_change_required"


async def test_staff_without_permission_cannot_send(client, owner_headers):
    await _register(client)
    cid = (await client.get(f"{API}/crm/customers", headers=owner_headers)).json()["items"][0]["id"]
    r = await client.post(f"{API}/crm/customers/{cid}/send-temp-password")
    assert r.status_code == 401
