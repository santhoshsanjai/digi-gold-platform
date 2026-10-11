import asyncio
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api import (
    app_auth,
    app_gold,
    auth,
    console,
    crm_audit,
    crm_customers,
    crm_dashboard,
    crm_expiry,
    crm_rates,
    crm_redemptions,
    crm_roles,
    crm_settings,
    crm_stores,
    crm_users,
    public,
)
from app.core.config import get_settings
from app.core.db import engine
from app.services.expiry import run_daily

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    task = None
    if settings.run_scheduler and settings.env != "test":
        task = asyncio.create_task(run_daily(settings.reminder_hour))
    yield
    if task:
        task.cancel()
        with suppress(asyncio.CancelledError):
            await task
    await engine.dispose()


app = FastAPI(
    title="Digi Gold Platform API",
    version="0.1.0",
    docs_url="/docs" if settings.env != "prod" else None,
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

API_PREFIX = "/api/v1"
ROUTERS = (
    auth,
    console,
    crm_settings,
    crm_users,
    crm_roles,
    crm_stores,
    crm_audit,
    crm_rates,
    crm_customers,
    crm_redemptions,
    crm_expiry,
    crm_dashboard,
    app_auth,
    app_gold,
    public,
)
for module in ROUTERS:
    app.include_router(module.router, prefix=API_PREFIX)


@app.get("/health", include_in_schema=False)
async def health() -> dict[str, str]:
    async with engine.connect() as conn:
        await conn.execute(text("SELECT 1"))
    return {"status": "ok"}
