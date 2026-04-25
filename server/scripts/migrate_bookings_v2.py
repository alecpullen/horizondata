"""
Migration v2: Add scheduling conflict safety net to app.bookings

- Trigger to reject overlapping bookings for the same teacher at DB level
- CHECK constraint ensuring scheduled_end > scheduled_start
- Composite index for fast overlap queries

Run: python server/scripts/migrate_bookings_v2.py
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# Load .env if present
env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
if os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ.setdefault(key.strip(), value.strip('"\''))

from sqlalchemy import text
from app.services.database import engine


def run():
    with engine.connect() as conn:
        # 1. Trigger function: reject overlapping bookings for same teacher
        conn.execute(text("""
            CREATE OR REPLACE FUNCTION app.check_booking_overlap()
            RETURNS TRIGGER AS $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM app.bookings b
                    WHERE b.teacher_id = NEW.teacher_id
                      AND b.status IN ('confirmed', 'pending')
                      AND b.id IS DISTINCT FROM NEW.id
                      AND b.scheduled_start < NEW.scheduled_end
                      AND b.scheduled_end > NEW.scheduled_start
                ) THEN
                    RAISE EXCEPTION 'Booking overlaps with existing session';
                END IF;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        """))

        conn.execute(text("""
            DROP TRIGGER IF EXISTS trg_booking_overlap ON app.bookings;
        """))

        conn.execute(text("""
            CREATE TRIGGER trg_booking_overlap
            BEFORE INSERT OR UPDATE ON app.bookings
            FOR EACH ROW EXECUTE FUNCTION app.check_booking_overlap();
        """))
        print("✅ Overlap trigger created")

        # 2. CHECK constraint: end must be after start
        conn.execute(text("""
            ALTER TABLE app.bookings
            DROP CONSTRAINT IF EXISTS chk_booking_duration_positive;
        """))

        conn.execute(text("""
            ALTER TABLE app.bookings
            ADD CONSTRAINT chk_booking_duration_positive
            CHECK (scheduled_end > scheduled_start);
        """))
        print("✅ Duration positive constraint added")

        # 3. Composite index for fast overlap queries
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_app_bookings_overlap
            ON app.bookings (teacher_id, scheduled_start, scheduled_end);
        """))
        print("✅ Overlap index created")

        conn.commit()

    print("\nMigration complete.")


if __name__ == "__main__":
    run()
