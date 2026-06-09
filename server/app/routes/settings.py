from flask import Blueprint, request, jsonify
from app.services.database import get_db
from app.models.setting import SystemSetting
from app.middleware.auth import require_admin, require_any_auth
import logging

logger = logging.getLogger(__name__)

settings_bp = Blueprint("settings", __name__, url_prefix="/api/settings")

@settings_bp.route("", methods=["GET"])
@require_any_auth
def get_settings():
    """
    Get all system settings for authenticated users.
    """
    try:
        with get_db() as db:
            settings = db.query(SystemSetting).all()
            # Return as key-value pairs
            result = {setting.key: setting.value for setting in settings}
            return jsonify(result), 200
    except Exception as e:
        logger.error(f"Failed to fetch settings: {e}")
        return jsonify({"error": "Failed to fetch settings", "message": str(e)}), 500

# Non-sensitive settings the frontend needs before (or without) any login:
#  - the MSW/mock-telescope toggles, read at app boot to decide whether to
#    start the in-browser mock worker (no token exists yet); and
#  - the live stream URLs, so the unauthenticated public view can render the
#    feed. Everything else in the settings table stays auth-gated.
# Each key carries a default so the response shape is stable; URLs default to
# "" (falsy) rather than "false" so the frontend treats a missing URL as empty.
PUBLIC_SETTING_DEFAULTS = {
    "msw_enabled": "false",
    "mock_telescope_enabled": "false",
    "primary_stream_webrtc_url": "",
    "primary_stream_url": "",
    "site_camera_webrtc_url": "",
    "site_camera_url": "",
}

@settings_bp.route("/public", methods=["GET"])
def get_public_settings():
    """
    Get the public subset of system settings (mock/demo toggles + stream URLs).

    Unauthenticated: the SPA calls this at startup to decide whether to enable
    the in-browser mock API, and the public live view reads the stream URLs.
    """
    try:
        with get_db() as db:
            settings = (
                db.query(SystemSetting)
                .filter(SystemSetting.key.in_(PUBLIC_SETTING_DEFAULTS.keys()))
                .all()
            )
            stored = {s.key: s.value for s in settings}
            # Fill any missing key with its default for a stable response shape.
            result = {key: stored.get(key, default) for key, default in PUBLIC_SETTING_DEFAULTS.items()}
            return jsonify(result), 200
    except Exception as e:
        logger.error(f"Failed to fetch public settings: {e}")
        return jsonify({"error": "Failed to fetch settings", "message": str(e)}), 500

@settings_bp.route("", methods=["PUT"])
@require_admin
def update_settings():
    """
    Update system settings.
    Accepts a JSON payload of key-value pairs.
    Only accessible by administrators.
    """
    data = request.json
    if not isinstance(data, dict):
        return jsonify({"error": "Invalid payload", "message": "Payload must be a JSON object"}), 400

    try:
        with get_db() as db:
            # Only update existing keys or create them if they don't exist
            # For this context we allow dynamic key creation if needed, or strictly update
            for key, value in data.items():
                setting = db.query(SystemSetting).filter_by(key=key).first()
                if setting:
                    setting.value = str(value) if value is not None else ""
                else:
                    new_setting = SystemSetting(key=key, value=str(value) if value is not None else "")
                    db.add(new_setting)
            db.commit()

            # Return updated settings
            settings = db.query(SystemSetting).all()
            result = {s.key: s.value for s in settings}
            return jsonify(result), 200
    except Exception as e:
        logger.error(f"Failed to update settings: {e}")
        return jsonify({"error": "Failed to update settings", "message": str(e)}), 500
