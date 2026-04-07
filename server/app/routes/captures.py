import os, json, time, uuid, re
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, send_from_directory, current_app, abort

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
def upload_capture():
    """
    multipart/form-data:
      - file: image/png or image/jpeg
      - objectName: string
      - ra, dec, alt, az: floats (optional but recommended)
      - timestamp: ISO string (optional; server will set if missing)
    """
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
        "relativeDir": os.path.relpath(dest_dir, root)
    }
    with open(meta_path, "w", encoding="utf-8") as fh:
        json.dump(meta, fh, indent=2)

    return jsonify({
        "success": True,
        "id": cap_id,
        "downloadUrl": f"/api/captures/{cap_id}/download"
    }), 201

def _walk_captures():
    root = _captures_root()
    for base, _, files in os.walk(root):
        for fn in files:
            if fn.endswith(".json"):
                yield os.path.join(base, fn)

@captures_bp.route("", methods=["GET"])
def list_captures():
    """Return a flat list of captures (can add filters later)."""
    items = []
    for meta_path in _walk_captures():
        try:
            with open(meta_path, "r", encoding="utf-8") as fh:
                meta = json.load(fh)
            items.append(meta)
        except Exception as e:
            current_app.logger.warning(f"Failed reading {meta_path}: {e}")
    # newest first
    items.sort(key=lambda x: x.get("timestamp",""), reverse=True)
    return jsonify({"items": items})

@captures_bp.route("/<cap_id>/download", methods=["GET"])
def download_capture(cap_id: str):
    """Send the image as attachment by id."""
    # find meta
    for meta_path in _walk_captures():
        try:
            with open(meta_path, "r", encoding="utf-8") as fh:
                meta = json.load(fh)
            if meta.get("id") == cap_id:
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
