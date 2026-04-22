"""
Async SQLAlchemy engine, session factory, and table creation.
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import (
	AsyncSession,
	async_sessionmaker,
	create_async_engine,
)

from config import get_settings

settings = get_settings()

# Ensure the URL uses asyncpg dialect
_url = settings.database_url
if _url.startswith("postgresql://"):
	_url = _url.replace("postgresql://", "postgresql+asyncpg://", 1)
elif _url.startswith("postgresql+psycopg2://"):
	_url = _url.replace("postgresql+psycopg2://", "postgresql+asyncpg://", 1)

engine = create_async_engine(
	_url,
	echo=settings.env == "development",
	pool_pre_ping=True,
	pool_size=20,
	max_overflow=30,
)

AsyncSessionLocal = async_sessionmaker(
	bind=engine,
	class_=AsyncSession,
	expire_on_commit=False,
	autoflush=False,
	autocommit=False,
)


async def get_db() -> AsyncSession:	 # type: ignore[return]
	"""FastAPI dependency yielding a transactional DB session."""
	async with AsyncSessionLocal() as session:
		try:
			yield session
			await session.commit()
		except Exception:
			await session.rollback()
			raise
		finally:
			await session.close()


async def create_all_tables() -> None:
	"""
	Create all tables defined in ORM models.
	Called during app lifespan startup.
	Also safe to call repeatedly (CREATE IF NOT EXISTS).
	"""
	# Import all models so their metadata is registered with Base
	from models.base import Base
	import models.session  # noqa: F401
	import models.workflow	# noqa: F401
	import models.run_log  # noqa: F401

	async with engine.begin() as conn:
		await conn.run_sync(Base.metadata.create_all)
