from datetime import timedelta

from sqlalchemy import update

from app.core.clock import today
from app.core.db import SessionLocal, bypass_tenant_scope
from app.core.security import now
from app.models import GoldLot
from tests.conftest import API, customer_sign_in, publish_rate, sign_in_first_time
from tests.test_rbac import _add_user

PHONE = "9876543210"


async def _buy(client, headers, amount):
    order = (
        await client.post(f"{API}/app/orders", json={"amount_inr": amount}, headers=headers)
    ).json()
    r = await client.post(
        f"{API}/app/orders/{order['id']}/test-outcome", json={"outcome": "success"}, headers=headers
    )
    assert r.json()["status"] == "paid", r.text


async def _customer_with_gold(client, owner_headers):
    await publish_rate(client, owner_headers, "10000")
    c = await customer_sign_in(client, phone=PHONE)
    await _buy(client, c, "2000")
    await _buy(client, c, "3000")
    return c


async def test_collections_by_day(client, owner_headers):
    await _customer_with_gold(client, owner_headers)
    r = await client.get(f"{API}/crm/reports/collections", headers=owner_headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total_payments"] == 2
    assert body["total_amount_inr"] == "5000.00"
    assert body["total_grams"] == "0.5000"
    assert [d["date"] for d in body["days"]] == [str(today())]

    # A range that ends yesterday has nothing.
    y = str(today() - timedelta(days=1))
    empty = (
        await client.get(f"{API}/crm/reports/collections?end={y}", headers=owner_headers)
    ).json()
    assert empty["total_payments"] == 0 and empty["days"] == []


async def test_collections_csv_for_excel(client, owner_headers):
    await _customer_with_gold(client, owner_headers)
    r = await client.get(f"{API}/crm/reports/collections?format=csv", headers=owner_headers)
    assert r.headers["content-type"].startswith("text/csv")
    assert "attachment" in r.headers["content-disposition"]
    lines = r.text.lstrip("﻿").splitlines()
    assert lines[0] == "Date,Payments,Amount (INR),Grams"
    assert lines[1] == f"{today()},2,5000.00,0.5000"


async def test_range_is_checked(client, owner_headers):
    bad = await client.get(
        f"{API}/crm/reports/collections?start=2026-02-01&end=2026-01-01", headers=owner_headers
    )
    assert bad.status_code == 422
    long = await client.get(
        f"{API}/crm/reports/collections?start=2024-01-01&end=2026-01-01", headers=owner_headers
    )
    assert long.status_code == 422


async def test_redemptions_by_day_and_store(client, owner_headers):
    c = await _customer_with_gold(client, owner_headers)
    await _buy(client, c, "6000")  # 1.1 g, over the 1 g redemption threshold
    store = (
        await client.post(f"{API}/crm/stores", json={"name": "Madurai Main"}, headers=owner_headers)
    ).json()
    async with SessionLocal() as db, db.begin():
        await bypass_tenant_scope(db)
        await db.execute(update(GoldLot).values(redeemable_at=now() - timedelta(minutes=1)))
    code = (await client.post(f"{API}/app/redemption-code", headers=c)).json()["code"]
    r = await client.post(
        f"{API}/crm/redemptions",
        json={"phone": PHONE, "code": code, "store_id": store["id"]},
        headers=owner_headers,
    )
    assert r.status_code == 201, r.text

    by_store = (
        await client.get(f"{API}/crm/reports/redemptions?group_by=store", headers=owner_headers)
    ).json()
    assert by_store["rows"] == [
        {
            "label": "Madurai Main",
            "redemptions": 1,
            "grams": "1.1000",
            "amount_paid_inr": "11000.00",
        }
    ]
    by_day = (await client.get(f"{API}/crm/reports/redemptions", headers=owner_headers)).json()
    assert by_day["rows"][0]["label"] == str(today())
    assert by_day["total_grams"] == "1.1000"


async def test_holdings_and_formula_safe_csv(client, owner_headers):
    c = await _customer_with_gold(client, owner_headers)
    await client.patch(f"{API}/app/me", json={"name": '=HYPERLINK("http://evil")'}, headers=c)
    body = (await client.get(f"{API}/crm/reports/holdings", headers=owner_headers)).json()
    assert body["total_customers"] == 1
    assert body["total_grams"] == "0.5000" and body["total_value_inr"] == "5000.00"
    row = body["rows"][0]
    assert row["open_lots"] == 2 and row["next_expiry"] == str(today() + timedelta(days=365))

    csv_text = (
        await client.get(f"{API}/crm/reports/holdings?format=csv", headers=owner_headers)
    ).text
    assert (
        "'=HYPERLINK" in csv_text
        and ",=HYPERLINK" not in csv_text
        and "\n=HYPERLINK" not in csv_text
    )


async def test_reports_need_permission(client, owner_headers):
    await _add_user(client, owner_headers, "staff@sri.example.com", "Store staff")
    staff = await sign_in_first_time(client, "sri-gold", "staff@sri.example.com")
    for path in ("collections", "redemptions", "holdings"):
        assert (await client.get(f"{API}/crm/reports/{path}", headers=staff)).status_code == 403
