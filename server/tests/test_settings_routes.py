import os
import sys
import unittest
from contextlib import contextmanager
from unittest.mock import MagicMock, patch

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)

os.environ.setdefault("HEADLESS_SCHEDULER_ENABLED", "false")

from app import create_app


@contextmanager
def _make_get_db(db):
    yield db


def _setting(key, value):
    s = MagicMock()
    s.key = key
    s.value = value
    return s


class TestSettingsRoutes(unittest.TestCase):

    def setUp(self):
        self.app = create_app()
        self.app.config["TESTING"] = True
        self.client = self.app.test_client()

    def test_full_settings_requires_auth(self):
        """GET /api/settings stays auth-gated (the security fix must hold)."""
        resp = self.client.get("/api/settings")
        self.assertEqual(resp.status_code, 401)

    def test_public_settings_no_auth_required(self):
        """GET /api/settings/public is reachable without a token (app boot)."""
        db = MagicMock()
        db.query.return_value.filter.return_value.all.return_value = [
            _setting("msw_enabled", "true"),
            _setting("mock_telescope_enabled", "true"),
        ]

        with patch("app.routes.settings.get_db", lambda: _make_get_db(db)):
            resp = self.client.get("/api/settings/public")

        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertEqual(data["msw_enabled"], "true")
        self.assertEqual(data["mock_telescope_enabled"], "true")

    def test_public_settings_defaults_to_false(self):
        """Missing keys default to 'false' so the frontend gets a stable shape."""
        db = MagicMock()
        db.query.return_value.filter.return_value.all.return_value = []

        with patch("app.routes.settings.get_db", lambda: _make_get_db(db)):
            resp = self.client.get("/api/settings/public")

        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertEqual(data, {"msw_enabled": "false", "mock_telescope_enabled": "false"})

    def test_public_settings_excludes_other_keys(self):
        """Only the whitelisted demo flags are exposed, never sensitive settings."""
        db = MagicMock()
        db.query.return_value.filter.return_value.all.return_value = [
            _setting("msw_enabled", "true"),
        ]

        with patch("app.routes.settings.get_db", lambda: _make_get_db(db)):
            resp = self.client.get("/api/settings/public")

        data = resp.get_json()
        self.assertEqual(set(data.keys()), {"msw_enabled", "mock_telescope_enabled"})


if __name__ == "__main__":
    unittest.main()
