"""
Add headless column to bookings table
"""

from sqlalchemy import text
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'server'))

env_path = os.path.join(os.path.dirname(__file__), 'server', '.env')
if os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ.setdefault(key.strip(), value.strip('"\''))

DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")

DATABASE_URL = (
    f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    f"?channel_binding=require&sslmode=require"
)

from sqlalchemy import create_engine
engine = create_engine(DATABASE_URL, pool_pre_ping=True)

if __name__ == "__main__":
    print("Adding headless column to bookings table...")
    
    with engine.connect() as conn:
        # Check if column exists
        result = conn.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'bookings' AND column_name = 'headless'
        """))
        
        if result.scalar():
            print("Column 'headless' already exists - skipping")
        else:
            # Add column
            conn.execute(text("""
                ALTER TABLE app.bookings 
                ADD COLUMN headless BOOLEAN NOT NULL DEFAULT FALSE
            """))
            conn.commit()
            print("Added headless column to bookings table")
    
    print("Done!")