from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api import auth, console, crm_audit, crm_roles, crm_settings, crm_stores, crm_users, public
from app.core.config import get_settings
from app.core.db import engine

settings = get_settings()

app = FastAPI(
    title="Digi Gold Platform API",
    version="0.1.0",
    docs_url="/docs" if settings.env != "prod" else None,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

API_PREFIX = "/api/v1"
for module in (auth, console, crm_settings, crm_users, crm_roles, crm_stores, crm_audit, public):
    app.include_router(module.router, prefix=API_PREFIX)


@app.get("/health", include_in_schema=False)
async def health() -> dict[str, str]:
    async with engine.connect() as conn:
        await conn.execute(text("SELECT 1"))
    return {"status": "ok"}
