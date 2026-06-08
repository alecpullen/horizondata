import os
import sys
import unittest
from contextlib import contextmanager
from unittest.mock import MagicMock, patch

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)

import app.services.session_codes as session_codes


@contextmanager
def _get_db(db):
    yield db


class TestGenerateSessionCode(unittest.TestCase):

    def test_uniqueness_check_ignores_status(self):
        """Regression: the collision check must match the global UNIQUE
        constraint on session_code (any status), not just active sessions —
        otherwise a code reused from an ended/terminated session passes the
        check and then blows up the insert with an IntegrityError."""
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = None

        with patch("app.services.database.get_db", lambda: _get_db(db)), \
             patch("app.services.session_codes.random.choices", return_value=list("ABC123")):
            code = session_codes.generate_session_code()

        self.assertEqual(code, "ABC123")

        # The collision query must constrain by session_code and NOT by status.
        filter_args = db.query.return_value.filter.call_args.args
        rendered = " ".join(str(a) for a in filter_args).lower()
        self.assertIn("session_code", rendered)
        self.assertNotIn("status", rendered)

    def test_retries_until_free_code_found(self):
        """A taken code triggers another attempt rather than being returned."""
        db = MagicMock()
        # First generated code is taken, second is free.
        db.query.return_value.filter.return_value.first.side_effect = [
            MagicMock(name="existing_session"),
            None,
        ]

        with patch("app.services.database.get_db", lambda: _get_db(db)), \
             patch(
                 "app.services.session_codes.random.choices",
                 side_effect=[list("TAKEN1"), list("FREE02")],
             ):
            code = session_codes.generate_session_code()

        self.assertEqual(code, "FREE02")


if __name__ == "__main__":
    unittest.main()
