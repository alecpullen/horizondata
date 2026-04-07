"""
Safety Manager Service

This service manages the overall safety status of the telescope system by combining
time-based and weather-based safety evaluations. It provides the central logic for
determining when telescope operations are safe to proceed.

Requirements addressed: 1.1, 1.2, 1.3, 3.1, 3.2
"""

from enum import Enum
from datetime import datetime
from typing import Dict, Optional, Tuple
from .time_service import TimeService
from .weather_safety import WeatherSafetyService


class SafetyStatus(Enum):
    """Enumeration of possible safety states for the telescope system"""
    ACTIVE = "ACTIVE"      # Safe to operate telescope
    UNSAFE = "UNSAFE"      # Unsafe due to weather conditions
    CLOSED = "CLOSED"      # Closed due to time restrictions (daylight hours)


class SafetyManager:
    """
    Central safety management service that coordinates time-based and weather-based
    safety evaluations to determine overall telescope operational status.
    """
    
    def __init__(self):
        self.time_service = TimeService()
        self.weather_service = WeatherSafetyService()
    
    def get_current_status(self) -> Dict:
        """
        Get the current safety status combining time and weather evaluations.
        
        Returns:
            Dict containing:
            - status: SafetyStatus enum value
            - reason: String explanation of the status
            - next_available: Optional datetime when system will next be available
            - current_time: Current Melbourne time
            - viewing_window: Current viewing window information
        """
        current_time = self.time_service.get_melbourne_time()
        
        # Check if we're in a valid viewing window (time-based safety)
        is_viewing_window = self.is_viewing_window_active()
        
        if not is_viewing_window:
            # System is closed due to time restrictions
            next_window = self.get_next_viewing_window()
            return {
                'status': SafetyStatus.CLOSED.value,
                'reason': f'Closed – Opens at {next_window.strftime("%H:%M")}',
                'next_available': next_window.isoformat(),
                'current_time': current_time.isoformat(),
                'viewing_window': self._get_current_viewing_window_info()
            }
        
        # Check weather safety if we're in viewing window
        weather_safe = self.check_weather_safety()
        
        if not weather_safe:
            # System is unsafe due to weather conditions
            # Get detailed weather information for specific messaging
            weather_details = self.weather_service.get_weather_status_details()
            weather_reason = self._get_weather_unsafe_reason(weather_details)
            
            return {
                'status': SafetyStatus.UNSAFE.value,
                'reason': weather_reason,
                'next_available': None,  # Weather-dependent, cannot predict
                'current_time': current_time.isoformat(),
                'viewing_window': self._get_current_viewing_window_info(),
                'weather_details': weather_details if weather_details.get('available') else None
            }
        
        # System is active and safe to operate
        return {
            'status': SafetyStatus.ACTIVE.value,
            'reason': 'System is active and safe for telescope operations',
            'next_available': None,
            'current_time': current_time.isoformat(),
            'viewing_window': self._get_current_viewing_window_info()
        }
    
    def is_viewing_window_active(self) -> bool:
        """
        Check if the current time falls within the allowed viewing window.
        
        Returns:
            bool: True if telescope operations are allowed based on time
        """
        return self.time_service.is_viewing_window_active()
    
    def get_next_viewing_window(self) -> datetime:
        """
        Get the next time when the viewing window will be active.
        
        Returns:
            datetime: Next available viewing time
        """
        return self.time_service.get_next_viewing_window()
    
    def check_weather_safety(self) -> bool:
        """
        Check if current weather conditions are safe for telescope operations.
        
        Returns:
            bool: True if weather conditions are safe
        """
        return self.weather_service.evaluate_current_conditions()
    
    def _get_current_viewing_window_info(self) -> Dict:
        """
        Get information about the current viewing window.
        
        Returns:
            Dict containing viewing window start and end times
        """
        current_time = self.time_service.get_melbourne_time()
        viewing_window = self.time_service.get_viewing_window(current_time.date())
        
        return {
            'start': viewing_window[0].isoformat(),
            'end': viewing_window[1].isoformat()
        }
    
    def _get_weather_unsafe_reason(self, weather_details: Dict) -> str:
        """
        Generate specific weather-related unsafe reason message.
        
        Args:
            weather_details: Detailed weather status from weather service
            
        Returns:
            str: Specific reason message for weather-related unsafe conditions
        """
        if not weather_details or not weather_details.get('available'):
            return 'Offline due to weather data unavailable'
        
        conditions = weather_details.get('conditions', {})
        unsafe_conditions = []
        
        # Check each condition and build specific message
        if not conditions.get('temperature', {}).get('safe', True):
            temp_value = conditions.get('temperature', {}).get('value')
            if temp_value is not None:
                if temp_value < -5:
                    unsafe_conditions.append(f'temperature too low ({temp_value:.1f}°C)')
                elif temp_value > 45:
                    unsafe_conditions.append(f'temperature too high ({temp_value:.1f}°C)')
                else:
                    unsafe_conditions.append('unsafe temperature')
        
        if not conditions.get('humidity', {}).get('safe', True):
            humidity_value = conditions.get('humidity', {}).get('value')
            if humidity_value is not None:
                unsafe_conditions.append(f'high humidity ({humidity_value:.1f}%)')
            else:
                unsafe_conditions.append('unsafe humidity')
        
        if not conditions.get('pressure', {}).get('safe', True):
            pressure_value = conditions.get('pressure', {}).get('value')
            if pressure_value is not None:
                unsafe_conditions.append(f'atmospheric pressure ({pressure_value:.1f} hPa)')
            else:
                unsafe_conditions.append('unsafe atmospheric pressure')
        
        if not conditions.get('dew_point_diff', {}).get('safe', True):
            dew_diff_value = conditions.get('dew_point_diff', {}).get('value')
            if dew_diff_value is not None:
                unsafe_conditions.append(f'condensation risk (dew point diff: {dew_diff_value:.1f}°C)')
            else:
                unsafe_conditions.append('condensation risk')
        
        if not conditions.get('wind_speed', {}).get('safe', True):
            wind_value = conditions.get('wind_speed', {}).get('value')
            if wind_value is not None:
                unsafe_conditions.append(f'high wind speed ({wind_value:.1f} km/h)')
            else:
                unsafe_conditions.append('unsafe wind conditions')
        
        # Build final message
        if unsafe_conditions:
            if len(unsafe_conditions) == 1:
                return f'Offline due to {unsafe_conditions[0]}'
            elif len(unsafe_conditions) == 2:
                return f'Offline due to {unsafe_conditions[0]} and {unsafe_conditions[1]}'
            else:
                return f'Offline due to {", ".join(unsafe_conditions[:-1])}, and {unsafe_conditions[-1]}'
        
        # Fallback message
        return 'Offline due to bad weather conditions'
    
    def get_comprehensive_status(self) -> Dict:
        """
        Get comprehensive safety status including detailed time and weather information.
        
        Returns:
            Dict containing:
            - Overall safety status
            - Time-based safety information
            - Weather-based safety information
            - Detailed conditions and thresholds
        """
        current_time = self.time_service.get_melbourne_time()
        
        # Get time-based safety
        is_viewing_window = self.is_viewing_window_active()
        time_status = {
            'safe': is_viewing_window,
            'current_time': current_time.isoformat(),
            'viewing_window': self._get_current_viewing_window_info()
        }
        
        if not is_viewing_window:
            time_status['next_available'] = self.get_next_viewing_window().isoformat()
        
        # Get weather-based safety
        weather_safe = self.check_weather_safety()
        weather_status = self.weather_service.get_weather_status_details()
        weather_status['safe'] = weather_safe
        
        # Determine overall status
        overall_status = self.get_current_status()
        
        return {
            'overall': overall_status,
            'time_safety': time_status,
            'weather_safety': weather_status,
            'last_updated': current_time.isoformat()
        }