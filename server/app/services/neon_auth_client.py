"""
Neon Auth Client Service

HTTP client for communicating with Neon Auth (BetterAuth) API.
All teacher authentication flows go through this client.
"""

import os
import logging
import requests
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)


class NeonAuthError(Exception):
    """Base exception for Neon Auth errors"""
    def __init__(self, message: str, status_code: Optional[int] = None, error_code: Optional[str] = None):
        self.message = message
        self.status_code = status_code
        self.error_code = error_code
        super().__init__(message)


class NeonAuthClient:
    """
    Client for Neon Auth API (BetterAuth).
    
    Handles all teacher authentication operations:
    - Sign up
    - Sign in
    - Session validation
    - Token refresh
    - Sign out
    """
    
    def __init__(self, base_url: Optional[str] = None, api_key: Optional[str] = None):
        self.base_url = base_url or os.getenv('NEON_AUTH_URL', 'http://localhost:3000/api/auth')
        self.api_key = api_key or os.getenv('NEON_AUTH_API_KEY')
        self.timeout = 10
        
    def _make_request(self, method: str, endpoint: str, data: Optional[Dict] = None, 
                      headers: Optional[Dict] = None) -> Dict[str, Any]:
        """Make HTTP request to Neon Auth API"""
        url = f"{self.base_url}{endpoint}"
        
        request_headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
        if self.api_key:
            request_headers['Authorization'] = f'Bearer {self.api_key}'
        if headers:
            request_headers.update(headers)
            
        try:
            response = requests.request(
                method=method,
                url=url,
                json=data,
                headers=request_headers,
                timeout=self.timeout
            )
            
            # Parse response
            if response.content:
                try:
                    result = response.json()
                except ValueError:
                    result = {'message': response.text}
            else:
                result = {}
                
            # Handle errors
            if not response.ok:
                error_msg = result.get('message', result.get('error', 'Unknown error'))
                logger.warning(f"Neon Auth error: {response.status_code} - {error_msg}")
                raise NeonAuthError(
                    message=error_msg,
                    status_code=response.status_code,
                    error_code=result.get('code')
                )
                
            return result
            
        except requests.Timeout:
            logger.error(f"Neon Auth request timed out: {url}")
            raise NeonAuthError("Authentication service timeout", status_code=504)
        except requests.RequestException as e:
            logger.error(f"Neon Auth request failed: {e}")
            raise NeonAuthError("Authentication service unavailable", status_code=503)
    
    def sign_up(self, email: str, password: str, name: str, role: str = "teacher") -> Dict[str, Any]:
        """
        Register a new teacher account.
        
        Args:
            email: Teacher's email address
            password: Password (will be hashed by Neon Auth)
            name: Display name
            role: User role (default: teacher)
            
        Returns:
            Dict with user data and tokens
        """
        data = {
            'email': email,
            'password': password,
            'name': name,
            'role': role,
            'callbackURL': '/dashboard'  # Redirect after email verification
        }
        
        result = self._make_request('POST', '/sign-up/email', data)
        logger.info(f"Teacher registered: {email}")
        return result
    
    def sign_in(self, email: str, password: str) -> Dict[str, Any]:
        """
        Authenticate a teacher.
        
        Args:
            email: Teacher's email
            password: Password
            
        Returns:
            Dict with user data, token, and refresh token
        """
        data = {
            'email': email,
            'password': password,
            'rememberMe': True
        }
        
        result = self._make_request('POST', '/sign-in/email', data)
        logger.info(f"Teacher logged in: {email}")
        return result
    
    def get_session(self, token: str) -> Optional[Dict[str, Any]]:
        """
        Validate a session token and get user info.
        
        Args:
            token: Bearer token from Authorization header
            
        Returns:
            User session data or None if invalid
        """
        try:
            result = self._make_request(
                'GET', 
                '/get-session',
                headers={'Authorization': f'Bearer {token}'}
            )
            return result
        except NeonAuthError as e:
            if e.status_code == 401:
                return None
            raise
    
    def sign_out(self, token: str) -> bool:
        """
        Invalidate a session.
        
        Args:
            token: Bearer token to invalidate
            
        Returns:
            True if successful
        """
        try:
            self._make_request(
                'POST',
                '/sign-out',
                headers={'Authorization': f'Bearer {token}'}
            )
            logger.info("Teacher logged out")
            return True
        except NeonAuthError:
            return False
    
    def refresh_token(self, refresh_token: str) -> Dict[str, Any]:
        """
        Refresh an access token.
        
        Args:
            refresh_token: Refresh token from sign-in response
            
        Returns:
            New tokens
        """
        data = {'refreshToken': refresh_token}
        return self._make_request('POST', '/refresh-token', data)
    
    def update_user(self, token: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Update user profile.
        
        Args:
            token: Bearer token
            data: Fields to update (name, image, etc.)
            
        Returns:
            Updated user data
        """
        return self._make_request(
            'POST',
            '/update-user',
            data,
            headers={'Authorization': f'Bearer {token}'}
        )
    
    def change_password(self, token: str, current_password: str, new_password: str) -> bool:
        """
        Change user password.
        
        Args:
            token: Bearer token
            current_password: Current password
            new_password: New password
            
        Returns:
            True if successful
        """
        data = {
            'currentPassword': current_password,
            'newPassword': new_password
        }
        
        try:
            self._make_request(
                'POST',
                '/change-password',
                data,
                headers={'Authorization': f'Bearer {token}'}
            )
            return True
        except NeonAuthError:
            return False


# Singleton instance
_neon_auth_client: Optional[NeonAuthClient] = None


def get_neon_auth_client() -> NeonAuthClient:
    """Get or create singleton Neon Auth client"""
    global _neon_auth_client
    if _neon_auth_client is None:
        _neon_auth_client = NeonAuthClient()
    return _neon_auth_client
