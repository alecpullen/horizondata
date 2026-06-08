"""
Student Session Manager

Manages ephemeral student sessions for observation sessions.

Sessions are persisted in the database (table ``student_sessions``) so they
survive server restarts and are shared across worker processes — the old
in-memory store dropped every student on restart and was invisible to other
processes, which produced wrong participant counts and spurious disconnects.

A session is removed / invalidated when:
- Teacher ends the observation session (``end_all_for_observation``)
- Teacher kicks the specific student (``kick_student``)
- Student voluntarily leaves (``end_session``)
- Session expires automatically (default: 8 hours)
"""

import uuid
import logging
from typing import Dict, Optional, List
from datetime import datetime, timedelta

from app.services.database import get_db
from app.models.student_session import StudentSession

logger = logging.getLogger(__name__)


class StudentSessionManager:
    """Database-backed store for ephemeral student sessions.

    The public API is unchanged from the previous in-memory implementation so
    callers don't need to change; only the storage backing differs.
    """

    def __init__(self):
        # <---- CHANGE THIS INT VALUE FOR SESSION DURATION
        self.session_duration_hours: int = 8

    def create_session(self, display_name: str, observation_session_id: str) -> str:
        session_id = str(uuid.uuid4())
        now = datetime.utcnow()
        with get_db() as db:
            db.add(StudentSession(
                id=session_id,
                display_name=display_name,
                observation_session_id=str(observation_session_id),
                created_at=now,
                expires_at=now + timedelta(hours=self.session_duration_hours),
                kicked=False,
            ))
        logger.info(f"Student session created: {session_id}")
        return session_id

    def validate_session(self, session_id: str) -> Optional[Dict]:
        with get_db() as db:
            s = db.query(StudentSession).filter(StudentSession.id == session_id).first()
            if s is None or s.kicked:
                return None

            # Auto-cleanup expired sessions on access.
            if datetime.utcnow() > s.expires_at:
                db.delete(s)
                logger.info(f"Student session expired and removed: {session_id}")
                return None

            return {
                'id': s.id,
                'display_name': s.display_name,
                'observation_session_id': s.observation_session_id,
                'created_at': s.created_at.isoformat(),
                'expires_at': s.expires_at.isoformat(),
                'user_type': 'student',
            }

    def end_session(self, session_id: str) -> bool:
        with get_db() as db:
            s = db.query(StudentSession).filter(StudentSession.id == session_id).first()
            if s is None:
                return False
            db.delete(s)
        logger.info(f"Student session ended: {session_id}")
        return True

    def kick_student(self, session_id: str, reason: str = "Kicked by teacher") -> bool:
        with get_db() as db:
            s = db.query(StudentSession).filter(StudentSession.id == session_id).first()
            if s is None:
                return False
            s.kicked = True
            s.kicked_reason = reason
        logger.info(f"Student kicked: {session_id}, reason: {reason}")
        return True

    def list_participants(self, observation_session_id: str) -> List[Dict]:
        now = datetime.utcnow()
        with get_db() as db:
            rows = (
                db.query(StudentSession)
                .filter(
                    StudentSession.observation_session_id == str(observation_session_id),
                    StudentSession.kicked == False,  # noqa: E712 — SQLAlchemy needs ==
                    StudentSession.expires_at > now,
                )
                .all()
            )
            return [
                {
                    'id': s.id,
                    'display_name': s.display_name,
                    'joined_at': s.created_at.isoformat(),
                }
                for s in rows
            ]

    def end_all_for_observation(self, observation_session_id: str) -> int:
        with get_db() as db:
            count = (
                db.query(StudentSession)
                .filter(StudentSession.observation_session_id == str(observation_session_id))
                .delete(synchronize_session=False)
            )
        logger.info(f"Ended {count} student sessions for observation {observation_session_id}")
        return count

    def cleanup_expired_sessions(self) -> int:
        """Remove all expired (non-kicked) sessions. Returns count removed."""
        now = datetime.utcnow()
        with get_db() as db:
            count = (
                db.query(StudentSession)
                .filter(
                    StudentSession.expires_at < now,
                    StudentSession.kicked == False,  # noqa: E712
                )
                .delete(synchronize_session=False)
            )
        if count:
            logger.info(f"Total expired sessions cleaned up: {count}")
        return count

    def get_session_count(self, observation_session_id: str) -> int:
        now = datetime.utcnow()
        with get_db() as db:
            return (
                db.query(StudentSession)
                .filter(
                    StudentSession.observation_session_id == str(observation_session_id),
                    StudentSession.kicked == False,  # noqa: E712
                    StudentSession.expires_at > now,
                )
                .count()
            )


_manager = StudentSessionManager()


def get_student_session_manager() -> StudentSessionManager:
    return _manager
