"""Website content: drafts, publishing, sanitising, tenant isolation and image uploads."""

from pathlib import Path

from app.core.config import get_settings
from tests.conftest import API, create_tenant, publish_rate

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64


def _hero(id_="h1", heading="Save in gold"):
    return {"id": id_, "type": "hero", "heading": heading, "cta_url": "https://example.com/app"}


async def _page(client, admin_headers, tenant_id, slug="home", title="Home"):
    if slug == "home":  # every client starts with a draft home page
        pages = await client.get(f"{API}/console/tenants/{tenant_id}/pages", headers=admin_headers)
        return next(p for p in pages.json() if p["slug"] == "home")
    r = await client.post(
        f"{API}/console/tenants/{tenant_id}/pages",
        json={"slug": slug, "title": title},
        headers=admin_headers,
    )
    assert r.status_code == 201, r.text
    return r.json()


async def test_new_client_starts_with_a_draft_home_page(client, admin_headers):
    t = await create_tenant(client, admin_headers)
    page = await _page(client, admin_headers, t["id"])
    full = await client.get(
        f"{API}/console/tenants/{t['id']}/pages/{page['id']}", headers=admin_headers
    )
    types = [s["type"] for s in full.json()["content"]["sections"]]
    assert page["status"] == "draft" and types[:2] == ["hero", "gold_rate"]
    assert (await client.get(f"{API}/public/tenants/sri-gold/pages/home")).status_code == 404


async def test_draft_is_hidden_until_published(client, admin_headers):
    t = await create_tenant(client, admin_headers)
    page = await _page(client, admin_headers, t["id"])
    base = f"{API}/console/tenants/{t['id']}/pages/{page['id']}"
    assert page["status"] == "draft"

    r = await client.patch(base, json={"content": {"sections": [_hero()]}}, headers=admin_headers)
    assert r.status_code == 200, r.text
    assert (await client.get(f"{API}/public/tenants/sri-gold/pages/home")).status_code == 404

    r = await client.post(f"{base}/publish", headers=admin_headers)
    assert r.json()["status"] == "published"
    live = (await client.get(f"{API}/public/tenants/sri-gold/pages/home")).json()
    assert live["content"]["sections"][0]["heading"] == "Save in gold"

    # Editing again changes only the draft until the next publish.
    await client.patch(
        base, json={"content": {"sections": [_hero(heading="New")]}}, headers=admin_headers
    )
    assert (await client.get(base, headers=admin_headers)).json()["status"] == "changed"
    live = (await client.get(f"{API}/public/tenants/sri-gold/pages/home")).json()
    assert live["content"]["sections"][0]["heading"] == "Save in gold"

    await client.post(f"{base}/publish", headers=admin_headers)
    live = (await client.get(f"{API}/public/tenants/sri-gold/pages/home")).json()
    assert live["content"]["sections"][0]["heading"] == "New"

    await client.post(f"{base}/unpublish", headers=admin_headers)
    assert (await client.get(f"{API}/public/tenants/sri-gold/pages/home")).status_code == 404


async def test_rich_text_is_sanitised_and_bad_links_refused(client, admin_headers):
    t = await create_tenant(client, admin_headers)
    page = await _page(client, admin_headers, t["id"])
    base = f"{API}/console/tenants/{t['id']}/pages/{page['id']}"
    body = '<p onclick="steal()">Hi<script>alert(1)</script> <a href="javascript:x">x</a></p>'
    r = await client.patch(
        base,
        json={"content": {"sections": [{"id": "t", "type": "rich_text", "body_html": body}]}},
        headers=admin_headers,
    )
    saved = r.json()["content"]["sections"][0]["body_html"]
    assert "script" not in saved and "onclick" not in saved and "javascript" not in saved
    assert saved.startswith("<p>Hi")

    bad = _hero() | {"cta_url": "javascript:alert(1)"}
    r = await client.patch(base, json={"content": {"sections": [bad]}}, headers=admin_headers)
    assert r.status_code == 422

    dupes = [_hero("same"), _hero("same")]
    r = await client.patch(base, json={"content": {"sections": dupes}}, headers=admin_headers)
    assert r.status_code == 422


async def test_menu_lists_published_pages_in_order(client, admin_headers):
    t = await create_tenant(client, admin_headers)
    tid = t["id"]
    home = await _page(client, admin_headers, tid)
    about = await _page(client, admin_headers, tid, "about", "About us")
    hidden = await _page(client, admin_headers, tid, "terms", "Terms")
    await _page(client, admin_headers, tid, "draft-only", "Not live")
    await client.patch(
        f"{API}/console/tenants/{tid}/pages/{about['id']}",
        json={"nav_order": 5},
        headers=admin_headers,
    )
    await client.patch(
        f"{API}/console/tenants/{tid}/pages/{hidden['id']}",
        json={"show_in_nav": False},
        headers=admin_headers,
    )
    for p in (home, about, hidden):
        await client.post(
            f"{API}/console/tenants/{tid}/pages/{p['id']}/publish", headers=admin_headers
        )

    await client.put(
        f"{API}/console/tenants/{tid}/website",
        json={"tagline": "Pure gold, every month", "contact": {"phone": "+91 98765 43210"}},
        headers=admin_headers,
    )
    site = (await client.get(f"{API}/public/tenants/sri-gold/site")).json()
    assert [n["slug"] for n in site["nav"]] == ["home", "about"]
    assert sorted(site["pages"]) == ["about", "home", "terms"]
    assert site["settings"]["tagline"] == "Pure gold, every month"
    assert site["settings"]["contact"]["phone"] == "+91 98765 43210"


async def test_slugs_are_unique_and_home_cannot_be_deleted(client, admin_headers):
    t = await create_tenant(client, admin_headers)
    home = await _page(client, admin_headers, t["id"])
    r = await client.post(
        f"{API}/console/tenants/{t['id']}/pages",
        json={"slug": "home", "title": "Again"},
        headers=admin_headers,
    )
    assert r.status_code == 409
    r = await client.post(
        f"{API}/console/tenants/{t['id']}/pages",
        json={"slug": "Bad Slug", "title": "x"},
        headers=admin_headers,
    )
    assert r.status_code == 422
    r = await client.delete(
        f"{API}/console/tenants/{t['id']}/pages/{home['id']}", headers=admin_headers
    )
    assert r.status_code == 422


async def test_pages_are_kept_apart_per_client(client, admin_headers):
    a = await create_tenant(client, admin_headers)
    b = await create_tenant(client, admin_headers, slug="other-gold", owner="o@other.example.com")
    page = await _page(client, admin_headers, a["id"])
    await client.post(
        f"{API}/console/tenants/{a['id']}/pages/{page['id']}/publish", headers=admin_headers
    )
    # Another client's page id under the wrong client is not found, and its site is empty.
    r = await client.get(
        f"{API}/console/tenants/{b['id']}/pages/{page['id']}", headers=admin_headers
    )
    assert r.status_code == 404
    assert (await client.get(f"{API}/public/tenants/other-gold/pages/home")).status_code == 404
    assert (await client.get(f"{API}/public/tenants/other-gold/site")).json()["nav"] == []


async def test_console_is_for_platform_admins_only(client, admin_headers, owner_headers):
    tenant_id = (await client.get(f"{API}/console/tenants", headers=admin_headers)).json()["items"][
        0
    ]["id"]
    r = await client.get(f"{API}/console/tenants/{tenant_id}/pages", headers=owner_headers)
    assert r.status_code == 403


async def test_image_upload_checks_content_and_size(client, admin_headers, monkeypatch):
    t = await create_tenant(client, admin_headers)
    url = f"{API}/console/tenants/{t['id']}/media"

    r = await client.post(
        url, files={"file": ("logo.png", PNG, "image/png")}, headers=admin_headers
    )
    assert r.status_code == 201, r.text
    asset = r.json()
    assert asset["content_type"] == "image/png"
    assert asset["url"].startswith("http://test/media/sri-gold/")
    key = asset["url"].split("/media/", 1)[1]
    assert (Path(get_settings().media_dir) / key).read_bytes() == PNG
    served = await client.get(f"/media/{key}")
    assert served.status_code == 200 and served.headers["access-control-allow-origin"] == "*"

    # A script renamed to .png is refused: the type comes from the bytes.
    r = await client.post(
        url, files={"file": ("x.png", b"<svg onload=alert(1)>", "image/png")}, headers=admin_headers
    )
    assert r.status_code == 422

    monkeypatch.setattr(get_settings(), "media_max_mb", 0)
    r = await client.post(url, files={"file": ("big.png", PNG, "image/png")}, headers=admin_headers)
    assert r.status_code == 422

    listed = (await client.get(url, headers=admin_headers)).json()
    assert listed["total"] == 1
    r = await client.delete(f"{url}/{asset['id']}", headers=admin_headers)
    assert r.status_code == 204
    assert not (Path(get_settings().media_dir) / key).exists()


async def test_public_rate_for_the_website(client, owner_headers):
    r = await client.get(f"{API}/public/tenants/sri-gold/rate")
    assert r.json()["rate_per_gram"] is None and r.json()["buying_open"] is False
    await publish_rate(client, owner_headers, rate="7250")
    r = await client.get(f"{API}/public/tenants/sri-gold/rate")
    assert r.headers["access-control-allow-origin"] == "*"
    assert r.json()["purity"] == "22K" and r.json()["rate_per_gram"] == "7250.00"
