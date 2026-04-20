"""
Student Session Manager

Manages ephemeral student sessions for observation sessions.
Sessions persist only in memory and are deleted when:
- Teacher ends the observation session
- Teacher kicks the specific student
- Student voluntarily leaves

No auto-expiry - sessions live until explicitly terminated.
"""

import uuid
import logging
from typing import Dict, Optional, List
from dataclasses import dataclass, field
from datetime import datetime
from threading import Lock

logger = logging.getLogger(__name__)


@dataclass
class StudentSession:
    """Represents an ephemeral student session"""
    id: str
    display_name: str
    observation_session_id: str
    created_at: datetime = field(default_factory=datetime.utcnow)
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
        self._observation_index: Dict[str, set] = {}  # observation_id -> set of session_ids
        self._lock = Lock()
        self._initialized = True
        logger.info("StudentSessionManager initialized")
    
    def create_session(self, display_name: str, observation_session_id: str) -> str:
        """
        Create a new student session.
        
        Args:
            display_name: Student's display name (e.g., "Student Alex")
            observation_session_id: UUID of the observation session they're joining
            
        Returns:
            Session ID (UUID string)
        """
        session_id = str(uuid.uuid4())
        
        session = StudentSession(
            id=session_id,
            display_name=display_name,
            observation_session_id=observation_session_id
        )
        
        with self._lock:
            self._sessions[session_id] = session
            
            # Index by observation session
            if observation_session_id not in self._observation_index:
                self._observation_index[observation_session_id] = set()
            self._observation_index[observation_session_id].add(session_id)
        
        logger.info(f"Student session created: {session_id} for observation {observation_session_id}")
        return session_id
    
    def validate_session(self, session_id: str) -> Optional[Dict]:
        """
        Validate a student session exists and hasn't been kicked.
        
        Args:
            session_id: Session ID to validate
            
        Returns:
            Session dict if valid, None otherwise
        """
        with self._lock:
            session = self._sessions.get(session_id)
            
            if session is None:
                return None
                
            if session.kicked:
                return None
            
            return {
                'id': session.id,
                'display_name': session.display_name,
                'observation_session_id': session.observation_session_id,
                'created_at': session.created_at.isoformat(),
                'user_type': 'student'
            }
    
    def end_session(self, session_id: str) -> bool:
        """
        End a student session (voluntary leave or kicked).
        
        Args:
            session_id: Session ID to end
            
        Returns:
            True if session was found and removed
        """
        with self._lock:
            session = self._sessions.get(session_id)
            if session is None:
                return False
            
            # Remove from main store
            del self._sessions[session_id]
            
            # Remove from observation index
            obs_id = session.observation_session_id
            if obs_id in self._observation_index:
                self._observation_index[obs_id].discard(session_id)
                if not self._observation_index[obs_id]:
                    del self._observation_index[obs_id]
        
        logger.info(f"Student session ended: {session_id}")
        return True
    
    def kick_student(self, session_id: str, reason: str = "Kicked by teacher") -> bool:
        """
        Mark a student as kicked (teacher action).
        
        Args:
            session_id: Session ID to kick
            reason: Reason for kicking
            
        Returns:
            True if student was found and kicked
        """
        with self._lock:
            session = self._sessions.get(session_id)
            if session is None:
                return False
            
            session.kicked = True
            session.kicked_reason = reason
        
        logger.info(f"Student kicked: {session_id}, reason: {reason}")
        return True
    
    def list_participants(self, observation_session_id: str) -> List[Dict]:
        """
        List all active students in an observation session.
        
        Args:
            observation_session_id: Observation session ID
            
        Returns:
            List of student session dicts
        """
        with self._lock:
            session_ids = self._observation_index.get(observation_session_id, set())
            participants = []
            
            for sid in session_ids:
                session = self._sessions.get(sid)
                if session and not session.kicked:
                    participants.append({
                        'id': session.id,
                        'display_name': session.display_name,
                        'joined_at': session.created_at.isoformat()
                    })
            
            return participants
    
    def end_all_for_observation(self, observation_session_id: str) -> int:
        """
        End all student sessions for an observation session.
        Called when teacher ends the session.
        
        Args:
            observation_session_id: Observation session ID
            
        Returns:
            Number of sessions ended
        """
        with self._lock:
            session_ids = list(self._observation_index.get(observation_session_id, set()))
            count = 0
            
            for sid in session_ids:
                if self.end_session(sid):
                    count += 1
            
            # Clean up index
            if observation_session_id in self._observation_index:
                del self._observation_index[observation_session_id]
        
        logger.info(f"Ended {count} student sessions for observation {observation_session_id}")
        return count
    
    def get_session_count(self, observation_session_id: str) -> int:
        """
        Get count of active students in an observation session.
        
        Args:
            observation_session_id: Observation session ID
            
        Returns:
            Number of active students
        """
        with self._lock:
            session_ids = self._observation_index.get(observation_session_id, set())
            count = 0
            for sid in session_ids:
                session = self._sessions.get(sid)
                if session and not session.kicked:
                    count += 1
            return count


# Singleton accessor
def get_student_session_manager() -> StudentSessionManager:
    """Get the singleton StudentSessionManager instance"""
    return StudentSessionManager()
