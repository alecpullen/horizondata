"""
Migration script to add an exclusion constraint preventing overlapping bookings.

Run with: python scripts/migrate_booking_exclusion.py
Requires: psycopg2-binary or psycopg2
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(__file__))))

from dotenv import load_dotenv
load_dotenv()

from app.services.database import engine
from sqlalchemy import text


def add_exclusion_constraint():
    print("Adding booking overlap exclusion constraint...")
    with engine.begin() as conn:
        conn.execute(text("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conname = 'no_overlap'
                    AND connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'app')
                ) THEN
                    ALTER TABLE app.bookings
                    ADD CONSTRAINT no_overlap
                    EXCLUDE USING gist (
                        tstzrange(scheduled_start, scheduled_end) WITH &&
                    )
                    WHERE (status != 'cancelled');
                END IF;
            END
            $$;
        """))
    print("Constraint added successfully (or already existed).")


if __name__ == "__main__":
    add_exclusion_constraint()
