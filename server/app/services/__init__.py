from contextlib import contextmanager
import logging

logger = logging.getLogger(__name__)

@contextmanager
def get_db():
    db = SessionLocal()
    try:
        yield db
        db.commit()
        logger.debug("Database session committed successfully")
    except Exception as e:
        db.rollback()
        logger.error(f"Database session rolled back due to error: {e}")
        raise
    finally:
        db.close()
        logger.debug("Database session closed")