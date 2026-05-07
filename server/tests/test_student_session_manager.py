import unittest
from datetime import datetime, timedelta
import sys
import os

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)

from app.services.student_session_manager import StudentSessionManager


class TestStudentSessionExpiry(unittest.TestCase):

    def setUp(self):
        self.mgr = StudentSessionManager()
        self.mgr._sessions.clear()
        self.mgr._observation_index.clear()

    def _expire_session(self, session_id):
        """Backdate a session's expires_at so it reads as already expired."""
        self.mgr._sessions[session_id].expires_at = datetime.utcnow() - timedelta(seconds=1)

    def test_session_valid_immediately_after_creation(self):
        session_id = self.mgr.create_session("Alice", "obs-1")
        result = self.mgr.validate_session(session_id)
        self.assertIsNotNone(result)
        self.assertEqual(result["display_name"], "Alice")

    def test_validate_returns_none_for_expired_session(self):
        session_id = self.mgr.create_session("Bob", "obs-1")
        self._expire_session(session_id)
        result = self.mgr.validate_session(session_id)
        self.assertIsNone(result)

    def test_expired_session_removed_from_store_on_validate(self):
        session_id = self.mgr.create_session("Carol", "obs-1")
        self._expire_session(session_id)
        self.mgr.validate_session(session_id)
        self.assertNotIn(session_id, self.mgr._sessions)

    def test_expired_session_removed_from_observation_index_on_validate(self):
        session_id = self.mgr.create_session("Dave", "obs-1")
        self._expire_session(session_id)
        self.mgr.validate_session(session_id)
        self.assertNotIn("obs-1", self.mgr._observation_index)

    def test_cleanup_removes_only_expired_sessions(self):
        live_id = self.mgr.create_session("Eve", "obs-1")
        dead_id = self.mgr.create_session("Frank", "obs-1")
        self._expire_session(dead_id)

        removed = self.mgr.cleanup_expired_sessions()

        self.assertEqual(removed, 1)
        self.assertIn(live_id, self.mgr._sessions)
        self.assertNotIn(dead_id, self.mgr._sessions)

    def test_cleanup_returns_zero_when_nothing_expired(self):
        self.mgr.create_session("Grace", "obs-1")
        removed = self.mgr.cleanup_expired_sessions()
        self.assertEqual(removed, 0)

    def test_cleanup_removes_multiple_expired_sessions(self):
        ids = [self.mgr.create_session(f"Student-{i}", "obs-1") for i in range(3)]
        for sid in ids:
            self._expire_session(sid)

        removed = self.mgr.cleanup_expired_sessions()

        self.assertEqual(removed, 3)
        self.assertEqual(len(self.mgr._sessions), 0)

    def test_validate_returns_expected_fields(self):
        session_id = self.mgr.create_session("Hannah", "obs-42")
        result = self.mgr.validate_session(session_id)
        for key in ("id", "display_name", "observation_session_id", "created_at", "expires_at", "user_type"):
            self.assertIn(key, result)
        self.assertEqual(result["user_type"], "student")
        self.assertEqual(result["observation_session_id"], "obs-42")

    def test_unknown_session_id_returns_none(self):
        result = self.mgr.validate_session("does-not-exist")
        self.assertIsNone(result)

    def test_kicked_session_returns_none_regardless_of_expiry(self):
        session_id = self.mgr.create_session("Ivan", "obs-1")
        self.mgr.kick_student(session_id)
        result = self.mgr.validate_session(session_id)
        self.assertIsNone(result)

    def test_session_duration_controls_expires_at(self):
        self.mgr.session_duration_hours = 2
        session_id = self.mgr.create_session("Julia", "obs-1")
        session = self.mgr._sessions[session_id]
        expected_expiry = session.created_at + timedelta(hours=2)
        delta = abs((session.expires_at - expected_expiry).total_seconds())
        self.assertLess(delta, 2)  # within 2 seconds of expected


if __name__ == "__main__":
    unittest.main()
