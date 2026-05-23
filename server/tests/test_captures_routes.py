import io
import os
import sys
import uuid
import tempfile
import unittest
from contextlib import contextmanager
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
SESSION_ID = uuid.uuid4()
CAPTURE_ID = uuid.uuid4()

# Minimal valid PNG magic bytes
_PNG_BYTES = b'\x89PNG\r\n\x1a\n' + b'\x00' * 50


@contextmanager
def _make_get_db(db):
    yield db


def _mock_capture():
    c = MagicMock()
    c.id = CAPTURE_ID
    c.captured_by_teacher_id = TEACHER_ID
    c.captured_by_student_session_id = None
    c.observation_session_id = SESSION_ID
    c.object_name = "Mars"
    c.coordinates = {"ra": 1.0, "dec": 2.0, "alt": 30.0, "az": 90.0}
    c.file_path = "/data/captures/2025/01/01/mars/123_abc.png"
    c.captured_at = None
    c.to_dict.return_value = {
        "id": str(CAPTURE_ID),
        "teacherId": TEACHER_ID,
        "objectName": "Mars",
        "capturedBy": "teacher",
    }
    return c


class TestCapturesRoutes(unittest.TestCase):

    def setUp(self):
        self.app = create_app()
        self.app.config["TESTING"] = True
        self.client = self.app.test_client()
        self.tmp_dir = tempfile.mkdtemp()

    def _headers(self):
        return {"Authorization": "Bearer fake-token"}

    def test_upload_capture_requires_auth(self):
        resp = self.client.post("/api/captures")
        self.assertEqual(resp.status_code, 401)

    def test_upload_capture_rejects_non_image_bytes(self):
        """Uploading a plain text file should return 400."""
        data = {"file": (io.BytesIO(b"this is not an image"), "test.png")}
        with patch("app.middleware.auth.validate_teacher", return_value=TEACHER_USER):
            resp = self.client.post(
                "/api/captures",
                data=data,
                content_type="multipart/form-data",
                headers=self._headers(),
            )
        self.assertEqual(resp.status_code, 400)

    def test_upload_capture_accepts_valid_png(self):
        """A valid PNG magic-byte payload should pass validation and reach DB write."""
        alpaca = MagicMock()
        alpaca.get_coordinates.side_effect = Exception("telescope offline")

        db = MagicMock()
        db.add = MagicMock()
        db.flush = MagicMock()

        data = {
            "file": (io.BytesIO(_PNG_BYTES), "capture.png"),
            "objectName": "Mars",
            "observationSessionId": str(SESSION_ID),
        }

        with patch("app.middleware.auth.validate_teacher", return_value=TEACHER_USER), \
             patch("app.routes.captures.get_db", lambda: _make_get_db(db)), \
             patch("app.routes.captures.alpaca_client", alpaca), \
             patch("app.routes.captures._captures_root", return_value=self.tmp_dir):
            resp = self.client.post(
                "/api/captures",
                data=data,
                content_type="multipart/form-data",
                headers=self._headers(),
            )

        # Valid PNG reaches the DB write stage — not rejected with 400
        self.assertNotEqual(resp.status_code, 400)

    def test_list_captures_requires_auth(self):
        resp = self.client.get("/api/captures")
        self.assertEqual(resp.status_code, 401)

    def test_list_captures_returns_captures_key(self):
        db = MagicMock()
        # Handle both join-based and simple filter queries the route might use
        db.query.return_value.join.return_value.filter.return_value.order_by.return_value.all.return_value = [
            _mock_capture()
        ]
        db.query.return_value.filter.return_value.order_by.return_value.all.return_value = [
            _mock_capture()
        ]

        with patch("app.middleware.auth.validate_teacher", return_value=TEACHER_USER), \
             patch("app.routes.captures.get_db", lambda: _make_get_db(db)):
            resp = self.client.get("/api/captures", headers=self._headers())

        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        # Route returns captures under "items" key
        self.assertIn("items", data)

    def test_download_capture_requires_auth(self):
        resp = self.client.get(f"/api/captures/{CAPTURE_ID}/download")
        self.assertEqual(resp.status_code, 401)

    def test_download_capture_returns_404_for_unknown_id(self):
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = None

        with patch("app.middleware.auth.validate_teacher", return_value=TEACHER_USER), \
             patch("app.routes.captures.get_db", lambda: _make_get_db(db)):
            resp = self.client.get(
                f"/api/captures/{CAPTURE_ID}/download",
                headers=self._headers(),
            )

        self.assertEqual(resp.status_code, 404)

    def test_download_metadata_returns_404_for_unknown_id(self):
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = None

        with patch("app.middleware.auth.validate_teacher", return_value=TEACHER_USER), \
             patch("app.routes.captures.get_db", lambda: _make_get_db(db)):
            resp = self.client.get(
                f"/api/captures/{CAPTURE_ID}/metadata",
                headers=self._headers(),
            )

        self.assertEqual(resp.status_code, 404)


if __name__ == "__main__":
    unittest.main()
