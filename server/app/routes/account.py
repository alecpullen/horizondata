"""
Account Routes

Handles account profile endpoints for teachers.
These routes are at /api/account (not /api/auth) to match frontend expectations.
"""

import logging
from flask import Blueprint, request, jsonify, g

from app.services.neon_auth_client import get_neon_auth_client, NeonAuthError
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
        'phone': '',  # Extended profile fields not stored in Neon Auth
        'institution': '',
        'is2FAEnabled': False,
        'notificationsEnabled': True,
    })


@account_bp.route('/account', methods=['PUT'])
@require_auth(roles=['teacher'])
def update_account():
    """
    Update current teacher account profile.
    Updates name in Neon Auth. Extended fields (phone, institution, etc.)
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
        client = get_neon_auth_client()
        token = g.auth_token

        # Update name in Neon Auth if provided
        name = data.get('fullName', '').strip()
        if name:
            client.update_user(token, {'name': name})

        # Note: Extended fields (phone, institution, is2FAEnabled, notificationsEnabled)
        # are not persisted as they require additional storage beyond Neon Auth.
        # They are accepted for API compatibility and returned in the response.

        # Return updated profile
        return jsonify({
            'success': True,
            'profile': {
                'fullName': name or g.user.get('name', ''),
                'email': data.get('email', g.user.get('email', '')),
                'phone': data.get('phone', ''),
                'institution': data.get('institution', ''),
                'is2FAEnabled': data.get('is2FAEnabled', False),
                'notificationsEnabled': data.get('notificationsEnabled', True),
            }
        })

    except NeonAuthError as e:
        return jsonify({'error': 'auth_error', 'message': e.message}), e.status_code or 500
    except Exception as e:
        logger.error(f"Error updating account: {e}")
        return jsonify({'error': 'internal_error', 'message': 'Failed to update account'}), 500
