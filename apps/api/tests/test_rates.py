from datetime import timedelta

from sqlalchemy import update

from app.core.db import SessionLocal, bypass_tenant_scope
from app.core.security import now
from app.models import GoldRate
from tests.conftest import API, customer_sign_in, publish_rate


async def test_first_rate_and_current_view(client, owner_headers):
    r = await publish_rate(client, owner_headers, "10500.50")
    assert r.status_code == 201, r.text
    cur = (await client.get(f"{API}/crm/rates/current", headers=owner_headers)).json()
    assert cur["rates"]["22K"]["rate_per_gram"] == "10500.50"
    assert cur["rates"]["24K"] is None
    assert cur["buying_open"] is True


async def test_large_change_needs_confirmation(client, owner_headers):
    await publish_rate(client, owner_headers, "11500")
    # A typo: 1150 instead of 11500.
    r = await publish_rate(client, owner_headers, "1150")
    assert r.status_code == 409
    assert r.json()["code"] == "confirm_large_change"
    assert r.json()["change_pct"] == "-90.00"
    r = await publish_rate(client, owner_headers, "1150", confirm=True)
    assert r.status_code == 201
    assert r.json()["large_change_confirmed"] is True
    # A small change goes straight through.
    assert (await publish_rate(client, owner_headers, "1160")).status_code == 201


async def test_rate_permissions(client, owner_headers):
    roles = (await client.get(f"{API}/crm/roles", headers=owner_headers)).json()
    viewer = next(r["id"] for r in roles if r["name"] == "Viewer")
    from tests.conftest import sign_in_first_time

    await client.post(
        f"{API}/crm/users",
        json={"email": "v@sri.example.com", "name": "V", "role_id": viewer},
        headers=owner_headers,
    )
    v = await sign_in_first_time(client, "sri-gold", "v@sri.example.com")
    assert (await publish_rate(client, v, "10000")).status_code == 403


async def test_pause_stops_buying(client, owner_headers):
    await publish_rate(client, owner_headers)
    r = await client.post(
        f"{API}/crm/rates/pause",
        json={"paused": True, "reason": "wrong rate"},
        headers=owner_headers,
    )
    assert r.json()["buying_open"] is False
    customer = await customer_sign_in(client)
    rate = (await client.get(f"{API}/app/rate", headers=customer)).json()
    assert rate["buying_open"] is False
    order = await client.post(f"{API}/app/orders", json={"amount_inr": "500"}, headers=customer)
    assert order.status_code == 409
    assert order.json()["code"] == "buying_closed"
    r = await client.post(f"{API}/crm/rates/pause", json={"paused": False}, headers=owner_headers)
    assert r.json()["buying_open"] is True


async def test_yesterdays_rate_is_not_sold_after_the_deadline(client, owner_headers):
    # Deadline 00:00 means "today's rate must exist" at any time of day.
    s = (await client.get(f"{API}/crm/settings", headers=owner_headers)).json()
    s["daily_rate_deadline"] = "00:00:00"
    await client.put(f"{API}/crm/settings", json=s, headers=owner_headers)
    await publish_rate(client, owner_headers)
    async with SessionLocal() as db, db.begin():
        await bypass_tenant_scope(db)
        await db.execute(update(GoldRate).values(created_at=now() - timedelta(days=1)))
    cur = (await client.get(f"{API}/crm/rates/current", headers=owner_headers)).json()
    assert cur["buying_open"] is False
    assert "today" in cur["reason"]


async def test_no_rate_means_no_buying(client, owner_headers):
    customer = await customer_sign_in(client)
    rate = (await client.get(f"{API}/app/rate", headers=customer)).json()
    assert rate["buying_open"] is False and rate["rate_per_gram"] is None
