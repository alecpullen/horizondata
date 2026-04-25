"""
Migration: create app.bookings table and add booking_id column to
app.observation_sessions.

Run once: python server/scripts/migrate_bookings.py
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
from app.services.database import engine, Base
from app.models.booking import Booking  # noqa: F401  registers table with Base
from app.models.session import ObservationSession  # noqa: F401


def run():
    with engine.connect() as conn:
        conn.execute(text("CREATE SCHEMA IF NOT EXISTS app"))
        conn.commit()

    # Create the bookings table
    Base.metadata.create_all(engine, tables=[Booking.__table__])
    print("✅ app.bookings table created (or already exists)")

    # Add booking_id column to existing observation_sessions table
    with engine.connect() as conn:
        conn.execute(text("""
            ALTER TABLE app.observation_sessions
            ADD COLUMN IF NOT EXISTS booking_id UUID
            REFERENCES app.bookings(id)
        """))
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_observation_sessions_booking_id
            ON app.observation_sessions (booking_id)
        """))
        conn.commit()
    print("✅ booking_id column added to app.observation_sessions")


if __name__ == "__main__":
    run()
