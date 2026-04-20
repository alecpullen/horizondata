import os, json, time, uuid, re
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, send_from_directory, current_app, abort, g

from app.middleware.auth import require_auth, require_any_auth
from app.services.rate_limiter import check_capture_limit
from app.services.student_session_manager import get_student_session_manager

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
    cap_id = uuid.uuid4().hex[:12]
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
    student_session_id = g.session_id if not captured_by_teacher else None

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
        "capturedByStudentSessionId": student_session_id,
        "observationSessionId": observation_session_id
    }
    with open(meta_path, "w", encoding="utf-8") as fh:
        json.dump(meta, fh, indent=2)

    # Store in database for student captures (attribution)
    if not captured_by_teacher and student_session_id and observation_session_id:
        try:
            # Get student display name
            session_manager = get_student_session_manager()
            session_data = session_manager.validate_session(student_session_id)
            if session_data:
                # Store in database
                import psycopg2
                from psycopg2.extras import RealDictCursor
                
                db_url = os.getenv('DATABASE_URL')
                if db_url:
                    conn = psycopg2.connect(db_url)
                    with conn.cursor() as cur:
                        cur.execute(
                            """
                            INSERT INTO app.captures 
                            (id, captured_by_student_session_id, observation_session_id, file_path, 
                             object_name, coordinates, captured_at)
                            VALUES (%s, %s, %s, %s, %s, %s, %s)
                            """,
                            (cap_id, student_session_id, observation_session_id, img_path,
                             object_name, json.dumps(meta['coordinates']), dt)
                        )
                    conn.commit()
                    conn.close()
        except Exception as e:
            current_app.logger.warning(f"Failed to store capture metadata in DB: {e}")

    return jsonify({
        "success": True,
        "id": cap_id,
        "downloadUrl": f"/api/captures/{cap_id}/download",
        "capturedBy": "teacher" if captured_by_teacher else "student"
    }), 201

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
    
    Teachers: see all captures in their observation sessions
    Students: see only their own captures
    """
    items = []
    user_type = g.user_type
    
    for meta_path in _walk_captures():
        try:
            with open(meta_path, "r", encoding="utf-8") as fh:
                meta = json.load(fh)
            
            # Filter based on user type
            if user_type == 'student':
                # Students only see their own captures
                if meta.get('capturedByStudentSessionId') != g.session_id:
                    continue
            
            items.append(meta)
        except Exception as e:
            current_app.logger.warning(f"Failed reading {meta_path}: {e}")
    
    # newest first
    items.sort(key=lambda x: x.get("timestamp",""), reverse=True)
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
