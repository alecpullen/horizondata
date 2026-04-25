import logging
import uuid as _uuid
from datetime import datetime, timezone

from flask import Blueprint, request, jsonify, g

from app.middleware.auth import require_auth
from app.services.database import get_db
from app.models.booking import Booking

logger = logging.getLogger(__name__)

bookings_bp = Blueprint("bookings", __name__, url_prefix="/api/bookings")


def _bucket(booking, now_utc):
    if booking.status in ("pending", "awaiting"):
        return "pending"
    end = booking.scheduled_end
    if end.tzinfo is None:
        end = end.replace(tzinfo=timezone.utc)
    if booking.status == "completed" or end < now_utc:
        return "past"
    return "upcoming"


@bookings_bp.route("", methods=["GET"])
@require_auth(roles=["teacher"])
def list_bookings():
    try:
        with get_db() as db:
            rows = (
                db.query(Booking)
                .filter(Booking.teacher_id == g.user["id"])
                .order_by(Booking.scheduled_start.asc())
                .all()
            )

        now_utc = datetime.now(timezone.utc)
        buckets = {"upcoming": [], "past": [], "pending": []}
        for b in rows:
            buckets[_bucket(b, now_utc)].append(b.to_dict())

        return jsonify(buckets)

    except Exception as e:
        logger.error(f"Error listing bookings: {e}")
        return jsonify({"error": "internal_error", "message": "Failed to list bookings"}), 500


@bookings_bp.route("/<uuid:booking_id>", methods=["GET"])
@require_auth(roles=["teacher"])
def get_booking(booking_id):
    try:
        with get_db() as db:
            booking = db.query(Booking).filter(Booking.id == booking_id).first()

        if not booking:
            return jsonify({"error": "not_found", "message": "Booking not found"}), 404
        if str(booking.teacher_id) != str(g.user["id"]):
            return jsonify({"error": "forbidden", "message": "You do not own this booking"}), 403

        return jsonify(booking.to_dict())

    except Exception as e:
        logger.error(f"Error fetching booking {booking_id}: {e}")
        return jsonify({"error": "internal_error", "message": "Failed to fetch booking"}), 500


@bookings_bp.route("", methods=["POST"])
@require_auth(roles=["teacher"])
def create_booking():
    data = request.get_json()
    if not data:
        return jsonify({"error": "invalid_request", "message": "Request body required"}), 400

    title = (data.get("title") or "").strip()
    date_str = (data.get("date") or "").strip()
    start_time_str = (data.get("startTime") or "").strip()
    end_time_str = (data.get("endTime") or "").strip()

    if not title:
        return jsonify({"error": "validation_error", "message": "title is required"}), 400
    if not date_str or not start_time_str or not end_time_str:
        return jsonify({"error": "validation_error", "message": "date, startTime and endTime are required"}), 400

    try:
        scheduled_start = datetime.fromisoformat(f"{date_str}T{start_time_str}:00")
        scheduled_end = datetime.fromisoformat(f"{date_str}T{end_time_str}:00")
        # Handle crossing midnight (e.g. 23:00 → 01:00 next day)
        if scheduled_end <= scheduled_start:
            from datetime import timedelta
            scheduled_end += timedelta(days=1)
    except ValueError:
        return jsonify({"error": "validation_error", "message": "Invalid date or time format"}), 400

    try:
        booking = Booking(
            teacher_id=g.user["id"],
            title=title,
            description=(data.get("description") or "").strip() or None,
            scheduled_start=scheduled_start,
            scheduled_end=scheduled_end,
            status="confirmed",
            targets=data.get("targets"),
        )
        with get_db() as db:
            db.add(booking)
            db.flush()
            result = booking.to_dict()

        return jsonify({"success": True, "booking": result}), 201

    except Exception as e:
        logger.error(f"Error creating booking: {e}")
        return jsonify({"error": "internal_error", "message": "Failed to create booking"}), 500
