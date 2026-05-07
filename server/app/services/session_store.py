"""In-memory session store with thread-safe operations."""
import random
import threading
from datetime import datetime, timedelta
from typing import Optional, Dict, List

from ..models.session import Session, Student


class SessionStore:
    """
    Thread-safe in-memory store for managing sessions.

    Uses two indexes:
    - _sessions: session_id -> Session
    - _join_codes: join_code -> session_id (for fast lookup)
    """

    def __init__(self, max_students_per_session: int = 30):
        self._sessions: Dict[str, Session] = {}  # session_id -> Session
        self._join_codes: Dict[str, str] = {}    # join_code -> session_id
        self._lock = threading.RLock()
        self._max_students = max_students_per_session

    def create_session(
        self,
        teacher_id: str,
        object_name: str,
        telescope: str,
        booking_id: Optional[str] = None
    ) -> Session:
        """
        Create a new session with a unique 6-digit join code.

        Args:
            teacher_id: Identifier for the teacher
            object_name: Target celestial object
            telescope: Telescope location/name
            booking_id: Optional reference to a booking

        Returns:
            The newly created Session object
        """
        import uuid

        with self._lock:
            # Generate unique 6-digit join code
            join_code = self._generate_unique_join_code()

            # Create session
            session = Session(
                id=uuid.uuid4().hex[:16],
                booking_id=booking_id,
                join_code=join_code,
                teacher_id=teacher_id,
                object_name=object_name,
                telescope=telescope,
                status='pending',
                created_at=datetime.utcnow(),
                max_students=self._max_students
            )

            # Store in both indexes
            self._sessions[session.id] = session
            self._join_codes[join_code] = session.id

            return session

    def get_by_join_code(self, join_code: str) -> Optional[Session]:
        """
        Get a session by its join code.

        Args:
            join_code: The 6-digit join code

        Returns:
            The Session if found, None otherwise
        """
        with self._lock:
            session_id = self._join_codes.get(join_code)
            if session_id:
                return self._sessions.get(session_id)
            return None

    def get_by_id(self, session_id: str) -> Optional[Session]:
        """
        Get a session by its ID.

        Args:
            session_id: The session UUID

        Returns:
            The Session if found, None otherwise
        """
        with self._lock:
            return self._sessions.get(session_id)

    def add_student(self, join_code: str, student_name: str) -> Optional[Student]:
        """
        Add a student to a session by join code.

        Args:
            join_code: The 6-digit join code
            student_name: The student's name

        Returns:
            The Student object if successfully added, None if session not found

        Raises:
            ValueError: If session is full or not in a joinable state
        """
        with self._lock:
            session = self.get_by_join_code(join_code)
            if not session:
                return None

            if session.status == 'ended':
                raise ValueError("Session has ended")

            if len(session.students) >= session.max_students:
                raise ValueError("Session is at capacity")

            return session.add_student(student_name)

    def remove_student(self, session_id: str, student_id: str) -> bool:
        """
        Remove a student from a session.

        Args:
            session_id: The session UUID
            student_id: The student ID to remove

        Returns:
            True if student was found and removed, False otherwise
        """
        with self._lock:
            session = self._sessions.get(session_id)
            if not session:
                return False
            return session.remove_student(student_id)

    def start_session(self, session_id: str) -> bool:
        """
        Start a session, transitioning it from 'pending' to 'active'.

        Args:
            session_id: The session UUID

        Returns:
            True if successfully started, False if session not found

        Raises:
            ValueError: If session cannot be started (wrong status)
        """
        with self._lock:
            session = self._sessions.get(session_id)
            if not session:
                return False
            session.start()
            return True

    def end_session(self, session_id: str) -> bool:
        """
        End a session, transitioning it to 'ended' status.

        Args:
            session_id: The session UUID

        Returns:
            True if successfully ended, False if session not found

        Raises:
            ValueError: If session cannot be ended (wrong status)
        """
        with self._lock:
            session = self._sessions.get(session_id)
            if not session:
                return False
            session.end()
            return True

    def list_active_sessions(self) -> List[Session]:
        """
        List all currently active sessions.

        Returns:
            List of Session objects with 'active' status
        """
        with self._lock:
            return [s for s in self._sessions.values() if s.status == 'active']

    def list_all_sessions(self) -> List[Session]:
        """
        List all sessions (for debugging/admin).

        Returns:
            List of all Session objects
        """
        with self._lock:
            return list(self._sessions.values())

    def cleanup_ended_sessions(self, older_than_hours: int = 24) -> int:
        """
        Remove ended sessions older than specified hours.

        Args:
            older_than_hours: Remove sessions ended more than this many hours ago

        Returns:
            Number of sessions removed
        """
        cutoff = datetime.utcnow() - timedelta(hours=older_than_hours)
        removed = 0

        with self._lock:
            to_remove = []
            for session_id, session in self._sessions.items():
                if session.status == 'ended' and session.ended_at and session.ended_at < cutoff:
                    to_remove.append(session_id)

            for session_id in to_remove:
                session = self._sessions.pop(session_id)
                self._join_codes.pop(session.join_code, None)
                removed += 1

        return removed

    def _generate_unique_join_code(self) -> str:
        """
        Generate a unique 6-digit join code.

        Ensures the code doesn't collide with existing codes.
        Falls back to sequential check after 100 attempts to avoid infinite loop.

        Returns:
            A unique 6-digit string
        """
        # Try random generation first
        for _ in range(100):
            code = str(random.randint(100000, 999999))
            if code not in self._join_codes:
                return code

        # Fall back to sequential search if random fails
        for i in range(100000, 1000000):
            code = str(i)
            if code not in self._join_codes:
                return code

        raise RuntimeError("All 6-digit join codes are exhausted")


# Singleton instance for the application
# Note: In a production environment with multiple workers,
# this would need to be replaced with Redis or similar
global_session_store = SessionStore()
