import os
import sys
import uuid
import unittest
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)

os.environ.setdefault("HEADLESS_SCHEDULER_ENABLED", "false")

from app import create_app

TEACHER_ID = "teacher-abc"
TEACHER_USER = {
    "id": TEACHER_ID,
    "email": "teacher@test.com",
    "name": "Test Teacher",
    "role": "teacher",
    "user_type": "teacher",
}
BOOKING_ID = uuid.uuid4()
SESSION_ID = uuid.uuid4()


def _make_db(booking=None, obs=None, captures=None):
    """Return a mock DB session that returns the given objects from queries."""
    db = MagicMock()

    def _query(model):
        q = MagicMock()
        model_name = getattr(model, "__name__", str(model))

        # Support both class and Column queries (e.g. db.query(Capture.object_name))
        if hasattr(model, "property"):
            # Column query — return capture rows for distinct object_name
            q.filter.return_value.distinct.return_value.all.return_value = captures or []
        elif "Booking" in str(model_name):
            q.filter.return_value.first.return_value = booking
        elif "ObservationSession" in str(model_name):
            q.filter.return_value.first.return_value = obs
        elif "Capture" in str(model_name):
            q.filter.return_value.distinct.return_value.all.return_value = captures or []
        return q

    db.query.side_effect = _query
    return db


@contextmanager
def _make_get_db(db):
    yield db


class TestQueueStatusPerTarget(unittest.TestCase):

    def setUp(self):
        self.app = create_app()
        self.app.config["TESTING"] = True
        self.client = self.app.test_client()

    def _headers(self):
        return {"Authorization": "Bearer fake-token"}

    def test_completed_reflects_per_target_captures(self):
        """When 1 of 2 targets has been captured, completed should be 1 not 0."""
        mock_booking = MagicMock()
        mock_booking.id = BOOKING_ID
        mock_booking.teacher_id = TEACHER_ID
        mock_booking.targets = {
            "celestialObjects": [
                {"name": "Mars"},
                {"name": "Jupiter"},
            ]
        }

        mock_obs = MagicMock()
        mock_obs.id = SESSION_ID
        mock_obs.status = "active"

        # Only Mars has been captured
        mars_row = MagicMock()
        mars_row.object_name = "Mars"
        mock_db = _make_db(booking=mock_booking, obs=mock_obs, captures=[mars_row])

        with patch("app.middleware.auth.validate_teacher", return_value=TEACHER_USER), \
             patch("app.routes.sessions.get_db", lambda: _make_get_db(mock_db)):
            resp = self.client.get(
                f"/api/sessions/{BOOKING_ID}/queue-status",
                headers=self._headers(),
            )

        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertEqual(data["total"], 2)
        self.assertEqual(data["completed"], 1)
        self.assertEqual(data["status"], "running")
        self.assertEqual(data["current_target"], "Jupiter")


class TestSessionsRoutes(unittest.TestCase):

    def setUp(self):
        self.app = create_app()
        self.app.config["TESTING"] = True
        self.client = self.app.test_client()

    def _headers(self):
        return {"Authorization": "Bearer fake-token"}

    def test_get_session_requires_auth(self):
        resp = self.client.get(f"/api/sessions/{BOOKING_ID}")
        self.assertEqual(resp.status_code, 401)

    def test_queue_status_returns_pending_when_no_session(self):
        mock_booking = MagicMock()
        mock_booking.id = BOOKING_ID
        mock_booking.teacher_id = TEACHER_ID
        mock_booking.targets = {"celestialObjects": [{"name": "Mars"}]}

        db = MagicMock()
        booking_q = MagicMock()
        booking_q.filter.return_value.first.return_value = mock_booking
        obs_q = MagicMock()
        obs_q.filter.return_value.first.return_value = None  # no session

        def _query(model):
            if "Booking" in str(getattr(model, "__name__", str(model))):
                return booking_q
            return obs_q

        db.query.side_effect = _query

        with patch("app.middleware.auth.validate_teacher", return_value=TEACHER_USER), \
             patch("app.routes.sessions.get_db", lambda: _make_get_db(db)):
            resp = self.client.get(
                f"/api/sessions/{BOOKING_ID}/queue-status",
                headers=self._headers(),
            )

        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertEqual(data["status"], "pending")
        self.assertEqual(data["total"], 0)
        self.assertEqual(data["completed"], 0)

    def test_queue_status_returns_done_when_session_ended(self):
        mock_booking = MagicMock()
        mock_booking.id = BOOKING_ID
        mock_booking.teacher_id = TEACHER_ID
        mock_booking.targets = {"celestialObjects": [{"name": "Mars"}, {"name": "Jupiter"}]}

        mock_obs = MagicMock()
        mock_obs.id = SESSION_ID
        mock_obs.status = "ended"

        mock_db = _make_db(booking=mock_booking, obs=mock_obs)

        with patch("app.middleware.auth.validate_teacher", return_value=TEACHER_USER), \
             patch("app.routes.sessions.get_db", lambda: _make_get_db(mock_db)):
            resp = self.client.get(
                f"/api/sessions/{BOOKING_ID}/queue-status",
                headers=self._headers(),
            )

        data = resp.get_json()
        self.assertEqual(data["status"], "done")
        self.assertEqual(data["completed"], 2)

    def test_list_participants_requires_auth(self):
        resp = self.client.get(f"/api/sessions/{BOOKING_ID}/participants")
        self.assertEqual(resp.status_code, 401)

    def test_list_participants_empty_when_no_active_session(self):
        mock_booking = MagicMock()
        mock_booking.id = BOOKING_ID
        mock_booking.teacher_id = TEACHER_ID

        db = MagicMock()
        db.query.return_value.filter.return_value.first.side_effect = [mock_booking, None]

        with patch("app.middleware.auth.validate_teacher", return_value=TEACHER_USER), \
             patch("app.routes.sessions.get_db", lambda: _make_get_db(db)):
            resp = self.client.get(
                f"/api/sessions/{BOOKING_ID}/participants",
                headers=self._headers(),
            )

        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertEqual(data["participants"], [])

    def test_validate_join_code_returns_invalid_for_unknown_code(self):
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = None

        with patch("app.routes.sessions.get_db", lambda: _make_get_db(db)):
            resp = self.client.post(
                "/api/sessions/validate",
                json={"joinCode": "ZZZZZZ"},
            )

        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertFalse(data["valid"])
        self.assertEqual(data["reason"], "not_found")

    def test_end_session_requires_auth(self):
        resp = self.client.post(f"/api/sessions/{BOOKING_ID}/end")
        self.assertEqual(resp.status_code, 401)

    def test_end_session_returns_404_when_no_active_session(self):
        mock_booking = MagicMock()
        mock_booking.id = BOOKING_ID
        mock_booking.teacher_id = TEACHER_ID

        db = MagicMock()
        # first query = booking, second = obs (None = no active session)
        db.query.return_value.filter.return_value.first.side_effect = [mock_booking, None]

        with patch("app.middleware.auth.validate_teacher", return_value=TEACHER_USER), \
             patch("app.routes.sessions.get_db", lambda: _make_get_db(db)):
            resp = self.client.post(
                f"/api/sessions/{BOOKING_ID}/end",
                headers=self._headers(),
            )

        self.assertEqual(resp.status_code, 404)


class TestStartSessionWindow(unittest.TestCase):
    """Bug 11 / Bug 9: starting a session must be gated to the booking
    window and must return a clear, structured reason when refused so the
    teacher is never silently dropped onto the live view."""

    def setUp(self):
        self.app = create_app()
        self.app.config["TESTING"] = True
        self.client = self.app.test_client()

    def _headers(self):
        return {"Authorization": "Bearer fake-token"}

    def _booking(self, start, end):
        b = MagicMock()
        b.id = BOOKING_ID
        b.teacher_id = TEACHER_ID
        b.scheduled_start = start
        b.scheduled_end = end
        return b

    def test_start_rejected_before_window(self):
        now = datetime.now(timezone.utc)
        booking = self._booking(now + timedelta(hours=39), now + timedelta(hours=40))
        db = _make_db(booking=booking)

        with patch("app.middleware.auth.validate_teacher", return_value=TEACHER_USER), \
             patch("app.routes.sessions.get_db", lambda: _make_get_db(db)):
            resp = self.client.post(
                f"/api/sessions/{BOOKING_ID}/start",
                headers=self._headers(),
            )

        self.assertEqual(resp.status_code, 409)
        data = resp.get_json()
        self.assertEqual(data["error"], "window_not_open")
        self.assertTrue(data["message"].startswith("Session not available yet"))
        # ~39h out, allowing for test execution time
        self.assertGreater(data["seconds_until_start"], 38 * 3600)
        self.assertLessEqual(data["seconds_until_start"], 39 * 3600)

    def test_start_rejected_after_window(self):
        now = datetime.now(timezone.utc)
        booking = self._booking(now - timedelta(hours=3), now - timedelta(hours=1))
        db = _make_db(booking=booking)

        with patch("app.middleware.auth.validate_teacher", return_value=TEACHER_USER), \
             patch("app.routes.sessions.get_db", lambda: _make_get_db(db)):
            resp = self.client.post(
                f"/api/sessions/{BOOKING_ID}/start",
                headers=self._headers(),
            )

        self.assertEqual(resp.status_code, 409)
        self.assertEqual(resp.get_json()["error"], "window_closed")

    def test_start_succeeds_within_window(self):
        now = datetime.now(timezone.utc)
        booking = self._booking(now - timedelta(minutes=5), now + timedelta(hours=1))
        db = _make_db(booking=booking)

        mock_obs = MagicMock()
        mock_obs.id = SESSION_ID
        mock_obs.status = "active"

        with patch("app.middleware.auth.validate_teacher", return_value=TEACHER_USER), \
             patch("app.routes.sessions.get_db", lambda: _make_get_db(db)), \
             patch("app.routes.sessions._get_or_create_session", return_value=mock_obs):
            resp = self.client.post(
                f"/api/sessions/{BOOKING_ID}/start",
                headers=self._headers(),
            )

        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.get_json()["success"])


if __name__ == "__main__":
    unittest.main()
