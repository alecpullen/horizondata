"""
Rate Limiter Service

Provides rate limiting for student operations, primarily image captures.
Uses in-memory sliding window for tracking.
"""

import time
import logging
from typing import Dict, Optional
from dataclasses import dataclass, field
from threading import Lock

logger = logging.getLogger(__name__)


@dataclass
class RateLimitEntry:
    """Tracks rate limit state for a client"""
    requests: list = field(default_factory=list)  # List of timestamps
    window_start: float = field(default_factory=time.time)


class RateLimiter:
    """
    In-memory rate limiter using sliding window.
    
    Thread-safe singleton that tracks request rates per client.
    Automatically cleans up expired entries.
    """
    
    _instance: Optional['RateLimiter'] = None
    _lock: Lock = Lock()
    
    # Default limits
    DEFAULT_CAPTURE_LIMIT = 5  # captures per minute for students
    DEFAULT_WINDOW_SECONDS = 60  # 1 minute window
    
    def __new__(cls) -> 'RateLimiter':
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
            
        self._limits: Dict[str, RateLimitEntry] = {}
        self._lock = Lock()
        self._initialized = True
        logger.info("RateLimiter initialized")
    
    def _clean_expired(self, window_seconds: float):
        """Remove expired entries from tracking"""
        now = time.time()
        cutoff = now - window_seconds
        
        for key, entry in list(self._limits.items()):
            # Remove old timestamps
            entry.requests = [ts for ts in entry.requests if ts > cutoff]
            
            # Remove empty entries
            if not entry.requests:
                del self._limits[key]
    
    def check_limit(self, key: str, max_requests: int, window_seconds: float = None) -> bool:
        """
        Check if a request is within rate limit.
        
        Args:
            key: Unique identifier (e.g., student session ID)
            max_requests: Maximum requests allowed in window
            window_seconds: Time window (default: 60 seconds)
            
        Returns:
            True if request is allowed, False if rate limited
        """
        if window_seconds is None:
            window_seconds = self.DEFAULT_WINDOW_SECONDS
        
        now = time.time()
        
        with self._lock:
            # Clean up periodically (1% chance per check)
            if hash(key) % 100 == 0:
                self._clean_expired(window_seconds)
            
            # Get or create entry
            entry = self._limits.get(key)
            if entry is None:
                entry = RateLimitEntry()
                self._limits[key] = entry
            
            # Remove expired timestamps
            cutoff = now - window_seconds
            entry.requests = [ts for ts in entry.requests if ts > cutoff]
            
            # Check limit
            if len(entry.requests) >= max_requests:
                logger.warning(f"Rate limit exceeded for {key}: {len(entry.requests)} requests in {window_seconds}s")
                return False
            
            # Record this request
            entry.requests.append(now)
            return True
    
    def get_remaining(self, key: str, max_requests: int, window_seconds: float = None) -> int:
        """
        Get remaining requests in current window.
        
        Args:
            key: Unique identifier
            max_requests: Maximum requests allowed
            window_seconds: Time window
            
        Returns:
            Number of remaining requests
        """
        if window_seconds is None:
            window_seconds = self.DEFAULT_WINDOW_SECONDS
        
        now = time.time()
        
        with self._lock:
            entry = self._limits.get(key)
            if entry is None:
                return max_requests
            
            cutoff = now - window_seconds
            valid_requests = [ts for ts in entry.requests if ts > cutoff]
            
            return max(0, max_requests - len(valid_requests))
    
    def reset(self, key: str):
        """
        Reset rate limit for a key.
        
        Args:
            key: Unique identifier to reset
        """
        with self._lock:
            if key in self._limits:
                del self._limits[key]
                logger.info(f"Rate limit reset for {key}")


# Capture-specific rate limiting
def check_capture_limit(student_session_id: str, max_per_minute: int = 5) -> bool:
    """
    Check if a student can make a capture.
    
    Args:
        student_session_id: Student's session ID
        max_per_minute: Maximum captures per minute (default: 5)
        
    Returns:
        True if capture is allowed
    """
    limiter = RateLimiter()
    key = f"capture:{student_session_id}"
    return limiter.check_limit(key, max_per_minute, window_seconds=60)


def get_capture_remaining(student_session_id: str, max_per_minute: int = 5) -> int:
    """
    Get remaining captures for a student.
    
    Args:
        student_session_id: Student's session ID
        max_per_minute: Maximum captures per minute
        
    Returns:
        Number of remaining captures
    """
    limiter = RateLimiter()
    key = f"capture:{student_session_id}"
    return limiter.get_remaining(key, max_per_minute, window_seconds=60)


# Singleton accessor
def get_rate_limiter() -> RateLimiter:
    """Get the singleton RateLimiter instance"""
    return RateLimiter()
