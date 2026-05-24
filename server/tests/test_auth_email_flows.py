import os
import sys
import unittest
from unittest.mock import MagicMock, patch

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)

os.environ.setdefault("HEADLESS_SCHEDULER_ENABLED", "false")

from app import create_app


def _make_user(email="teacher@test.com", verified=False, password_hash="hashedpw1234567890"):
    user = MagicMock()
    user.email = email
    user.email_verified = verified
    user.hashed_password = password_hash
    return user


class TestResendVerification(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.app.config["TESTING"] = True
        self.client = self.app.test_client()

    def _post(self, body):
        return self.client.post("/api/auth/resend-verification", json=body)

    @patch("app.routes.auth.send_verification_email")
    @patch("app.routes.auth.generate_verify_token", return_value="mock-token")
    @patch("app.routes.auth.get_db")
    def test_sends_email_for_unverified_user(self, mock_get_db, mock_gen_token, mock_send):
        user = _make_user(verified=False)
        db = MagicMock()
        db.query.return_value.filter_by.return_value.first.return_value = user
        mock_get_db.return_value.__enter__ = MagicMock(return_value=db)
        mock_get_db.return_value.__exit__ = MagicMock(return_value=False)

        res = self._post({"email": "teacher@test.com"})
        self.assertEqual(res.status_code, 200)
        mock_gen_token.assert_called_once_with(user)
        mock_send.assert_called_once_with(user, "mock-token")

    @patch("app.routes.auth.send_verification_email")
    @patch("app.routes.auth.generate_verify_token")
    @patch("app.routes.auth.get_db")
    def test_skips_already_verified_user(self, mock_get_db, mock_gen_token, mock_send):
        user = _make_user(verified=True)
        db = MagicMock()
        db.query.return_value.filter_by.return_value.first.return_value = user
        mock_get_db.return_value.__enter__ = MagicMock(return_value=db)
        mock_get_db.return_value.__exit__ = MagicMock(return_value=False)

        res = self._post({"email": "teacher@test.com"})
        self.assertEqual(res.status_code, 200)
        mock_gen_token.assert_not_called()
        mock_send.assert_not_called()

    @patch("app.routes.auth.send_verification_email")
    @patch("app.routes.auth.generate_verify_token")
    @patch("app.routes.auth.get_db")
    def test_returns_200_for_unknown_email(self, mock_get_db, mock_gen_token, mock_send):
        db = MagicMock()
        db.query.return_value.filter_by.return_value.first.return_value = None
        mock_get_db.return_value.__enter__ = MagicMock(return_value=db)
        mock_get_db.return_value.__exit__ = MagicMock(return_value=False)

        res = self._post({"email": "nobody@test.com"})
        self.assertEqual(res.status_code, 200)
        mock_send.assert_not_called()

    def test_returns_400_for_missing_email(self):
        res = self._post({})
        self.assertEqual(res.status_code, 400)


if __name__ == "__main__":
    unittest.main()
