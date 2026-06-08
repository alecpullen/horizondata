import uuid
from datetime import datetime, timedelta

from sqlalchemy import Column, String, DateTime, Boolean
from app.services.database import Base

# Default lifetime fallback; the manager sets expires_at explicitly on create.
DEFAULT_SESSION_HOURS = 8


def _default_expiry():
    return datetime.utcnow() + timedelta(hours=DEFAULT_SESSION_HOURS)


class StudentSession(Base):
    """Ephemeral student session, persisted to the database.

    Previously these lived only in process memory, so every server restart
    silently disconnected all students and the store was invisible to other
    worker processes (wrong participant counts, spurious 401s). Persisting
    them makes the count and student auth survive restarts and work across
    processes.

    Times are stored as naive UTC (matching ``datetime.utcnow()``) to keep
    comparisons unambiguous across drivers.
    """

    __tablename__ = "student_sessions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    display_name = Column(String(50), nullable=False)
    observation_session_id = Column(String(36), nullable=False, index=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False, default=_default_expiry)
    kicked = Column(Boolean, nullable=False, default=False)
    kicked_reason = Column(String(255), nullable=True)
