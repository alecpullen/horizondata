import logging
from datetime import datetime, timezone
from flask import Blueprint, jsonify

from app.middleware.auth import require_auth
from app.services.database import get_db
from app.models.user import User
from app.models.booking import Booking
from app.models.session import ObservationSession
from app.services.safety_manager import SafetyManager

logger = logging.getLogger(__name__)

admin_summary_bp = Blueprint("admin_summary", __name__, url_prefix="/api/admin")


@admin_summary_bp.route("/summary", methods=["GET"])
@require_auth(roles=["admin"])
def get_admin_summary():
    try:
        with get_db() as db:
            pending_accounts = (
                db.query(User)
                .filter(User.account_status == "pending")
                .count()
            )
            pending_bookings = (
                db.query(Booking)
                .filter(
                    Booking.status == "confirmed",
                    Booking.scheduled_start > datetime.now(timezone.utc),
                )
                .count()
            )
            active_sessions = (
                db.query(ObservationSession)
                .filter(ObservationSession.status == "active")
                .count()
            )

        safety = SafetyManager().get_current_status()

        queued_jobs = 0
        try:
            from app.services.headless_runner import scheduler
            if scheduler is not None:
                queued_jobs = len(scheduler.get_jobs())
        except Exception as e:
            logger.warning(f"Could not get scheduler job count: {e}")

        return jsonify({
            "pending_accounts": pending_accounts,
            "pending_bookings": pending_bookings,
            "active_sessions": active_sessions,
            "safety_status": {
                "status": safety.get("status"),
                "reason": safety.get("reason"),
                "next_available": safety.get("next_available"),
                "current_time": safety.get("current_time"),
            },
            "queued_jobs": queued_jobs,
        })

    except Exception as e:
        logger.error(f"Error fetching admin summary: {e}")
        return jsonify({"error": "internal_error", "message": "Failed to fetch admin summary"}), 500
