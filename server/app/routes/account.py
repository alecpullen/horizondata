"""
Account Routes

Handles account profile endpoints for teachers.
These routes are at /api/account (not /api/auth) to match frontend expectations.
"""

import logging
from flask import Blueprint, request, jsonify, g

from app.middleware.auth import require_auth

logger = logging.getLogger(__name__)

account_bp = Blueprint('account', __name__, url_prefix='/api')


@account_bp.route('/account', methods=['GET'])
@require_auth(roles=['teacher'])
def get_account():
    """
    Get current teacher account profile.
    Returns profile data in format expected by MyAccount.jsx frontend.

    Headers:
        Authorization: Bearer <token>

    Returns:
        {
            "fullName": "...",
            "email": "...",
            "phone": "",
            "institution": "",
            "is2FAEnabled": false,
            "notificationsEnabled": true
        }
    """
    user = g.user
    return jsonify({
        'fullName': user.get('name', ''),
        'email': user.get('email', ''),
        'phone': '',  # Extended profile fields not stored in user model
        'institution': '',
        'is2FAEnabled': False,
        'notificationsEnabled': True,
    })


@account_bp.route('/account', methods=['PUT'])
@require_auth(roles=['teacher'])
def update_account():
    """
    Update current teacher account profile.
    Updates name in database. Extended fields (phone, institution, etc.)
    are accepted but not persisted (would need additional storage).

    Headers:
        Authorization: Bearer <token>

    Request Body:
        {
            "fullName": "...",
            "email": "...",
            "phone": "...",
            "institution": "...",
            "is2FAEnabled": false,
            "notificationsEnabled": true
        }

    Returns:
        {
            "success": true,
            "profile": { ...updated profile... }
        }
    """
    data = request.get_json()
    if not data:
        return jsonify({'error': 'invalid_request', 'message': 'Request body required'}), 400

    try:
        from app.services.database import get_db
        from app.models.user import User

        with get_db() as db:
            user = db.query(User).filter_by(id=g.user['id']).first()
            if not user:
                return jsonify({'error': 'not_found', 'message': 'User not found'}), 404

            name = data.get('fullName', '').strip()
            if name:
                user.username = name
                
            institution = data.get('institution', '').strip()
            if institution:
                user.institution = institution
                
            db.commit()

        # Return updated profile
        return jsonify({
            'success': True,
            'profile': {
                'fullName': name or g.user.get('name', ''),
                'email': data.get('email', g.user.get('email', '')),
                'phone': data.get('phone', ''),
                'institution': institution or g.user.get('institution', ''),
                'is2FAEnabled': data.get('is2FAEnabled', False),
                'notificationsEnabled': data.get('notificationsEnabled', True),
            }
        })

    except Exception as e:
        logger.error(f"Error updating account: {e}")
        return jsonify({'error': 'internal_error', 'message': 'Failed to update account'}), 500
