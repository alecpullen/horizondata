import os
import sys
import unittest
from unittest.mock import MagicMock, patch

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)

os.environ.setdefault("HEADLESS_SCHEDULER_ENABLED", "false")

from app import create_app


VALID_SESSION_ID = "test-session-abc123"
VALID_STUDENT = {
    "id": VALID_SESSION_ID,
    "display_name": "Test Student",
    "observation_session_id": "obs-789",
    "user_type": "student",
}


def _auth_mock():
    m = MagicMock()
    m.validate_session.return_value = VALID_STUDENT
    return m


class TestStudentLeave(unittest.TestCase):

    def setUp(self):
        self.app = create_app()
        self.app.config["TESTING"] = True
        self.client = self.app.test_client()

    def test_returns_500_with_error_body_when_end_session_raises(self):
        route_mock = MagicMock()
        route_mock.end_session.side_effect = Exception("DB connection lost")

        with patch("app.middleware.auth.get_student_session_manager", return_value=_auth_mock()), \
             patch("app.routes.auth.get_student_session_manager", return_value=route_mock):
            resp = self.client.post(
                "/api/auth/student/leave",
                headers={"X-Session-ID": VALID_SESSION_ID},
            )

        self.assertEqual(resp.status_code, 500)
        data = resp.get_json()
        self.assertEqual(data.get("error"), "internal_error")
        self.assertNotIn("success", data)

    def test_returns_success_true_when_leave_succeeds(self):
        route_mock = MagicMock()
        route_mock.end_session.return_value = True

        with patch("app.middleware.auth.get_student_session_manager", return_value=_auth_mock()), \
             patch("app.routes.auth.get_student_session_manager", return_value=route_mock):
            resp = self.client.post(
                "/api/auth/student/leave",
                headers={"X-Session-ID": VALID_SESSION_ID},
            )

        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertTrue(data.get("success"))


if __name__ == "__main__":
    unittest.main()
