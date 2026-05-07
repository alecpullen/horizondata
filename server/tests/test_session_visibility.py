"""
Unit tests for session-aware visibility API

Tests session target calculations for specific time windows,
adaptive sampling, quality scoring, and moon phase calculations.

Requirements tested: Session-aware target visibility API
"""

import unittest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime, timezone, timedelta
import sys
import os
import warnings

# Add the backend directory to the path and import required modules
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)

try:
    from astropy.coordinates import EarthLocation, SkyCoord, AltAz, get_sun, get_body, get_moon
    from astropy.time import Time
    from astropy import units as u
    import numpy as np
    import pytz
    
    # Import VisibilityService directly without going through app module
    sys.path.insert(0, os.path.join(backend_dir, 'app', 'services'))
    from visibility_service import VisibilityService, ENHANCED_OBJECT_DATABASE, MELBOURNE_LOCATION
    
    DEPENDENCIES_AVAILABLE = True
except ImportError as e:
    print(f"Skipping tests due to missing dependencies: {e}")
    DEPENDENCIES_AVAILABLE = False
    
    # Create dummy classes for testing structure
    class VisibilityService:
        pass
    
    ENHANCED_OBJECT_DATABASE = []
    MELBOURNE_LOCATION = None


@unittest.skipUnless(DEPENDENCIES_AVAILABLE, "Required dependencies not available")
class TestSessionVisibility(unittest.TestCase):
    """Test cases for session-aware visibility functionality"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.visibility_service = VisibilityService(cache_duration_minutes=1, update_interval_minutes=1)
        
        # Test session: June 15, 2024 8-10 PM Melbourne (good for winter observing)
        # UTC: June 15, 2024 10:00 - 12:00 UTC
        self.test_start = datetime(2024, 6, 15, 10, 0, 0, tzinfo=timezone.utc)
        self.test_end = datetime(2024, 6, 15, 12, 0, 0, tzinfo=timezone.utc)
        
        # Melbourne timezone
        self.melbourne_tz = pytz.timezone("Australia/Melbourne")
    
    def tearDown(self):
        """Clean up after tests"""
        # Stop any running background updates
        if hasattr(self.visibility_service, '_is_running') and self.visibility_service._is_running:
            self.visibility_service.stop_real_time_updates()
        
        # Clear cache
        self.visibility_service.clear_cache()
    
    def test_session_cache_key_generation(self):
        """Test that session cache keys are generated consistently"""
        key1 = self.visibility_service._get_session_cache_key(
            self.test_start, self.test_end, 30.0
        )
        key2 = self.visibility_service._get_session_cache_key(
            self.test_start, self.test_end, 30.0
        )
        
        # Same inputs should produce same key
        self.assertEqual(key1, key2)
        
        # Different inputs should produce different keys
        key3 = self.visibility_service._get_session_cache_key(
            self.test_start, self.test_end, 45.0
        )
        self.assertNotEqual(key1, key3)
    
    def test_adaptive_sampling_30_minutes(self):
        """Test that 30-minute session has 4 samples minimum"""
        start = self.test_start
        end = start + timedelta(minutes=30)
        
        samples = self.visibility_service._sample_session_times(start, end)
        
        self.assertEqual(len(samples), 4)
        self.assertEqual(samples[0], start)
        self.assertEqual(samples[-1], end)
    
    def test_adaptive_sampling_2_hours(self):
        """Test that 2-hour session has appropriate number of samples"""
        samples = self.visibility_service._sample_session_times(self.test_start, self.test_end)
        
        # 2 hours = roughly 4 samples (one per 30 min)
        self.assertGreaterEqual(len(samples), 4)
        self.assertLessEqual(len(samples), 12)
    
    def test_adaptive_sampling_8_hours(self):
        """Test that 8-hour session caps at 12 samples"""
        start = self.test_start
        end = start + timedelta(hours=8)
        
        samples = self.visibility_service._sample_session_times(start, end)
        
        # Should be capped at 12 samples
        self.assertLessEqual(len(samples), 12)
        self.assertGreaterEqual(len(samples), 8)
    
    def test_quality_score_bounds(self):
        """Test that quality scores are always 0-100"""
        test_cases = [
            (80, 80, True, False, 30),   # High elevation, transit
            (10, 5, False, False, 30),   # Low elevation
            (60, 20, False, True, 30),   # Sets during, big range
            (90, 90, True, False, 30),   # Excellent
            (15, 10, False, True, 20),   # Poor, sets
        ]
        
        for max_elev, min_elev, transits, sets_during, threshold in test_cases:
            score, grade = self.visibility_service._calculate_quality_score(
                max_elev, min_elev, transits, sets_during, threshold
            )
            
            self.assertGreaterEqual(score, 0, f"Score {score} below 0")
            self.assertLessEqual(score, 100, f"Score {score} above 100")
            self.assertIn(grade, ['excellent', 'good', 'fair', 'poor', 'not_visible'])
    
    def test_quality_grade_ranges(self):
        """Test that grades map correctly to score ranges"""
        # Excellent: 85-100
        score, grade = self.visibility_service._calculate_quality_score(90, 85, True, False, 30)
        self.assertEqual(grade, 'excellent')
        self.assertGreaterEqual(score, 85)
        
        # Good: 70-84
        score, grade = self.visibility_service._calculate_quality_score(75, 70, False, False, 30)
        self.assertEqual(grade, 'good')
        self.assertGreaterEqual(score, 70)
        self.assertLess(score, 85)
        
        # Fair: 50-69
        score, grade = self.visibility_service._calculate_quality_score(60, 50, False, False, 30)
        self.assertEqual(grade, 'fair')
        self.assertGreaterEqual(score, 50)
        self.assertLess(score, 70)
        
        # Poor: 20-49
        score, grade = self.visibility_service._calculate_quality_score(30, 20, False, False, 30)
        self.assertEqual(grade, 'poor')
        self.assertGreaterEqual(score, 20)
        self.assertLess(score, 50)
        
        # Not visible: 0-19
        score, grade = self.visibility_service._calculate_quality_score(15, 10, False, False, 30)
        self.assertEqual(grade, 'not_visible')
        self.assertLess(score, 20)
    
    def test_session_validation_end_before_start(self):
        """Test that end_time before start_time raises error"""
        with self.assertRaises(ValueError) as context:
            self.visibility_service.get_session_targets(
                self.test_end, self.test_start, min_elevation=30
            )
        self.assertIn("after start_time", str(context.exception))
    
    def test_session_validation_too_long(self):
        """Test that session > 8 hours raises error"""
        long_end = self.test_start + timedelta(hours=9)
        
        with self.assertRaises(ValueError) as context:
            self.visibility_service.get_session_targets(
                self.test_start, long_end, min_elevation=30
            )
        self.assertIn("8 hours", str(context.exception))
    
    def test_session_validation_high_elevation(self):
        """Test that min_elevation > 90 raises error"""
        with self.assertRaises(ValueError) as context:
            self.visibility_service.get_session_targets(
                self.test_start, self.test_end, min_elevation=95
            )
        self.assertIn("90", str(context.exception))
    
    def test_moon_phase_calculation(self):
        """Test moon phase calculation returns valid data"""
        astro_time = Time(self.test_start)
        
        moon_data = self.visibility_service._calculate_moon_phase(astro_time)
        
        # Check required fields
        self.assertIn('phase_name', moon_data)
        self.assertIn('illumination_percent', moon_data)
        self.assertIn('phase_angle', moon_data)
        self.assertIn('is_interfering', moon_data)
        
        # Phase name should be valid
        valid_phases = [
            'New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous',
            'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent'
        ]
        self.assertIn(moon_data['phase_name'], valid_phases)
        
        # Illumination should be 0-100
        if moon_data['illumination_percent'] is not None:
            self.assertGreaterEqual(moon_data['illumination_percent'], 0)
            self.assertLessEqual(moon_data['illumination_percent'], 100)
    
    def test_target_structure(self):
        """Test that target data has correct structure"""
        result = self.visibility_service.get_session_targets(
            self.test_start, self.test_end, min_elevation=30
        )
        
        self.assertIn('targets', result)
        self.assertIsInstance(result['targets'], list)
        
        if result['targets']:
            target = result['targets'][0]
            
            # Required fields
            required_fields = [
                'name', 'type', 'constellation', 'magnitude', 'catalog_id',
                'coordinates', 'quality_score', 'quality_grade',
                'elevation_start', 'elevation_end', 'elevation_min', 'elevation_max',
                'transits_during_session', 'visible_entire_session',
                'sets_during_session', 'best_time', 'recommendation'
            ]
            
            for field in required_fields:
                self.assertIn(field, target, f"Missing field: {field}")
            
            # Coordinates structure
            coords = target['coordinates']
            self.assertIn('ra_hours', coords)
            self.assertIn('ra', coords)
            self.assertIn('dec_degrees', coords)
            self.assertIn('dec', coords)
            
            # Quality score should be valid
            self.assertIsInstance(target['quality_score'], int)
            self.assertGreaterEqual(target['quality_score'], 0)
            self.assertLessEqual(target['quality_score'], 100)
            
            # Quality grade should be valid
            self.assertIn(target['quality_grade'], 
                         ['excellent', 'good', 'fair', 'poor', 'not_visible'])
    
    def test_session_metadata_structure(self):
        """Test that session metadata has correct structure"""
        result = self.visibility_service.get_session_targets(
            self.test_start, self.test_end, min_elevation=30
        )
        
        self.assertIn('session', result)
        session = result['session']
        
        # Required session fields
        required_fields = [
            'start', 'end', 'duration_minutes', 'timezone',
            'local_start', 'local_end', 'is_night', 'sun', 'moon'
        ]
        
        for field in required_fields:
            self.assertIn(field, session, f"Missing session field: {field}")
        
        # Check timezone
        self.assertEqual(session['timezone'], 'Australia/Melbourne')
        
        # Duration should match input
        expected_duration = 120  # 2 hours
        self.assertEqual(session['duration_minutes'], expected_duration)
        
        # Sun data structure
        self.assertIn('set_time', session['sun'])
        self.assertIn('rise_time', session['sun'])
        
        # Moon data structure
        self.assertIn('phase_name', session['moon'])
        self.assertIn('illumination_percent', session['moon'])
    
    def test_summary_statistics(self):
        """Test that summary statistics are calculated correctly"""
        result = self.visibility_service.get_session_targets(
            self.test_start, self.test_end, min_elevation=30
        )
        
        self.assertIn('summary', result)
        summary = result['summary']
        
        # Should have total count
        self.assertIn('total_checked', summary)
        self.assertEqual(summary['total_checked'], len(ENHANCED_OBJECT_DATABASE))
        
        # Should have grade breakdown
        self.assertIn('by_grade', summary)
        by_grade = summary['by_grade']
        
        for grade in ['excellent', 'good', 'fair', 'poor', 'not_visible']:
            self.assertIn(grade, by_grade)
            self.assertIsInstance(by_grade[grade], int)
        
        # Sum should equal total targets
        total_targets = len(result['targets'])
        sum_by_grade = sum(by_grade.values())
        self.assertEqual(sum_by_grade, total_targets)
    
    def test_session_caching(self):
        """Test that session results are cached"""
        # First call - should calculate
        result1 = self.visibility_service.get_session_targets(
            self.test_start, self.test_end, min_elevation=30
        )
        self.assertFalse(result1.get('cache_used', True))
        
        # Second call - should use cache
        result2 = self.visibility_service.get_session_targets(
            self.test_start, self.test_end, min_elevation=30
        )
        # Results should be identical
        self.assertEqual(len(result1['targets']), len(result2['targets']))
    
    def test_best_time_formatting(self):
        """Test best time formatting for different scenarios"""
        from datetime import datetime
        
        # Transit at high elevation
        transit_time = datetime(2024, 6, 15, 21, 30, 0)
        best = self.visibility_service._format_best_time(transit_time, True, 60.0)
        self.assertRegex(best, r'\d{2}:\d{2}-\d{2}:\d{2}')
        
        # Transit at low elevation (just time, not window)
        best = self.visibility_service._format_best_time(transit_time, True, 25.0)
        self.assertRegex(best, r'\d{2}:\d{2}')
        
        # No transit
        best = self.visibility_service._format_best_time(transit_time, False, 60.0)
        self.assertEqual(best, "Throughout session")
    
    def test_recommendation_generation(self):
        """Test recommendation text generation"""
        from datetime import datetime
        
        transit_time = datetime(2024, 6, 15, 21, 30, 0)
        
        # Excellent with transit
        rec = self.visibility_service._generate_session_recommendation(
            'excellent', True, False, transit_time, 70.0, 30
        )
        self.assertIn('Transits', rec)
        
        # Good without transit
        rec = self.visibility_service._generate_session_recommendation(
            'good', False, False, transit_time, 50.0, 30
        )
        self.assertIn('Well positioned', rec)
        
        # Poor setting
        rec = self.visibility_service._generate_session_recommendation(
            'poor', False, True, transit_time, 20.0, 30
        )
        self.assertIn('Setting', rec)


@unittest.skipUnless(DEPENDENCIES_AVAILABLE, "Required dependencies not available")
class TestSessionVisibilityValidation(unittest.TestCase):
    """Test validation and error handling"""
    
    def setUp(self):
        self.visibility_service = VisibilityService(cache_duration_minutes=1, update_interval_minutes=1)
    
    def tearDown(self):
        self.visibility_service.clear_cache()
    
    def test_targets_sorted_by_quality(self):
        """Test that targets are sorted by quality score descending"""
        test_start = datetime(2024, 6, 15, 10, 0, 0, tzinfo=timezone.utc)
        test_end = datetime(2024, 6, 15, 12, 0, 0, tzinfo=timezone.utc)
        
        result = self.visibility_service.get_session_targets(
            test_start, test_end, min_elevation=30
        )
        
        if len(result['targets']) > 1:
            scores = [t['quality_score'] for t in result['targets']]
            self.assertEqual(scores, sorted(scores, reverse=True))


if __name__ == '__main__':
    unittest.main()
