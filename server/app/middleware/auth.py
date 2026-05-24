"""
Authentication Middleware

Unified authentication and authorization middleware for Flask.
Handles both teacher (JWT token) and student (session ID) authentication.
"""

import logging
from functools import wraps
from flask import request, g, jsonify
from typing import Optional, List, Callable

from app.services.student_session_manager import get_student_session_manager

logger = logging.getLogger(__name__)


def extract_bearer_token() -> Optional[str]:
    """Extract Bearer token from Authorization header"""
    auth_header = request.headers.get('Authorization', '')
    if auth_header.startswith('Bearer '):
        return auth_header[7:]  # Remove 'Bearer ' prefix
    return None


def extract_session_id() -> Optional[str]:
    """Extract student session ID from X-Session-ID header"""
    return request.headers.get('X-Session-ID')


def validate_teacher() -> Optional[dict]:
    """
    Validate a teacher's session token using flask_jwt_extended.
    """
    from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity
    from flask_jwt_extended.exceptions import JWTExtendedException

    try:
        verify_jwt_in_request()
        user_id = get_jwt_identity()
        
        from app.services.database import get_db
        from app.models.user import User
        
        with get_db() as db:
            user = db.query(User).filter_by(id=user_id).first()
            if not user or user.is_active is False:
                return None
            
            # Determine role directly from user model
            role = user.role if user.role else "teacher"
            user_type = role

            return {
                "id": str(user.id),
                "email": user.email,
                "name": user.username or user.email,
                "role": role,
                "user_type": user_type,
            }
    except JWTExtendedException as e:
        logger.warning(f"JWT validation failed: {e}")
        return None
    except Exception as e:
        logger.error(f"Error validating teacher token: {e}")
        return None


def invalidate_token(jti: str) -> None:
    """Add a token's JTI to the blocklist."""
    try:
        from app.services.database import get_db
        from app.models.token_blocklist import TokenBlocklist
        with get_db() as db:
            db.add(TokenBlocklist(jti=jti))
            db.commit()
    except Exception as e:
        logger.warning(f"Could not add JTI to blocklist during logout: {e}")


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
            bearer_token = None
            session_id = None

            # Try teacher authentication (Bearer token)
            bearer_token = extract_bearer_token()
            if bearer_token:
                user = validate_teacher()
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
                
                # Check if role is allowed (admins inherit all teacher privileges)
                is_allowed = user_role in roles or (user_role == 'admin' and 'teacher' in roles)
                if not is_allowed:
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


def require_admin(f: Callable) -> Callable:
    """Shortcut decorator for admin-only routes.
    
    All /api/admin routes should use this decorator.
    """
    return require_auth(roles=['admin'])(f)


def is_admin() -> bool:
    """Check if current user is an admin"""
    user = get_current_user()
    return user is not None and user.get('role') == 'admin'
