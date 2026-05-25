import logging
from datetime import datetime, timezone
from flask import Blueprint, jsonify, g

from app.middleware.auth import require_auth
from app.services.database import get_db
from app.models.session import ObservationSession
from app.models.booking import Booking
from app.models.user import User
from app.services.student_session_manager import get_student_session_manager

logger = logging.getLogger(__name__)

admin_sessions_bp = Blueprint("admin_sessions", __name__, url_prefix="/api/admin/sessions")


@admin_sessions_bp.route("", methods=["GET"])
@require_auth(roles=["admin"])
def list_all_sessions():
    try:
        with get_db() as db:
            rows = (
                db.query(ObservationSession)
                .order_by(ObservationSession.created_at.desc())
                .all()
            )
            manager = get_student_session_manager()
            items = []
            for obs in rows:
                teacher = None
                if obs.teacher_id:
                    if obs.teacher_id.isdigit():
                        teacher = db.query(User).filter(User.id == int(obs.teacher_id)).first()
                    else:
                        teacher = db.query(User).filter(User.external_id == obs.teacher_id).first()
                booking = db.query(Booking).filter(Booking.id == obs.booking_id).first() if obs.booking_id else None
                participants = manager.list_participants(str(obs.id))
                items.append({
                    "id": str(obs.id),
                    "booking_id": str(obs.booking_id) if obs.booking_id else None,
                    "session_code": obs.session_code,
                    "teacher_name": teacher.username or "Unknown" if teacher else "Unknown",
                    "title": booking.title if booking else None,
                    "status": obs.status,
                    "student_count": len(participants),
                    "started_at": obs.created_at.isoformat() if obs.created_at else None,
                    "ended_at": obs.ended_at.isoformat() if obs.ended_at else None,
                })
        return jsonify({"items": items, "total": len(items)})
    except Exception as e:
        logger.error(f"Error listing sessions: {e}")
        return jsonify({"error": "internal_error", "message": "Failed to list sessions"}), 500


@admin_sessions_bp.route("/<uuid:session_id>/terminate", methods=["POST"])
@require_auth(roles=["admin"])
def terminate_session(session_id):
    try:
        with get_db() as db:
            obs = db.query(ObservationSession).filter(ObservationSession.id == session_id).first()
            if not obs:
                return jsonify({"error": "not_found", "message": "Session not found"}), 404

            obs.status = "ended"
            obs.ended_at = datetime.now(timezone.utc)

            if obs.booking_id:
                booking = db.query(Booking).filter(Booking.id == obs.booking_id).first()
                if booking and booking.status != "completed":
                    booking.status = "completed"

        manager = get_student_session_manager()
        manager.end_all_for_observation(str(session_id))

        logger.info(f"Session {session_id} terminated by admin {g.user['id']}")
        return jsonify({"success": True, "message": "Session terminated"})
    except Exception as e:
        logger.error(f"Error terminating session {session_id}: {e}")
        return jsonify({"error": "internal_error", "message": "Failed to terminate session"}), 500
