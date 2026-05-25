import logging
from flask import Blueprint, request, jsonify, g

from app.middleware.auth import require_auth
from app.services.safety_manager import SafetyManager

logger = logging.getLogger(__name__)

admin_safety_bp = Blueprint("admin_safety", __name__, url_prefix="/api/admin/safety")


def _admin_safety_status():
    """Build safety status dict in the format the admin widget expects."""
    mgr = SafetyManager()
    override = mgr.get_override()
    current = mgr.get_current_status()

    if override:
        display_status = "FORCE_OPEN" if override["state"] == "OPEN" else "FORCE_CLOSED"
        return {
            "status": display_status,
            "override": {"expiresAt": override["expires_at"].isoformat()},
            "source": "manual",
        }
    return {
        "status": current["status"],
        "override": None,
        "source": "automatic",
    }


@admin_safety_bp.route("/status", methods=["GET"])
@require_auth(roles=["admin"])
def get_admin_safety_status():
    try:
        return jsonify(_admin_safety_status()), 200
    except Exception as e:
        logger.error(f"Error fetching admin safety status: {e}")
        return jsonify({"error": "internal_error", "message": "Failed to get safety status"}), 500


@admin_safety_bp.route("/override", methods=["POST"])
@require_auth(roles=["admin"])
def set_safety_override():
    data = request.get_json()
    if not data:
        return jsonify({"error": "invalid_request", "message": "Request body required"}), 400

    state = data.get("state")
    duration_minutes = data.get("duration_minutes") or data.get("durationMins")

    if state not in ("OPEN", "CLOSED"):
        return jsonify({"error": "validation_error", "message": "state must be 'OPEN' or 'CLOSED'"}), 400
    if not isinstance(duration_minutes, (int, float)) or duration_minutes < 1 or duration_minutes > 1440:
        return jsonify({"error": "validation_error", "message": "duration_minutes must be between 1 and 1440"}), 400

    SafetyManager().set_override(state, int(duration_minutes))

    logger.info(f"Safety override set to {state} for {duration_minutes}min by admin {g.user['id']}")
    return jsonify(_admin_safety_status()), 200


@admin_safety_bp.route("/override", methods=["DELETE"])
@require_auth(roles=["admin"])
def clear_safety_override():
    SafetyManager().clear_override()
    logger.info(f"Safety override cleared by admin {g.user['id']}")
    return jsonify(_admin_safety_status()), 200
