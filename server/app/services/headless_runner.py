import atexit
import json
import logging
import os
import re
import subprocess
import time
import uuid
from datetime import datetime, timezone

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.jobstores.base import JobLookupError

from app.services.database import get_db
from app.services.alpaca_client import alpaca_client
from app.services.safety_manager import SafetyManager
from app.services.session_codes import generate_session_code
from app.models.booking import Booking
from app.models.capture import Capture
from app.models.session import ObservationSession

logger = logging.getLogger(__name__)

MEDIAMTX_RTSP_URL = os.getenv("MEDIAMTX_RTSP_URL", "rtsp://mediamtx:8554/telescope-camera")
FRAME_GRAB_TIMEOUT = int(os.getenv("FRAME_GRAB_TIMEOUT", "15"))
HEADLESS_SETTLE_SECONDS = int(os.getenv("HEADLESS_SETTLE_SECONDS", "5"))
HEADLESS_SLEW_TIMEOUT = int(os.getenv("HEADLESS_SLEW_TIMEOUT", "120"))

scheduler: BackgroundScheduler = None


class FrameGrabError(Exception):
    pass


def init_scheduler(app) -> None:
    global scheduler
    scheduler = BackgroundScheduler(daemon=True)
    scheduler.start()
    atexit.register(lambda: scheduler.shutdown(wait=False))
    schedule_all_upcoming(app)
    logger.info("Headless runner scheduler started")


def schedule_headless_booking(booking_id: str, scheduled_start: datetime) -> None:
    if scheduler is None:
        logger.warning("Scheduler not initialised; cannot schedule headless booking %s", booking_id)
        return
    from flask import current_app
    scheduler.add_job(
        func=_run_headless_job,
        trigger="date",
        run_date=scheduled_start,
        id=f"headless_{booking_id}",
        replace_existing=True,
        kwargs={"booking_id": booking_id, "app": current_app._get_current_object()},
        misfire_grace_time=300,
    )
    logger.info("Scheduled headless job for booking %s at %s", booking_id, scheduled_start)


def schedule_all_upcoming(app) -> None:
    now = datetime.now(timezone.utc)
    with app.app_context():
        with get_db() as db:
            rows = (
                db.query(Booking)
                .filter(
                    Booking.headless == True,
                    Booking.status == "confirmed",
                    Booking.scheduled_start > now,
                )
                .all()
            )
        for booking in rows:
            if scheduler is None:
                break
            scheduler.add_job(
                func=_run_headless_job,
                trigger="date",
                run_date=booking.scheduled_start,
                id=f"headless_{booking.id}",
                replace_existing=True,
                kwargs={"booking_id": str(booking.id), "app": app},
                misfire_grace_time=300,
            )
            logger.info(
                "Re-registered headless job for booking %s at %s",
                booking.id,
                booking.scheduled_start,
            )


def unschedule_headless_booking(booking_id: str) -> None:
    if scheduler is None:
        return
    try:
        scheduler.remove_job(f"headless_{booking_id}")
        logger.info("Removed headless job for booking %s", booking_id)
    except JobLookupError:
        pass


# ---------------------------------------------------------------------------
# Job entrypoint
# ---------------------------------------------------------------------------

def _run_headless_job(booking_id: str, app) -> None:
    with app.app_context():
        try:
            _execute(booking_id)
        except Exception:
            logger.exception("Fatal error in headless job for booking %s", booking_id)
            try:
                alpaca_client.park()
            except Exception:
                pass


def _execute(booking_id: str) -> None:
    with get_db() as db:
        booking = db.query(Booking).filter(Booking.id == booking_id).first()
        if not booking:
            logger.error("Headless job: booking %s not found", booking_id)
            return
        if not booking.headless or booking.status != "confirmed":
            logger.info(
                "Headless job: booking %s skipped (headless=%s status=%s)",
                booking_id, booking.headless, booking.status,
            )
            return

        # a. Safety check
        safety = SafetyManager().get_current_status()
        if safety["status"] != "ACTIVE":
            logger.error(
                "Headless job %s: safety not ACTIVE (%s — %s), aborting",
                booking_id, safety["status"], safety.get("reason"),
            )
            return

        # b. Create session
        try:
            obs = _create_headless_session(db, booking)
        except ValueError as e:
            logger.error("Headless job %s: could not create session — %s", booking_id, e)
            return

        # Prepare telescope
        try:
            alpaca_client.unpark()
            alpaca_client.set_connected(True)
            alpaca_client.set_tracking(True)
        except Exception as e:
            logger.error("Headless job %s: telescope setup failed — %s", booking_id, e)
            _end_run(db, obs, booking, completed=False)
            return

        targets = (booking.targets or {}).get("celestialObjects", [])
        capture_settings = (booking.targets or {}).get("captureSettings", {})

        # c. Process targets
        for target in targets:
            # Re-check safety before each slew
            mid_safety = SafetyManager().get_current_status()
            if mid_safety["status"] != "ACTIVE":
                logger.warning(
                    "Headless job %s: safety went %s mid-run, parking",
                    booking_id, mid_safety["status"],
                )
                try:
                    alpaca_client.park()
                except Exception:
                    pass
                _end_run(db, obs, booking, completed=False)
                return

            obj_name = target.get("name", "Unknown")
            try:
                ra = _parse_ra(str(target.get("ra", "0")))
                dec = _parse_dec(str(target.get("dec", "0")))
            except ValueError as e:
                logger.warning("Headless job %s: bad coordinates for %s — %s, skipping", booking_id, obj_name, e)
                continue

            # c.1 Slew
            try:
                alpaca_client.slew_to_coordinates(ra, dec)
            except Exception as e:
                logger.warning("Headless job %s: slew failed for %s — %s, skipping", booking_id, obj_name, e)
                continue

            # c.1 Wait for slew completion
            slew_done = alpaca_client.wait_for_slew_complete(timeout=HEADLESS_SLEW_TIMEOUT)
            if not slew_done:
                logger.warning("Headless job %s: slew timeout for %s, skipping", booking_id, obj_name)
                continue

            # c.2 Settle
            time.sleep(HEADLESS_SETTLE_SECONDS)

            # c.3 Grab frame
            dt = datetime.now(timezone.utc)
            ts_part = dt.strftime("%Y%m%dT%H%M%S")
            cap_uuid = uuid.uuid4()
            root = _captures_root()
            dest_dir = os.path.join(root, dt.strftime("%Y"), dt.strftime("%m"), dt.strftime("%d"), _safe_slug(obj_name))
            os.makedirs(dest_dir, exist_ok=True)

            try:
                img_path = _grab_frame(obj_name, dest_dir, ts_part, cap_uuid)
            except FrameGrabError as e:
                logger.warning("Headless job %s: frame grab failed for %s — %s", booking_id, obj_name, e)
                continue

            # c.4–5 Save capture + metadata
            try:
                coords = alpaca_client.get_coordinates()
            except Exception:
                coords = {"ra": ra, "dec": dec, "alt": None, "az": None}

            try:
                _save_capture(db, obs, booking, obj_name, img_path, coords, dt, cap_uuid, dest_dir, ts_part, root)
            except Exception as e:
                logger.error("Headless job %s: failed to save capture for %s — %s", booking_id, obj_name, e)

        # d. Park telescope
        try:
            alpaca_client.park()
        except Exception as e:
            logger.error("Headless job %s: park failed — %s", booking_id, e)

        # e. End session
        _end_run(db, obs, booking, completed=True)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _create_headless_session(db, booking) -> ObservationSession:
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

    existing = (
        db.query(ObservationSession)
        .filter(
            ObservationSession.teacher_id == str(booking.teacher_id),
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
        teacher_id=str(booking.teacher_id),
        session_code=generate_session_code(),
        booking_id=booking.id,
        status="active",
    )
    db.add(obs)
    db.flush()
    return obs


def _grab_frame(object_name: str, dest_dir: str, ts_part: str, cap_uuid: uuid.UUID) -> str:
    img_name = f"{ts_part}_{cap_uuid}.jpg"
    img_path = os.path.join(dest_dir, img_name)
    cmd = [
        "ffmpeg", "-y",
        "-rtsp_transport", "tcp",
        "-i", MEDIAMTX_RTSP_URL,
        "-frames:v", "1",
        "-q:v", "2",
        img_path,
    ]
    try:
        subprocess.run(
            cmd,
            timeout=FRAME_GRAB_TIMEOUT,
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
        )
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as e:
        raise FrameGrabError(str(e)) from e
    return img_path


def _save_capture(
    db, obs: ObservationSession, booking: Booking,
    object_name: str, img_path: str, coords: dict,
    dt: datetime, cap_uuid: uuid.UUID,
    dest_dir: str, ts_part: str, root: str,
) -> None:
    img_name = os.path.basename(img_path)
    meta_name = f"{ts_part}_{cap_uuid}.json"
    meta_path = os.path.join(dest_dir, meta_name)

    meta = {
        "id": str(cap_uuid),
        "objectName": object_name,
        "timestamp": dt.isoformat(),
        "coordinates": {
            "ra": coords.get("ra"),
            "dec": coords.get("dec"),
            "alt": coords.get("alt"),
            "az": coords.get("az"),
        },
        "file": img_name,
        "relativeDir": os.path.relpath(dest_dir, root),
        "capturedBy": "teacher",
        "capturedByTeacherId": str(booking.teacher_id),
        "capturedByTeacherName": None,
        "capturedByStudentSessionId": None,
        "capturedByStudentName": None,
        "observationSessionId": str(obs.id),
    }
    with open(meta_path, "w", encoding="utf-8") as fh:
        json.dump(meta, fh, indent=2)

    file_size = os.path.getsize(img_path) if os.path.exists(img_path) else None
    db.add(Capture(
        id=cap_uuid,
        captured_by_teacher_id=str(booking.teacher_id),
        captured_by_student_session_id=None,
        captured_by_name=None,
        observation_session_id=obs.id,
        file_path=img_path,
        object_name=object_name,
        coordinates=meta["coordinates"],
        captured_at=dt,
        file_size_bytes=file_size,
    ))
    db.flush()


def _end_run(db, obs: ObservationSession, booking: Booking, completed: bool) -> None:
    obs.status = "ended"
    obs.ended_at = datetime.now(timezone.utc)
    if completed:
        booking.status = "completed"
    db.commit()
    logger.info(
        "Headless run for booking %s ended (completed=%s)", booking.id, completed
    )


def _captures_root() -> str:
    root = os.getenv("CAPTURES_DIR", "/data/captures")
    os.makedirs(root, exist_ok=True)
    return root


def _safe_slug(s: str) -> str:
    s = s.strip().lower()
    s = re.sub(r"[^a-z0-9\-_.]+", "-", s)
    s = re.sub(r"-{2,}", "-", s).strip("-")
    return s or "unnamed"


def _parse_ra(ra_str: str) -> float:
    """Parse RA string 'HH:MM:SS' or decimal string to decimal hours (0–24)."""
    ra_str = ra_str.strip()
    if ":" in ra_str:
        parts = ra_str.split(":")
        h, m, s = int(parts[0]), int(parts[1]), float(parts[2]) if len(parts) > 2 else 0.0
        return h + m / 60.0 + s / 3600.0
    return float(ra_str)


def _parse_dec(dec_str: str) -> float:
    """Parse Dec string '±DD:MM:SS' or decimal string to decimal degrees (-90–90)."""
    dec_str = dec_str.strip()
    if ":" in dec_str:
        negative = dec_str.startswith("-")
        parts = dec_str.lstrip("+-").split(":")
        d, m, s = int(parts[0]), int(parts[1]), float(parts[2]) if len(parts) > 2 else 0.0
        val = d + m / 60.0 + s / 3600.0
        return -val if negative else val
    return float(dec_str)
