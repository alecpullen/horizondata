import os, json, time, uuid, re
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, send_from_directory, current_app, abort, g

from app.middleware.auth import require_auth, require_any_auth
from app.services.database import get_db
from app.services.rate_limiter import check_capture_limit
from app.services.student_session_manager import get_student_session_manager
from app.services.alpaca_client import alpaca_client
from app.models.capture import Capture

captures_bp = Blueprint("captures", __name__, url_prefix="/api/captures")

def _safe_slug(s: str) -> str:
    s = s.strip().lower()
    s = re.sub(r"[^a-z0-9\-_.]+", "-", s)
    s = re.sub(r"-{2,}", "-", s).strip("-")
    return s or "unnamed"

def _captures_root() -> str:
    root = os.getenv("CAPTURES_DIR", "/data/captures")
    os.makedirs(root, exist_ok=True)
    return root

@captures_bp.route("", methods=["POST"])
@require_any_auth
def upload_capture():
    """
    multipart/form-data:
      - file: image/png or image/jpeg
      - objectName: string
      - ra, dec, alt, az: floats (optional but recommended)
      - timestamp: ISO string (optional; server will set if missing)
    
    Headers (one of):
      - Authorization: Bearer <teacher_token>
      - X-Session-ID: <student_session_id>
    
    Students are rate limited to 5 captures per minute.
    """
    # Check rate limiting for students
    if g.user_type == 'student':
        if not check_capture_limit(g.session_id, max_per_minute=5):
            return jsonify({
                'error': 'rate_limited',
                'message': 'Capture rate limit exceeded. Maximum 5 captures per minute.',
                'retry_after': 60
            }), 429
    
    if "file" not in request.files:
        return jsonify({"message": "file is required"}), 400

    f = request.files["file"]
    if not f.filename:
        return jsonify({"message": "file has no filename"}), 400

    object_name = request.form.get("objectName", "Unknown")
    # Get ACTUAL telescope coordinates at capture time
    try:
        coords = alpaca_client.get_coordinates()
        ra = str(coords['ra'])
        dec = str(coords['dec'])
        alt = str(coords['alt'])
        az = str(coords['az'])
    except Exception as e:
        current_app.logger.warning(f"Could not get telescope coordinates: {e}")
        # Fallback to form data if telescope query fails
        ra = request.form.get("ra")
        dec = request.form.get("dec")
        alt = request.form.get("alt")
        az = request.form.get("az")
    ts = request.form.get("timestamp")
    observation_session_id = request.form.get("observationSessionId")

    # timestamp
    if ts:
        try:
            dt = datetime.fromisoformat(ts.replace("Z","+00:00"))
        except:
            dt = datetime.now(timezone.utc)
    else:
        dt = datetime.now(timezone.utc)

    # directory structure: /data/captures/YYYY/MM/DD/<object-slug>/
    y = dt.strftime("%Y"); m = dt.strftime("%m"); d = dt.strftime("%d")
    obj_slug = _safe_slug(object_name)
    root = _captures_root()
    dest_dir = os.path.join(root, y, m, d, obj_slug)
    os.makedirs(dest_dir, exist_ok=True)

    # ids & filenames
    cap_uuid = uuid.uuid4()
    cap_id = str(cap_uuid)
    ts_part = dt.strftime("%Y%m%dT%H%M%S")
    ext = ".png" if (f.mimetype == "image/png" or f.filename.lower().endswith(".png")) else ".jpg"
    img_name = f"{ts_part}_{cap_id}{ext}"
    meta_name = f"{ts_part}_{cap_id}.json"

    img_path = os.path.join(dest_dir, img_name)
    meta_path = os.path.join(dest_dir, meta_name)

    # save image
    f.save(img_path)

    # Determine who captured this
    captured_by_teacher = g.user_type == 'teacher'
    teacher_id = g.user.get('id') if captured_by_teacher else None
    teacher_name = g.user.get('name') if captured_by_teacher else None
    student_session_id = g.session_id if not captured_by_teacher else None
    
    # Get student's display name if student captured
    student_display_name = None
    if not captured_by_teacher and student_session_id:
        try:
            session_manager = get_student_session_manager()
            session = session_manager.validate_session(student_session_id)
            if session:
                student_display_name = session.get('display_name')
        except Exception as e:
            current_app.logger.warning(f"Could not get student display name: {e}")

    # save metadata sidecar
    meta = {
        "id": cap_id,
        "objectName": object_name,
        "timestamp": dt.isoformat(),
        "coordinates": {
            "ra": float(ra) if ra else None,
            "dec": float(dec) if dec else None,
            "alt": float(alt) if alt else None,
            "az": float(az) if az else None,
        },
        "file": img_name,
        "relativeDir": os.path.relpath(dest_dir, root),
        "capturedBy": "teacher" if captured_by_teacher else "student",
        "capturedByTeacherId": teacher_id,
        "capturedByTeacherName": teacher_name,  # NEW: Teacher's name
        "capturedByStudentSessionId": student_session_id,
        "capturedByStudentName": student_display_name,  # NEW: Student's display name
        "observationSessionId": observation_session_id
    }
    with open(meta_path, "w", encoding="utf-8") as fh:
        json.dump(meta, fh, indent=2)

    # persist to DB
    try:
        obs_uuid = uuid.UUID(observation_session_id) if observation_session_id else None
        with get_db() as db:
            db.add(Capture(
                id=cap_uuid,
                captured_by_teacher_id=teacher_id,
                captured_by_student_session_id=student_session_id,
                observation_session_id=obs_uuid,
                file_path=img_path,
                object_name=object_name,
                coordinates=meta["coordinates"],
                captured_at=dt,
            ))
    except Exception as e:
        current_app.logger.error(f"Failed to persist capture to DB: {e}")

    return jsonify({
        "success": True,
        "id": cap_id,
        "downloadUrl": f"/api/captures/{cap_id}/download",
        "capturedBy": "teacher" if captured_by_teacher else "student"
    }), 201

def _is_teachers_session(teacher_id, session_id, db):
    """Check if a session belongs to this teacher's bookings"""
    from app.models.session import ObservationSession
    from app.models.booking import Booking
    
    session = db.query(ObservationSession).filter(
        ObservationSession.id == session_id
    ).first()
    
    if not session or not session.booking_id:
        return False
    
    booking = db.query(Booking).filter(
        Booking.id == session.booking_id,
        Booking.teacher_id == teacher_id
    ).first()
    
    return booking is not None

def _walk_captures():
    root = _captures_root()
    for base, _, files in os.walk(root):
        for fn in files:
            if fn.endswith(".json"):
                yield os.path.join(base, fn)

@captures_bp.route("", methods=["GET"])
@require_any_auth
def list_captures():
    """
    Return a list of captures.
    
    Teachers: see only captures from their sessions/bookings
    Students: see only their own captures
    
    Optional query param: ?sessionId=<id> to filter by session
    """
    items = []
    user_type = g.user_type
    teacher_id = g.user.get('id') if user_type == 'teacher' else None
    
    # Get sessionId filter from query params
    filter_session_id = request.args.get("sessionId")
    
    with get_db() as db:
        from app.models.capture import Capture
        
        # Build query
        query = db.query(Capture)
        
        if user_type == 'teacher':
            query = query.filter(Capture.captured_by_teacher_id == str(teacher_id))
        elif user_type == 'student':
            query = query.filter(Capture.captured_by_student_session_id == g.session_id)

        if filter_session_id:
            query = query.filter(Capture.observation_session_id == filter_session_id)

        captures = query.order_by(Capture.captured_at.desc()).all()
        
        for capture in captures:
            items.append(capture.to_dict())
    
    return jsonify({"items": items})

@captures_bp.route("/<cap_id>/download", methods=["GET"])
@require_any_auth
def download_capture(cap_id: str):
    """
    Send the image as attachment by id.
    
    Students can only download their own captures.
    Teachers can download any capture.
    """
    user_type = g.user_type
    
    # find meta
    for meta_path in _walk_captures():
        try:
            with open(meta_path, "r", encoding="utf-8") as fh:
                meta = json.load(fh)
            
            if meta.get("id") == cap_id:
                # Check permissions for students
                if user_type == 'student':
                    if meta.get('capturedByStudentSessionId') != g.session_id:
                        abort(403, "You can only download your own captures")
                
                root = _captures_root()
                rel = meta["relativeDir"]
                img = meta["file"]
                return send_from_directory(
                    directory=os.path.join(root, rel),
                    path=img,
                    as_attachment=True
                )
        except Exception as e:
            current_app.logger.warning(f"Lookup error: {e}")
    abort(404)


@captures_bp.route("/<cap_id>/metadata", methods=["GET"])
@require_any_auth
def download_capture_metadata(cap_id: str):
    """
    Send the JSON metadata sidecar as attachment by capture id.

    Students can only download metadata for their own captures.
    Teachers can download any capture's metadata.
    """
    user_type = g.user_type

    for meta_path in _walk_captures():
        try:
            with open(meta_path, "r", encoding="utf-8") as fh:
                meta = json.load(fh)

            if meta.get("id") == cap_id:
                if user_type == 'student':
                    if meta.get('capturedByStudentSessionId') != g.session_id:
                        abort(403, "You can only download your own captures")

                root = _captures_root()
                rel = meta["relativeDir"]
                json_file = meta["file"].rsplit(".", 1)[0] + ".json"
                return send_from_directory(
                    directory=os.path.join(root, rel),
                    path=json_file,
                    as_attachment=True,
                    mimetype="application/json"
                )
        except Exception as e:
            current_app.logger.warning(f"Metadata lookup error: {e}")
    abort(404)
