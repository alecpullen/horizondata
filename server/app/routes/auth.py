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

from app.services.student_session_manager import get_student_session_manager
from app.services.rate_limiter import check_capture_limit, get_capture_remaining, check_join_limit, get_join_remaining
from app.services.session_codes import generate_session_code
from app.middleware.auth import require_auth, invalidate_token
from app.models.booking import Booking
from app.services.token_service import (
    generate_reset_token, verify_reset_token,
    generate_verify_token, verify_email_token,
)
from app.services.email_service import send_password_reset_email, send_verification_email

from flask_jwt_extended import (
    create_access_token, 
    create_refresh_token, 
    jwt_required, 
    get_jwt_identity, 
    get_jwt
)

import uuid as _uuid

from app.services.database import get_db
from app.models.session import ObservationSession

logger = logging.getLogger(__name__)

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')


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
        from app.models.user import User
        with get_db() as db:
            if db.query(User).filter_by(email=email).first():
                return jsonify({'error': 'email_exists', 'message': 'An account with this email already exists'}), 409
            
            new_user = User(
                email=email,
                username=name,
                account_status="approved", # Automatically approve for this example
                external_id=str(_uuid.uuid4())
            )
            new_user.set_password(password)
            db.add(new_user)
            db.commit()
            
            user_id_str = str(new_user.id)
            user_dict = new_user.to_dict()
            user_dict['role'] = new_user.role
            user_dict['name'] = new_user.username
            
        access_token = create_access_token(identity=user_id_str)
        refresh_token = create_refresh_token(identity=user_id_str)

        # Send verification email (silently skipped if email is disabled in settings)
        try:
            verify_token = generate_verify_token(new_user)
            send_verification_email(new_user, verify_token)
        except Exception as email_err:
            logger.warning(f"Failed to send verification email after signup: {email_err}")

        return jsonify({
            'success': True,
            'user': user_dict,
            'token': access_token,
            'refresh_token': refresh_token
        }), 201

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
        from app.models.user import User
        with get_db() as db:
            user = db.query(User).filter_by(email=email).first()
            if not user or not user.check_password(password):
                return jsonify({'error': 'invalid_credentials', 'message': 'Invalid email or password'}), 401
            if user.account_status == "pending":
                return jsonify({'error': 'account_pending', 'message': 'Your account is pending administrator approval'}), 403
            if not user.email_verified:
                return jsonify({'error': 'email_not_verified', 'message': 'Please verify your email address before logging in.'}), 403
            
            user_id_str = str(user.id)
            user_dict = user.to_dict()
            user_dict['role'] = user.role
            user_dict['name'] = user.username

        access_token = create_access_token(identity=user_id_str)
        refresh_token = create_refresh_token(identity=user_id_str)

        return jsonify({
            'success': True,
            'user': user_dict,
            'token': access_token,
            'refresh_token': refresh_token
        })
        
    except Exception as e:
        logger.error(f"Unexpected error during teacher login: {e}")
        return jsonify({'error': 'internal_error', 'message': 'Login failed'}), 500


@auth_bp.route('/teacher/logout', methods=['POST'])
@jwt_required()
def teacher_logout():
    """
    Log out a teacher by blocklisting their JWT JTI.
    """
    try:
        jti = get_jwt()["jti"]
        invalidate_token(jti)
    except Exception as e:
        logger.warning(f"Error during logout (non-fatal): {e}")

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


@auth_bp.route('/teacher/change-password', methods=['POST'])
@require_auth(roles=['teacher'])
def teacher_change_password():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'invalid_request', 'message': 'Request body required'}), 400

    current_password = data.get('current_password', '')
    new_password = data.get('new_password', '')

    if not current_password:
        return jsonify({'error': 'validation_error', 'message': 'Current password is required'}), 400
    if not new_password or len(new_password) < 8:
        return jsonify({'error': 'validation_error', 'message': 'New password must be at least 8 characters'}), 400

    try:
        from app.models.user import User
        with get_db() as db:
            user = db.query(User).filter_by(id=g.user['id']).first()
            if not user or not user.check_password(current_password):
                return jsonify({'error': 'password_change_failed', 'message': 'Incorrect current password or password change failed'}), 400
                
            user.set_password(new_password)
            db.commit()
            
        return jsonify({'success': True})
    except Exception as e:
        logger.error(f"Unexpected error during password change: {e}")
        return jsonify({'error': 'internal_error', 'message': 'Password change failed'}), 500


@auth_bp.route('/teacher/refresh', methods=['POST'])
@jwt_required(refresh=True)
def teacher_refresh():
    """
    Refresh access token.
    """
    try:
        user_id = get_jwt_identity()
        old_jti = get_jwt()["jti"]
        access_token = create_access_token(identity=user_id)
        new_refresh_token = create_refresh_token(identity=user_id)
        
        invalidate_token(old_jti)
        
        return jsonify({
            'success': True,
            'token': access_token,
            'refresh_token': new_refresh_token,
        })
    except Exception as e:
        logger.error(f"Error refreshing token: {e}")
        return jsonify({'error': 'internal_error', 'message': 'Token refresh failed'}), 500


# ============================================================================
# Password Reset Routes
# ============================================================================

@auth_bp.route('/forgot-password', methods=['POST'])
def forgot_password():
    """
    Trigger a password-reset email.

    Always returns 200 regardless of whether the email exists to prevent
    email enumeration.

    Body: { "email": "..." }
    """
    data = request.get_json() or {}
    email = (data.get('email') or '').strip().lower()

    if not email:
        return jsonify({'error': 'validation_error', 'message': 'Email is required'}), 400

    try:
        from app.models.user import User
        with get_db() as db:
            user = db.query(User).filter_by(email=email).first()

        if user:
            try:
                token = generate_reset_token(user)
                send_password_reset_email(user, token)
            except Exception as e:
                logger.warning(f"Failed to send password reset email to {email}: {e}")

    except Exception as e:
        logger.error(f"Error during forgot-password for {email}: {e}")

    return jsonify({'success': True, 'message': 'If that email exists, a reset link has been sent.'})


@auth_bp.route('/reset-password', methods=['POST'])
def reset_password():
    """
    Apply a new password using a signed reset token.

    Body: { "token": "...", "new_password": "..." }
    """
    data = request.get_json() or {}
    token = (data.get('token') or '').strip()
    new_password = data.get('new_password') or ''

    if not token:
        return jsonify({'error': 'validation_error', 'message': 'token is required'}), 400
    if not new_password or len(new_password) < 8:
        return jsonify({'error': 'validation_error', 'message': 'Password must be at least 8 characters'}), 400

    try:
        email, ph_fragment = verify_reset_token(token)
    except ValueError as e:
        code = 'expired_token' if str(e) == 'expired' else 'invalid_token'
        return jsonify({'error': code, 'message': 'This reset link is invalid or has expired.'}), 400

    try:
        from app.models.user import User
        with get_db() as db:
            user = db.query(User).filter_by(email=email).first()
            if not user:
                return jsonify({'error': 'invalid_token', 'message': 'This reset link is invalid or has expired.'}), 400

            # Token is single-use: the embedded password fragment must still match
            if not user.hashed_password or len(user.hashed_password) < 16:
                return jsonify({'error': 'invalid_token', 'message': 'This reset link is invalid or has expired.'}), 400
            if user.hashed_password[-16:] != ph_fragment:
                return jsonify({'error': 'invalid_token', 'message': 'This reset link has already been used.'}), 400

            user.set_password(new_password)

        return jsonify({'success': True})

    except Exception as e:
        logger.error(f"Error during reset-password: {e}")
        return jsonify({'error': 'internal_error', 'message': 'Password reset failed'}), 500


@auth_bp.route('/verify-email', methods=['GET'])
def verify_email():
    """
    Verify an email address using the signed token from the verification email.

    Query param: ?token=<signed_token>
    """
    token = (request.args.get('token') or '').strip()
    if not token:
        return jsonify({'error': 'validation_error', 'message': 'token query parameter is required'}), 400

    try:
        email = verify_email_token(token)
    except ValueError as e:
        code = 'expired_token' if str(e) == 'expired' else 'invalid_token'
        return jsonify({'error': code, 'message': 'This verification link is invalid or has expired.'}), 400

    try:
        from app.models.user import User
        with get_db() as db:
            user = db.query(User).filter_by(email=email).first()
            if not user:
                return jsonify({'error': 'invalid_token', 'message': 'This verification link is invalid.'}), 400

            if user.email_verified:
                return jsonify({'error': 'already_verified', 'message': 'This email address has already been verified.'}), 400

            user.email_verified = True

        return jsonify({'success': True, 'message': 'Email verified successfully.'})

    except Exception as e:
        logger.error(f"Error during verify-email: {e}")
        return jsonify({'error': 'internal_error', 'message': 'Email verification failed'}), 500


@auth_bp.route('/resend-verification', methods=['POST'])
def resend_verification():
    """
    Re-send an email verification link.

    Always returns 200 to prevent email enumeration.
    Silently skips if user is already verified or email sending is disabled.

    Body: { "email": "..." }
    """
    data = request.get_json() or {}
    email = (data.get('email') or '').strip().lower()

    if not email:
        return jsonify({'error': 'validation_error', 'message': 'Email is required'}), 400

    try:
        from app.models.user import User
        with get_db() as db:
            user = db.query(User).filter_by(email=email).first()
            if user and not user.email_verified:
                try:
                    token = generate_verify_token(user)
                    send_verification_email(user, token)
                except Exception as e:
                    logger.warning(f"Failed to resend verification email to {email}: {e}")

    except Exception as e:
        logger.error(f"Error during resend-verification for {email}: {e}")

    return jsonify({'success': True, 'message': 'If that email exists and is unverified, a new link has been sent.'})


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


@auth_bp.route('/student/session-info', methods=['GET'])
@require_auth(roles=['student'])
def student_session_info():
    """
    Get current student's session info including observation session status and booking title.

    Headers:
        X-Session-ID: <student_session_id>

    Returns:
        {
            "success": true,
            "status": "active" | "ended" | ...,
            "booking_title": "Mars Observation",
            "user": { "display_name": "Alex" }
        }
    """
    observation_session_id = g.user.get('observation_session_id')

    try:
        with get_db() as db:
            obs = db.query(ObservationSession).filter(
                ObservationSession.id == _uuid.UUID(observation_session_id)
            ).first()

            if not obs:
                return jsonify({'success': True, 'status': 'ended', 'booking_title': None,
                                'user': {'display_name': g.user.get('display_name')}})

            booking_title = None
            if obs.booking_id:
                booking = db.query(Booking).filter(Booking.id == obs.booking_id).first()
                booking_title = booking.title if booking else None

        return jsonify({
            'success': True,
            'status': obs.status,
            'booking_title': booking_title,
            'user': {'display_name': g.user.get('display_name')},
        })

    except Exception as e:
        logger.error(f"Error getting student session info: {e}")
        return jsonify({'error': 'internal_error', 'message': 'Failed to get session info'}), 500


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
        return jsonify({'error': 'internal_error', 'message': 'Failed to leave session'}), 500


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
# Account Profile Routes
# ============================================================================

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
