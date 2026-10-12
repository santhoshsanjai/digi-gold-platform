from datetime import timedelta
from decimal import Decimal

import pytest
from sqlalchemy import func, select, text, update
from sqlalchemy.exc import DBAPIError

from app.core import sms
from app.core.db import SessionLocal, bypass_tenant_scope
from app.core.security import now
from app.models import Customer, LedgerEntry, PaymentOrder
from tests.conftest import API, bearer, create_tenant, customer_sign_in, publish_rate


async def _buy(client, headers, amount, outcome="success"):
    r = await client.post(f"{API}/app/orders", json={"amount_inr": amount}, headers=headers)
    assert r.status_code == 201, r.text
    order = r.json()
    r = await client.post(
        f"{API}/app/orders/{order['id']}/test-outcome", json={"outcome": outcome}, headers=headers
    )
    assert r.status_code == 200, r.text
    return order, r.json()


async def test_otp_sign_in_creates_customer_once(client, owner_headers):
    r = await client.post(
        f"{API}/app/auth/otp", json={"tenant": "sri-gold", "phone": "98765 43210"}
    )
    assert r.status_code == 202
    code = sms.outbox[-1].body.split()[0]
    assert sms.outbox[-1].to == "+919876543210"
    wrong = await client.post(
        f"{API}/app/auth/verify",
        json={
            "tenant": "sri-gold",
            "phone": "9876543210",
            "code": "000000" if code != "000000" else "111111",
        },
    )
    assert wrong.status_code == 401
    r = await client.post(
        f"{API}/app/auth/verify",
        json={"tenant": "sri-gold", "phone": "+919876543210", "code": code},
    )
    assert r.json()["is_new_customer"] is True
    # A code works once.
    again = await client.post(
        f"{API}/app/auth/verify", json={"tenant": "sri-gold", "phone": "9876543210", "code": code}
    )
    assert again.status_code == 401


async def test_otp_resend_gap(client, owner_headers):
    body = {"tenant": "sri-gold", "phone": "9876543210"}
    assert (await client.post(f"{API}/app/auth/otp", json=body)).status_code == 202
    assert (await client.post(f"{API}/app/auth/otp", json=body)).status_code == 429


async def test_invalid_phone(client, owner_headers):
    r = await client.post(f"{API}/app/auth/otp", json={"tenant": "sri-gold", "phone": "12345"})
    assert r.status_code == 422


async def test_successful_payment_credits_grams_and_ledger(client, owner_headers):
    await publish_rate(client, owner_headers, "11500")
    c = await customer_sign_in(client)
    order, paid = await _buy(client, c, "2000")
    assert order["quoted_grams"] == "0.1739"
    assert paid["status"] == "paid" and paid["credited_grams"] == "0.1739"

    me = (await client.get(f"{API}/app/me", headers=c)).json()
    assert me["gold_grams"] == "0.1739"
    assert me["rupee_balance_inr"] == "0.15"
    assert me["total_paid_inr"] == "2000.00"
    assert me["open_lots"] == 1 and me["can_redeem"] is False

    lots = (await client.get(f"{API}/app/lots", headers=c)).json()
    assert len(lots) == 1
    lot = lots[0]
    paid_at = lot["paid_at"][:10]
    assert lot["expires_at"][:10] > paid_at  # 365 days later

    ledger = (await client.get(f"{API}/app/ledger", headers=c)).json()
    assert [e["kind"] for e in ledger["items"]] == ["credit"]


async def test_leftover_rupees_are_used_in_the_next_payment(client, owner_headers):
    await publish_rate(client, owner_headers, "11500")
    c = await customer_sign_in(client)
    await _buy(client, c, "2000")  # leaves ₹0.15
    _, paid = await _buy(client, c, "2000")  # 2000.15 / 11500 = 0.1739, leaves 0.30
    me = (await client.get(f"{API}/app/me", headers=c)).json()
    assert me["gold_grams"] == "0.3478"
    assert me["rupee_balance_inr"] == "0.30"


async def test_running_totals_equal_the_ledger(client, owner_headers):
    await publish_rate(client, owner_headers, "10000")
    c = await customer_sign_in(client)
    for amount in ("100", "2500.50", "777"):
        await _buy(client, c, amount)
    async with SessionLocal() as db, db.begin():
        await bypass_tenant_scope(db)
        customer = await db.scalar(select(Customer))
        grams, paid = (
            await db.execute(
                select(func.sum(LedgerEntry.grams), func.sum(LedgerEntry.amount_inr)).where(
                    LedgerEntry.customer_id == customer.id
                )
            )
        ).one()
    assert customer.gold_grams == grams
    assert customer.total_paid_inr == paid == Decimal("3377.50")


async def test_failed_and_pending_payments(client, owner_headers):
    await publish_rate(client, owner_headers)
    c = await customer_sign_in(client)
    _, failed = await _buy(client, c, "500", "failure")
    assert failed["status"] == "failed" and failed["credited_grams"] is None
    # A failed payment cannot later succeed.
    r = await client.post(
        f"{API}/app/orders/{failed['id']}/test-outcome", json={"outcome": "success"}, headers=c
    )
    assert r.status_code == 409

    order, pending = await _buy(client, c, "500", "pending")
    assert pending["status"] == "pending"
    r = await client.post(
        f"{API}/app/orders/{order['id']}/test-outcome", json={"outcome": "success"}, headers=c
    )
    assert r.json()["status"] == "paid"
    me = (await client.get(f"{API}/app/me", headers=c)).json()
    assert me["gold_grams"] == "0.0500"


async def test_success_twice_credits_once(client, owner_headers):
    await publish_rate(client, owner_headers)
    c = await customer_sign_in(client)
    order, _ = await _buy(client, c, "1000")
    r = await client.post(
        f"{API}/app/orders/{order['id']}/test-outcome", json={"outcome": "success"}, headers=c
    )
    assert r.status_code == 200
    me = (await client.get(f"{API}/app/me", headers=c)).json()
    assert me["gold_grams"] == "0.1000"


async def test_expired_price_lock_uses_the_current_rate(client, owner_headers):
    await publish_rate(client, owner_headers, "10000")
    c = await customer_sign_in(client)
    r = await client.post(f"{API}/app/orders", json={"amount_inr": "1000"}, headers=c)
    order = r.json()
    await publish_rate(client, owner_headers, "10200")
    async with SessionLocal() as db, db.begin():
        await bypass_tenant_scope(db)
        await db.execute(update(PaymentOrder).values(lock_expires_at=now() - timedelta(seconds=1)))
    r = await client.post(
        f"{API}/app/orders/{order['id']}/test-outcome", json={"outcome": "success"}, headers=c
    )
    body = r.json()
    assert body["repriced"] is True
    assert body["credited_grams"] == "0.0980"  # 1000 / 10200


async def test_amount_limits_and_pan_rule(client, owner_headers):
    await publish_rate(client, owner_headers)
    c = await customer_sign_in(client)
    low = await client.post(f"{API}/app/orders", json={"amount_inr": "99"}, headers=c)
    assert low.json()["code"] == "amount_out_of_range"
    high = await client.post(f"{API}/app/orders", json={"amount_inr": "50001"}, headers=c)
    assert high.json()["code"] == "amount_out_of_range"

    s = (await client.get(f"{API}/crm/settings", headers=owner_headers)).json()
    s["pan_required_above_inr"] = "1000"
    await client.put(f"{API}/crm/settings", json=s, headers=owner_headers)
    await _buy(client, c, "800")
    r = await client.post(f"{API}/app/orders", json={"amount_inr": "300"}, headers=c)
    assert r.json()["code"] == "pan_required"
    bad = await client.post(f"{API}/app/me/pan", json={"pan": "ABC"}, headers=c)
    assert bad.status_code == 422
    ok = await client.post(f"{API}/app/me/pan", json={"pan": "abcde1234f"}, headers=c)
    assert ok.status_code == 204
    assert (
        await client.post(f"{API}/app/orders", json={"amount_inr": "300"}, headers=c)
    ).status_code == 201


async def test_test_payments_can_be_switched_off(client, admin_headers, owner_headers):
    await publish_rate(client, owner_headers)
    tid = (await client.get(f"{API}/console/tenants", headers=admin_headers)).json()["items"][0][
        "id"
    ]
    await client.put(
        f"{API}/console/tenants/{tid}/features",
        json={"test_payments": False},
        headers=admin_headers,
    )
    c = await customer_sign_in(client)
    r = await client.post(f"{API}/app/orders", json={"amount_inr": "500"}, headers=c)
    assert r.status_code == 503 and r.json()["code"] == "payments_unavailable"


async def test_customers_are_isolated_between_jewellers(client, admin_headers, owner_headers):
    await publish_rate(client, owner_headers)
    a = await customer_sign_in(client, "sri-gold")
    order, _ = await _buy(client, a, "500")

    await create_tenant(client, admin_headers, "lakshmi", "owner@lakshmi.example.com")
    b = await customer_sign_in(client, "lakshmi")  # same phone, different jeweller
    assert (await client.get(f"{API}/app/me", headers=b)).json()["gold_grams"] == "0.0000"
    assert (await client.get(f"{API}/app/orders/{order['id']}", headers=b)).status_code == 404


async def test_staff_token_cannot_be_used_in_the_app(client, owner_headers):
    assert (await client.get(f"{API}/app/me", headers=owner_headers)).status_code == 401


async def test_crm_sees_customer_and_payments(client, owner_headers):
    await publish_rate(client, owner_headers)
    c = await customer_sign_in(client)
    await client.patch(f"{API}/app/me", json={"name": "Meena"}, headers=c)
    await _buy(client, c, "1000")
    await _buy(client, c, "500", "failure")

    found = (await client.get(f"{API}/crm/customers?q=meena", headers=owner_headers)).json()
    assert found["total"] == 1
    cid = found["items"][0]["id"]
    detail = (await client.get(f"{API}/crm/customers/{cid}", headers=owner_headers)).json()
    assert detail["customer"]["gold_grams"] == "0.1000"
    assert len(detail["open_lots"]) == 1
    failed = (await client.get(f"{API}/crm/payments?status=failed", headers=owner_headers)).json()
    assert failed["total"] == 1


async def test_customer_refresh_rotation(client, owner_headers):
    await client.post(f"{API}/app/auth/otp", json={"tenant": "sri-gold", "phone": "9876543210"})
    code = sms.outbox[-1].body.split()[0]
    tokens = (
        await client.post(
            f"{API}/app/auth/verify",
            json={"tenant": "sri-gold", "phone": "9876543210", "code": code},
        )
    ).json()
    r = await client.post(
        f"{API}/app/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
    )
    assert r.status_code == 200
    assert (
        await client.get(f"{API}/app/me", headers=bearer(r.json()["access_token"]))
    ).status_code == 200
    replay = await client.post(
        f"{API}/app/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
    )
    assert replay.status_code == 401


async def test_ledger_rows_cannot_be_changed(client, owner_headers):
    await publish_rate(client, owner_headers)
    c = await customer_sign_in(client)
    await _buy(client, c, "500")
    with pytest.raises(DBAPIError, match="append-only"):
        async with SessionLocal() as db, db.begin():
            await bypass_tenant_scope(db)
            await db.execute(text("UPDATE ledger_entries SET grams = 100"))
