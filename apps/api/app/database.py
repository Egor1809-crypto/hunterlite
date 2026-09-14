from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

engine = create_async_engine(
    settings.database_url,
    echo=settings.app_debug,
    # Bounded per-process pool; production reserves capacity for the bot,
    # migrations and administration instead of exceeding PostgreSQL limits.
    pool_size=settings.db_pool_size,
    max_overflow=settings.db_max_overflow,
    pool_pre_ping=True,   # Detect stale connections after DB restart/network hiccup
    pool_recycle=1800,     # Recycle connections every 30min to prevent stale TCP
    pool_timeout=30,       # Queue up to 30s for a connection (was 10 — too aggressive, causes cascading failures)
    connect_args={
        "timeout": 10,                              # TCP connect timeout
        "server_settings": {
            "statement_timeout": "30000",            # 30s max per SQL statement (prevents runaway queries)
            "lock_timeout": "10000",                 # 10s max waiting for row locks
        },
    },
)

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
