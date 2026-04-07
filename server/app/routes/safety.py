"""
Safety API Routes

This module provides REST API endpoints for the telescope safety system,
exposing safety status, viewing windows, and weather conditions.

Requirements addressed: 1.5, 2.4
"""

from flask import Blueprint, jsonify
from app.services.safety_manager import SafetyManager
from app.services.weather_safety import WeatherSafetyService
import logging

logger = logging.getLogger(__name__)

# Create blueprint for safety routes
safety_bp = Blueprint('safety', __name__, url_prefix='/api/safety')

# Initialize safety manager
safety_manager = SafetyManager()
weather_service = WeatherSafetyService()


def create_error_response(error_code: str, message: str, status_code: int = 500):
    """Create standardized error response"""
    return jsonify({'error': error_code, 'message': message}), status_code


@safety_bp.route('/status', methods=['GET'])
def get_safety_status():
    """
    Get current safety status of the telescope system.
    
    Returns:
        JSON response containing:
        - status: Current safety status (ACTIVE/UNSAFE/CLOSED)
        - reason: Explanation of the current status
        - next_available: Next available time (if applicable)
        - current_time: Current Melbourne time
        - viewing_window: Current viewing window information
    """
    try:
        status_data = safety_manager.get_current_status()
        return jsonify(status_data)
    except Exception as e:
        logger.error(f"Error getting safety status: {e}")
        return create_error_response('safety_error', 'Failed to determine safety status')


@safety_bp.route('/viewing-window', methods=['GET'])
def get_viewing_window():
    """
    Get current and next viewing window information.
    
    Returns:
        JSON response containing:
        - current: Today's viewing window with start, end, and isActive
        - next: Tomorrow's viewing window with start and end
        - sunrise: Today's sunrise time
        - sunset: Today's sunset time
        - isDaylightSaving: Whether DST is currently active
        - timeZone: Current timezone (AEST/AEDT)
    """
    try:
        current_time = safety_manager.time_service.get_melbourne_time()
        current_date = current_time.date()
        
        # Get current viewing window
        current_window_start, current_window_end = safety_manager.time_service.get_viewing_window(current_date)
        
        # Get next day's viewing window
        from datetime import timedelta
        next_date = current_date + timedelta(days=1)
        next_window_start, next_window_end = safety_manager.time_service.get_viewing_window(next_date)
        
        # Check if currently active
        is_active = safety_manager.is_viewing_window_active()
        
        # Get sun times for today
        import pytz
        from astral import LocationInfo
        from astral.sun import sun
        
        melbourne_tz = pytz.timezone('Australia/Melbourne')
        melbourne_location = LocationInfo("Melbourne", "Australia", "Australia/Melbourne", -37.8136, 144.9631)
        
        sun_times = sun(melbourne_location.observer, date=current_date, tzinfo=melbourne_tz)
        
        # Check if DST is active
        is_dst = current_time.dst().total_seconds() > 0
        timezone_name = "AEDT" if is_dst else "AEST"
        
        return jsonify({
            'current': {
                'start': current_window_start.isoformat(),
                'end': current_window_end.isoformat(),
                'isActive': is_active
            },
            'next': {
                'start': next_window_start.isoformat(),
                'end': next_window_end.isoformat()
            },
            'sunrise': sun_times['sunrise'].isoformat(),
            'sunset': sun_times['sunset'].isoformat(),
            'isDaylightSaving': is_dst,
            'timeZone': timezone_name
        })
    except Exception as e:
        logger.error(f"Error getting viewing window: {e}")
        return create_error_response('viewing_window_error', 'Failed to get viewing window information')


@safety_bp.route('/next-available', methods=['GET'])
def get_next_available_time():
    """
    Get the next time when telescope operations will be available.
    
    Returns:
        JSON response containing:
        - next_available: Next available time for telescope operations
        - reason: Explanation of why system is currently unavailable (if applicable)
        - melbourne_time: Current Melbourne time
    """
    try:
        current_status = safety_manager.get_current_status()
        
        if current_status['status'] == 'ACTIVE':
            return jsonify({
                'next_available': None,
                'reason': 'System is currently available',
                'melbourne_time': current_status['current_time']
            })
        
        next_available = None
        if current_status['status'] == 'CLOSED':
            # For time-based closures, we can predict next availability
            next_available = safety_manager.get_next_viewing_window().isoformat()
        
        return jsonify({
            'next_available': next_available,
            'reason': current_status['reason'],
            'melbourne_time': current_status['current_time']
        })
    except Exception as e:
        logger.error(f"Error getting next available time: {e}")
        return create_error_response('next_available_error', 'Failed to get next available time')


@safety_bp.route('/weather', methods=['GET'])
def get_weather_safety():
    """
    Get detailed weather safety information.
    
    Returns:
        JSON response containing:
        - safe: Whether current weather conditions are safe
        - conditions: Detailed weather condition data
        - thresholds: Current safety thresholds
        - timestamp: When weather data was last updated
    """
    try:
        weather_details = weather_service.get_weather_status_details()
        
        if not weather_details['available']:
            return jsonify({
                'safe': False,
                'error': weather_details['error'],
                'conditions': None,
                'thresholds': weather_service.get_safety_thresholds()
            })
        
        return jsonify({
            'safe': weather_details['overall_safe'],
            'conditions': weather_details['conditions'],
            'thresholds': weather_service.get_safety_thresholds(),
            'timestamp': weather_details['timestamp']
        })
    except Exception as e:
        logger.error(f"Error getting weather safety: {e}")
        return create_error_response('weather_safety_error', 'Failed to get weather safety information')


@safety_bp.route('/thresholds', methods=['GET'])
def get_safety_thresholds():
    """
    Get current safety thresholds configuration.
    
    Returns:
        JSON response containing current safety thresholds for all parameters
    """
    try:
        return jsonify(weather_service.get_safety_thresholds())
    except Exception as e:
        logger.error(f"Error getting safety thresholds: {e}")
        return create_error_response('thresholds_error', 'Failed to get safety thresholds')


@safety_bp.route('/comprehensive', methods=['GET'])
def get_comprehensive_status():
    """
    Get comprehensive safety status including detailed time and weather information.
    
    Returns:
        JSON response containing:
        - overall: Overall safety status
        - time_safety: Time-based safety information
        - weather_safety: Weather-based safety information with detailed conditions
        - last_updated: Timestamp of status calculation
    """
    try:
        comprehensive_status = safety_manager.get_comprehensive_status()
        return jsonify(comprehensive_status)
    except Exception as e:
        logger.error(f"Error getting comprehensive safety status: {e}")
        return create_error_response('comprehensive_status_error', 'Failed to get comprehensive safety status')