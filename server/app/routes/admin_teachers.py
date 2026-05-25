"""
Admin API Routes for teacher management
"""

import logging
from flask import Blueprint, request, jsonify, g

from app.middleware.auth import require_auth
from app.services.database import get_db
from app.models.user import User

logger = logging.getLogger(__name__)

admin_teachers_bp = Blueprint("admin_teachers", __name__, url_prefix="/api/admin/teachers")


@admin_teachers_bp.route("", methods=["GET"])
@require_auth(roles=["admin"])
def list_teachers():
    """
    Get paginated list of teachers.
    
    Query params:
        page: int (default 1)
        limit: int (default 20, max 100)
    
    Returns:
        {
            "items": [
                {"id": 1, "name": "...", "email": "...", "account_status": "pending", "created_at": "..."}
            ],
            "total": 100,
            "page": 1,
            "limit": 20
        }
    """
    try:
        page = request.args.get("page", 1, type=int)
        limit = min(request.args.get("limit", 20, type=int), 100)
        
        with get_db() as db:
            total = db.query(User).filter(User.role == "teacher").count()
            offset = (page - 1) * limit
            users = (
                db.query(User)
                .filter(User.role == "teacher")
                .order_by(User.created_at.desc())
                .offset(offset)
                .limit(limit)
                .all()
            )
            items = [
                {
                    "id": user.id,
                    "name": user.username or user.institution or "Unknown",
                    "email": user.email,
                    "account_status": user.account_status,
                    "email_verified": user.email_verified,
                    "created_at": user.created_at.isoformat() if user.created_at else None,
                }
                for user in users
            ]
        
        return jsonify({
            "items": items,
            "total": total,
            "page": page,
            "limit": limit
        })
    
    except Exception as e:
        logger.error(f"Error listing teachers: {e}")
        return jsonify({"error": "internal_error", "message": "Failed to list teachers"}), 500


@admin_teachers_bp.route("/<int:teacher_id>", methods=["PATCH"])
@require_auth(roles=["admin"])
def update_teacher_status(teacher_id):
    """
    Update teacher account status.
    
    Body: {"status": "approved" | "suspended"}
    
    Returns updated record.
    """
    data = request.get_json()
    if not data:
        return jsonify({"error": "invalid_request", "message": "Request body required"}), 400

    new_status = data.get("status")
    new_email_verified = data.get("email_verified")

    if new_status is None and new_email_verified is None:
        return jsonify({"error": "validation_error", "message": "Provide 'status' or 'email_verified'"}), 400
    if new_status is not None and new_status not in ["approved", "suspended", "pending"]:
        return jsonify({"error": "validation_error", "message": "status must be 'approved', 'suspended', or 'pending'"}), 400
    if new_email_verified is not None and not isinstance(new_email_verified, bool):
        return jsonify({"error": "validation_error", "message": "email_verified must be a boolean"}), 400

    try:
        with get_db() as db:
            user = db.query(User).filter(User.id == teacher_id).first()

            if not user:
                return jsonify({"error": "not_found", "message": "Teacher not found"}), 404

            if new_status is not None:
                user.account_status = new_status
                logger.info(f"Teacher {teacher_id} status updated to {new_status} by admin {g.user['id']}")
            if new_email_verified is not None:
                user.email_verified = new_email_verified
                logger.info(f"Teacher {teacher_id} email_verified set to {new_email_verified} by admin {g.user['id']}")

            db.commit()

            return jsonify({
                "id": user.id,
                "name": user.username or user.institution or "Unknown",
                "email": user.email,
                "account_status": user.account_status,
                "email_verified": user.email_verified,
                "created_at": user.created_at.isoformat() if user.created_at else None,
            })
    
    except Exception as e:
        logger.error(f"Error updating teacher status: {e}")
        return jsonify({"error": "internal_error", "message": "Failed to update teacher status"}), 500