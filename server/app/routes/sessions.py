import logging
import uuid as _uuid
from datetime import datetime, timezone

from flask import Blueprint, jsonify, g

from app.middleware.auth import require_auth
from app.services.database import get_db
from app.services.session_codes import generate_session_code
from app.services.student_session_manager import get_student_session_manager
from app.models.booking import Booking
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
        

def create_booking(slot_id):
    try:
        with get_db() as db:

            # LOCK SLOT ROW
            slot = (
                db.query(TimeSlot)
                .filter(TimeSlot.id == slot_id)
                .with_for_update()
                .first()
            )

            if not slot:
                return jsonify({
                    "error": "not_found",
                    "message": "Time slot not found"
                }), 404

            # CHECK AGAIN INSIDE LOCK
            existing = (
                db.query(Booking)
                .filter(Booking.time_slot_id == slot_id)
                .first()
            )

            if existing:
                return jsonify({
                    "error": "slot_taken",
                    "message": "This slot has already been booked."
                }), 409

            booking = Booking(
                student_id=g.user["id"],
                teacher_id=slot.teacher_id,
                time_slot_id=slot_id,
                status="confirmed"
            )

            db.add(booking)
            db.flush()

            return jsonify({
                "success": True,
                "booking_id": str(booking.id)
            })

    except IntegrityError:
        db.rollback()

        return jsonify({
            "error": "slot_taken",
            "message": "Another user booked this slot first."
        }), 409
