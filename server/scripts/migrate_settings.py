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
            {"key": "primary_stream_url", "value": "", "description": "Telescope Camera HLS Stream URL"},
            {"key": "primary_stream_webrtc_url", "value": "", "description": "Telescope Camera WebRTC (WHEP) URL"},
            {"key": "site_camera_url", "value": "", "description": "Site Camera HLS Stream URL"},
            {"key": "site_camera_webrtc_url", "value": "", "description": "Site Camera WebRTC (WHEP) URL"},
            {"key": "msw_enabled", "value": "false", "description": "Mock API mode enabled"},
            {"key": "mock_telescope_enabled", "value": "false", "description": "Mock Telescope mode enabled"},
            {"key": "alpaca_base", "value": os.getenv('ALPACA_BASE', 'http://localhost:32323/api/v1/telescope/0'), "description": "Alpaca Telescope Base URL"},
            {"key": "thingspeak_channel_id", "value": os.getenv('THINGSPEAK_CHANNEL_ID', '270748'), "description": "ThingSpeak Weather Channel ID"},
            {"key": "safety_max_wind_speed", "value": "25.0", "description": "Safety Max Wind Speed (km/h)"},
            {"key": "safety_min_temperature", "value": "-5.0", "description": "Safety Min Temperature (C)"},
            {"key": "safety_max_temperature", "value": "45.0", "description": "Safety Max Temperature (C)"},
            {"key": "safety_max_humidity", "value": "95.0", "description": "Safety Max Humidity (%)"},
            {"key": "safety_min_pressure", "value": "980.0", "description": "Safety Min Pressure (hPa)"},
            {"key": "safety_max_pressure", "value": "1040.0", "description": "Safety Max Pressure (hPa)"},
            {"key": "safety_max_dew_point_diff", "value": "2.0", "description": "Safety Min Temperature-Dew Point Diff (C)"}
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
                print(f"✅ Inserted default setting: {item['key']} = {item['value']}")
            else:
                if item["key"] in ["thingspeak_channel_id", "alpaca_base"] and existing.value != item["value"]:
                    existing.value = item["value"]
                    print(f"🔄 Updated setting to match ENV default: {item['key']} = {item['value']}")
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
