import logging
from flask import Blueprint, request, jsonify, g

from app.middleware.auth import require_auth
from app.services.database import get_db
from app.models.booking import Booking

logger = logging.getLogger(__name__)

admin_bookings_bp = Blueprint("admin_bookings", __name__, url_prefix="/api/admin/bookings")


@admin_bookings_bp.route("", methods=["GET"])
@require_auth(roles=["admin"])
def list_all_bookings():
    status_filter = request.args.get("status")
    _ALLOWED_FILTERS = {"confirmed", "pending", "completed", "awaiting", "cancelled", "rejected"}
    if status_filter and status_filter not in _ALLOWED_FILTERS:
        return jsonify({"error": "validation_error", "message": f"Invalid status filter. Allowed: {', '.join(sorted(_ALLOWED_FILTERS))}"}), 400
    try:
        with get_db() as db:
            query = db.query(Booking).order_by(Booking.scheduled_start.desc())
            if status_filter:
                query = query.filter(Booking.status == status_filter)
            bookings = query.all()
            items = []
            for b in bookings:
                d = b.to_dict()
                d["id"] = str(b.id)
                d["teacher_id"] = str(b.teacher_id)
                d["status"] = b.status  # raw value, not the display label from to_dict
                d["scheduled_start"] = b.scheduled_start.isoformat() if b.scheduled_start else None
                d["scheduled_end"] = b.scheduled_end.isoformat() if b.scheduled_end else None
                d["created_at"] = b.created_at.isoformat() if b.created_at else None
                from app.models.user import User
                teacher = None
                if b.teacher_id:
                    if b.teacher_id.isdigit():
                        teacher = db.query(User).filter(User.id == int(b.teacher_id)).first()
                    else:
                        teacher = db.query(User).filter(User.external_id == b.teacher_id).first()
                d["teacher"] = {
                    "name": teacher.username or "Unknown" if teacher else "Unknown",
                    "email": teacher.email if teacher else None,
                }
                items.append(d)
        return jsonify({"items": items, "total": len(items)})
    except Exception as e:
        logger.error(f"Error listing all bookings: {e}")
        return jsonify({"error": "internal_error", "message": "Failed to list bookings"}), 500


@admin_bookings_bp.route("/<uuid:booking_id>", methods=["PATCH"])
@require_auth(roles=["admin"])
def update_booking_status(booking_id):
    data = request.get_json()
    if not data or "status" not in data:
        return jsonify({"error": "validation_error", "message": "status is required"}), 400

    new_status = data["status"]
    if new_status not in ["confirmed", "rejected", "cancelled"]:
        return jsonify({"error": "validation_error", "message": "status must be 'confirmed', 'rejected', or 'cancelled'"}), 400

    try:
        with get_db() as db:
            booking = db.query(Booking).filter(Booking.id == booking_id).first()
            if not booking:
                return jsonify({"error": "not_found", "message": "Booking not found"}), 404

            if new_status == "cancelled":
                from app.models.session import ObservationSession
                active = db.query(ObservationSession).filter(
                    ObservationSession.booking_id == booking.id,
                    ObservationSession.status == "active",
                ).first()
                if active:
                    return jsonify({"error": "conflict", "message": "Cannot cancel a booking with an active session"}), 409

            booking.status = new_status
            db.commit()

            if new_status == "cancelled" and booking.headless:
                from app.services.headless_runner import unschedule_headless_booking
                unschedule_headless_booking(str(booking.id))

            logger.info(f"Booking {booking_id} status updated to {new_status} by admin {g.user['id']}")
            return jsonify({"success": True, "id": str(booking.id), "status": booking.status})
    except Exception as e:
        logger.error(f"Error updating booking {booking_id}: {e}")
        return jsonify({"error": "internal_error", "message": "Failed to update booking"}), 500
