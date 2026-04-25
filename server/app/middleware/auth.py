"""
Authentication Middleware

Unified authentication and authorization middleware for Flask.
Handles both teacher (BetterAuth token) and student (session ID) authentication.
"""

import hashlib
import logging
import threading
from functools import wraps
from flask import request, g, jsonify
from typing import Optional, List, Callable
from cachetools import TTLCache

from app.services.neon_auth_client import get_neon_auth_client, NeonAuthError
from app.services.student_session_manager import get_student_session_manager

logger = logging.getLogger(__name__)

# Cache validated teacher tokens for 60 s to avoid a live HTTP call on every request.
# Key: sha256(token) — avoids storing raw bearer tokens in memory.
_token_cache: TTLCache = TTLCache(maxsize=512, ttl=60)
_token_cache_lock = threading.Lock()


def extract_bearer_token() -> Optional[str]:
    """Extract Bearer token from Authorization header"""
    auth_header = request.headers.get('Authorization', '')
    if auth_header.startswith('Bearer '):
        return auth_header[7:]  # Remove 'Bearer ' prefix
    return None


def extract_session_id() -> Optional[str]:
    """Extract student session ID from X-Session-ID header"""
    return request.headers.get('X-Session-ID')


def validate_teacher(token: str) -> Optional[dict]:
    """
    Validate a teacher's Bearer token with Neon Auth.
    Results are cached for 60 s (keyed on sha256 of the token) to avoid
    a live HTTP round-trip on every protected request.

    Args:
        token: Bearer token

    Returns:
        User dict if valid, None otherwise
    """
    cache_key = hashlib.sha256(token.encode()).hexdigest()

    with _token_cache_lock:
        cached = _token_cache.get(cache_key)
    if cached is not None:
        return cached

    try:
        client = get_neon_auth_client()
        session = client.get_session(token)

        if session and session.get('user'):
            user = session['user']
            result = {
                'id': user.get('id'),
                'email': user.get('email'),
                'name': user.get('name'),
                'role': user.get('role', 'teacher'),
                'user_type': 'teacher'
            }
            with _token_cache_lock:
                _token_cache[cache_key] = result
            return result
        return None

    except NeonAuthError as e:
        logger.warning(f"Token validation failed: {e.message}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error validating teacher token: {e}")
        return None


def validate_student(session_id: str) -> Optional[dict]:
    """
    Validate a student's session ID.
    
    Args:
        session_id: Student session ID
        
    Returns:
        Student dict if valid, None otherwise
    """
    try:
        manager = get_student_session_manager()
        session = manager.validate_session(session_id)
        return session
    except Exception as e:
        logger.error(f"Unexpected error validating student session: {e}")
        return None


def require_auth(roles: Optional[List[str]] = None):
    """
    Decorator to require authentication for a route.
    
    Supports both teacher (Bearer token) and student (X-Session-ID) authentication.
    
    Args:
        roles: List of allowed roles (e.g., ['teacher'], ['teacher', 'student'])
              If None, any authenticated user is allowed.
              
    Usage:
        @app.route('/api/protected')
        @require_auth(roles=['teacher'])
        def protected_route():
            # g.user contains authenticated user info
            # g.user_type is 'teacher' or 'student'
            return jsonify({'message': f'Hello {g.user["name"]}'})
    """
    def decorator(f: Callable) -> Callable:
        @wraps(f)
        def decorated_function(*args, **kwargs):
            user = None
            user_type = None
            
            # Try teacher authentication (Bearer token)
            bearer_token = extract_bearer_token()
            if bearer_token:
                user = validate_teacher(bearer_token)
                if user:
                    user_type = 'teacher'
            
            # Try student authentication (Session ID) if no teacher auth
            if user is None:
                session_id = extract_session_id()
                if session_id:
                    user = validate_student(session_id)
                    if user:
                        user_type = 'student'
            
            # Check if authentication succeeded
            if user is None:
                return jsonify({
                    'error': 'unauthorized',
                    'message': 'Authentication required. Provide Bearer token or X-Session-ID header.'
                }), 401
            
            # Check role permissions
            if roles is not None:
                # Get user's role
                if user_type == 'teacher':
                    user_role = user.get('role', 'teacher')
                else:
                    user_role = 'student'
                
                # Check if role is allowed
                if user_role not in roles:
                    return jsonify({
                        'error': 'forbidden',
                        'message': f'Insufficient permissions. Required: {", ".join(roles)}'
                    }), 403
            
            # Store user info in Flask g context
            g.user = user
            g.user_type = user_type
            g.auth_token = bearer_token if user_type == 'teacher' else None
            g.session_id = session_id if user_type == 'student' else None
            
            # Call the actual route function
            return f(*args, **kwargs)
        
        return decorated_function
    return decorator


def require_teacher(f: Callable) -> Callable:
    """Shortcut decorator for teacher-only routes"""
    return require_auth(roles=['teacher'])(f)


def require_any_auth(f: Callable) -> Callable:
    """Shortcut decorator for routes allowing any authenticated user"""
    return require_auth(roles=['teacher', 'student'])(f)


def get_current_user() -> Optional[dict]:
    """Get current authenticated user from Flask g context"""
    return getattr(g, 'user', None)


def get_current_user_type() -> Optional[str]:
    """Get current user type ('teacher' or 'student') from Flask g context"""
    return getattr(g, 'user_type', None)


def is_teacher() -> bool:
    """Check if current user is a teacher"""
    return get_current_user_type() == 'teacher'


def is_student() -> bool:
    """Check if current user is a student"""
    return get_current_user_type() == 'student'
