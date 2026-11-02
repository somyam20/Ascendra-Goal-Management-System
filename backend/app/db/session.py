import os
from collections.abc import Generator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import NullPool

from app.core.config import settings


def make_engine(url: str):
    kwargs = {"pool_pre_ping": True}
    if url.startswith("postgresql"):
        # Safe with Supabase poolers (no server-side prepared statements).
        kwargs["connect_args"] = {"prepare_threshold": None}
        if os.environ.get("VERCEL"):
            # Serverless: don't hold idle connections per instance; the Supabase pooler does the pooling.
            kwargs["poolclass"] = NullPool
            kwargs.pop("pool_pre_ping")
    if url.startswith("sqlite"):
        kwargs = {"connect_args": {"check_same_thread": False}}
    engine = create_engine(url, **kwargs)
    if url.startswith("sqlite"):
        @event.listens_for(engine, "connect")
        def _fk_on(dbapi_conn, _):
            dbapi_conn.execute("PRAGMA foreign_keys=ON")
    return engine


engine = make_engine(settings.sqlalchemy_url)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
