"""
Add account_status column to users table
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

env_path = os.path.join(os.path.dirname(__file__), '..', '..', '.env')
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

from sqlalchemy import create_engine, text

engine = create_engine(DATABASE_URL, pool_pre_ping=True)

if __name__ == "__main__":
    print("Adding account_status column to users table...")
    
    with engine.connect() as conn:
        # Check if column exists in public.users
        result = conn.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'users' AND table_schema = 'public' AND column_name = 'account_status'
        """))
        
        if result.scalar():
            print("Column 'account_status' already exists - skipping")
        else:
            # Add column to public.users
            conn.execute(text("""
                ALTER TABLE public.users 
                ADD COLUMN account_status VARCHAR(20) NOT NULL DEFAULT 'pending'
            """))
            conn.commit()
            print("Added account_status column to public.users table")
    
    print("Done!")