import logging
from flask import Blueprint, request, jsonify, g

from app.middleware.auth import require_auth
from app.services.safety_manager import SafetyManager

logger = logging.getLogger(__name__)

admin_safety_bp = Blueprint("admin_safety", __name__, url_prefix="/api/admin/safety")


@admin_safety_bp.route("/override", methods=["POST"])
@require_auth(roles=["admin"])
def set_safety_override():
    data = request.get_json()
    if not data:
        return jsonify({"error": "invalid_request", "message": "Request body required"}), 400

    state = data.get("state")
    duration_minutes = data.get("duration_minutes")

    if state not in ("OPEN", "CLOSED"):
        return jsonify({"error": "validation_error", "message": "state must be 'OPEN' or 'CLOSED'"}), 400
    if not isinstance(duration_minutes, (int, float)) or duration_minutes < 1 or duration_minutes > 1440:
        return jsonify({"error": "validation_error", "message": "duration_minutes must be between 1 and 1440"}), 400

    SafetyManager().set_override(state, int(duration_minutes))
    override = SafetyManager().get_override()

    logger.info(f"Safety override set to {state} for {duration_minutes}min by admin {g.user['id']}")
    return jsonify({"success": True, "override": {
        "state": state,
        "expires_at": override["expires_at"].isoformat(),
    }}), 200


@admin_safety_bp.route("/override", methods=["DELETE"])
@require_auth(roles=["admin"])
def clear_safety_override():
    SafetyManager().clear_override()
    logger.info(f"Safety override cleared by admin {g.user['id']}")
    return jsonify({"success": True, "message": "Override cleared"}), 200
