import asyncio
import logging
import os
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from app.api import (
    app_auth,
    app_gold,
    auth,
    console,
    console_site,
    crm_audit,
    crm_customers,
    crm_dashboard,
    crm_expiry,
    crm_rates,
    crm_redemptions,
    crm_reports,
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

# Uvicorn only configures its own loggers; this makes the app's logs (reminders, outgoing
# email and SMS in development) show up too.
logging.basicConfig(level=logging.INFO, format="%(levelname)s:     %(name)s: %(message)s")


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


@app.middleware("http")
async def open_public_reads(request: Request, call_next):
    """Client websites live on their own domains, so public reads and images allow any
    origin. They carry no credentials; everything else keeps the CORS list above."""
    response = await call_next(request)
    path = request.url.path
    if request.method == "GET" and (
        path.startswith(f"{API_PREFIX}/public/") or path.startswith(settings.media_url_path)
    ):
        response.headers["Access-Control-Allow-Origin"] = "*"
    if path.startswith(settings.media_url_path):
        response.headers["X-Content-Type-Options"] = "nosniff"
    return response


ROUTERS = (
    auth,
    console,
    console_site,
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
    crm_reports,
    app_auth,
    app_gold,
    public,
)
for module in ROUTERS:
    app.include_router(module.router, prefix=API_PREFIX)

# Uploaded images, while they live on local disk. Behind a CDN or bucket this mount is unused.
os.makedirs(settings.media_dir, exist_ok=True)
app.mount(settings.media_url_path, StaticFiles(directory=settings.media_dir), name="media")


@app.get("/health", include_in_schema=False)
async def health() -> dict[str, str]:
    async with engine.connect() as conn:
        await conn.execute(text("SELECT 1"))
    return {"status": "ok"}
