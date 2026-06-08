import os
import sys
import unittest
from contextlib import contextmanager
from datetime import datetime, timedelta
from unittest.mock import patch

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)

from app.services.database import Base
from app.models.student_session import StudentSession
import app.services.student_session_manager as ssm


class _DBTestBase(unittest.TestCase):
    """Backs the manager with a real in-memory SQLite database so the tests
    exercise the actual persistence logic rather than mocks."""

    def setUp(self):
        # Single shared connection so the in-memory DB persists for the test.
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(self.engine, tables=[StudentSession.__table__])
        TestSession = sessionmaker(bind=self.engine)

        @contextmanager
        def _test_get_db():
            db = TestSession()
            try:
                yield db
                db.commit()
            except Exception:
                db.rollback()
                raise
            finally:
                db.close()

        self._db_factory = TestSession
        patcher = patch.object(ssm, "get_db", _test_get_db)
        patcher.start()
        self.addCleanup(patcher.stop)

        self.mgr = ssm.StudentSessionManager()

    def _backdate_expiry(self, session_id, seconds_ago=1):
        """Force a session to read as already expired."""
        db = self._db_factory()
        try:
            row = db.query(StudentSession).filter(StudentSession.id == session_id).first()
            row.expires_at = datetime.utcnow() - timedelta(seconds=seconds_ago)
            db.commit()
        finally:
            db.close()

    def _exists(self, session_id):
        db = self._db_factory()
        try:
            return db.query(StudentSession).filter(StudentSession.id == session_id).first() is not None
        finally:
            db.close()


class TestStudentSessionExpiry(_DBTestBase):

    def test_session_valid_immediately_after_creation(self):
        session_id = self.mgr.create_session("Alice", "obs-1")
        result = self.mgr.validate_session(session_id)
        self.assertIsNotNone(result)
        self.assertEqual(result["display_name"], "Alice")

    def test_validate_returns_none_for_expired_session(self):
        session_id = self.mgr.create_session("Bob", "obs-1")
        self._backdate_expiry(session_id)
        self.assertIsNone(self.mgr.validate_session(session_id))

    def test_expired_session_removed_from_store_on_validate(self):
        session_id = self.mgr.create_session("Carol", "obs-1")
        self._backdate_expiry(session_id)
        self.mgr.validate_session(session_id)
        self.assertFalse(self._exists(session_id))

    def test_cleanup_removes_only_expired_sessions(self):
        live_id = self.mgr.create_session("Eve", "obs-1")
        dead_id = self.mgr.create_session("Frank", "obs-1")
        self._backdate_expiry(dead_id)

        removed = self.mgr.cleanup_expired_sessions()

        self.assertEqual(removed, 1)
        self.assertTrue(self._exists(live_id))
        self.assertFalse(self._exists(dead_id))

    def test_cleanup_returns_zero_when_nothing_expired(self):
        self.mgr.create_session("Grace", "obs-1")
        self.assertEqual(self.mgr.cleanup_expired_sessions(), 0)

    def test_cleanup_removes_multiple_expired_sessions(self):
        ids = [self.mgr.create_session(f"Student-{i}", "obs-1") for i in range(3)]
        for sid in ids:
            self._backdate_expiry(sid)
        self.assertEqual(self.mgr.cleanup_expired_sessions(), 3)

    def test_validate_returns_expected_fields(self):
        session_id = self.mgr.create_session("Hannah", "obs-42")
        result = self.mgr.validate_session(session_id)
        for key in ("id", "display_name", "observation_session_id", "created_at", "expires_at", "user_type"):
            self.assertIn(key, result)
        self.assertEqual(result["user_type"], "student")
        self.assertEqual(result["observation_session_id"], "obs-42")

    def test_unknown_session_id_returns_none(self):
        self.assertIsNone(self.mgr.validate_session("does-not-exist"))

    def test_kicked_session_returns_none_regardless_of_expiry(self):
        session_id = self.mgr.create_session("Ivan", "obs-1")
        self.mgr.kick_student(session_id)
        self.assertIsNone(self.mgr.validate_session(session_id))

    def test_session_duration_controls_expires_at(self):
        self.mgr.session_duration_hours = 2
        session_id = self.mgr.create_session("Julia", "obs-1")
        db = self._db_factory()
        try:
            row = db.query(StudentSession).filter(StudentSession.id == session_id).first()
            expected = row.created_at + timedelta(hours=2)
            self.assertLess(abs((row.expires_at - expected).total_seconds()), 2)
        finally:
            db.close()


class TestParticipantTracking(_DBTestBase):
    """Regression for the disconnected-student / zero-count report: joins must
    be visible to participant queries and survive across manager calls (now
    that state is in the DB rather than process memory)."""

    def test_list_and_count_reflect_active_joins(self):
        self.mgr.create_session("Ann", "obs-A")
        self.mgr.create_session("Ben", "obs-A")
        self.mgr.create_session("Cara", "obs-B")

        participants = self.mgr.list_participants("obs-A")
        names = sorted(p["display_name"] for p in participants)
        self.assertEqual(names, ["Ann", "Ben"])
        self.assertEqual(self.mgr.get_session_count("obs-A"), 2)
        self.assertEqual(self.mgr.get_session_count("obs-B"), 1)

    def test_kicked_and_expired_excluded_from_listing(self):
        keep = self.mgr.create_session("Keep", "obs-A")
        kicked = self.mgr.create_session("Kicked", "obs-A")
        expired = self.mgr.create_session("Expired", "obs-A")
        self.mgr.kick_student(kicked)
        self._backdate_expiry(expired)

        participants = self.mgr.list_participants("obs-A")
        self.assertEqual([p["display_name"] for p in participants], ["Keep"])
        self.assertEqual(self.mgr.get_session_count("obs-A"), 1)
        self.assertEqual(participants[0]["id"], keep)

    def test_end_all_for_observation_clears_only_that_session(self):
        self.mgr.create_session("Ann", "obs-A")
        self.mgr.create_session("Ben", "obs-A")
        keep = self.mgr.create_session("Cara", "obs-B")

        removed = self.mgr.end_all_for_observation("obs-A")

        self.assertEqual(removed, 2)
        self.assertEqual(self.mgr.get_session_count("obs-A"), 0)
        self.assertEqual(self.mgr.get_session_count("obs-B"), 1)
        self.assertIsNotNone(self.mgr.validate_session(keep))

    def test_leave_removes_single_session(self):
        a = self.mgr.create_session("Ann", "obs-A")
        b = self.mgr.create_session("Ben", "obs-A")
        self.assertTrue(self.mgr.end_session(a))
        self.assertEqual(self.mgr.get_session_count("obs-A"), 1)
        self.assertIsNotNone(self.mgr.validate_session(b))


if __name__ == "__main__":
    unittest.main()
