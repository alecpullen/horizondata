import logging
import uuid as _uuid
from datetime import datetime, timezone, date, time, timedelta

from flask import Blueprint, request, jsonify, g
import pytz

from app.middleware.auth import require_auth
from app.services.database import get_db
from app.models.booking import Booking
from app.services.time_service import TimeService

logger = logging.getLogger(__name__)

bookings_bp = Blueprint("bookings", __name__, url_prefix="/api/bookings")

MELBOURNE_TZ = pytz.timezone("Australia/Melbourne")
MIN_SESSION_MINUTES = 5
MAX_SESSION_MINUTES = 60


def _bucket(booking, now_melbourne):
    """
    Categorise a booking into past/upcoming/pending buckets.
    All comparisons use Melbourne timezone to avoid naive-vs-aware errors.
    """
    if booking.status in ("pending", "awaiting"):
        return "pending"

    end = booking.scheduled_end
    # Ensure we're comparing timezone-aware datetimes
    if end.tzinfo is None:
        end = MELBOURNE_TZ.localize(end)
    else:
        end = end.astimezone(MELBOURNE_TZ)

    if booking.status == "completed" or end < now_melbourne:
        return "past"
    return "upcoming"


@bookings_bp.route("", methods=["GET"])
@require_auth(roles=["teacher"])
def list_bookings():
    try:
        now_melbourne = datetime.now(MELBOURNE_TZ)
        buckets = {"upcoming": [], "past": [], "pending": []}

        with get_db() as db:
            rows = (
                db.query(Booking)
                .filter(Booking.teacher_id == g.user["id"])
                .order_by(Booking.scheduled_start.asc())
                .all()
            )

            for b in rows:
                buckets[_bucket(b, now_melbourne)].append(b.to_dict())

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

    # Parse into Melbourne-local naive datetime, then localize
    try:
        naive_start = datetime.fromisoformat(f"{date_str}T{start_time_str}:00")
        naive_end = datetime.fromisoformat(f"{date_str}T{end_time_str}:00")
        # Handle crossing midnight (e.g. 23:00 → 01:00 next day)
        if naive_end <= naive_start:
            naive_end += timedelta(days=1)
    except ValueError:
        return jsonify({"error": "validation_error", "message": "Invalid date or time format"}), 400

    scheduled_start = MELBOURNE_TZ.localize(naive_start)
    scheduled_end = MELBOURNE_TZ.localize(naive_end)

    # Duration validation: 5–60 minutes
    duration_minutes = (scheduled_end - scheduled_start).total_seconds() / 60
    if duration_minutes < MIN_SESSION_MINUTES:
        return jsonify(
            {"error": "validation_error", "message": f"Minimum session duration is {MIN_SESSION_MINUTES} minutes"}
        ), 400
    if duration_minutes > MAX_SESSION_MINUTES:
        return jsonify(
            {"error": "validation_error", "message": f"Maximum session duration is {MAX_SESSION_MINUTES} minutes"}
        ), 400

    # Nighttime viewing-window gate
    ts = TimeService()
    booking_date = scheduled_start.date()
    try:
        window_start, window_end = ts.get_viewing_window(booking_date)
    except Exception as e:
        logger.warning(f"Could not calculate viewing window for {booking_date}: {e}")
        return jsonify({"error": "validation_error", "message": "Could not verify nighttime viewing window"}), 400

    # Convert window bounds to Melbourne time for comparison
    if window_start.tzinfo is None:
        window_start = MELBOURNE_TZ.localize(window_start)
    else:
        window_start = window_start.astimezone(MELBOURNE_TZ)

    if window_end.tzinfo is None:
        window_end = MELBOURNE_TZ.localize(window_end)
    else:
        window_end = window_end.astimezone(MELBOURNE_TZ)

    if scheduled_end <= window_start or scheduled_start >= window_end:
        return jsonify(
            {
                "error": "validation_error",
                "message": (
                    f"Booking must be within the nighttime viewing window "
                    f"({window_start.strftime('%H:%M')}–{window_end.strftime('%H:%M')} Melbourne time)"
                ),
            }
        ), 400

    try:
        with get_db() as db:
            # Application-level overlap check (DB trigger is the safety net)
            existing = (
                db.query(Booking)
                .filter(
                    Booking.teacher_id == g.user["id"],
                    Booking.status.in_(["confirmed", "pending"]),
                    Booking.scheduled_start < scheduled_end,
                    Booking.scheduled_end > scheduled_start,
                )
                .first()
            )

            if existing:
                return jsonify(
                    {"error": "conflict", "message": "You already have a booking during this time"}
                ), 409

            booking = Booking(
                teacher_id=g.user["id"],
                title=title,
                description=(data.get("description") or "").strip() or None,
                scheduled_start=scheduled_start,
                scheduled_end=scheduled_end,
                status="confirmed",
                targets=data.get("targets"),
            )
            db.add(booking)
            db.flush()
            result = booking.to_dict()

        return jsonify({"success": True, "booking": result}), 201

    except Exception as e:
        logger.error(f"Error creating booking: {e}")
        # If the DB trigger rejected the insert, surface a clear conflict message
        if "overlaps with existing session" in str(e).lower():
            return jsonify(
                {"error": "conflict", "message": "You already have a booking during this time"}
            ), 409
        return jsonify({"error": "internal_error", "message": "Failed to create booking"}), 500


@bookings_bp.route("/availability", methods=["GET"])
@require_auth(roles=["teacher"])
def get_availability():
    """
    Return available time slots for a date range.
    Each slot is 30 minutes, restricted to the nighttime viewing window.
    Slots that overlap with an existing confirmed/pending booking are marked unavailable.
    """
    start_date_str = request.args.get("startDate")
    end_date_str = request.args.get("endDate")

    if not start_date_str or not end_date_str:
        return jsonify({"error": "validation_error", "message": "startDate and endDate are required"}), 400

    try:
        start = date.fromisoformat(start_date_str)
        end = date.fromisoformat(end_date_str)
    except ValueError:
        return jsonify({"error": "validation_error", "message": "Invalid date format (expected YYYY-MM-DD)"}), 400

    if end < start:
        return jsonify({"error": "validation_error", "message": "endDate must be on or after startDate"}), 400

    # Cap query range to avoid abuse
    if (end - start).days > 60:
        return jsonify({"error": "validation_error", "message": "Date range may not exceed 60 days"}), 400

    ts = TimeService()
    teacher_id = g.user["id"]

    with get_db() as db:
        # Fetch all relevant bookings for this teacher in the range
        range_end_dt = MELBOURNE_TZ.localize(datetime.combine(end, time.max))
        range_start_dt = MELBOURNE_TZ.localize(datetime.combine(start, time.min))

        rows = (
            db.query(Booking)
            .filter(
                Booking.teacher_id == teacher_id,
                Booking.status.in_(["confirmed", "pending"]),
                Booking.scheduled_start <= range_end_dt,
                Booking.scheduled_end >= range_start_dt,
            )
            .all()
        )

        # Extract into plain tuples so we can use them outside the session context
        bookings = [(r.scheduled_start, r.scheduled_end) for r in rows]

    slots = []
    current = start
    while current <= end:
        try:
            window_start, window_end = ts.get_viewing_window(current)
        except Exception as e:
            logger.warning(f"Viewing window calculation failed for {current}: {e}")
            current += timedelta(days=1)
            continue

        # Ensure timezone-aware for comparisons
        if window_start.tzinfo is None:
            window_start = MELBOURNE_TZ.localize(window_start)
        else:
            window_start = window_start.astimezone(MELBOURNE_TZ)

        if window_end.tzinfo is None:
            window_end = MELBOURNE_TZ.localize(window_end)
        else:
            window_end = window_end.astimezone(MELBOURNE_TZ)

        # Generate fixed 30-minute slots aligned to the frontend grid.
        # Evening: 18:00-23:30 on current date. Morning: 00:00-05:30 on next date.
        grid_times = []
        for hour in range(18, 24):
            for minute in (0, 30):
                grid_times.append((current, hour, minute))
        next_day = current + timedelta(days=1)
        for hour in range(0, 6):
            for minute in (0, 30):
                grid_times.append((next_day, hour, minute))

        for slot_date, hour, minute in grid_times:
            naive = datetime.combine(slot_date, time(hour, minute))
            slot_start = MELBOURNE_TZ.localize(naive)
            slot_end = slot_start + timedelta(minutes=30)

            # Slot is available only if fully within the viewing window
            # AND does not overlap any existing booking.
            fully_in_window = slot_start >= window_start and slot_end <= window_end
            overlaps_booking = any(
                b_start < slot_end and b_end > slot_start
                for b_start, b_end in bookings
            )

            slots.append({
                "date": current.isoformat(),
                "startTime": slot_start.strftime("%H:%M"),
                "endTime": slot_end.strftime("%H:%M"),
                "available": fully_in_window and not overlaps_booking,
            })

        current += timedelta(days=1)

    return jsonify({"slots": slots, "total": len(slots)})
