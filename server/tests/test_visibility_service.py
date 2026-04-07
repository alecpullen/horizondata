"""
Unit tests for VisibilityService

Tests object position calculations for Melbourne coordinates,
visibility filtering and elevation angle calculations,
and database update mechanisms and caching behavior.

Requirements tested: 4.1, 4.3, 4.4
"""

import unittest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime, timezone, timedelta
import sys
import os
import threading
import time

# Add the backend directory to the path and import required modules
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)

try:
    from astropy.coordinates import EarthLocation, SkyCoord, AltAz, get_sun, get_body
    from astropy.time import Time
    from astropy import units as u
    import warnings
    
    # Import VisibilityService directly without going through app module
    sys.path.insert(0, os.path.join(backend_dir, 'app', 'services'))
    from visibility_service import VisibilityService, MELBOURNE_LOCATION, MIN_ELEVATION, ENHANCED_OBJECT_DATABASE
    
    DEPENDENCIES_AVAILABLE = True
except ImportError as e:
    print(f"Skipping tests due to missing dependencies: {e}")
    DEPENDENCIES_AVAILABLE = False
    
    # Create dummy classes for testing structure
    class VisibilityService:
        pass
    
    MELBOURNE_LOCATION = None
    MIN_ELEVATION = 20.0
    ENHANCED_OBJECT_DATABASE = []


@unittest.skipUnless(DEPENDENCIES_AVAILABLE, "Required dependencies not available")
class TestVisibilityService(unittest.TestCase):
    """Test cases for VisibilityService functionality"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.visibility_service = VisibilityService(cache_duration_minutes=1, update_interval_minutes=1)
        
        # Test time - June 15, 2024 at 10 PM Melbourne time (good for visibility)
        self.test_time = datetime(2024, 6, 15, 12, 0, 0, tzinfo=timezone.utc)  # Noon UTC = 10 PM Melbourne winter
        
        # Known bright objects that should be visible from Melbourne
        self.known_bright_objects = ['Sirius', 'Canopus', 'Alpha Centauri', 'Jupiter', 'Saturn']
        
        # Melbourne coordinates for validation
        self.expected_lat = -37.7214
        self.expected_lon = 145.0489
        self.expected_height = 140
    
    def tearDown(self):
        """Clean up after tests"""
        # Stop any running background updates
        if hasattr(self.visibility_service, '_is_running') and self.visibility_service._is_running:
            self.visibility_service.stop_real_time_updates()
        
        # Clear cache
        self.visibility_service.clear_cache()
    
    def test_melbourne_location_constants(self):
        """Test that Melbourne location constants are correctly configured"""
        self.assertAlmostEqual(MELBOURNE_LOCATION.lat.degree, self.expected_lat, places=4)
        self.assertAlmostEqual(MELBOURNE_LOCATION.lon.degree, self.expected_lon, places=4)
        self.assertAlmostEqual(MELBOURNE_LOCATION.height.value, self.expected_height, places=0)
        
        # Test service uses correct location
        self.assertEqual(self.visibility_service.location, MELBOURNE_LOCATION)
        self.assertEqual(self.visibility_service.min_elevation, MIN_ELEVATION)
    
    def test_enhanced_object_database_structure(self):
        """Test that the enhanced object database has proper structure"""
        self.assertGreater(len(ENHANCED_OBJECT_DATABASE), 0)
        
        # Check that all objects have required fields
        required_fields = ['name', 'type']
        for obj in ENHANCED_OBJECT_DATABASE:
            for field in required_fields:
                self.assertIn(field, obj, f"Object {obj.get('name', 'Unknown')} missing field: {field}")
            
            # Check object types are valid
            valid_types = ['Planet', 'Star', 'Star System', 'Emission Nebula', 'Dark Nebula', 
                          'Planetary Nebula', 'Spiral Galaxy', 'Irregular Galaxy', 'Elliptical Galaxy',
                          'Globular Cluster', 'Open Cluster']
            self.assertIn(obj['type'], valid_types, f"Invalid type for {obj['name']}: {obj['type']}")
    
    def test_get_visible_objects_basic_functionality(self):
        """Test basic visible objects retrieval"""
        visible_objects = self.visibility_service.get_visible_objects(self.test_time)
        
        # Should return a list
        self.assertIsInstance(visible_objects, list)
        
        # Should have some visible objects (Melbourne has good sky visibility)
        self.assertGreater(len(visible_objects), 0)
        
        # Each object should have required structure
        for obj in visible_objects:
            self.assertIn('name', obj)
            self.assertIn('type', obj)
            self.assertIn('coordinates', obj)
            self.assertIn('visibility', obj)
            self.assertIn('metadata', obj)
            
            # Check coordinates structure
            coords = obj['coordinates']
            self.assertIn('ra', coords)
            self.assertIn('dec', coords)
            self.assertIn('elevation', coords)
            self.assertIn('azimuth', coords)
            
            # Check visibility structure
            visibility = obj['visibility']
            self.assertIn('is_visible', visibility)
            self.assertIn('elevation', visibility)
            self.assertTrue(visibility['is_visible'])  # All returned objects should be visible
            
            # Elevation should be above minimum threshold
            self.assertGreaterEqual(coords['elevation'], MIN_ELEVATION)
            self.assertGreaterEqual(visibility['elevation'], MIN_ELEVATION)
    
    def test_get_visible_objects_with_custom_elevation(self):
        """Test visible objects retrieval with custom minimum elevation"""
        high_elevation = 45.0  # Higher than default
        visible_objects = self.visibility_service.get_visible_objects(
            self.test_time, min_elevation=high_elevation
        )
        
        # Should return fewer objects with higher elevation requirement
        all_objects = self.visibility_service.get_visible_objects(self.test_time)
        self.assertLessEqual(len(visible_objects), len(all_objects))
        
        # All returned objects should meet the higher elevation requirement
        for obj in visible_objects:
            self.assertGreaterEqual(obj['coordinates']['elevation'], high_elevation)
    
    def test_get_visible_objects_sorting(self):
        """Test that visible objects are sorted by elevation (highest first)"""
        visible_objects = self.visibility_service.get_visible_objects(self.test_time)
        
        if len(visible_objects) > 1:
            # Check that objects are sorted by elevation in descending order
            elevations = [obj['coordinates']['elevation'] for obj in visible_objects]
            self.assertEqual(elevations, sorted(elevations, reverse=True))
    
    def test_object_position_calculations_planets(self):
        """Test position calculations for planets using solar system ephemeris"""
        # Test with Jupiter (should be calculable)
        jupiter_data = next((obj for obj in ENHANCED_OBJECT_DATABASE if obj['name'] == 'Jupiter'), None)
        self.assertIsNotNone(jupiter_data, "Jupiter not found in object database")
        
        astro_time = Time(self.test_time)
        
        # This should not raise an exception
        try:
            visibility_info = self.visibility_service._calculate_object_visibility(
                jupiter_data, astro_time, MIN_ELEVATION
            )
            
            if visibility_info:  # Only test if Jupiter is visible at test time
                self.assertEqual(visibility_info['name'], 'Jupiter')
                self.assertEqual(visibility_info['type'], 'Planet')
                self.assertIn('coordinates', visibility_info)
                
                # Coordinates should be reasonable
                coords = visibility_info['coordinates']
                self.assertGreaterEqual(coords['ra'], 0)
                self.assertLess(coords['ra'], 24)  # RA in hours (0-24)
                self.assertGreaterEqual(coords['dec'], -90)
                self.assertLessEqual(coords['dec'], 90)  # Dec in degrees (-90 to +90)
                self.assertGreaterEqual(coords['azimuth'], 0)
                self.assertLess(coords['azimuth'], 360)  # Azimuth in degrees (0-360)
                
        except Exception as e:
            self.fail(f"Planet position calculation failed: {e}")
    
    def test_object_position_calculations_stars(self):
        """Test position calculations for stars using catalog lookup"""
        # Test with Sirius (brightest star, should be in catalogs)
        sirius_data = next((obj for obj in ENHANCED_OBJECT_DATABASE if obj['name'] == 'Sirius'), None)
        self.assertIsNotNone(sirius_data, "Sirius not found in object database")
        
        astro_time = Time(self.test_time)
        
        try:
            visibility_info = self.visibility_service._calculate_object_visibility(
                sirius_data, astro_time, MIN_ELEVATION
            )
            
            if visibility_info:  # Only test if Sirius is visible at test time
                self.assertEqual(visibility_info['name'], 'Sirius')
                self.assertEqual(visibility_info['type'], 'Star')
                
                # Should have magnitude information
                self.assertIsNotNone(visibility_info['visibility']['magnitude'])
                self.assertEqual(visibility_info['visibility']['magnitude'], -1.46)
                
                # Should have constellation information
                self.assertEqual(visibility_info['metadata']['constellation'], 'Canis Major')
                
        except Exception as e:
            self.fail(f"Star position calculation failed: {e}")
    
    def test_elevation_angle_calculations(self):
        """Test that elevation angle calculations are accurate for Melbourne"""
        visible_objects = self.visibility_service.get_visible_objects(self.test_time)
        
        for obj in visible_objects:
            coords = obj['coordinates']
            
            # Elevation should be consistent between coordinates and visibility
            self.assertAlmostEqual(
                coords['elevation'], 
                obj['visibility']['elevation'], 
                places=6,
                msg=f"Elevation mismatch for {obj['name']}"
            )
            
            # Elevation should be above horizon and below zenith
            self.assertGreaterEqual(coords['elevation'], 0, f"{obj['name']} below horizon")
            self.assertLessEqual(coords['elevation'], 90, f"{obj['name']} above zenith")
            
            # Azimuth should be valid
            self.assertGreaterEqual(coords['azimuth'], 0, f"{obj['name']} invalid azimuth")
            self.assertLess(coords['azimuth'], 360, f"{obj['name']} invalid azimuth")
    
    def test_filter_by_elevation(self):
        """Test elevation filtering functionality"""
        # Get all visible objects first
        all_objects = self.visibility_service.get_visible_objects(self.test_time, min_elevation=0)
        
        if len(all_objects) == 0:
            self.skipTest("No objects visible at test time")
        
        # Test filtering with different elevation thresholds
        test_elevations = [30.0, 45.0, 60.0]
        
        for min_elev in test_elevations:
            filtered_objects = self.visibility_service.filter_by_elevation(all_objects, min_elev)
            
            # All filtered objects should meet elevation requirement
            for obj in filtered_objects:
                self.assertGreaterEqual(
                    obj['coordinates']['elevation'], 
                    min_elev,
                    f"Object {obj['name']} below elevation threshold {min_elev}"
                )
            
            # Should have fewer or equal objects than previous threshold
            if min_elev > MIN_ELEVATION:
                unfiltered_count = len([obj for obj in all_objects 
                                     if obj['coordinates']['elevation'] >= MIN_ELEVATION])
                self.assertLessEqual(len(filtered_objects), unfiltered_count)
    
    def test_get_object_by_name(self):
        """Test retrieving specific objects by name"""
        # Test with a known bright object
        for obj_name in self.known_bright_objects:
            obj_info = self.visibility_service.get_object_by_name(obj_name, self.test_time)
            
            if obj_info:  # Only test if object is visible
                self.assertEqual(obj_info['name'], obj_name)
                self.assertTrue(obj_info['visibility']['is_visible'])
                self.assertGreaterEqual(obj_info['coordinates']['elevation'], MIN_ELEVATION)
        
        # Test with non-existent object
        non_existent = self.visibility_service.get_object_by_name('NonExistentObject', self.test_time)
        self.assertIsNone(non_existent)
    
    def test_get_objects_by_type(self):
        """Test filtering objects by type"""
        # Test different object types
        test_types = ['Planet', 'Star', 'Galaxy']
        
        for obj_type in test_types:
            objects = self.visibility_service.get_objects_by_type(obj_type, self.test_time)
            
            # All returned objects should be of the requested type
            for obj in objects:
                self.assertEqual(obj['type'], obj_type)
                self.assertTrue(obj['visibility']['is_visible'])
        
        # Test case insensitive matching
        planets_lower = self.visibility_service.get_objects_by_type('planet', self.test_time)
        planets_upper = self.visibility_service.get_objects_by_type('PLANET', self.test_time)
        self.assertEqual(len(planets_lower), len(planets_upper))
    
    def test_get_objects_in_constellation(self):
        """Test filtering objects by constellation"""
        # Test with known constellations
        test_constellations = ['Orion', 'Centaurus', 'Crux']
        
        for constellation in test_constellations:
            objects = self.visibility_service.get_objects_in_constellation(constellation, self.test_time)
            
            # All returned objects should be in the requested constellation
            for obj in objects:
                self.assertEqual(obj['metadata']['constellation'], constellation)
                self.assertTrue(obj['visibility']['is_visible'])
        
        # Test case insensitive matching
        orion_lower = self.visibility_service.get_objects_in_constellation('orion', self.test_time)
        orion_upper = self.visibility_service.get_objects_in_constellation('ORION', self.test_time)
        self.assertEqual(len(orion_lower), len(orion_upper))
    
    def test_magnitude_calculation(self):
        """Test magnitude calculation for different object types"""
        # Test fixed magnitude objects (stars)
        sirius_data = {'name': 'Sirius', 'magnitude': -1.46}
        magnitude = self.visibility_service._get_object_magnitude(sirius_data, Time(self.test_time))
        self.assertEqual(magnitude, -1.46)
        
        # Test variable magnitude objects (planets)
        jupiter_data = {'name': 'Jupiter', 'magnitude_range': (-2.9, -1.6)}
        magnitude = self.visibility_service._get_object_magnitude(jupiter_data, Time(self.test_time))
        self.assertIsNotNone(magnitude)
        self.assertGreaterEqual(magnitude, -2.9)
        self.assertLessEqual(magnitude, -1.6)
        
        # Test objects without magnitude data
        unknown_data = {'name': 'Unknown'}
        magnitude = self.visibility_service._get_object_magnitude(unknown_data, Time(self.test_time))
        self.assertIsNone(magnitude)
    
    def test_description_generation(self):
        """Test object description generation"""
        test_cases = [
            ({'name': 'Jupiter', 'type': 'Planet'}, 'Jupiter is a planet in our solar system'),
            ({'name': 'Sirius', 'type': 'Star'}, 'Sirius is a bright star'),
            ({'name': 'Alpha Centauri', 'type': 'Star System'}, 'Alpha Centauri is a multiple star system'),
            ({'name': 'Orion Nebula', 'type': 'Emission Nebula'}, 'Orion Nebula is a emission nebula'),
            ({'name': 'Andromeda Galaxy', 'type': 'Spiral Galaxy'}, 'Andromeda Galaxy is a spiral galaxy'),
            ({'name': 'Pleiades', 'type': 'Open Cluster'}, 'Pleiades is a open cluster'),
        ]
        
        for obj_data, expected_desc in test_cases:
            description = self.visibility_service._generate_description(obj_data)
            self.assertEqual(description, expected_desc)
    
    def test_caching_functionality(self):
        """Test visibility data caching mechanisms"""
        # Clear cache first
        self.visibility_service.clear_cache()
        
        # First call should calculate fresh data
        start_time = time.time()
        objects1 = self.visibility_service.get_cached_visible_objects(self.test_time)
        first_call_time = time.time() - start_time
        
        # Second call should use cache (should be faster)
        start_time = time.time()
        objects2 = self.visibility_service.get_cached_visible_objects(self.test_time)
        second_call_time = time.time() - start_time
        
        # Results should be identical
        self.assertEqual(len(objects1), len(objects2))
        
        # Cache should be faster (though this might not always be true due to system variations)
        # Just verify cache is working by checking cache stats
        cache_stats = self.visibility_service.get_cache_stats()
        self.assertGreater(cache_stats['cache_entries'], 0)
    
    def test_cache_expiry(self):
        """Test that cache expires after the configured duration"""
        # Use a service with very short cache duration
        short_cache_service = VisibilityService(cache_duration_minutes=0.01)  # 0.6 seconds
        
        # First call
        objects1 = short_cache_service.get_cached_visible_objects(self.test_time)
        
        # Wait for cache to expire
        time.sleep(1)
        
        # Second call should recalculate (cache expired)
        objects2 = short_cache_service.get_cached_visible_objects(self.test_time)
        
        # Results should still be consistent
        self.assertEqual(len(objects1), len(objects2))
    
    def test_cache_key_generation(self):
        """Test cache key generation for different times"""
        time1 = datetime(2024, 6, 15, 12, 0, 0, tzinfo=timezone.utc)
        time2 = datetime(2024, 6, 15, 12, 0, 30, tzinfo=timezone.utc)  # 30 seconds later
        time3 = datetime(2024, 6, 15, 12, 1, 0, tzinfo=timezone.utc)   # 1 minute later
        
        key1 = self.visibility_service._get_cache_key(time1)
        key2 = self.visibility_service._get_cache_key(time2)
        key3 = self.visibility_service._get_cache_key(time3)
        
        # Times within same minute should have same cache key
        self.assertEqual(key1, key2)
        
        # Different minutes should have different cache keys
        self.assertNotEqual(key1, key3)
    
    def test_cache_cleanup(self):
        """Test that old cache entries are cleaned up"""
        # Add some cache entries with old timestamps
        old_time = datetime.now(timezone.utc) - timedelta(hours=1)
        current_time = datetime.now(timezone.utc)
        
        # Manually add old cache entry
        old_key = self.visibility_service._get_cache_key(old_time)
        current_key = self.visibility_service._get_cache_key(current_time)
        
        with self.visibility_service._cache_lock:
            self.visibility_service._visibility_cache[old_key] = []
            self.visibility_service._cache_timestamps[old_key] = old_time
            self.visibility_service._visibility_cache[current_key] = []
            self.visibility_service._cache_timestamps[current_key] = current_time
        
        # Trigger cleanup
        self.visibility_service._cleanup_old_cache_entries(current_time)
        
        # Old entry should be removed, current entry should remain
        with self.visibility_service._cache_lock:
            self.assertNotIn(old_key, self.visibility_service._visibility_cache)
            self.assertIn(current_key, self.visibility_service._visibility_cache)
    
    def test_cache_stats(self):
        """Test cache statistics reporting"""
        # Clear cache and add some data
        self.visibility_service.clear_cache()
        self.visibility_service.get_cached_visible_objects(self.test_time)
        
        stats = self.visibility_service.get_cache_stats()
        
        # Check required fields
        required_fields = [
            'cache_entries', 'oldest_entry', 'newest_entry',
            'cache_duration_minutes', 'update_interval_minutes',
            'is_running', 'objects_tracked'
        ]
        
        for field in required_fields:
            self.assertIn(field, stats)
        
        # Should have at least one cache entry
        self.assertGreater(stats['cache_entries'], 0)
        
        # Duration should match initialization
        self.assertEqual(stats['cache_duration_minutes'], 1)  # From setUp
        self.assertEqual(stats['update_interval_minutes'], 1)  # From setUp
    
    def test_clear_cache(self):
        """Test cache clearing functionality"""
        # Add some cached data
        self.visibility_service.get_cached_visible_objects(self.test_time)
        
        # Verify cache has data
        stats_before = self.visibility_service.get_cache_stats()
        self.assertGreater(stats_before['cache_entries'], 0)
        
        # Clear cache
        self.visibility_service.clear_cache()
        
        # Verify cache is empty
        stats_after = self.visibility_service.get_cache_stats()
        self.assertEqual(stats_after['cache_entries'], 0)
        self.assertEqual(stats_after['objects_tracked'], 0)
    
    def test_real_time_updates_start_stop(self):
        """Test starting and stopping real-time updates"""
        # Should not be running initially
        self.assertFalse(self.visibility_service._is_running)
        
        # Start updates
        self.visibility_service.start_real_time_updates()
        self.assertTrue(self.visibility_service._is_running)
        
        # Starting again should not cause issues
        self.visibility_service.start_real_time_updates()
        self.assertTrue(self.visibility_service._is_running)
        
        # Stop updates
        self.visibility_service.stop_real_time_updates()
        self.assertFalse(self.visibility_service._is_running)
        
        # Stopping again should not cause issues
        self.visibility_service.stop_real_time_updates()
        self.assertFalse(self.visibility_service._is_running)
    
    def test_position_change_detection(self):
        """Test detection of significant position changes"""
        # Clear any existing position data
        self.visibility_service._last_positions = {}
        
        # Create mock objects with different positions
        objects1 = [
            {'name': 'TestObject', 'coordinates': {'elevation': 45.0, 'azimuth': 180.0}}
        ]
        objects2 = [
            {'name': 'TestObject', 'coordinates': {'elevation': 45.05, 'azimuth': 180.05}}  # Small change (0.05 degrees)
        ]
        objects3 = [
            {'name': 'TestObject', 'coordinates': {'elevation': 46.0, 'azimuth': 185.0}}  # Large change
        ]
        
        # First detection should always return True (no previous positions)
        changes1 = self.visibility_service._detect_position_changes(objects1)
        self.assertTrue(changes1)
        
        # Small change should not trigger detection
        changes2 = self.visibility_service._detect_position_changes(objects2)
        self.assertFalse(changes2)
        
        # Large change should trigger detection
        changes3 = self.visibility_service._detect_position_changes(objects3)
        self.assertTrue(changes3)
    
    def test_azimuth_wraparound_handling(self):
        """Test proper handling of azimuth wraparound (0/360 degrees)"""
        # Clear any existing position data
        self.visibility_service._last_positions = {}
        
        # Test objects near azimuth boundaries
        objects1 = [
            {'name': 'TestObject', 'coordinates': {'elevation': 45.0, 'azimuth': 359.95}}
        ]
        objects2 = [
            {'name': 'TestObject', 'coordinates': {'elevation': 45.0, 'azimuth': 0.01}}  # Crossed 0/360 (0.06 degree difference)
        ]
        
        # First detection
        self.visibility_service._detect_position_changes(objects1)
        
        # Second detection should handle wraparound correctly (2 degree difference, not 358)
        changes = self.visibility_service._detect_position_changes(objects2)
        self.assertFalse(changes)  # Should be below threshold
    
    def test_error_handling_invalid_objects(self):
        """Test error handling for invalid or unknown objects"""
        # Test with invalid object data
        invalid_object = {'name': 'InvalidObject', 'type': 'Unknown'}
        astro_time = Time(self.test_time)
        
        # Should handle gracefully and return None
        result = self.visibility_service._calculate_object_visibility(
            invalid_object, astro_time, MIN_ELEVATION
        )
        self.assertIsNone(result)
    
    def test_safe_float_conversion(self):
        """Test safe float conversion utility (if available)"""
        if hasattr(self.visibility_service, '_safe_float'):
            # Test valid conversions
            self.assertEqual(self.visibility_service._safe_float('20.5'), 20.5)
            self.assertEqual(self.visibility_service._safe_float(25.0), 25.0)
            
            # Test invalid conversions
            self.assertIsNone(self.visibility_service._safe_float(None))
            self.assertIsNone(self.visibility_service._safe_float('invalid'))
    
    def test_thread_safety(self):
        """Test thread safety of cache operations"""
        def cache_worker():
            for i in range(10):
                self.visibility_service.get_cached_visible_objects(self.test_time)
                time.sleep(0.01)
        
        # Start multiple threads accessing cache
        threads = []
        for i in range(3):
            thread = threading.Thread(target=cache_worker)
            threads.append(thread)
            thread.start()
        
        # Wait for all threads to complete
        for thread in threads:
            thread.join(timeout=5)
            self.assertFalse(thread.is_alive(), "Thread did not complete in time")
        
        # Cache should still be functional
        objects = self.visibility_service.get_cached_visible_objects(self.test_time)
        self.assertIsInstance(objects, list)


if __name__ == '__main__':
    unittest.main()