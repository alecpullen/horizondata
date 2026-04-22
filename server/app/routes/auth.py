"""
Authentication Routes

Handles all authentication endpoints:
- Teacher signup, login, logout, refresh
- Student join, leave, status
- Teacher session management (kick, list participants)
"""

import logging
from flask import Blueprint, request, jsonify, g
from datetime import datetime

from app.services.neon_auth_client import get_neon_auth_client, NeonAuthError
from app.services.student_session_manager import get_student_session_manager
from app.services.rate_limiter import check_capture_limit, get_capture_remaining
from app.middleware.auth import require_auth, require_teacher, require_any_auth
from app.services.neon_auth_client import NeonAuthClient

import uuid as _uuid

from app.services.database import get_db
from app.models.session import ObservationSession

logger = logging.getLogger(__name__)

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')


def generate_session_code() -> str:
    """Generate a unique 6-character session code"""
    import random
    import string
    
    # Generate random 6-character alphanumeric code
    while True:
        code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
        
        try:
            with get_db() as db:
                exists = db.query(ObservationSession).filter(
                    ObservationSession.session_code == code,
                    ObservationSession.status == "active",
                ).first()
                if not exists:
                    return code
        except Exception as e:
            logger.error(f"Error checking session code: {e}")
            return code


# ============================================================================
# Teacher Authentication Routes
# ============================================================================

@auth_bp.route('/teacher/signup', methods=['POST'])
def teacher_signup():
    """
    Register a new teacher account.
    
    Request Body:
        {
            "email": "teacher@example.com",
            "password": "securepassword",
            "name": "John Doe"
        }
    
    Returns:
        {
            "success": true,
            "user": {
                "id": "...",
                "email": "...",
                "name": "...",
                "role": "teacher"
            },
            "token": "...",
            "refresh_token": "..."
        }
    """
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'invalid_request', 'message': 'Request body required'}), 400
    
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    name = data.get('name', '').strip()
    
    # Validation
    if not email:
        return jsonify({'error': 'validation_error', 'message': 'Email is required'}), 400
    if not password or len(password) < 8:
        return jsonify({'error': 'validation_error', 'message': 'Password must be at least 8 characters'}), 400
    if not name:
        return jsonify({'error': 'validation_error', 'message': 'Name is required'}), 400
    
    try:
        client = get_neon_auth_client()
        result = client.sign_up(email, password, name, role='teacher')
        
        return jsonify({
            'success': True,
            'user': result.get('user'),
            'token': result.get('token'),
            'refresh_token': result.get('refreshToken')
        }), 201
        
    except NeonAuthError as e:
        if e.status_code == 409 or 'already exists' in e.message.lower():
            return jsonify({'error': 'email_exists', 'message': 'An account with this email already exists'}), 409
        return jsonify({'error': 'auth_error', 'message': e.message}), e.status_code or 500
    except Exception as e:
        logger.error(f"Unexpected error during teacher signup: {e}")
        return jsonify({'error': 'internal_error', 'message': 'Registration failed'}), 500


@auth_bp.route('/teacher/login', methods=['POST'])
def teacher_login():
    """
    Authenticate a teacher.
    
    Request Body:
        {
            "email": "teacher@example.com",
            "password": "securepassword"
        }
    
    Returns:
        {
            "success": true,
            "user": {
                "id": "...",
                "email": "...",
                "name": "...",
                "role": "teacher"
            },
            "token": "...",
            "refresh_token": "..."
        }
    """
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'invalid_request', 'message': 'Request body required'}), 400
    
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    
    if not email or not password:
        return jsonify({'error': 'validation_error', 'message': 'Email and password are required'}), 400
    
    try:
        client = get_neon_auth_client()
        result = client.sign_in(email, password)
        
        return jsonify({
            'success': True,
            'user': result.get('user'),
            'token': result.get('token'),
            'refresh_token': result.get('refreshToken')
        })
        
    except NeonAuthError as e:
        if e.status_code == 401:
            return jsonify({'error': 'invalid_credentials', 'message': 'Invalid email or password'}), 401
        return jsonify({'error': 'auth_error', 'message': e.message}), e.status_code or 500
    except Exception as e:
        logger.error(f"Unexpected error during teacher login: {e}")
        return jsonify({'error': 'internal_error', 'message': 'Login failed'}), 500


@auth_bp.route('/teacher/logout', methods=['POST'])
@require_auth(roles=['teacher'])
def teacher_logout():
    """
    Log out a teacher.
    
    Headers:
        Authorization: Bearer <token>
    
    Returns:
        {"success": true}
    """
    try:
        token = g.auth_token
        if token:
            client = get_neon_auth_client()
            client.sign_out(token)
        
        return jsonify({'success': True})
        
    except Exception as e:
        logger.error(f"Error during logout: {e}")
        # Still return success - client should clear token anyway
        return jsonify({'success': True})


@auth_bp.route('/teacher/me', methods=['GET'])
@require_auth(roles=['teacher'])
def teacher_me():
    """
    Get current teacher info.
    
    Headers:
        Authorization: Bearer <token>
    
    Returns:
        {
            "user": {
                "id": "...",
                "email": "...",
                "name": "...",
                "role": "teacher"
            }
        }
    """
    return jsonify({
        'success': True,
        'user': g.user
    })


@auth_bp.route('/teacher/refresh', methods=['POST'])
def teacher_refresh():
    """
    Refresh access token.
    
    Request Body:
        {
            "refresh_token": "..."
        }
    
    Returns:
        {
            "success": true,
            "token": "...",
            "refresh_token": "..."
        }
    """
    data = request.get_json()
    
    if not data or not data.get('refresh_token'):
        return jsonify({'error': 'invalid_request', 'message': 'Refresh token required'}), 400
    
    try:
        client = get_neon_auth_client()
        result = client.refresh_token(data['refresh_token'])
        
        return jsonify({
            'success': True,
            'token': result.get('token'),
            'refresh_token': result.get('refreshToken')
        })
        
    except NeonAuthError as e:
        return jsonify({'error': 'invalid_token', 'message': 'Invalid or expired refresh token'}), 401
    except Exception as e:
        logger.error(f"Error refreshing token: {e}")
        return jsonify({'error': 'internal_error', 'message': 'Token refresh failed'}), 500


# ============================================================================
# Student Session Routes
# ============================================================================

@auth_bp.route('/student/join', methods=['POST'])
def student_join():
    """
    Join an observation session as a student.
    
    Request Body:
        {
            "display_name": "Student Alex",
            "session_code": "ABC123"
        }
    
    Returns:
        {
            "success": true,
            "session_id": "...",
            "display_name": "Student Alex",
            "observation_session_id": "..."
        }
    """
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'invalid_request', 'message': 'Request body required'}), 400
    
    display_name = data.get('display_name', '').strip()
    session_code = data.get('session_code', '').strip().upper()
    
    # Validation
    if not display_name:
        return jsonify({'error': 'validation_error', 'message': 'Display name is required'}), 400
    if len(display_name) > 50:
        return jsonify({'error': 'validation_error', 'message': 'Display name must be 50 characters or less'}), 400
    if not session_code:
        return jsonify({'error': 'validation_error', 'message': 'Session code is required'}), 400
    
    try:
        with get_db() as db:
            obs_session = db.query(ObservationSession).filter(
                ObservationSession.session_code == session_code,
                ObservationSession.status == "active",
            ).first()

        if not obs_session:
            return jsonify({
                'error': 'session_not_found',
                'message': 'Session not found or has ended. Please check the session code.'
            }), 404

        manager = get_student_session_manager()
        student_session_id = manager.create_session(
            display_name=display_name,
            observation_session_id=str(obs_session.id),
        )
        
        return jsonify({
            'success': True,
            'session_id': student_session_id,
            'display_name': display_name,
            'observation_session_id': str(obs_session.id)
        }), 201
        
    except Exception as e:
        logger.error(f"Error during student join: {e}")
        return jsonify({'error': 'internal_error', 'message': 'Failed to join session'}), 500


@auth_bp.route('/student/leave', methods=['POST'])
@require_auth(roles=['student'])
def student_leave():
    """
    Leave the observation session voluntarily.
    
    Headers:
        X-Session-ID: <student_session_id>
    
    Returns:
        {"success": true}
    """
    try:
        session_id = g.session_id
        manager = get_student_session_manager()
        manager.end_session(session_id)
        
        return jsonify({'success': True})
        
    except Exception as e:
        logger.error(f"Error during student leave: {e}")
        return jsonify({'success': True})  # Still return success


@auth_bp.route('/student/me', methods=['GET'])
@require_auth(roles=['student'])
def student_me():
    """
    Get current student session info.
    
    Headers:
        X-Session-ID: <student_session_id>
    
    Returns:
        {
            "user": {
                "id": "...",
                "display_name": "...",
                "observation_session_id": "...",
                "user_type": "student"
            },
            "rate_limits": {
                "captures_remaining": 5
            }
        }
    """
    # Get remaining captures
    remaining = get_capture_remaining(g.session_id, max_per_minute=5)
    
    return jsonify({
        'success': True,
        'user': g.user,
        'rate_limits': {
            'captures_remaining': remaining
        }
    })


# ============================================================================
# Teacher Session Management Routes
# ============================================================================

@auth_bp.route('/teacher/participants', methods=['GET'])
@require_auth(roles=['teacher'])
def list_participants():
    """
    List all active students in the current observation session.
    
    Headers:
        Authorization: Bearer <token>
    
    Query Params:
        observation_session_id: UUID of the observation session
    
    Returns:
        {
            "success": true,
            "participants": [
                {
                    "id": "...",
                    "display_name": "Student Alex",
                    "joined_at": "2024-01-15T10:30:00Z"
                }
            ],
            "count": 1
        }
    """
    observation_session_id = request.args.get('observation_session_id')
    
    if not observation_session_id:
        return jsonify({'error': 'validation_error', 'message': 'observation_session_id query parameter required'}), 400
    
    try:
        with get_db() as db:
            obs_session = db.query(ObservationSession).filter(
                ObservationSession.id == _uuid.UUID(observation_session_id)
            ).first()

        if not obs_session:
            return jsonify({'error': 'not_found', 'message': 'Observation session not found'}), 404

        if str(obs_session.teacher_id) != str(g.user.get('id')):
            return jsonify({'error': 'forbidden', 'message': 'You do not own this session'}), 403
        
        # Get participants
        manager = get_student_session_manager()
        participants = manager.list_participants(observation_session_id)
        
        return jsonify({
            'success': True,
            'participants': participants,
            'count': len(participants)
        })
        
    except Exception as e:
        logger.error(f"Error listing participants: {e}")
        return jsonify({'error': 'internal_error', 'message': 'Failed to list participants'}), 500


@auth_bp.route('/teacher/kick', methods=['POST'])
@require_auth(roles=['teacher'])
def kick_student():
    """
    Kick a student from the observation session.
    
    Headers:
        Authorization: Bearer <token>
    
    Request Body:
        {
            "student_session_id": "...",
            "reason": "Misbehavior"  // optional
        }
    
    Returns:
        {"success": true}
    """
    data = request.get_json()
    
    if not data or not data.get('student_session_id'):
        return jsonify({'error': 'validation_error', 'message': 'student_session_id required'}), 400
    
    student_session_id = data.get('student_session_id')
    reason = data.get('reason', 'Kicked by teacher')
    
    try:
        # Get student's session info
        manager = get_student_session_manager()
        session = manager.validate_session(student_session_id)
        
        if not session:
            return jsonify({'error': 'not_found', 'message': 'Student session not found or already ended'}), 404
        
        observation_session_id = session['observation_session_id']

        with get_db() as db:
            obs_session = db.query(ObservationSession).filter(
                ObservationSession.id == _uuid.UUID(observation_session_id)
            ).first()

        if not obs_session:
            return jsonify({'error': 'not_found', 'message': 'Observation session not found'}), 404

        if str(obs_session.teacher_id) != str(g.user.get('id')):
            return jsonify({'error': 'forbidden', 'message': 'You do not own this session'}), 403
        
        # Kick the student
        manager.kick_student(student_session_id, reason)
        
        return jsonify({
            'success': True,
            'message': f'Student kicked: {reason}'
        })
        
    except Exception as e:
        logger.error(f"Error kicking student: {e}")
        return jsonify({'error': 'internal_error', 'message': 'Failed to kick student'}), 500


# ============================================================================
# Rate Limit Check Route (for UI display)
# ============================================================================

@auth_bp.route('/rate-limit/captures', methods=['GET'])
@require_auth(roles=['student'])
def get_capture_rate_limit():
    """
    Get current capture rate limit status.
    
    Headers:
        X-Session-ID: <student_session_id>
    
    Returns:
        {
            "success": true,
            "limit": 5,
            "remaining": 3,
            "window_seconds": 60
        }
    """
    remaining = get_capture_remaining(g.session_id, max_per_minute=5)
    
    return jsonify({
        'success': True,
        'limit': 5,
        'remaining': remaining,
        'window_seconds': 60
    })
