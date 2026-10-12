from collections.abc import AsyncIterator
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings

_settings = get_settings()

engine = create_async_engine(
    _settings.database_url,
    pool_size=_settings.db_pool_size,
    max_overflow=_settings.db_max_overflow,
    pool_pre_ping=True,
)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_session() -> AsyncIterator[AsyncSession]:
    """One transaction per request: committed on success, rolled back on error."""
    async with SessionLocal() as session, session.begin():
        yield session


async def scope_to_tenant(session: AsyncSession, tenant_id: UUID) -> None:
    """Limit this transaction to one tenant's rows (enforced by row-level security)."""
    await session.execute(
        text("SELECT set_config('app.tenant_id', :t, true)"), {"t": str(tenant_id)}
    )


async def bypass_tenant_scope(session: AsyncSession) -> None:
    """Platform-level access across tenants (Platform Console and sign-in lookups only)."""
    await session.execute(text("SELECT set_config('app.bypass_rls', 'on', true)"))
