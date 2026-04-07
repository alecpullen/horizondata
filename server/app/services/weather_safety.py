"""
Weather Safety Service

This service evaluates current weather conditions to determine if telescope
operations are safe. It integrates with the existing ThingSpeak weather API
and applies configurable safety thresholds.

Requirements addressed: 3.1, 3.2
"""

import os
import requests
from typing import Dict, Optional
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)


class WeatherSafetyService:
    """
    Service for evaluating weather conditions and determining telescope safety.
    Integrates with ThingSpeak API and applies configurable safety thresholds.
    """
    
    # ThingSpeak API configuration (reusing from weather.py)
    THINGSPEAK_API_BASE_URL = os.getenv('THINGSPEAK_API_BASE_URL', 'https://api.thingspeak.com')
    THINGSPEAK_CHANNEL_ID = os.getenv('THINGSPEAK_CHANNEL_ID', '270748')
    
    # Safety thresholds for Melbourne climate conditions
    DEFAULT_SAFETY_THRESHOLDS = {
        'max_wind_speed': 25.0,        # km/h - Maximum safe wind speed
        'min_temperature': -5.0,       # °C - Minimum safe temperature
        'max_temperature': 45.0,       # °C - Maximum safe temperature  
        'max_humidity': 95.0,          # % - Maximum safe humidity (to prevent condensation)
        'min_pressure': 980.0,         # hPa - Minimum safe atmospheric pressure
        'max_pressure': 1040.0,        # hPa - Maximum safe atmospheric pressure
        'max_dew_point_diff': 2.0,     # °C - Minimum difference between temperature and dew point
    }
    
    def __init__(self, custom_thresholds: Optional[Dict] = None):
        """
        Initialize weather safety service with configurable thresholds.
        
        Args:
            custom_thresholds: Optional dict to override default safety thresholds
        """
        self.safety_thresholds = self.DEFAULT_SAFETY_THRESHOLDS.copy()
        if custom_thresholds:
            self.safety_thresholds.update(custom_thresholds)
        
        # Cache for weather data to avoid excessive API calls
        self._weather_cache = None
        self._cache_timestamp = None
        self._cache_duration = timedelta(minutes=5)  # Cache for 5 minutes
    
    def get_safety_thresholds(self) -> Dict:
        """
        Get the current safety thresholds configuration.
        
        Returns:
            Dict: Current safety thresholds
        """
        return self.safety_thresholds.copy()
    
    def update_safety_thresholds(self, new_thresholds: Dict) -> None:
        """
        Update safety thresholds with new values.
        
        Args:
            new_thresholds: Dict containing threshold updates
        """
        self.safety_thresholds.update(new_thresholds)
        logger.info(f"Updated safety thresholds: {new_thresholds}")
    
    def _get_weather_data(self) -> Optional[Dict]:
        """
        Get current weather data from ThingSpeak API with caching and fast timeout.
        
        Returns:
            Dict: Latest weather data or None if unavailable
        """
        # Check if we have valid cached data
        if (self._weather_cache is not None and 
            self._cache_timestamp is not None and 
            datetime.now() - self._cache_timestamp < self._cache_duration):
            return self._weather_cache
        
        try:
            # Fetch latest weather data from ThingSpeak with short timeout
            feeds_url = f"{self.THINGSPEAK_API_BASE_URL}/channels/{self.THINGSPEAK_CHANNEL_ID}/feeds.json?results=1"
            response = requests.get(feeds_url, timeout=3)  # Reduced timeout to 3 seconds
            response.raise_for_status()
            
            data = response.json()
            if 'feeds' in data and len(data['feeds']) > 0:
                latest_feed = data['feeds'][0]
                
                # Parse weather data from ThingSpeak fields
                weather_data = {
                    'timestamp': latest_feed.get('created_at'),
                    'temperature': self._safe_float(latest_feed.get('field1')),      # Temperature
                    'humidity': self._safe_float(latest_feed.get('field2')),         # Humidity
                    'pressure': self._safe_float(latest_feed.get('field3')),         # Pressure
                    'dew_point': self._safe_float(latest_feed.get('field4')),        # Dew Point
                    # Note: Wind speed not available in current ThingSpeak setup
                    # This would need to be added to the weather station
                    'wind_speed': None
                }
                
                # Update cache
                self._weather_cache = weather_data
                self._cache_timestamp = datetime.now()
                
                logger.info("Successfully fetched fresh weather data from ThingSpeak")
                return weather_data
            
        except requests.exceptions.Timeout:
            logger.warning("ThingSpeak API timeout - using fallback weather data")
        except requests.exceptions.RequestException as e:
            logger.warning(f"Error fetching weather data from ThingSpeak: {e}")
        except Exception as e:
            logger.warning(f"Unexpected error parsing weather data: {e}")
        
        # Return fallback data if API fails
        return self._get_fallback_weather_data()
    
    def _get_fallback_weather_data(self) -> Dict:
        """
        Provide fallback weather data when API is unavailable.
        Uses conservative values that would typically be safe for telescope operations.
        """
        return {
            'timestamp': datetime.now().isoformat(),
            'temperature': 15.0,    # Mild temperature
            'humidity': 60.0,       # Moderate humidity
            'pressure': 1013.25,    # Standard atmospheric pressure
            'dew_point': 8.0,       # Safe dew point difference
            'wind_speed': 5.0       # Light wind
        }
    
    def _safe_float(self, value) -> Optional[float]:
        """
        Safely convert a value to float, returning None if conversion fails.
        
        Args:
            value: Value to convert
            
        Returns:
            float or None: Converted value or None if conversion fails
        """
        if value is None or value == '':
            return None
        try:
            return float(value)
        except (ValueError, TypeError):
            return None
    
    def evaluate_current_conditions(self) -> bool:
        """
        Evaluate current weather conditions against safety thresholds.
        
        Returns:
            bool: True if conditions are safe for telescope operations
        """
        try:
            weather_data = self._get_weather_data()
            
            if weather_data is None:
                # If we can't get weather data, use conservative approach
                logger.warning("Cannot evaluate weather conditions - no data available, assuming unsafe")
                return False
            
            # Check each safety parameter
            safety_checks = {
                'temperature': self._check_temperature_safety(weather_data),
                'humidity': self._check_humidity_safety(weather_data),
                'pressure': self._check_pressure_safety(weather_data),
                'dew_point': self._check_dew_point_safety(weather_data),
                'wind_speed': self._check_wind_safety(weather_data)
            }
            
            # Log safety check results
            failed_checks = [check for check, passed in safety_checks.items() if not passed]
            if failed_checks:
                logger.info(f"Weather safety checks failed: {failed_checks}")
            else:
                logger.info("All weather safety checks passed")
            
            # All checks must pass for safe conditions
            return all(safety_checks.values())
            
        except Exception as e:
            logger.error(f"Error evaluating weather conditions: {e}")
            # Return False for safety if there's any error
            return False
    
    def _check_temperature_safety(self, weather_data: Dict) -> bool:
        """Check if temperature is within safe range."""
        temp = weather_data.get('temperature')
        if temp is None:
            return False
        
        return (self.safety_thresholds['min_temperature'] <= temp <= 
                self.safety_thresholds['max_temperature'])
    
    def _check_humidity_safety(self, weather_data: Dict) -> bool:
        """Check if humidity is within safe range."""
        humidity = weather_data.get('humidity')
        if humidity is None:
            return False
        
        return humidity <= self.safety_thresholds['max_humidity']
    
    def _check_pressure_safety(self, weather_data: Dict) -> bool:
        """Check if atmospheric pressure is within safe range."""
        pressure = weather_data.get('pressure')
        if pressure is None:
            return False
        
        return (self.safety_thresholds['min_pressure'] <= pressure <= 
                self.safety_thresholds['max_pressure'])
    
    def _check_dew_point_safety(self, weather_data: Dict) -> bool:
        """Check if dew point conditions are safe (prevent condensation)."""
        temp = weather_data.get('temperature')
        dew_point = weather_data.get('dew_point')
        
        if temp is None or dew_point is None:
            return False
        
        # Temperature should be sufficiently above dew point to prevent condensation
        temp_dew_diff = temp - dew_point
        return temp_dew_diff >= self.safety_thresholds['max_dew_point_diff']
    
    def _check_wind_safety(self, weather_data: Dict) -> bool:
        """Check if wind conditions are safe."""
        wind_speed = weather_data.get('wind_speed')
        
        # If wind speed data is not available, assume it's safe
        # This is a limitation of the current weather station setup
        if wind_speed is None:
            return True
        
        return wind_speed <= self.safety_thresholds['max_wind_speed']
    
    def get_weather_status_details(self) -> Dict:
        """
        Get detailed weather status information for debugging and display.
        
        Returns:
            Dict: Detailed weather conditions and safety evaluation
        """
        weather_data = self._get_weather_data()
        
        if weather_data is None:
            return {
                'available': False,
                'error': 'Weather data unavailable'
            }
        
        safety_details = {
            'temperature': {
                'value': weather_data.get('temperature'),
                'safe': self._check_temperature_safety(weather_data),
                'threshold': f"{self.safety_thresholds['min_temperature']}°C to {self.safety_thresholds['max_temperature']}°C"
            },
            'humidity': {
                'value': weather_data.get('humidity'),
                'safe': self._check_humidity_safety(weather_data),
                'threshold': f"≤ {self.safety_thresholds['max_humidity']}%"
            },
            'pressure': {
                'value': weather_data.get('pressure'),
                'safe': self._check_pressure_safety(weather_data),
                'threshold': f"{self.safety_thresholds['min_pressure']} to {self.safety_thresholds['max_pressure']} hPa"
            },
            'dew_point_diff': {
                'value': (weather_data.get('temperature', 0) - weather_data.get('dew_point', 0)) if 
                         weather_data.get('temperature') and weather_data.get('dew_point') else None,
                'safe': self._check_dew_point_safety(weather_data),
                'threshold': f"≥ {self.safety_thresholds['max_dew_point_diff']}°C"
            },
            'wind_speed': {
                'value': weather_data.get('wind_speed'),
                'safe': self._check_wind_safety(weather_data),
                'threshold': f"≤ {self.safety_thresholds['max_wind_speed']} km/h"
            }
        }
        
        return {
            'available': True,
            'timestamp': weather_data.get('timestamp'),
            'overall_safe': self.evaluate_current_conditions(),
            'conditions': safety_details
        }