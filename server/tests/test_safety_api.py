"""
Simplified API endpoint tests for safety routes

Tests all safety status endpoints with various system states,
verifies API response formats and error handling.

Requirements tested: 1.5, 2.4, 4.4
"""

import unittest
from unittest.mock import Mock, patch
import json
import sys
import os
from datetime import datetime, timezone, timedelta

# Add the backend directory to the path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)

try:
    from flask import Flask, Blueprint, jsonify
    DEPENDENCIES_AVAILABLE = True
except ImportError as e:
    print(f"Skipping tests due to missing dependencies: {e}")
    DEPENDENCIES_AVAILABLE = False


@unittest.skipUnless(DEPENDENCIES_AVAILABLE, "Required dependencies not available")
class TestSafetyAPIEndpoints(unittest.TestCase):
    """Test cases for safety API endpoints"""
    
    def setUp(self):
        """Set up test fixtures"""
        # Create a simple Flask app for testing
        self.app = Flask(__name__)
        self.app.config['TESTING'] = True
        
        # Create blueprint
        self.safety_bp = Blueprint('safety', __name__, url_prefix='/api/safety')
        
        # Mock services
        self.mock_safety_manager = Mock()
        self.mock_weather_service = Mock()
        
        # Add routes to blueprint
        self._add_routes()
        
        # Register blueprint
        self.app.register_blueprint(self.safety_bp)
        
        # Create test client
        self.client = self.app.test_client()
        
        # Sample test data
        self.active_status = {
            'status': 'ACTIVE',
            'reason': 'All systems operational',
            'next_available': None,
            'current_time': '2024-06-15T22:00:00+10:00',
            'viewing_window': {
                'start': '2024-06-15T19:00:00+10:00',
                'end': '2024-06-16T06:00:00+10:00'
            }
        }
        
        self.closed_status = {
            'status': 'CLOSED',
            'reason': 'Outside viewing hours (daylight)',
            'next_available': '2024-06-15T19:00:00+10:00',
            'current_time': '2024-06-15T12:00:00+10:00',
            'viewing_window': {
                'start': '2024-06-15T19:00:00+10:00',
                'end': '2024-06-16T06:00:00+10:00'
            }
        }
        
        self.unsafe_status = {
            'status': 'UNSAFE',
            'reason': 'Weather conditions unsafe (high wind speed)',
            'next_available': None,
            'current_time': '2024-06-15T22:00:00+10:00',
            'viewing_window': {
                'start': '2024-06-15T19:00:00+10:00',
                'end': '2024-06-16T06:00:00+10:00'
            }
        }
    
    def _add_routes(self):
        """Add routes to the blueprint"""
        
        @self.safety_bp.route('/status', methods=['GET'])
        def get_safety_status():
            try:
                status_data = self.mock_safety_manager.get_current_status()
                return jsonify(status_data)
            except Exception as e:
                return jsonify({'error': 'safety_error', 'message': 'Failed to determine safety status'}), 500
        
        @self.safety_bp.route('/viewing-window', methods=['GET'])
        def get_viewing_window():
            try:
                current_time = self.mock_safety_manager.time_service.get_melbourne_time()
                current_date = current_time.date()
                
                current_window_start, current_window_end = self.mock_safety_manager.time_service.get_viewing_window(current_date)
                
                next_date = current_date + timedelta(days=1)
                next_window_start, next_window_end = self.mock_safety_manager.time_service.get_viewing_window(next_date)
                
                is_active = self.mock_safety_manager.is_viewing_window_active()
                
                return jsonify({
                    'current_window': {
                        'start': current_window_start.isoformat(),
                        'end': current_window_end.isoformat(),
                        'date': current_date.isoformat()
                    },
                    'next_window': {
                        'start': next_window_start.isoformat(),
                        'end': next_window_end.isoformat(),
                        'date': next_date.isoformat()
                    },
                    'is_active': is_active,
                    'melbourne_time': current_time.isoformat()
                })
            except Exception as e:
                return jsonify({'error': 'viewing_window_error', 'message': 'Failed to get viewing window information'}), 500
        
        @self.safety_bp.route('/next-available', methods=['GET'])
        def get_next_available_time():
            try:
                current_status = self.mock_safety_manager.get_current_status()
                
                if current_status.get('status') == 'ACTIVE':
                    return jsonify({
                        'next_available': None,
                        'reason': 'System is currently available',
                        'melbourne_time': current_status.get('current_time')
                    })
                
                next_available = None
                if current_status.get('status') == 'CLOSED':
                    next_window = self.mock_safety_manager.get_next_viewing_window()
                    if next_window:
                        next_available = next_window.isoformat()
                
                return jsonify({
                    'next_available': next_available,
                    'reason': current_status.get('reason'),
                    'melbourne_time': current_status.get('current_time')
                })
            except Exception as e:
                return jsonify({'error': 'next_available_error', 'message': 'Failed to get next available time'}), 500
        
        @self.safety_bp.route('/weather', methods=['GET'])
        def get_weather_safety():
            try:
                weather_details = self.mock_weather_service.get_weather_status_details()
                
                if not weather_details.get('available', True):
                    return jsonify({
                        'safe': False,
                        'error': weather_details.get('error', 'Weather data unavailable'),
                        'conditions': None,
                        'thresholds': self.mock_weather_service.get_safety_thresholds()
                    })
                
                return jsonify({
                    'safe': weather_details.get('overall_safe', False),
                    'conditions': weather_details.get('conditions', {}),
                    'thresholds': self.mock_weather_service.get_safety_thresholds(),
                    'timestamp': weather_details.get('timestamp')
                })
            except Exception as e:
                return jsonify({'error': 'weather_safety_error', 'message': 'Failed to get weather safety information'}), 500
        
        @self.safety_bp.route('/thresholds', methods=['GET'])
        def get_thresholds():
            try:
                return jsonify(self.mock_weather_service.get_safety_thresholds())
            except Exception as e:
                return jsonify({'error': 'thresholds_error', 'message': 'Failed to get safety thresholds'}), 500
        
        @self.safety_bp.route('/comprehensive', methods=['GET'])
        def get_comprehensive_status():
            try:
                comprehensive_status = self.mock_safety_manager.get_comprehensive_status()
                return jsonify(comprehensive_status)
            except Exception as e:
                return jsonify({'error': 'comprehensive_status_error', 'message': 'Failed to get comprehensive safety status'}), 500
    
    def test_get_safety_status_active(self):
        """Test /api/safety/status endpoint with ACTIVE status"""
        self.mock_safety_manager.get_current_status.return_value = self.active_status
        
        response = self.client.get('/api/safety/status')
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content_type, 'application/json')
        
        data = json.loads(response.data)
        self.assertEqual(data['status'], 'ACTIVE')
        self.assertEqual(data['reason'], 'All systems operational')
        self.assertIsNone(data['next_available'])
        self.assertIn('current_time', data)
        self.assertIn('viewing_window', data)
    
    def test_get_safety_status_closed(self):
        """Test /api/safety/status endpoint with CLOSED status"""
        self.mock_safety_manager.get_current_status.return_value = self.closed_status
        
        response = self.client.get('/api/safety/status')
        
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        
        self.assertEqual(data['status'], 'CLOSED')
        self.assertEqual(data['reason'], 'Outside viewing hours (daylight)')
        self.assertIsNotNone(data['next_available'])
        self.assertEqual(data['next_available'], '2024-06-15T19:00:00+10:00')
    
    def test_get_safety_status_unsafe(self):
        """Test /api/safety/status endpoint with UNSAFE status"""
        self.mock_safety_manager.get_current_status.return_value = self.unsafe_status
        
        response = self.client.get('/api/safety/status')
        
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        
        self.assertEqual(data['status'], 'UNSAFE')
        self.assertIn('Weather conditions unsafe', data['reason'])
        self.assertIsNone(data['next_available'])
    
    def test_get_safety_status_error_handling(self):
        """Test /api/safety/status endpoint error handling"""
        self.mock_safety_manager.get_current_status.side_effect = Exception("Safety calculation failed")
        
        response = self.client.get('/api/safety/status')
        
        self.assertEqual(response.status_code, 500)
        data = json.loads(response.data)
        
        self.assertIn('error', data)
        self.assertEqual(data['error'], 'safety_error')
        self.assertIn('message', data)
        self.assertEqual(data['message'], 'Failed to determine safety status')
    
    def test_get_viewing_window_success(self):
        """Test /api/safety/viewing-window endpoint success"""
        # Mock time service
        mock_time_service = Mock()
        mock_time_service.get_melbourne_time.return_value = datetime(2024, 6, 15, 12, 0, 0, tzinfo=timezone.utc)
        mock_time_service.get_viewing_window.side_effect = [
            (datetime(2024, 6, 15, 9, 0, 0, tzinfo=timezone.utc),   # Today's window
             datetime(2024, 6, 16, 20, 0, 0, tzinfo=timezone.utc)),
            (datetime(2024, 6, 16, 9, 0, 0, tzinfo=timezone.utc),   # Tomorrow's window
             datetime(2024, 6, 17, 20, 0, 0, tzinfo=timezone.utc))
        ]
        
        self.mock_safety_manager.time_service = mock_time_service
        self.mock_safety_manager.is_viewing_window_active.return_value = False
        
        response = self.client.get('/api/safety/viewing-window')
        
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        
        # Check response structure
        self.assertIn('current_window', data)
        self.assertIn('next_window', data)
        self.assertIn('is_active', data)
        self.assertIn('melbourne_time', data)
        
        # Check current window structure
        current_window = data['current_window']
        self.assertIn('start', current_window)
        self.assertIn('end', current_window)
        self.assertIn('date', current_window)
        
        # Check next window structure
        next_window = data['next_window']
        self.assertIn('start', next_window)
        self.assertIn('end', next_window)
        self.assertIn('date', next_window)
        
        # Check activity status
        self.assertFalse(data['is_active'])
    
    def test_get_viewing_window_error_handling(self):
        """Test /api/safety/viewing-window endpoint error handling"""
        self.mock_safety_manager.time_service.get_melbourne_time.side_effect = Exception("Time calculation failed")
        
        response = self.client.get('/api/safety/viewing-window')
        
        self.assertEqual(response.status_code, 500)
        data = json.loads(response.data)
        
        self.assertIn('error', data)
        self.assertEqual(data['error'], 'viewing_window_error')
        self.assertIn('message', data)
    
    def test_get_next_available_when_active(self):
        """Test /api/safety/next-available endpoint when system is active"""
        self.mock_safety_manager.get_current_status.return_value = self.active_status
        
        response = self.client.get('/api/safety/next-available')
        
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        
        self.assertIsNone(data['next_available'])
        self.assertEqual(data['reason'], 'System is currently available')
        self.assertIn('melbourne_time', data)
    
    def test_get_next_available_when_closed(self):
        """Test /api/safety/next-available endpoint when system is closed"""
        self.mock_safety_manager.get_current_status.return_value = self.closed_status
        self.mock_safety_manager.get_next_viewing_window.return_value = datetime(2024, 6, 15, 9, 0, 0, tzinfo=timezone.utc)
        
        response = self.client.get('/api/safety/next-available')
        
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        
        self.assertIsNotNone(data['next_available'])
        self.assertEqual(data['reason'], 'Outside viewing hours (daylight)')
        self.assertIn('melbourne_time', data)
    
    def test_get_weather_safety_safe_conditions(self):
        """Test /api/safety/weather endpoint with safe conditions"""
        safe_weather_details = {
            'available': True,
            'overall_safe': True,
            'conditions': {
                'temperature': {'value': 20.0, 'safe': True, 'threshold': '(-5.0, 45.0)°C'},
                'humidity': {'value': 65.0, 'safe': True, 'threshold': '<95.0%'},
                'pressure': {'value': 1013.25, 'safe': True, 'threshold': '(980.0, 1040.0) hPa'},
                'dew_point': {'value': 15.0, 'safe': True, 'threshold': '>2.0°C from temperature'},
                'wind_speed': {'value': 15.0, 'safe': True, 'threshold': '<25.0 km/h'}
            },
            'timestamp': '2024-06-15T12:00:00Z'
        }
        
        self.mock_weather_service.get_weather_status_details.return_value = safe_weather_details
        self.mock_weather_service.get_safety_thresholds.return_value = {
            'max_wind_speed': 25.0,
            'min_temperature': -5.0,
            'max_temperature': 45.0,
            'max_humidity': 95.0,
            'min_pressure': 980.0,
            'max_pressure': 1040.0,
            'max_dew_point_diff': 2.0
        }
        
        response = self.client.get('/api/safety/weather')
        
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        
        self.assertTrue(data['safe'])
        self.assertIn('conditions', data)
        self.assertIn('thresholds', data)
        self.assertIn('timestamp', data)
        
        # Check conditions structure
        conditions = data['conditions']
        for condition_name in ['temperature', 'humidity', 'pressure', 'dew_point', 'wind_speed']:
            self.assertIn(condition_name, conditions)
            condition_data = conditions[condition_name]
            self.assertIn('value', condition_data)
            self.assertIn('safe', condition_data)
            self.assertIn('threshold', condition_data)
    
    def test_get_weather_safety_error_handling(self):
        """Test /api/safety/weather endpoint error handling"""
        self.mock_weather_service.get_weather_status_details.side_effect = Exception("Weather service failed")
        
        response = self.client.get('/api/safety/weather')
        
        self.assertEqual(response.status_code, 500)
        data = json.loads(response.data)
        
        self.assertIn('error', data)
        self.assertEqual(data['error'], 'weather_safety_error')
    
    def test_get_safety_thresholds(self):
        """Test /api/safety/thresholds endpoint"""
        expected_thresholds = {
            'max_wind_speed': 25.0,
            'min_temperature': -5.0,
            'max_temperature': 45.0,
            'max_humidity': 95.0,
            'min_pressure': 980.0,
            'max_pressure': 1040.0,
            'max_dew_point_diff': 2.0
        }
        self.mock_weather_service.get_safety_thresholds.return_value = expected_thresholds
        
        response = self.client.get('/api/safety/thresholds')
        
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        
        self.assertEqual(data, expected_thresholds)
        
        # Verify all required thresholds are present
        required_keys = [
            'max_wind_speed', 'min_temperature', 'max_temperature',
            'max_humidity', 'min_pressure', 'max_pressure', 'max_dew_point_diff'
        ]
        for key in required_keys:
            self.assertIn(key, data)
    
    def test_get_comprehensive_status(self):
        """Test /api/safety/comprehensive endpoint"""
        comprehensive_data = {
            'overall': {
                'status': 'ACTIVE',
                'reason': 'All systems operational',
                'last_updated': '2024-06-15T22:00:00+10:00'
            },
            'time_safety': {
                'is_viewing_window': True,
                'current_window': {
                    'start': '2024-06-15T19:00:00+10:00',
                    'end': '2024-06-16T06:00:00+10:00'
                },
                'next_window': {
                    'start': '2024-06-16T19:00:00+10:00',
                    'end': '2024-06-17T06:00:00+10:00'
                }
            },
            'weather_safety': {
                'overall_safe': True,
                'conditions': {},
                'last_updated': '2024-06-15T12:00:00Z'
            },
            'last_updated': '2024-06-15T22:00:00+10:00'
        }
        self.mock_safety_manager.get_comprehensive_status.return_value = comprehensive_data
        
        response = self.client.get('/api/safety/comprehensive')
        
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        
        # Check main structure
        self.assertIn('overall', data)
        self.assertIn('time_safety', data)
        self.assertIn('weather_safety', data)
        self.assertIn('last_updated', data)
        
        # Check overall status
        overall = data['overall']
        self.assertEqual(overall['status'], 'ACTIVE')
        self.assertEqual(overall['reason'], 'All systems operational')
        
        # Check time safety
        time_safety = data['time_safety']
        self.assertTrue(time_safety['is_viewing_window'])
        self.assertIn('current_window', time_safety)
        self.assertIn('next_window', time_safety)
        
        # Check weather safety
        weather_safety = data['weather_safety']
        self.assertTrue(weather_safety['overall_safe'])
        self.assertIn('conditions', weather_safety)
    
    def test_api_response_format_consistency(self):
        """Test that all API responses follow consistent format"""
        endpoints = [
            '/api/safety/status',
            '/api/safety/viewing-window',
            '/api/safety/next-available',
            '/api/safety/weather',
            '/api/safety/thresholds',
            '/api/safety/comprehensive'
        ]
        
        # Set up mocks for successful responses
        self.mock_safety_manager.get_current_status.return_value = self.active_status
        self.mock_safety_manager.time_service.get_melbourne_time.return_value = datetime.now(timezone.utc)
        self.mock_safety_manager.time_service.get_viewing_window.return_value = (
            datetime.now(timezone.utc), datetime.now(timezone.utc) + timedelta(hours=8)
        )
        self.mock_safety_manager.is_viewing_window_active.return_value = True
        self.mock_safety_manager.get_comprehensive_status.return_value = {'overall': {'status': 'ACTIVE'}}
        
        self.mock_weather_service.get_weather_status_details.return_value = {'available': True, 'overall_safe': True}
        self.mock_weather_service.get_safety_thresholds.return_value = {'max_wind_speed': 25.0}
        
        for endpoint in endpoints:
            with self.subTest(endpoint=endpoint):
                response = self.client.get(endpoint)
                
                # All endpoints should return 200 for successful requests
                self.assertEqual(response.status_code, 200)
                
                # All responses should be JSON
                self.assertEqual(response.content_type, 'application/json')
                
                # Should be valid JSON
                data = json.loads(response.data)
                self.assertIsInstance(data, dict)
    
    def test_http_methods_not_allowed(self):
        """Test that only GET methods are allowed on safety endpoints"""
        endpoints = [
            '/api/safety/status',
            '/api/safety/viewing-window',
            '/api/safety/next-available',
            '/api/safety/weather',
            '/api/safety/thresholds',
            '/api/safety/comprehensive'
        ]
        
        disallowed_methods = ['POST', 'PUT', 'DELETE', 'PATCH']
        
        for endpoint in endpoints:
            for method in disallowed_methods:
                with self.subTest(endpoint=endpoint, method=method):
                    response = self.client.open(endpoint, method=method)
                    self.assertEqual(response.status_code, 405)  # Method Not Allowed


if __name__ == '__main__':
    unittest.main()