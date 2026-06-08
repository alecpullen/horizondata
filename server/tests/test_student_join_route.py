import os
import sys
import uuid
import unittest
from contextlib import contextmanager
from unittest.mock import MagicMock, patch

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)

os.environ.setdefault("HEADLESS_SCHEDULER_ENABLED", "false")

from app import create_app

SESSION_ID = uuid.uuid4()


class _DetachOnClose:
    """Mimics SQLAlchemy's expire_on_commit behaviour: once the owning
    session closes, accessing a mapped attribute on the now-detached
    instance raises — exactly what triggered Bug 10's 500.
    """

    def __init__(self, value):
        self._value = value
        self._detached = False

    @property
    def id(self):
        if self._detached:
            raise RuntimeError("Instance <ObservationSession> is detached (session closed)")
        return self._value

    @property
    def session_code(self):
        if self._detached:
            raise RuntimeError("Instance <ObservationSession> is detached (session closed)")
        return "ABC123"


@contextmanager
def _make_get_db_detaching(obs):
    """A get_db() stand-in that detaches the returned row when the block
    exits, the way a real committed+closed session would.
    """
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = obs
    try:
        yield db
    finally:
        if isinstance(obs, _DetachOnClose):
            obs._detached = True


class TestStudentJoinRoute(unittest.TestCase):

    def setUp(self):
        self.app = create_app()
        self.app.config["TESTING"] = True
        self.client = self.app.test_client()

    def test_join_succeeds_with_active_session(self):
        """Regression for Bug 10: a valid, active session must return 201,
        not a 500 from accessing a detached ORM instance after the session
        closes.
        """
        obs = _DetachOnClose(SESSION_ID)

        with patch("app.routes.auth.get_db", lambda: _make_get_db_detaching(obs)), \
             patch("app.routes.auth.check_join_limit", return_value=True), \
             patch(
                 "app.services.student_session_manager.StudentSessionManager.create_session",
                 return_value="student-session-1",
             ):
            resp = self.client.post(
                "/api/auth/student/join",
                json={"display_name": "Alex", "session_code": "ABC123"},
            )

        self.assertEqual(resp.status_code, 201)
        data = resp.get_json()
        self.assertTrue(data["success"])
        self.assertEqual(data["observation_session_id"], str(SESSION_ID))
        self.assertEqual(data["session_id"], "student-session-1")

    def test_join_unknown_code_returns_404(self):
        """An unknown / inactive code returns a clear 404, never a 500."""
        with patch("app.routes.auth.get_db", lambda: _make_get_db_detaching(None)), \
             patch("app.routes.auth.check_join_limit", return_value=True):
            resp = self.client.post(
                "/api/auth/student/join",
                json={"display_name": "Alex", "session_code": "ZZZZZZ"},
            )

        self.assertEqual(resp.status_code, 404)
        self.assertEqual(resp.get_json()["error"], "session_not_found")


if __name__ == "__main__":
    unittest.main()
