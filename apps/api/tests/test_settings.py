from tests.conftest import API


async def test_defaults_match_the_design(client, owner_headers):
    s = (await client.get(f"{API}/crm/settings", headers=owner_headers)).json()
    assert s["min_payment_inr"] == "100"
    assert s["purity"] == "22K"
    assert s["lot_validity_days"] == 365
    assert s["manual_refund_enabled"] is False


async def test_save_settings_audits_and_updates_public_config(client, owner_headers):
    s = (await client.get(f"{API}/crm/settings", headers=owner_headers)).json()
    before = (await client.get(f"{API}/public/tenants/sri-gold/config")).json()
    s.update(min_payment_inr="250", purity="24K", making_charge_discount_pct="10")
    r = await client.put(f"{API}/crm/settings", json=s, headers=owner_headers)
    assert r.status_code == 200, r.text

    after = (await client.get(f"{API}/public/tenants/sri-gold/config")).json()
    assert after["scheme"]["purity"] == "24K"
    assert after["version"] == before["version"] + 1

    logs = (await client.get(f"{API}/crm/audit-logs", headers=owner_headers)).json()["items"]
    change = next(item for item in logs if item["action"] == "settings.updated")
    assert set(change["changes"]) == {"min_payment_inr", "purity", "making_charge_discount_pct"}


async def test_lot_validity_cannot_exceed_365_days(client, owner_headers):
    s = (await client.get(f"{API}/crm/settings", headers=owner_headers)).json()
    s["lot_validity_days"] = 400
    assert (
        await client.put(f"{API}/crm/settings", json=s, headers=owner_headers)
    ).status_code == 422


async def test_min_payment_cannot_exceed_max(client, owner_headers):
    s = (await client.get(f"{API}/crm/settings", headers=owner_headers)).json()
    s.update(min_payment_inr="60000", max_payment_inr="50000")
    assert (
        await client.put(f"{API}/crm/settings", json=s, headers=owner_headers)
    ).status_code == 422


async def test_unknown_setting_is_rejected(client, owner_headers):
    s = (await client.get(f"{API}/crm/settings", headers=owner_headers)).json()
    s["interest_rate"] = 12
    assert (
        await client.put(f"{API}/crm/settings", json=s, headers=owner_headers)
    ).status_code == 422


async def test_branding_from_console_reaches_public_config(client, admin_headers, owner_headers):
    tenants = (await client.get(f"{API}/console/tenants", headers=admin_headers)).json()["items"]
    tid = tenants[0]["id"]
    r = await client.put(
        f"{API}/console/tenants/{tid}/branding",
        json={"display_name": "Sri Gold", "primary_color": "#AA7700"},
        headers=admin_headers,
    )
    assert r.status_code == 200
    bad = await client.put(
        f"{API}/console/tenants/{tid}/branding",
        json={"primary_color": "gold"},
        headers=admin_headers,
    )
    assert bad.status_code == 422
    cfg = (await client.get(f"{API}/public/tenants/sri-gold/config")).json()
    assert cfg["branding"]["primary_color"] == "#AA7700"
    assert cfg["branding"]["display_name"] == "Sri Gold"


async def test_unknown_tenant_public_config(client):
    assert (await client.get(f"{API}/public/tenants/nope/config")).status_code == 404


async def test_stores(client, owner_headers):
    r = await client.post(
        f"{API}/crm/stores", json={"name": "Madurai Main", "phone": "0452"}, headers=owner_headers
    )
    assert r.status_code == 201
    stores = (await client.get(f"{API}/crm/stores", headers=owner_headers)).json()
    assert [s["name"] for s in stores] == ["Madurai Main"]
