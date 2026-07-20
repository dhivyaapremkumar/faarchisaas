from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import text
from app.core.config import settings

engine = create_async_engine(settings.DATABASE_URL, echo=False, pool_pre_ping=True)

AsyncSessionLocal = async_sessionmaker(
    bind=engine, expire_on_commit=False, class_=AsyncSession
)


async def get_db():
    """
    Plain DB session, no tenant context set.
    Only use for auth/signup endpoints that happen BEFORE we know the org/role.
    """
    async with AsyncSessionLocal() as session:
        yield session


async def get_db_with_rls(org_id: str, user_id: str, role: str):
    """
    Yields a DB session with Postgres session variables set for Row-Level Security.
    Every tenant-scoped table's RLS policy reads these via current_setting().
    SET LOCAL scopes the variables to the current transaction only - they don't leak
    across requests even if connections are pooled/reused.
    """
    async with AsyncSessionLocal() as session:
        async with session.begin():
            await session.execute(text("SET LOCAL app.current_org_id = :org_id"), {"org_id": org_id})
            await session.execute(text("SET LOCAL app.current_user_id = :user_id"), {"user_id": user_id})
            await session.execute(text("SET LOCAL app.current_role = :role"), {"role": role})
        yield session
