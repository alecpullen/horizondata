import os
from contextlib import contextmanager
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

_env_db_url = os.getenv("DATABASE_URL")
DATABASE_URL = _env_db_url

if not DATABASE_URL:
    host = os.getenv("DB_HOST", "localhost")
    port = os.getenv("DB_PORT", "5432")
    name = os.getenv("DB_NAME", "horizon")
    user = os.getenv("DB_USER", "postgres")
    password = os.getenv("DB_PASSWORD", "postgres")
    DATABASE_URL = f"postgresql+psycopg2://{user}:{password}@{host}:{port}/{name}"

# Default to "require" when DATABASE_URL was explicitly set (e.g. Neon/cloud),
# "prefer" when assembled from individual DB_* vars (local development).
_ssl_default = "require" if _env_db_url else "prefer"
_ssl_mode = os.getenv("DATABASE_SSL_MODE", _ssl_default)
connect_args = {"sslmode": _ssl_mode} if _ssl_mode else {}

engine = create_engine(
    DATABASE_URL,
    pool_size=int(os.getenv("DATABASE_POOL_SIZE", 10)),
    max_overflow=int(os.getenv("DATABASE_MAX_OVERFLOW", 20)),
    pool_pre_ping=True,
    pool_recycle=int(os.getenv("DATABASE_POOL_RECYCLE", 3600)),
    pool_timeout=30,
    connect_args=connect_args,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


@contextmanager
def get_db():
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
