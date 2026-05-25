import logging
from datetime import datetime, timezone
from flask import Blueprint, jsonify, g

from app.middleware.auth import require_auth
from app.services.database import get_db
from app.models.booking import Booking
from app.models.session import ObservationSession
from app.models.user import User
from app.routes.sessions import _compute_queue_status

logger = logging.getLogger(__name__)

admin_queue_bp = Blueprint("admin_queue", __name__, url_prefix="/api/admin/queue")


@admin_queue_bp.route("", methods=["GET"])
@require_auth(roles=["admin"])
def list_all_queue_status():
    try:
        with get_db() as db:
            bookings = (
                db.query(Booking)
                .filter(Booking.headless == True)
                .order_by(Booking.scheduled_start.desc())
                .all()
            )
            booking_ids = [b.id for b in bookings]
            obs_map = {
                o.booking_id: o
                for o in db.query(ObservationSession)
                .filter(ObservationSession.booking_id.in_(booking_ids))
                .all()
            }
            int_teacher_ids = {int(b.teacher_id) for b in bookings if b.teacher_id and b.teacher_id.isdigit()}
            ext_teacher_ids = {b.teacher_id for b in bookings if b.teacher_id and not b.teacher_id.isdigit()}
            teachers = {}
            if int_teacher_ids:
                for u in db.query(User).filter(User.id.in_(int_teacher_ids)).all():
                    teachers[str(u.id)] = u
            if ext_teacher_ids:
                for u in db.query(User).filter(User.external_id.in_(ext_teacher_ids)).all():
                    teachers[u.external_id] = u

            items = []
            for booking in bookings:
                obs = obs_map.get(booking.id)
                qs = _compute_queue_status(booking, obs, db)
                teacher = teachers.get(booking.teacher_id)
                items.append({
                    "booking_id": str(booking.id),
                    "title": booking.title,
                    "teacher_name": teacher.username or "Unknown" if teacher else "Unknown",
                    "scheduled_start": booking.scheduled_start.isoformat() if booking.scheduled_start else None,
                    "headless": booking.headless,
                    **qs,
                })
            return jsonify({"items": items, "total": len(items)})

    except Exception as e:
        logger.error(f"Error listing queue: {e}")
        return jsonify({"error": "internal_error", "message": "Failed to list queue"}), 500


@admin_queue_bp.route("/<uuid:booking_id>/abort", methods=["POST"])
@require_auth(roles=["admin"])
def abort_headless_job(booking_id):
    try:
        with get_db() as db:
            booking = db.query(Booking).filter(Booking.id == booking_id).first()
            if not booking:
                return jsonify({"error": "not_found", "message": "Booking not found"}), 404
            if not booking.headless:
                return jsonify({"error": "validation_error", "message": "Booking is not a headless job"}), 400

            obs = (
                db.query(ObservationSession)
                .filter(ObservationSession.booking_id == booking.id)
                .first()
            )
            if obs and obs.status not in ("ended", "terminated", "completed"):
                obs.status = "terminated"
                obs.ended_at = datetime.now(timezone.utc)

            db.commit()

        from app.services.headless_runner import unschedule_headless_booking
        unschedule_headless_booking(str(booking.id))

        try:
            from app.services.alpaca_client import alpaca_client
            alpaca_client.park()
        except Exception:
            logger.warning(f"Could not park telescope during abort of booking {booking_id}")

        logger.info(f"Headless job {booking_id} aborted by admin {g.user['id']}")
        return jsonify({"success": True, "message": "Headless job aborted"})

    except Exception as e:
        logger.error(f"Error aborting headless job {booking_id}: {e}")
        return jsonify({"error": "internal_error", "message": "Failed to abort headless job"}), 500
