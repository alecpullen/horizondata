import logging
import uuid as _uuid
from datetime import datetime, timezone

from flask import Blueprint, jsonify, g, request

from app.middleware.auth import require_auth
from app.services.database import get_db
from app.services.session_codes import generate_session_code
from app.services.student_session_manager import get_student_session_manager
from app.services.rate_limiter import check_join_limit, get_join_remaining
from app.models.booking import Booking
from app.models.capture import Capture
from app.models.session import ObservationSession
from sqlalchemy.exc import IntegrityError

logger = logging.getLogger(__name__)

sessions_bp = Blueprint("sessions", __name__, url_prefix="/api/sessions")


def _load_booking_owned(db, booking_id):
    """Return (booking, error_response) — exactly one of which is None."""
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        return None, (jsonify({"error": "not_found", "message": "Booking not found"}), 404)
    if str(booking.teacher_id) != str(g.user["id"]):
        return None, (jsonify({"error": "forbidden", "message": "You do not own this booking"}), 403)
    return booking, None


def _get_or_create_session(db, booking):
    """Return the active ObservationSession for this booking, creating one if needed.
    
    Raises ValueError if the teacher already has an unrelated active session.
    """
    # 1. Return existing session for this booking
    obs = (
        db.query(ObservationSession)
        .filter(
            ObservationSession.booking_id == booking.id,
            ObservationSession.status == "active",
        )
        .with_for_update()
        .first()
    )
    if obs:
        return obs

    # 2. Prevent multiple active sessions for the same teacher
    existing = (
        db.query(ObservationSession)
        .filter(
            ObservationSession.teacher_id == g.user["id"],
            ObservationSession.status == "active",
            ObservationSession.booking_id != booking.id,
        )
        .with_for_update()
        .first()
    )
    if existing:
        raise ValueError(
            f"Teacher already has an active observation session (booking {existing.booking_id})"
        )

    obs = ObservationSession(
        teacher_id=g.user["id"],
        session_code=generate_session_code(),
        booking_id=booking.id,
        status="active",
    )
    db.add(obs)
    db.flush()
    return obs


@sessions_bp.route("/<uuid:booking_id>", methods=["GET"])
@require_auth(roles=["teacher"])
def get_session(booking_id):
    try:
        with get_db() as db:
            booking, err = _load_booking_owned(db, booking_id)
            if err:
                return err
            obs = _get_or_create_session(db, booking)
            result = {"id": str(obs.id), "joinCode": obs.session_code, "status": obs.status}

        return jsonify({"success": True, "session": result})

    except ValueError as e:
        logger.warning(f"Session conflict for booking {booking_id}: {e}")
        return jsonify({"error": "conflict", "message": str(e)}), 409
    except Exception as e:
        logger.error(f"Error fetching session for booking {booking_id}: {e}")
        return jsonify({"error": "internal_error", "message": "Failed to fetch session"}), 500


def _compute_queue_status(booking, obs, db):
    """Shared helper: compute queue status dict (total, completed, current_target, status)."""
    if not obs:
        return {"total": 0, "completed": 0, "current_target": None, "status": "pending"}

    status_map = {
        "active": "running",
        "completed": "done",
        "terminated": "aborted",
        "ended": "done",
    }
    status = status_map.get(obs.status or "pending", "pending")

    targets = booking.targets or {}
    celestial_objects = targets.get("celestialObjects", [])
    total = len(celestial_objects)
    completed = 0
    current_target = None

    if status == "done":
        completed = total
    elif status == "running" and total > 0:
        captured_rows = (
            db.query(Capture.object_name)
            .filter(
                Capture.observation_session_id == obs.id,
                Capture.object_name.isnot(None),
            )
            .distinct()
            .all()
        )
        captured_names = {row.object_name.lower() for row in captured_rows if row.object_name}
        target_names_lower = [obj.get("name", "").lower() for obj in celestial_objects]
        completed = sum(1 for n in target_names_lower if n in captured_names)
        current_target = next(
            (obj.get("name") for obj in celestial_objects
             if obj.get("name", "").lower() not in captured_names),
            None,
        )

    return {"total": total, "completed": completed, "current_target": current_target, "status": status}


@sessions_bp.route("/<uuid:booking_id>/queue-status", methods=["GET"])
@require_auth(roles=["teacher"])
def get_queue_status(booking_id):
    try:
        with get_db() as db:
            booking, err = _load_booking_owned(db, booking_id)
            if err:
                return err
            obs = (
                db.query(ObservationSession)
                .filter(ObservationSession.booking_id == booking.id)
                .first()
            )
            return jsonify(_compute_queue_status(booking, obs, db))
    except Exception as e:
        logger.error(f"Error fetching queue status for booking {booking_id}: {e}")
        return jsonify({"error": "internal_error", "message": "Failed to fetch queue status"}), 500


@sessions_bp.route("/<uuid:booking_id>/participants", methods=["GET"])
@require_auth(roles=["teacher"])
def list_participants(booking_id):
    try:
        with get_db() as db:
            booking, err = _load_booking_owned(db, booking_id)
            if err:
                return err
            obs = (
                db.query(ObservationSession)
                .filter(
                    ObservationSession.booking_id == booking.id,
                    ObservationSession.status == "active",
                )
                .first()
            )

        if not obs:
            return jsonify({"success": True, "participants": []})

        manager = get_student_session_manager()
        raw = manager.list_participants(str(obs.id))
        participants = [{"id": p["id"], "name": p["display_name"]} for p in raw]

        return jsonify({"success": True, "participants": participants})

    except Exception as e:
        logger.error(f"Error listing participants for booking {booking_id}: {e}")
        return jsonify({"error": "internal_error", "message": "Failed to list participants"}), 500


@sessions_bp.route("/<uuid:booking_id>/start", methods=["POST"])
@require_auth(roles=["teacher"])
def start_session(booking_id):
    try:
        with get_db() as db:
            booking, err = _load_booking_owned(db, booking_id)
            if err:
                return err
            obs = _get_or_create_session(db, booking)
            obs.status = "active"  # idempotent

        return jsonify({"success": True})

    except ValueError as e:
        logger.warning(f"Session conflict for booking {booking_id}: {e}")
        return jsonify({"error": "conflict", "message": str(e)}), 409
    except Exception as e:
        logger.error(f"Error starting session for booking {booking_id}: {e}")
        return jsonify({"error": "internal_error", "message": "Failed to start session"}), 500


@sessions_bp.route("/<uuid:booking_id>/end", methods=["POST"])
@require_auth(roles=["teacher"])
def end_session(booking_id):
    try:
        with get_db() as db:
            booking, err = _load_booking_owned(db, booking_id)
            if err:
                return err

            obs = (
                db.query(ObservationSession)
                .filter(
                    ObservationSession.booking_id == booking.id,
                    ObservationSession.status == "active",
                )
                .first()
            )
            if not obs:
                return jsonify({"error": "not_found", "message": "No active session for this booking"}), 404

            obs.status = "ended"
            obs.ended_at = datetime.now(timezone.utc)
            booking.status = "completed"
            obs_id = str(obs.id)

        manager = get_student_session_manager()
        manager.end_all_for_observation(obs_id)

        return jsonify({"success": True})

    except Exception as e:
        logger.error(f"Error ending session for booking {booking_id}: {e}")
        return jsonify({"error": "internal_error", "message": "Failed to end session"}), 500


@sessions_bp.route("/validate", methods=["POST"])
def validate_join_code():
    """
    Lightweight check that a join code exists and belongs to an active session.
    Does not create a student session — just confirms the code is valid.

    Body (JSON):
        joinCode  str  required  6-character session code

    Returns:
        { valid: bool, status?, sessionId?, reason? }
    """
    data = request.get_json(force=True) or {}
    join_code = (data.get("joinCode") or "").strip().upper()

    if not join_code:
        return jsonify({"valid": False, "reason": "missing_code"}), 400

    # Rate limit by IP
    ip = request.remote_addr or "unknown"
    if not check_join_limit(ip):
        remaining = get_join_remaining(ip)
        return jsonify({
            "valid": False,
            "reason": "rate_limited",
            "message": "Too many attempts. Please wait before trying again.",
            "remaining": remaining,
        }), 429

    try:
        with get_db() as db:
            obs = (
                db.query(ObservationSession)
                .filter(
                    ObservationSession.session_code == join_code,
                    ObservationSession.status == "active",
                )
                .first()
            )

        if not obs:
            return jsonify({"valid": False, "reason": "not_found"})

        return jsonify({"valid": True, "sessionId": str(obs.id), "status": obs.status})

    except Exception as e:
        logger.error(f"Error validating join code: {e}")
        return jsonify({"valid": False, "reason": "internal_error"}), 500


@sessions_bp.route("/join", methods=["POST"])
def join_session():
    """
    Join an active session as a student.

    Rate limited per IP — 10 attempts per minute to prevent
    brute-force session code guessing.

    Body (JSON):
        joinCode     str  required  6-character session code
        studentName  str  required  Display name (max 50 chars)

    Returns:
        201 + { success, session: { id, joinCode }, studentSessionId }
    """
    data = request.get_json(force=True) or {}
    join_code = (data.get("joinCode") or "").strip().upper()
    student_name = (data.get("studentName") or "").strip()

    # Validate input
    if not join_code:
        return jsonify({"error": "validation_error", "message": "joinCode is required"}), 400
    if not student_name:
        return jsonify({"error": "validation_error", "message": "studentName is required"}), 400
    if len(student_name) > 50:
        return jsonify({"error": "validation_error", "message": "Name must be 50 characters or less"}), 400

    # Rate limit by IP — prevents brute-force guessing of session codes
    ip = request.remote_addr or "unknown"
    if not check_join_limit(ip):
        remaining = get_join_remaining(ip)
        return jsonify({
            "error": "rate_limited",
            "message": "Too many join attempts. Please wait before trying again.",
            "remaining": remaining,
        }), 429

    try:
        with get_db() as db:
            obs = (
                db.query(ObservationSession)
                .filter(
                    ObservationSession.session_code == join_code,
                    ObservationSession.status == "active",
                )
                .first()
            )

            if not obs:
                return jsonify({
                    "error": "session_not_found",
                    "message": "Session not found or has ended. Please check the session code.",
                }), 404

            obs_id = str(obs.id)
            obs_code = obs.session_code

        # Create ephemeral student session
        manager = get_student_session_manager()
        student_session_id = manager.create_session(
            display_name=student_name,
            observation_session_id=obs_id,
        )

        logger.info(f"Student '{student_name}' joined session {obs_id}")

        return jsonify({
            "success": True,
            "session": {"id": obs_id, "joinCode": obs_code},
            "studentSessionId": student_session_id,
        }), 201

    except Exception as e:
        logger.error(f"Error joining session with code {join_code}: {e}")
        return jsonify({"error": "internal_error", "message": "Failed to join session"}), 500


@sessions_bp.route("", methods=["POST"])
@require_auth(roles=["teacher"])
def create_booking():
    data = request.get_json(force=True) or {}
    title = (data.get("title") or "").strip()
    scheduled_start = data.get("scheduledStart")
    scheduled_end = data.get("scheduledEnd")

    if not title or not scheduled_start or not scheduled_end:
        return jsonify({
            "error": "validation_error",
            "message": "title, scheduledStart, and scheduledEnd are required"
        }), 400

    try:
        start_dt = datetime.fromisoformat(scheduled_start)
        end_dt = datetime.fromisoformat(scheduled_end)
    except ValueError:
        return jsonify({"error": "validation_error", "message": "Invalid datetime format"}), 400

    if end_dt <= start_dt:
        return jsonify({"error": "validation_error", "message": "End time must be after start time"}), 400
    if start_dt <= datetime.now(timezone.utc):
        return jsonify({"error": "validation_error", "message": "Start time must be in the future"}), 400

    try:
        with get_db() as db:
            overlapping = (
                db.query(Booking)
                .filter(
                    Booking.scheduled_start < end_dt,
                    Booking.scheduled_end > start_dt,
                    Booking.status != "cancelled",
                )
                .with_for_update()
                .first()
            )

            if overlapping:
                return jsonify({
                    "error": "slot_taken",
                    "message": "This time slot has already been booked."
                }), 409

            booking = Booking(
                teacher_id=g.user["id"],
                title=title,
                scheduled_start=start_dt,
                scheduled_end=end_dt,
                status="confirmed",
            )
            db.add(booking)
            db.flush()

            return jsonify({
                "success": True,
                "booking_id": str(booking.id)
            }), 201

    except IntegrityError:
        return jsonify({
            "error": "slot_taken",
            "message": "Another user booked this slot first."
        }), 409
