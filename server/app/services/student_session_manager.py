"""
Student Session Manager

Manages ephemeral student sessions for observation sessions.
Sessions persist only in memory and are deleted when:
- Teacher ends the observation session
- Teacher kicks the specific student
- Student voluntarily leaves
- Session expires automatically (default: 8 hours)

Auto-expiry: Sessions now have an expiration time and are automatically
invalidated after the timeout period.
"""

import uuid
import logging
from typing import Dict, Optional, List
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from threading import Lock

logger = logging.getLogger(__name__)


@dataclass
class StudentSession:
    """Represents an ephemeral student session"""
    id: str
    display_name: str
    observation_session_id: str
    created_at: datetime = field(default_factory=datetime.utcnow)
    expires_at: datetime = field(default_factory=lambda: datetime.utcnow() + timedelta(hours=8))
    kicked: bool = False
    kicked_reason: Optional[str] = None


class StudentSessionManager:
    """
    In-memory manager for student sessions.

    Thread-safe singleton that stores student sessions.
    Sessions are identified by UUID and linked to observation sessions.
    """

    _instance: Optional['StudentSessionManager'] = None
    _lock: Lock = Lock()

    def __new__(cls) -> 'StudentSessionManager':
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self._sessions: Dict[str, StudentSession] = {}
        self._observation_index: Dict[str, set] = {}
        self._lock = Lock()
        self._initialized = True
        self.session_duration_hours: int = 8  # Configurable session duration
        logger.info("StudentSessionManager initialized")

    def create_session(self, display_name: str, observation_session_id: str) -> str:
        session_id = str(uuid.uuid4())
        session = StudentSession(
            id=session_id,
            display_name=display_name,
            observation_session_id=observation_session_id,
            expires_at=datetime.utcnow() + timedelta(hours=self.session_duration_hours)
        )
        with self._lock:
            self._sessions[session_id] = session
            if observation_session_id not in self._observation_index:
                self._observation_index[observation_session_id] = set()
            self._observation_index[observation_session_id].add(session_id)
        logger.info(f"Student session created: {session_id}")
        return session_id

    def validate_session(self, session_id: str) -> Optional[Dict]:
        with self._lock:
            session = self._sessions.get(session_id)
            if session is None or session.kicked:
                return None
            
            # Check if session has expired
            if datetime.utcnow() > session.expires_at:
                # Auto-cleanup: remove expired session
                del self._sessions[session_id]
                obs_id = session.observation_session_id
                if obs_id in self._observation_index:
                    self._observation_index[obs_id].discard(session_id)
                    if not self._observation_index[obs_id]:
                        del self._observation_index[obs_id]
                logger.info(f"Student session expired and removed: {session_id}")
                return None
            
            return {
                'id': session.id,
                'display_name': session.display_name,
                'observation_session_id': session.observation_session_id,
                'created_at': session.created_at.isoformat(),
                'expires_at': session.expires_at.isoformat(),
                'user_type': 'student',
            }

    def end_session(self, session_id: str) -> bool:
        with self._lock:
            session = self._sessions.get(session_id)
            if session is None:
                return False
            del self._sessions[session_id]
            obs_id = session.observation_session_id
            if obs_id in self._observation_index:
                self._observation_index[obs_id].discard(session_id)
                if not self._observation_index[obs_id]:
                    del self._observation_index[obs_id]
        logger.info(f"Student session ended: {session_id}")
        return True

    def kick_student(self, session_id: str, reason: str = "Kicked by teacher") -> bool:
        with self._lock:
            session = self._sessions.get(session_id)
            if session is None:
                return False
            session.kicked = True
            session.kicked_reason = reason
        logger.info(f"Student kicked: {session_id}, reason: {reason}")
        return True

    def list_participants(self, observation_session_id: str) -> List[Dict]:
        with self._lock:
            session_ids = self._observation_index.get(observation_session_id, set())
            return [
                {
                    'id': s.id,
                    'display_name': s.display_name,
                    'joined_at': s.created_at.isoformat(),
                }
                for sid in session_ids
                if (s := self._sessions.get(sid)) and not s.kicked
            ]

    def end_all_for_observation(self, observation_session_id: str) -> int:
        with self._lock:
            session_ids = list(self._observation_index.get(observation_session_id, set()))
            for sid in session_ids:
                self._sessions.pop(sid, None)
            if observation_session_id in self._observation_index:
                del self._observation_index[observation_session_id]
        logger.info(f"Ended {len(session_ids)} student sessions for observation {observation_session_id}")
        return len(session_ids)

    def cleanup_expired_sessions(self) -> int:
        """Remove all expired sessions. Returns count of removed sessions."""
        now = datetime.utcnow()
        expired_ids = []
        
        with self._lock:
            # Find expired sessions
            for session_id, session in self._sessions.items():
                if now > session.expires_at and not session.kicked:
                    expired_ids.append((session_id, session.observation_session_id))
            
            # Remove expired sessions
            removed_count = 0
            for session_id, obs_id in expired_ids:
                if session_id in self._sessions:
                    del self._sessions[session_id]
                    if obs_id in self._observation_index:
                        self._observation_index[obs_id].discard(session_id)
                        if not self._observation_index[obs_id]:
                            del self._observation_index[obs_id]
                    removed_count += 1
                    logger.info(f"Cleaned up expired session: {session_id}")
            
            if removed_count > 0:
                logger.info(f"Total expired sessions cleaned up: {removed_count}")
            return removed_count

    def get_session_count(self, observation_session_id: str) -> int:
        with self._lock:
            session_ids = self._observation_index.get(observation_session_id, set())
            return sum(
                1 for sid in session_ids
                if (s := self._sessions.get(sid)) and not s.kicked
            )


def get_student_session_manager() -> StudentSessionManager:
    return StudentSessionManager()
