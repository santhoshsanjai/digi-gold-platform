from datetime import date, timedelta

from sqlalchemy import update

from app.core import email
from app.core.clock import today
from app.core.db import SessionLocal, bypass_tenant_scope
from app.core.security import now
from app.models import GoldLot
from app.services.expiry import reminder_due, send_reminders
from tests.conftest import API, customer_sign_in, publish_rate, sign_in_first_time

PHONE = "9876543210"


async def _buy(client, headers, amount):
    order = (
        await client.post(f"{API}/app/orders", json={"amount_inr": amount}, headers=headers)
    ).json()
    r = await client.post(
        f"{API}/app/orders/{order['id']}/test-outcome", json={"outcome": "success"}, headers=headers
    )
    assert r.json()["status"] == "paid", r.text


async def _shift_lots(**values):
    async with SessionLocal() as db, db.begin():
        await bypass_tenant_scope(db)
        await db.execute(update(GoldLot).values(**values))


async def _customer_with_gold(client, owner_headers, amount="10000"):
    await publish_rate(client, owner_headers, "10000")
    c = await customer_sign_in(client, phone=PHONE)
    await _buy(client, c, amount)
    return c


async def _code(client, customer):
    r = await client.post(f"{API}/app/redemption-code", headers=customer)
    assert r.status_code == 200, r.text
    return r.json()["code"]


async def test_redeem_whole_balance_in_store(client, owner_headers):
    c = await _customer_with_gold(client, owner_headers)
    await _buy(client, c, "5000")
    store = (
        await client.post(f"{API}/crm/stores", json={"name": "Madurai Main"}, headers=owner_headers)
    ).json()

    # Payments are still settling (2-day hold by default).
    code = await _code(client, c)
    r = await client.post(
        f"{API}/crm/redemptions",
        json={"phone": PHONE, "code": code, "store_id": store["id"]},
        headers=owner_headers,
    )
    assert r.status_code == 409 and "settling" in r.json()["detail"]

    await _shift_lots(redeemable_at=now() - timedelta(minutes=1))
    code = await _code(client, c)
    wrong = await client.post(
        f"{API}/crm/redemptions",
        json={"phone": PHONE, "code": "000000" if code != "000000" else "111111"},
        headers=owner_headers,
    )
    assert wrong.status_code == 422
    r = await client.post(
        f"{API}/crm/redemptions",
        json={"phone": PHONE, "code": code, "store_id": store["id"]},
        headers=owner_headers,
    )
    assert r.status_code == 201, r.text
    redemption = r.json()
    assert redemption["grams"] == "1.5000"
    assert redemption["lots_count"] == 2
    assert redemption["amount_paid_inr"] == "15000.00"
    assert redemption["slip_number"].startswith(f"R{today():%Y%m%d}-")

    me = (await client.get(f"{API}/app/me", headers=c)).json()
    assert me["gold_grams"] == "0.0000" and me["open_lots"] == 0
    ledger = (await client.get(f"{API}/app/ledger", headers=c)).json()["items"]
    assert sorted(e["kind"] for e in ledger) == ["credit", "credit", "redeem", "redeem"]

    slip = (
        await client.get(f"{API}/crm/redemptions/{redemption['id']}/slip", headers=owner_headers)
    ).json()
    assert slip["store_name"] == "Madurai Main"
    assert slip["customer_phone"] == "+919876543210"

    # The same code cannot be used twice.
    again = await client.post(
        f"{API}/crm/redemptions", json={"phone": PHONE, "code": code}, headers=owner_headers
    )
    assert again.status_code == 422


async def test_below_threshold_cannot_get_a_code(client, owner_headers):
    c = await _customer_with_gold(client, owner_headers, "5000")  # 0.5 g, threshold 1 g
    r = await client.post(f"{API}/app/redemption-code", headers=c)
    assert r.status_code == 422 and r.json()["code"] == "below_threshold"


async def test_store_staff_redeem_in_their_own_store(client, owner_headers):
    c = await _customer_with_gold(client, owner_headers)
    await _shift_lots(redeemable_at=now() - timedelta(minutes=1))
    main = (
        await client.post(f"{API}/crm/stores", json={"name": "Main"}, headers=owner_headers)
    ).json()
    other = (
        await client.post(f"{API}/crm/stores", json={"name": "Other"}, headers=owner_headers)
    ).json()
    roles = (await client.get(f"{API}/crm/roles", headers=owner_headers)).json()
    staff_role = next(r["id"] for r in roles if r["name"] == "Store staff")
    await client.post(
        f"{API}/crm/users",
        json={
            "email": "s@sri.example.com",
            "name": "S",
            "role_id": staff_role,
            "store_id": main["id"],
        },
        headers=owner_headers,
    )
    staff = await sign_in_first_time(client, "sri-gold", "s@sri.example.com")
    r = await client.post(
        f"{API}/crm/redemptions",
        json={"phone": PHONE, "code": await _code(client, c), "store_id": other["id"]},
        headers=staff,
    )
    assert r.status_code == 201
    assert r.json()["store_id"] == main["id"]


def test_reminder_schedule():
    expires = date(2026, 12, 31)
    before, every = [60, 30, 7], 7
    due = [
        d
        for d in range(-15, 70)
        if reminder_due(expires, expires - timedelta(days=d), before, every)
    ]
    # 60, 30 and 7 days before; on the day; then every 7 days after.
    assert sorted(due, reverse=True) == [60, 30, 7, 0, -7, -14]


async def test_expired_lots_are_listed_and_reminded_once_a_day(client, owner_headers):
    c = await _customer_with_gold(client, owner_headers)
    await client.patch(
        f"{API}/app/me", json={"name": "Meena", "email": "meena@example.com"}, headers=c
    )
    await _shift_lots(expires_at=now() - timedelta(days=7))

    page = (await client.get(f"{API}/crm/expiry?state=expired", headers=owner_headers)).json()
    assert page["total"] == 1
    assert page["items"][0]["days_left"] == -7
    assert page["items"][0]["customer_name"] == "Meena"

    first = await send_reminders(today())
    assert first == {"emails": 1, "lots": 1}
    assert email.outbox[-1].to == "meena@example.com"
    assert "redeem" in email.outbox[-1].subject
    # Running again the same day sends nothing more.
    assert await send_reminders(today()) == {"emails": 0, "lots": 0}


async def test_expiring_soon_list(client, owner_headers):
    await _customer_with_gold(client, owner_headers)
    await _shift_lots(expires_at=now() + timedelta(days=10))
    soon = (await client.get(f"{API}/crm/expiry?state=expiring", headers=owner_headers)).json()
    assert soon["total"] == 1
    later = (
        await client.get(f"{API}/crm/expiry?state=expiring&within_days=5", headers=owner_headers)
    ).json()
    assert later["total"] == 0


async def test_manual_refund_is_off_until_enabled(client, owner_headers):
    c = await _customer_with_gold(client, owner_headers)
    page = (
        await client.get(f"{API}/crm/expiry?state=expiring&within_days=400", headers=owner_headers)
    ).json()
    lot_id = page["items"][0]["lot_id"]
    body = {"note": "returned by bank transfer"}
    assert (
        await client.post(f"{API}/crm/lots/{lot_id}/refund", json=body, headers=owner_headers)
    ).status_code == 403

    s = (await client.get(f"{API}/crm/settings", headers=owner_headers)).json()
    s["manual_refund_enabled"] = True
    await client.put(f"{API}/crm/settings", json=s, headers=owner_headers)
    r = await client.post(f"{API}/crm/lots/{lot_id}/refund", json=body, headers=owner_headers)
    assert r.status_code == 204
    me = (await client.get(f"{API}/app/me", headers=c)).json()
    assert me["gold_grams"] == "0.0000" and me["total_paid_inr"] == "0.00"
    again = await client.post(f"{API}/crm/lots/{lot_id}/refund", json=body, headers=owner_headers)
    assert again.status_code == 409


async def test_dashboard(client, owner_headers):
    c = await _customer_with_gold(client, owner_headers)
    await _buy(client, c, "2500")
    d = (await client.get(f"{API}/crm/dashboard", headers=owner_headers)).json()
    assert d["customers"] == 1
    assert d["outstanding_grams"] == "1.2500"
    assert d["outstanding_value_inr"] == "12500.00"
    assert d["collections_today_inr"] == "12500.00"
    assert d["payments_today"] == 2
    assert d["lots_expired"] == 0
