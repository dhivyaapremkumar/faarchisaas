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
    Uses set_config() rather than `SET LOCAL x = $1` because Postgres's SET
    command does not accept bind parameters - only set_config() does, while
    still being scoped to the current transaction (third arg `true` = local).
    """
    async with AsyncSessionLocal() as session:
        async with session.begin():
            await session.execute(text("SELECT set_config('app.current_org_id', :val, true)"), {"val": org_id})
            await session.execute(text("SELECT set_config('app.current_user_id', :val, true)"), {"val": user_id})
            await session.execute(text("SELECT set_config('app.current_role', :val, true)"), {"val": role})
            yield session
