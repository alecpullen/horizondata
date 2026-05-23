import os
import sys
import uuid
import unittest
from contextlib import contextmanager
from datetime import datetime, timezone, timedelta
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


@contextmanager
def _make_get_db(db):
    yield db


_FUTURE = datetime.now(timezone.utc) + timedelta(days=7)


def _mock_booking(teacher_id=TEACHER_ID):
    b = MagicMock()
    b.id = BOOKING_ID
    b.teacher_id = teacher_id
    b.title = "Test Booking"
    b.description = "A test"
    b.status = "confirmed"
    b.headless = False
    b.scheduled_end = _FUTURE
    b.targets = {"celestialObjects": [{"name": "Mars"}]}
    b.to_dict.return_value = {
        "id": str(BOOKING_ID),
        "title": "Test Booking",
        "date": "01/06/2025",
        "time": "20:00 - 21:00",
        "status": "Confirmed",
        "statusColor": "confirmed",
        "headless": False,
        "targets": {"celestialObjects": [{"name": "Mars"}]},
    }
    return b


class TestBookingsRoutes(unittest.TestCase):

    def setUp(self):
        self.app = create_app()
        self.app.config["TESTING"] = True
        self.client = self.app.test_client()

    def _headers(self):
        return {"Authorization": "Bearer fake-token"}

    def test_list_bookings_requires_auth(self):
        resp = self.client.get("/api/bookings")
        self.assertEqual(resp.status_code, 401)

    def test_list_bookings_returns_buckets(self):
        """GET /api/bookings returns upcoming/past/pending structure."""
        db = MagicMock()
        db.query.return_value.filter.return_value.order_by.return_value.all.return_value = [
            _mock_booking()
        ]

        with patch("app.middleware.auth.validate_teacher", return_value=TEACHER_USER), \
             patch("app.routes.bookings.get_db", lambda: _make_get_db(db)):
            resp = self.client.get("/api/bookings", headers=self._headers())

        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertIn("upcoming", data)
        self.assertIn("past", data)
        self.assertIn("pending", data)

    def test_get_booking_requires_auth(self):
        resp = self.client.get(f"/api/bookings/{BOOKING_ID}")
        self.assertEqual(resp.status_code, 401)

    def test_get_booking_not_found(self):
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = None

        with patch("app.middleware.auth.validate_teacher", return_value=TEACHER_USER), \
             patch("app.routes.bookings.get_db", lambda: _make_get_db(db)):
            resp = self.client.get(
                f"/api/bookings/{BOOKING_ID}",
                headers=self._headers(),
            )

        self.assertEqual(resp.status_code, 404)

    def test_get_booking_forbidden_when_not_owner(self):
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = _mock_booking(
            teacher_id="other-teacher"
        )

        with patch("app.middleware.auth.validate_teacher", return_value=TEACHER_USER), \
             patch("app.routes.bookings.get_db", lambda: _make_get_db(db)):
            resp = self.client.get(
                f"/api/bookings/{BOOKING_ID}",
                headers=self._headers(),
            )

        self.assertEqual(resp.status_code, 403)

    def test_get_booking_success(self):
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = _mock_booking()

        with patch("app.middleware.auth.validate_teacher", return_value=TEACHER_USER), \
             patch("app.routes.bookings.get_db", lambda: _make_get_db(db)):
            resp = self.client.get(
                f"/api/bookings/{BOOKING_ID}",
                headers=self._headers(),
            )

        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertEqual(data["title"], "Test Booking")

    def test_delete_booking_requires_auth(self):
        resp = self.client.delete(f"/api/bookings/{BOOKING_ID}")
        self.assertEqual(resp.status_code, 401)

    def test_delete_booking_not_found(self):
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = None

        with patch("app.middleware.auth.validate_teacher", return_value=TEACHER_USER), \
             patch("app.routes.bookings.get_db", lambda: _make_get_db(db)):
            resp = self.client.delete(
                f"/api/bookings/{BOOKING_ID}",
                headers=self._headers(),
            )

        self.assertEqual(resp.status_code, 404)

    def test_create_booking_requires_auth(self):
        resp = self.client.post("/api/bookings", json={})
        self.assertEqual(resp.status_code, 401)

    def test_create_booking_missing_required_fields(self):
        with patch("app.middleware.auth.validate_teacher", return_value=TEACHER_USER):
            resp = self.client.post(
                "/api/bookings",
                json={"title": "Only title, missing scheduledStart etc."},
                headers=self._headers(),
            )
        self.assertEqual(resp.status_code, 400)


if __name__ == "__main__":
    unittest.main()
