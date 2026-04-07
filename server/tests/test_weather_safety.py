"""
Unit tests for WeatherSafetyService

Tests weather threshold evaluation with various condition scenarios,
safety status changes based on weather data, and fallback behavior
when weather API is unavailable.

Requirements tested: 3.1, 3.2
"""

import unittest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime, timedelta
import sys
import os

# Add the backend directory to the path and import required modules
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)

try:
    import requests
    # Import WeatherSafetyService directly without going through app module
    sys.path.insert(0, os.path.join(backend_dir, 'app', 'services'))
    from weather_safety import WeatherSafetyService
    
    DEPENDENCIES_AVAILABLE = True
except ImportError as e:
    print(f"Skipping tests due to missing dependencies: {e}")
    DEPENDENCIES_AVAILABLE = False
    
    # Create a dummy WeatherSafetyService for testing structure
    class WeatherSafetyService:
        pass


@unittest.skipUnless(DEPENDENCIES_AVAILABLE, "Required dependencies not available")
class TestWeatherSafetyService(unittest.TestCase):
    """Test cases for WeatherSafetyService functionality"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.weather_service = WeatherSafetyService()
        
        # Sample safe weather data
        self.safe_weather_data = {
            'timestamp': '2024-06-15T12:00:00Z',
            'temperature': 20.0,    # Safe temperature
            'humidity': 60.0,       # Safe humidity
            'pressure': 1013.25,    # Safe pressure
            'dew_point': 15.0,      # Safe dew point (5°C below temp)
            'wind_speed': 15.0      # Safe wind speed
        }
        
        # Sample unsafe weather data scenarios
        self.unsafe_weather_scenarios = {
            'high_temperature': {
                'timestamp': '2024-06-15T12:00:00Z',
                'temperature': 50.0,    # Too hot
                'humidity': 60.0,
                'pressure': 1013.25,
                'dew_point': 15.0,
                'wind_speed': 15.0
            },
            'low_temperature': {
                'timestamp': '2024-06-15T12:00:00Z',
                'temperature': -10.0,   # Too cold
                'humidity': 60.0,
                'pressure': 1013.25,
                'dew_point': -15.0,
                'wind_speed': 15.0
            },
            'high_humidity': {
                'timestamp': '2024-06-15T12:00:00Z',
                'temperature': 20.0,
                'humidity': 98.0,       # Too humid
                'pressure': 1013.25,
                'dew_point': 15.0,
                'wind_speed': 15.0
            },
            'low_pressure': {
                'timestamp': '2024-06-15T12:00:00Z',
                'temperature': 20.0,
                'humidity': 60.0,
                'pressure': 970.0,      # Too low pressure
                'dew_point': 15.0,
                'wind_speed': 15.0
            },
            'high_pressure': {
                'timestamp': '2024-06-15T12:00:00Z',
                'temperature': 20.0,
                'humidity': 60.0,
                'pressure': 1050.0,     # Too high pressure
                'dew_point': 15.0,
                'wind_speed': 15.0
            },
            'condensation_risk': {
                'timestamp': '2024-06-15T12:00:00Z',
                'temperature': 20.0,
                'humidity': 60.0,
                'pressure': 1013.25,
                'dew_point': 19.0,      # Too close to temperature (1°C diff)
                'wind_speed': 15.0
            },
            'high_wind': {
                'timestamp': '2024-06-15T12:00:00Z',
                'temperature': 20.0,
                'humidity': 60.0,
                'pressure': 1013.25,
                'dew_point': 15.0,
                'wind_speed': 30.0      # Too windy
            }
        }
    
    def test_default_safety_thresholds(self):
        """Test that default safety thresholds are properly configured"""
        thresholds = self.weather_service.get_safety_thresholds()
        
        # Verify all required thresholds are present
        expected_keys = [
            'max_wind_speed', 'min_temperature', 'max_temperature',
            'max_humidity', 'min_pressure', 'max_pressure', 'max_dew_point_diff'
        ]
        
        for key in expected_keys:
            self.assertIn(key, thresholds)
        
        # Verify reasonable default values for Melbourne climate
        self.assertEqual(thresholds['max_wind_speed'], 25.0)
        self.assertEqual(thresholds['min_temperature'], -5.0)
        self.assertEqual(thresholds['max_temperature'], 45.0)
        self.assertEqual(thresholds['max_humidity'], 95.0)
        self.assertEqual(thresholds['min_pressure'], 980.0)
        self.assertEqual(thresholds['max_pressure'], 1040.0)
        self.assertEqual(thresholds['max_dew_point_diff'], 2.0)
    
    def test_custom_safety_thresholds(self):
        """Test initialization with custom safety thresholds"""
        custom_thresholds = {
            'max_wind_speed': 20.0,
            'max_temperature': 40.0
        }
        
        service = WeatherSafetyService(custom_thresholds)
        thresholds = service.get_safety_thresholds()
        
        # Custom values should override defaults
        self.assertEqual(thresholds['max_wind_speed'], 20.0)
        self.assertEqual(thresholds['max_temperature'], 40.0)
        
        # Other values should remain default
        self.assertEqual(thresholds['min_temperature'], -5.0)
        self.assertEqual(thresholds['max_humidity'], 95.0)
    
    def test_update_safety_thresholds(self):
        """Test updating safety thresholds after initialization"""
        original_thresholds = self.weather_service.get_safety_thresholds()
        
        # Update some thresholds
        updates = {
            'max_wind_speed': 30.0,
            'min_temperature': 0.0
        }
        
        self.weather_service.update_safety_thresholds(updates)
        updated_thresholds = self.weather_service.get_safety_thresholds()
        
        # Updated values should change
        self.assertEqual(updated_thresholds['max_wind_speed'], 30.0)
        self.assertEqual(updated_thresholds['min_temperature'], 0.0)
        
        # Other values should remain unchanged
        self.assertEqual(updated_thresholds['max_temperature'], original_thresholds['max_temperature'])
        self.assertEqual(updated_thresholds['max_humidity'], original_thresholds['max_humidity'])
    
    @patch('weather_safety.requests.get')
    def test_get_weather_data_success(self, mock_get):
        """Test successful weather data retrieval from ThingSpeak API"""
        # Mock successful API response
        mock_response = Mock()
        mock_response.json.return_value = {
            'feeds': [{
                'created_at': '2024-06-15T12:00:00Z',
                'field1': '20.5',    # Temperature
                'field2': '65.0',    # Humidity
                'field3': '1013.25', # Pressure
                'field4': '15.2'     # Dew Point
            }]
        }
        mock_response.raise_for_status.return_value = None
        mock_get.return_value = mock_response
        
        # Clear cache to ensure fresh API call
        self.weather_service._weather_cache = None
        self.weather_service._cache_timestamp = None
        
        weather_data = self.weather_service._get_weather_data()
        
        # Verify API was called correctly
        mock_get.assert_called_once()
        call_args = mock_get.call_args
        self.assertIn('feeds.json', call_args[0][0])
        self.assertIn('results=1', call_args[0][0])
        
        # Verify parsed data
        self.assertIsNotNone(weather_data)
        self.assertEqual(weather_data['temperature'], 20.5)
        self.assertEqual(weather_data['humidity'], 65.0)
        self.assertEqual(weather_data['pressure'], 1013.25)
        self.assertEqual(weather_data['dew_point'], 15.2)
        self.assertIsNone(weather_data['wind_speed'])  # Not available in current setup
    
    @patch('weather_safety.requests.get')
    def test_get_weather_data_api_failure(self, mock_get):
        """Test weather data retrieval when API fails"""
        # Mock API failure
        mock_get.side_effect = requests.exceptions.RequestException("API Error")
        
        # Clear cache to ensure fresh API call
        self.weather_service._weather_cache = None
        self.weather_service._cache_timestamp = None
        
        weather_data = self.weather_service._get_weather_data()
        
        # Should return None on API failure
        self.assertIsNone(weather_data)
    
    @patch('weather_safety.requests.get')
    def test_get_weather_data_empty_response(self, mock_get):
        """Test weather data retrieval with empty API response"""
        # Mock empty response
        mock_response = Mock()
        mock_response.json.return_value = {'feeds': []}
        mock_response.raise_for_status.return_value = None
        mock_get.return_value = mock_response
        
        # Clear cache to ensure fresh API call
        self.weather_service._weather_cache = None
        self.weather_service._cache_timestamp = None
        
        weather_data = self.weather_service._get_weather_data()
        
        # Should return None for empty response
        self.assertIsNone(weather_data)
    
    @patch('weather_safety.requests.get')
    def test_weather_data_caching(self, mock_get):
        """Test that weather data is properly cached"""
        # Mock successful API response
        mock_response = Mock()
        mock_response.json.return_value = {
            'feeds': [{
                'created_at': '2024-06-15T12:00:00Z',
                'field1': '20.5',
                'field2': '65.0',
                'field3': '1013.25',
                'field4': '15.2'
            }]
        }
        mock_response.raise_for_status.return_value = None
        mock_get.return_value = mock_response
        
        # Clear cache
        self.weather_service._weather_cache = None
        self.weather_service._cache_timestamp = None
        
        # First call should hit API
        weather_data1 = self.weather_service._get_weather_data()
        self.assertEqual(mock_get.call_count, 1)
        
        # Second call should use cache
        weather_data2 = self.weather_service._get_weather_data()
        self.assertEqual(mock_get.call_count, 1)  # No additional API call
        
        # Data should be identical
        self.assertEqual(weather_data1, weather_data2)
    
    @patch('weather_safety.requests.get')
    def test_weather_data_cache_expiry(self, mock_get):
        """Test that weather data cache expires after timeout"""
        # Mock successful API response
        mock_response = Mock()
        mock_response.json.return_value = {
            'feeds': [{
                'created_at': '2024-06-15T12:00:00Z',
                'field1': '20.5',
                'field2': '65.0',
                'field3': '1013.25',
                'field4': '15.2'
            }]
        }
        mock_response.raise_for_status.return_value = None
        mock_get.return_value = mock_response
        
        # Clear cache
        self.weather_service._weather_cache = None
        self.weather_service._cache_timestamp = None
        
        # First call
        weather_data1 = self.weather_service._get_weather_data()
        self.assertEqual(mock_get.call_count, 1)
        
        # Simulate cache expiry by setting old timestamp
        self.weather_service._cache_timestamp = datetime.now() - timedelta(minutes=10)
        
        # Second call should hit API again due to expired cache
        weather_data2 = self.weather_service._get_weather_data()
        self.assertEqual(mock_get.call_count, 2)
    
    def test_safe_float_conversion(self):
        """Test safe float conversion utility method"""
        # Valid conversions
        self.assertEqual(self.weather_service._safe_float('20.5'), 20.5)
        self.assertEqual(self.weather_service._safe_float('0'), 0.0)
        self.assertEqual(self.weather_service._safe_float('-5.2'), -5.2)
        self.assertEqual(self.weather_service._safe_float(25.0), 25.0)
        
        # Invalid conversions should return None
        self.assertIsNone(self.weather_service._safe_float(None))
        self.assertIsNone(self.weather_service._safe_float(''))
        self.assertIsNone(self.weather_service._safe_float('invalid'))
        self.assertIsNone(self.weather_service._safe_float('20.5.3'))
    
    def test_temperature_safety_check_safe_conditions(self):
        """Test temperature safety check with safe conditions"""
        safe_temps = [0.0, 20.0, 35.0, 44.9]  # Within -5 to 45°C range
        
        for temp in safe_temps:
            with self.subTest(temperature=temp):
                weather_data = {'temperature': temp}
                self.assertTrue(self.weather_service._check_temperature_safety(weather_data))
    
    def test_temperature_safety_check_unsafe_conditions(self):
        """Test temperature safety check with unsafe conditions"""
        unsafe_temps = [-10.0, -5.1, 45.1, 50.0]  # Outside -5 to 45°C range
        
        for temp in unsafe_temps:
            with self.subTest(temperature=temp):
                weather_data = {'temperature': temp}
                self.assertFalse(self.weather_service._check_temperature_safety(weather_data))
    
    def test_temperature_safety_check_missing_data(self):
        """Test temperature safety check with missing data"""
        # Missing temperature data should be unsafe
        self.assertFalse(self.weather_service._check_temperature_safety({}))
        self.assertFalse(self.weather_service._check_temperature_safety({'temperature': None}))
    
    def test_humidity_safety_check_safe_conditions(self):
        """Test humidity safety check with safe conditions"""
        safe_humidity = [0.0, 50.0, 85.0, 95.0]  # Within 0 to 95% range
        
        for humidity in safe_humidity:
            with self.subTest(humidity=humidity):
                weather_data = {'humidity': humidity}
                self.assertTrue(self.weather_service._check_humidity_safety(weather_data))
    
    def test_humidity_safety_check_unsafe_conditions(self):
        """Test humidity safety check with unsafe conditions"""
        unsafe_humidity = [95.1, 98.0, 100.0]  # Above 95%
        
        for humidity in unsafe_humidity:
            with self.subTest(humidity=humidity):
                weather_data = {'humidity': humidity}
                self.assertFalse(self.weather_service._check_humidity_safety(weather_data))
    
    def test_humidity_safety_check_missing_data(self):
        """Test humidity safety check with missing data"""
        # Missing humidity data should be unsafe
        self.assertFalse(self.weather_service._check_humidity_safety({}))
        self.assertFalse(self.weather_service._check_humidity_safety({'humidity': None}))
    
    def test_pressure_safety_check_safe_conditions(self):
        """Test pressure safety check with safe conditions"""
        safe_pressures = [980.0, 1000.0, 1013.25, 1030.0, 1040.0]  # Within 980-1040 hPa
        
        for pressure in safe_pressures:
            with self.subTest(pressure=pressure):
                weather_data = {'pressure': pressure}
                self.assertTrue(self.weather_service._check_pressure_safety(weather_data))
    
    def test_pressure_safety_check_unsafe_conditions(self):
        """Test pressure safety check with unsafe conditions"""
        unsafe_pressures = [970.0, 979.9, 1040.1, 1050.0]  # Outside 980-1040 hPa
        
        for pressure in unsafe_pressures:
            with self.subTest(pressure=pressure):
                weather_data = {'pressure': pressure}
                self.assertFalse(self.weather_service._check_pressure_safety(weather_data))
    
    def test_pressure_safety_check_missing_data(self):
        """Test pressure safety check with missing data"""
        # Missing pressure data should be unsafe
        self.assertFalse(self.weather_service._check_pressure_safety({}))
        self.assertFalse(self.weather_service._check_pressure_safety({'pressure': None}))
    
    def test_dew_point_safety_check_safe_conditions(self):
        """Test dew point safety check with safe conditions"""
        safe_scenarios = [
            {'temperature': 20.0, 'dew_point': 15.0},  # 5°C difference
            {'temperature': 25.0, 'dew_point': 20.0},  # 5°C difference
            {'temperature': 10.0, 'dew_point': 7.0},   # 3°C difference
            {'temperature': 30.0, 'dew_point': 28.0}   # 2°C difference (exactly at threshold)
        ]
        
        for scenario in safe_scenarios:
            with self.subTest(scenario=scenario):
                self.assertTrue(self.weather_service._check_dew_point_safety(scenario))
    
    def test_dew_point_safety_check_unsafe_conditions(self):
        """Test dew point safety check with unsafe conditions"""
        unsafe_scenarios = [
            {'temperature': 20.0, 'dew_point': 19.0},  # 1°C difference (too close)
            {'temperature': 25.0, 'dew_point': 24.5},  # 0.5°C difference
            {'temperature': 15.0, 'dew_point': 15.0},  # Same temperature (0°C difference)
            {'temperature': 10.0, 'dew_point': 11.0}   # Dew point higher than temperature
        ]
        
        for scenario in unsafe_scenarios:
            with self.subTest(scenario=scenario):
                self.assertFalse(self.weather_service._check_dew_point_safety(scenario))
    
    def test_dew_point_safety_check_missing_data(self):
        """Test dew point safety check with missing data"""
        # Missing data should be unsafe
        self.assertFalse(self.weather_service._check_dew_point_safety({}))
        self.assertFalse(self.weather_service._check_dew_point_safety({'temperature': 20.0}))
        self.assertFalse(self.weather_service._check_dew_point_safety({'dew_point': 15.0}))
        self.assertFalse(self.weather_service._check_dew_point_safety({'temperature': None, 'dew_point': None}))
    
    def test_wind_safety_check_safe_conditions(self):
        """Test wind safety check with safe conditions"""
        safe_wind_speeds = [0.0, 10.0, 20.0, 25.0]  # Within 0-25 km/h range
        
        for wind_speed in safe_wind_speeds:
            with self.subTest(wind_speed=wind_speed):
                weather_data = {'wind_speed': wind_speed}
                self.assertTrue(self.weather_service._check_wind_safety(weather_data))
    
    def test_wind_safety_check_unsafe_conditions(self):
        """Test wind safety check with unsafe conditions"""
        unsafe_wind_speeds = [25.1, 30.0, 50.0]  # Above 25 km/h
        
        for wind_speed in unsafe_wind_speeds:
            with self.subTest(wind_speed=wind_speed):
                weather_data = {'wind_speed': wind_speed}
                self.assertFalse(self.weather_service._check_wind_safety(weather_data))
    
    def test_wind_safety_check_missing_data(self):
        """Test wind safety check with missing data (should be safe as fallback)"""
        # Missing wind data should be safe (limitation of current weather station)
        self.assertTrue(self.weather_service._check_wind_safety({}))
        self.assertTrue(self.weather_service._check_wind_safety({'wind_speed': None}))
    
    @patch.object(WeatherSafetyService, '_get_weather_data')
    def test_evaluate_current_conditions_all_safe(self, mock_get_weather):
        """Test overall safety evaluation with all safe conditions"""
        mock_get_weather.return_value = self.safe_weather_data
        
        result = self.weather_service.evaluate_current_conditions()
        self.assertTrue(result)
    
    @patch.object(WeatherSafetyService, '_get_weather_data')
    def test_evaluate_current_conditions_unsafe_scenarios(self, mock_get_weather):
        """Test overall safety evaluation with various unsafe scenarios"""
        for scenario_name, weather_data in self.unsafe_weather_scenarios.items():
            with self.subTest(scenario=scenario_name):
                mock_get_weather.return_value = weather_data
                
                result = self.weather_service.evaluate_current_conditions()
                self.assertFalse(result, f"Scenario {scenario_name} should be unsafe")
    
    @patch.object(WeatherSafetyService, '_get_weather_data')
    def test_evaluate_current_conditions_no_data(self, mock_get_weather):
        """Test overall safety evaluation when no weather data is available"""
        mock_get_weather.return_value = None
        
        result = self.weather_service.evaluate_current_conditions()
        # Should be unsafe when no data is available (err on side of caution)
        self.assertFalse(result)
    
    @patch.object(WeatherSafetyService, '_get_weather_data')
    def test_get_weather_status_details_safe_conditions(self, mock_get_weather):
        """Test detailed weather status with safe conditions"""
        mock_get_weather.return_value = self.safe_weather_data
        
        status = self.weather_service.get_weather_status_details()
        
        # Should be available and overall safe
        self.assertTrue(status['available'])
        self.assertTrue(status['overall_safe'])
        self.assertIn('timestamp', status)
        self.assertIn('conditions', status)
        
        # All individual conditions should be safe
        conditions = status['conditions']
        for condition_name, condition_data in conditions.items():
            with self.subTest(condition=condition_name):
                if condition_name != 'wind_speed':  # Wind speed might be None
                    self.assertTrue(condition_data['safe'], f"{condition_name} should be safe")
                self.assertIn('threshold', condition_data)
    
    @patch.object(WeatherSafetyService, '_get_weather_data')
    def test_get_weather_status_details_unsafe_conditions(self, mock_get_weather):
        """Test detailed weather status with unsafe conditions"""
        # Test high temperature scenario
        mock_get_weather.return_value = self.unsafe_weather_scenarios['high_temperature']
        
        status = self.weather_service.get_weather_status_details()
        
        # Should be available but overall unsafe
        self.assertTrue(status['available'])
        self.assertFalse(status['overall_safe'])
        
        # Temperature condition should be unsafe
        temp_condition = status['conditions']['temperature']
        self.assertFalse(temp_condition['safe'])
        self.assertEqual(temp_condition['value'], 50.0)
    
    @patch.object(WeatherSafetyService, '_get_weather_data')
    def test_get_weather_status_details_no_data(self, mock_get_weather):
        """Test detailed weather status when no data is available"""
        mock_get_weather.return_value = None
        
        status = self.weather_service.get_weather_status_details()
        
        # Should indicate data is not available
        self.assertFalse(status['available'])
        self.assertIn('error', status)
        self.assertEqual(status['error'], 'Weather data unavailable')


if __name__ == '__main__':
    unittest.main()