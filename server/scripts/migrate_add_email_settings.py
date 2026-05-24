"""
Migration: add email_verified column to users + seed email settings.

Run once from the server/ directory:
    python scripts/migrate_add_email_settings.py
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

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
        # 1. Add email_verified column to users table
        conn.execute(text("""
            ALTER TABLE public.users
            ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false
        """))
        conn.commit()
        print("✅ email_verified column added to public.users")

        # 2. Seed email-related settings (skip if key already exists)
        defaults = [
            ('email_enabled',  'false',                     'Enable email sending via SMTP'),
            ('smtp_host',      '',                           'SMTP server hostname'),
            ('smtp_port',      '587',                        'SMTP server port'),
            ('smtp_use_tls',   'true',                       'Use STARTTLS when connecting to SMTP'),
            ('smtp_user',      '',                           'SMTP login username'),
            ('smtp_password',  '',                           'SMTP login password'),
            ('mail_from',      'noreply@horizon.edu.au',     'Sender address for outgoing emails'),
            ('frontend_url',   'http://localhost:5173',      'Frontend base URL used in email links'),
        ]

        for key, value, description in defaults:
            conn.execute(text("""
                INSERT INTO public.system_settings (key, value, description)
                VALUES (:k, :v, :d)
                ON CONFLICT (key) DO NOTHING
            """), {'k': key, 'v': value, 'd': description})

        conn.commit()
        print(f"✅ Seeded {len(defaults)} email settings into system_settings")


if __name__ == '__main__':
    run()
