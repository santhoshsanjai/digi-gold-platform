import os
import tempfile

os.environ.update(
    DG_ENV="test",
    DG_DATABASE_URL=os.environ.get(
        "DG_TEST_DATABASE_URL",
        "postgresql+asyncpg://digigold:digigold@localhost:5432/digigold_test",
    ),
    DG_EMAIL_BACKEND="console",
    DG_MEDIA_DIR=tempfile.mkdtemp(prefix="digigold-media-"),
)

import pytest  # noqa: E402
from alembic.config import Config  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from alembic import command  # noqa: E402
from app.core import email, sms  # noqa: E402
from app.core.db import SessionLocal, bypass_tenant_scope, engine  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.main import app  # noqa: E402
from app.services import config_cache, site_cache  # noqa: E402
from app.services.users import create_staff_user  # noqa: E402

API = "/api/v1"
ADMIN_EMAIL = "admin@platform.example.com"
ADMIN_PASSWORD = "Admin-pass-123"
TABLES = (
    "site_pages, media_assets, ledger_entries, gold_lots, payment_orders, customer_tokens, "
    "customer_otps, customers, gold_rates, audit_logs, auth_tokens, staff_users, roles, "
    "stores, tenants"
)


@pytest.fixture(scope="session", autouse=True)
def migrated_db():
    cfg = Config(os.path.join(os.path.dirname(__file__), "..", "alembic.ini"))
    cfg.set_main_option("script_location", os.path.join(os.path.dirname(__file__), "..", "alembic"))
    command.downgrade(cfg, "base")
    command.upgrade(cfg, "head")


@pytest.fixture(autouse=True)
async def clean_db():
    yield
    async with engine.begin() as conn:
        await conn.execute(text(f"TRUNCATE {TABLES} CASCADE"))
    email.outbox.clear()
    sms.outbox.clear()
    config_cache.clear()
    site_cache.clear()


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


async def make_platform_admin() -> None:
    async with SessionLocal() as session, session.begin():
        await bypass_tenant_scope(session)
        user, _ = await create_staff_user(
            session,
            tenant_id=None,
            email=ADMIN_EMAIL,
            name="Admin",
            role_id=None,
            is_platform_admin=True,
        )
        user.password_hash = hash_password(ADMIN_PASSWORD)
        user.must_change_password = False


async def login(client: AsyncClient, email_: str, password: str, tenant: str | None = None):
    return await client.post(
        f"{API}/auth/login", json={"tenant": tenant, "email": email_, "password": password}
    )


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def admin_headers(client) -> dict[str, str]:
    await make_platform_admin()
    r = await login(client, ADMIN_EMAIL, ADMIN_PASSWORD)
    assert r.status_code == 200, r.text
    return bearer(r.json()["access_token"])


def last_temp_password(to: str) -> str:
    msg = next(m for m in reversed(email.outbox) if m.to == to)
    line = next(line for line in msg.body.splitlines() if line.startswith("Temporary password:"))
    return line.split(":", 1)[1].strip()


async def create_tenant(client, admin_headers, slug="sri-gold", owner="owner@sri.example.com"):
    r = await client.post(
        f"{API}/console/tenants",
        json={
            "slug": slug,
            "name": f"{slug} Jewellers",
            "owner_email": owner,
            "owner_name": "Owner",
        },
        headers=admin_headers,
    )
    assert r.status_code == 201, r.text
    return r.json()


async def sign_in_first_time(client, tenant: str, email_: str, new_password="Strong-pass-1"):
    """Temporary password from the email -> forced change -> signed in. Returns headers."""
    r = await login(client, email_, last_temp_password(email_), tenant)
    assert r.json()["status"] == "password_change_required", r.text
    r = await client.post(
        f"{API}/auth/first-login",
        json={
            "password_change_token": r.json()["password_change_token"],
            "new_password": new_password,
        },
    )
    assert r.status_code == 200, r.text
    return bearer(r.json()["access_token"])


@pytest.fixture
async def owner_headers(client, admin_headers):
    await create_tenant(client, admin_headers)
    return await sign_in_first_time(client, "sri-gold", "owner@sri.example.com")


async def publish_rate(client, headers, rate="10000", purity="22K", confirm=False):
    r = await client.post(
        f"{API}/crm/rates",
        json={"purity": purity, "rate_per_gram": rate, "confirm_large_change": confirm},
        headers=headers,
    )
    return r


def last_otp(phone: str) -> str:
    msg = next(m for m in reversed(sms.outbox) if m.to == phone)
    return msg.body.split()[0]


async def customer_sign_in(client, tenant="sri-gold", phone="9876543210"):
    r = await client.post(f"{API}/app/auth/otp", json={"tenant": tenant, "phone": phone})
    assert r.status_code == 202, r.text
    r = await client.post(
        f"{API}/app/auth/verify",
        json={"tenant": tenant, "phone": phone, "code": last_otp("+91" + phone[-10:])},
    )
    assert r.status_code == 200, r.text
    return bearer(r.json()["access_token"])
