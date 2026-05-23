import os
import sys

# Add the server directory to load .env
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# Load environment variables manually
env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
if os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ.setdefault(key.strip(), value.strip('"\''))

from app.services.database import engine, Base
from sqlalchemy import text
from app.models.setting import SystemSetting
from sqlalchemy.orm import sessionmaker

def run_migration():
    """Run database migration to create system_settings table."""
    print("="*60)
    print("Running Migration: Creating system_settings table")
    print("="*60)
    
    try:
        # Create all tables (will create system_settings if it doesn't exist)
        with engine.connect() as conn:
            Base.metadata.create_all(conn)
            conn.commit()
            print("✅ Table 'system_settings' creation attempted")
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        raise

def seed_defaults():
    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        default_keys = [
            {"key": "primary_stream_url", "value": "", "description": "Telescope Camera Stream URL"},
            {"key": "site_camera_url", "value": "", "description": "Site Camera Stream URL"},
            {"key": "msw_enabled", "value": "false", "description": "Mock API mode enabled"}
        ]

        for item in default_keys:
            existing = session.query(SystemSetting).filter_by(key=item["key"]).first()
            if not existing:
                setting = SystemSetting(
                    key=item["key"],
                    value=item["value"],
                    description=item["description"]
                )
                session.add(setting)
                print(f"✅ Inserted default setting: {item['key']}")
            else:
                print(f"ℹ️ Setting already exists: {item['key']}")
        session.commit()
    except Exception as e:
        print(f"❌ Seeding failed: {e}")
        session.rollback()
        raise
    finally:
        session.close()

if __name__ == "__main__":
    run_migration()
    seed_defaults()
    print("Migration Complete!")
