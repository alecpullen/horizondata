"""
Unit tests for TimeService

Tests sunrise/sunset calculations, DST handling, timezone calculations,
and viewing window edge cases for Melbourne, Australia.

Requirements tested: 1.1, 1.4
"""

import unittest
from datetime import datetime, date, timedelta
import sys
import os

# Add the backend directory to the path and import required modules
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)

try:
    import pytz
    from astropy.coordinates import EarthLocation, get_sun
    from astropy.time import Time
    from astropy import units as u
    import warnings
    
    # Import TimeService directly without going through app module
    sys.path.insert(0, os.path.join(backend_dir, 'app', 'services'))
    from time_service import TimeService
    
    DEPENDENCIES_AVAILABLE = True
except ImportError as e:
    print(f"Skipping tests due to missing dependencies: {e}")
    DEPENDENCIES_AVAILABLE = False
    
    # Create a dummy TimeService for testing structure
    class TimeService:
        pass


@unittest.skipUnless(DEPENDENCIES_AVAILABLE, "Required dependencies not available")
class TestTimeService(unittest.TestCase):
    """Test cases for TimeService functionality"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.time_service = TimeService()
        self.melbourne_tz = pytz.timezone('Australia/Melbourne')
    
    def test_melbourne_timezone_constants(self):
        """Test that Melbourne timezone and location constants are correct"""
        # Test timezone
        self.assertEqual(str(self.time_service.MELBOURNE_TZ), 'Australia/Melbourne')
        
        # Test location coordinates (Melbourne)
        self.assertAlmostEqual(self.time_service.MELBOURNE_LOCATION.lat.degree, -37.7214, places=4)
        self.assertAlmostEqual(self.time_service.MELBOURNE_LOCATION.lon.degree, 145.0489, places=4)
        self.assertEqual(self.time_service.MELBOURNE_LOCATION.height.value, 140)
        
        # Test viewing buffer
        self.assertEqual(self.time_service.VIEWING_BUFFER_HOURS, 1)
    
    def test_get_melbourne_time(self):
        """Test getting current Melbourne time with timezone handling"""
        melbourne_time = self.time_service.get_melbourne_time()
        
        # Should return timezone-aware datetime
        self.assertIsNotNone(melbourne_time.tzinfo)
        self.assertEqual(melbourne_time.tzinfo, self.melbourne_tz)
        
        # Should be within reasonable range of current time
        utc_now = datetime.utcnow().replace(tzinfo=pytz.UTC)
        time_diff = abs((melbourne_time.astimezone(pytz.UTC) - utc_now).total_seconds())
        self.assertLess(time_diff, 5)  # Within 5 seconds
    
    def test_daylight_saving_detection_summer(self):
        """Test DST detection during summer months (AEDT)"""
        # January 15th - should be DST (AEDT)
        summer_date = self.melbourne_tz.localize(datetime(2024, 1, 15, 12, 0, 0))
        self.assertTrue(self.time_service.is_daylight_saving_active(summer_date))
    
    def test_daylight_saving_detection_winter(self):
        """Test DST detection during winter months (AEST)"""
        # July 15th - should not be DST (AEST)
        winter_date = self.melbourne_tz.localize(datetime(2024, 7, 15, 12, 0, 0))
        self.assertFalse(self.time_service.is_daylight_saving_active(winter_date))
    
    def test_daylight_saving_transition_dates(self):
        """Test DST transitions around changeover dates"""
        # DST typically starts first Sunday in October
        # DST typically ends first Sunday in April
        
        # Before DST starts (September) - AEST
        before_dst = self.melbourne_tz.localize(datetime(2024, 9, 15, 12, 0, 0))
        self.assertFalse(self.time_service.is_daylight_saving_active(before_dst))
        
        # After DST starts (November) - AEDT
        after_dst_start = self.melbourne_tz.localize(datetime(2024, 11, 15, 12, 0, 0))
        self.assertTrue(self.time_service.is_daylight_saving_active(after_dst_start))
        
        # Before DST ends (March) - AEDT
        before_dst_end = self.melbourne_tz.localize(datetime(2024, 3, 15, 12, 0, 0))
        self.assertTrue(self.time_service.is_daylight_saving_active(before_dst_end))
        
        # After DST ends (May) - AEST
        after_dst_end = self.melbourne_tz.localize(datetime(2024, 5, 15, 12, 0, 0))
        self.assertFalse(self.time_service.is_daylight_saving_active(after_dst_end))
    
    def test_daylight_saving_with_naive_datetime(self):
        """Test DST detection with timezone-naive datetime"""
        # Should handle naive datetime by localizing to Melbourne timezone
        naive_summer = datetime(2024, 1, 15, 12, 0, 0)
        self.assertTrue(self.time_service.is_daylight_saving_active(naive_summer))
        
        naive_winter = datetime(2024, 7, 15, 12, 0, 0)
        self.assertFalse(self.time_service.is_daylight_saving_active(naive_winter))
    
    def test_daylight_saving_with_different_timezone(self):
        """Test DST detection with datetime in different timezone"""
        # Create UTC datetime and test conversion
        utc_tz = pytz.UTC
        utc_summer = utc_tz.localize(datetime(2024, 1, 15, 1, 0, 0))  # 1 AM UTC = noon AEDT
        self.assertTrue(self.time_service.is_daylight_saving_active(utc_summer))
    
    def test_sunrise_sunset_summer_solstice(self):
        """Test sunrise/sunset calculations around summer solstice (December 21)"""
        summer_solstice = date(2024, 12, 21)
        sunrise, sunset = self.time_service.calculate_sunrise_sunset(summer_solstice)
        
        # Verify timezone
        self.assertEqual(sunrise.tzinfo, self.melbourne_tz)
        self.assertEqual(sunset.tzinfo, self.melbourne_tz)
        
        # Summer solstice: early sunrise, late sunset
        # Approximate times for Melbourne summer
        self.assertLessEqual(sunrise.hour, 6)  # Should be around 5:30-6:00 AM
        self.assertGreaterEqual(sunset.hour, 19)  # Should be around 8:00-8:30 PM
        
        # Sunrise should be before sunset
        self.assertLess(sunrise, sunset)
    
    def test_sunrise_sunset_winter_solstice(self):
        """Test sunrise/sunset calculations around winter solstice (June 21)"""
        winter_solstice = date(2024, 6, 21)
        sunrise, sunset = self.time_service.calculate_sunrise_sunset(winter_solstice)
        
        # Verify timezone
        self.assertEqual(sunrise.tzinfo, self.melbourne_tz)
        self.assertEqual(sunset.tzinfo, self.melbourne_tz)
        
        # Winter solstice: late sunrise, early sunset
        # Approximate times for Melbourne winter
        self.assertGreaterEqual(sunrise.hour, 7)  # Should be around 7:30-8:00 AM
        self.assertLessEqual(sunset.hour, 18)  # Should be around 5:00-6:00 PM
        
        # Sunrise should be before sunset
        self.assertLess(sunrise, sunset)
    
    def test_sunrise_sunset_equinox(self):
        """Test sunrise/sunset calculations around equinox (March/September 21)"""
        spring_equinox = date(2024, 9, 21)
        sunrise, sunset = self.time_service.calculate_sunrise_sunset(spring_equinox)
        
        # Verify timezone
        self.assertEqual(sunrise.tzinfo, self.melbourne_tz)
        self.assertEqual(sunset.tzinfo, self.melbourne_tz)
        
        # Equinox: roughly 12 hours of daylight
        daylight_duration = sunset - sunrise
        # Should be approximately 12 hours (within 1 hour tolerance)
        self.assertAlmostEqual(daylight_duration.total_seconds(), 12 * 3600, delta=3600)
    
    def test_sunrise_sunset_various_dates(self):
        """Test sunrise/sunset calculations for various dates throughout the year"""
        test_dates = [
            date(2024, 1, 1),   # New Year
            date(2024, 3, 15),  # Autumn
            date(2024, 6, 15),  # Winter
            date(2024, 9, 15),  # Spring
            date(2024, 12, 15), # Summer
        ]
        
        for test_date in test_dates:
            with self.subTest(date=test_date):
                sunrise, sunset = self.time_service.calculate_sunrise_sunset(test_date)
                
                # Basic validations
                self.assertEqual(sunrise.date(), test_date)
                self.assertEqual(sunset.date(), test_date)
                self.assertEqual(sunrise.tzinfo, self.melbourne_tz)
                self.assertEqual(sunset.tzinfo, self.melbourne_tz)
                self.assertLess(sunrise, sunset)
                
                # Reasonable time ranges for Melbourne
                self.assertGreaterEqual(sunrise.hour, 5)  # Not before 5 AM
                self.assertLessEqual(sunrise.hour, 8)     # Not after 8 AM
                self.assertGreaterEqual(sunset.hour, 17)  # Not before 5 PM
                self.assertLessEqual(sunset.hour, 21)     # Not after 9 PM
    
    def test_viewing_window_calculation(self):
        """Test viewing window calculation (1 hour after sunset to 1 hour before sunrise)"""
        test_date = date(2024, 6, 15)  # Winter date
        window_start, window_end = self.time_service.get_viewing_window(test_date)
        
        # Get actual sunrise/sunset for comparison
        sunset_today = self.time_service.calculate_sunrise_sunset(test_date)[1]
        sunrise_tomorrow = self.time_service.calculate_sunrise_sunset(test_date + timedelta(days=1))[0]
        
        # Verify window timing
        expected_start = sunset_today + timedelta(hours=1)
        expected_end = sunrise_tomorrow - timedelta(hours=1)
        
        self.assertEqual(window_start, expected_start)
        self.assertEqual(window_end, expected_end)
        
        # Verify timezone
        self.assertEqual(window_start.tzinfo, self.melbourne_tz)
        self.assertEqual(window_end.tzinfo, self.melbourne_tz)
    
    def test_viewing_window_spans_midnight(self):
        """Test that viewing window correctly spans midnight"""
        test_date = date(2024, 6, 15)  # Winter date
        window_start, window_end = self.time_service.get_viewing_window(test_date)
        
        # Window should start on test_date and end on next day
        self.assertEqual(window_start.date(), test_date)
        self.assertEqual(window_end.date(), test_date + timedelta(days=1))
        
        # Start should be after end when considering same day (spans midnight)
        if window_start.date() != window_end.date():
            # This is expected - window spans midnight
            self.assertGreater(window_start.hour, window_end.hour)
    
    def test_is_viewing_window_active_during_window(self):
        """Test viewing window detection when time is within window"""
        test_date = date(2024, 6, 15)
        window_start, window_end = self.time_service.get_viewing_window(test_date)
        
        # Test time in middle of viewing window
        middle_time = window_start + (window_end - window_start) / 2
        self.assertTrue(self.time_service.is_viewing_window_active(middle_time))
        
        # Test time just after window start
        just_after_start = window_start + timedelta(minutes=1)
        self.assertTrue(self.time_service.is_viewing_window_active(just_after_start))
        
        # Test time just before window end
        just_before_end = window_end - timedelta(minutes=1)
        self.assertTrue(self.time_service.is_viewing_window_active(just_before_end))
    
    def test_is_viewing_window_active_outside_window(self):
        """Test viewing window detection when time is outside window"""
        test_date = date(2024, 6, 15)
        window_start, window_end = self.time_service.get_viewing_window(test_date)
        
        # Test time before window (during day)
        noon_time = self.melbourne_tz.localize(datetime.combine(test_date, datetime.min.time().replace(hour=12)))
        self.assertFalse(self.time_service.is_viewing_window_active(noon_time))
        
        # Test time just before window start
        just_before_start = window_start - timedelta(minutes=1)
        self.assertFalse(self.time_service.is_viewing_window_active(just_before_start))
        
        # Test time just after window end
        just_after_end = window_end + timedelta(minutes=1)
        self.assertFalse(self.time_service.is_viewing_window_active(just_after_end))
    
    def test_viewing_window_edge_cases_midnight_boundary(self):
        """Test viewing window behavior around midnight boundary"""
        test_date = date(2024, 6, 15)
        
        # Test exactly at midnight
        midnight = self.melbourne_tz.localize(datetime.combine(test_date + timedelta(days=1), datetime.min.time()))
        
        # Should be within viewing window (between sunset+1h and sunrise-1h)
        window_start, window_end = self.time_service.get_viewing_window(test_date)
        
        # Midnight should be between window start and end
        if window_start.date() != window_end.date():  # Window spans midnight
            self.assertTrue(self.time_service.is_viewing_window_active(midnight))
    
    def test_get_next_viewing_window_when_active(self):
        """Test getting next viewing window when currently in active window"""
        test_date = date(2024, 6, 15)
        window_start, window_end = self.time_service.get_viewing_window(test_date)
        
        # Test from middle of active window
        middle_time = window_start + (window_end - window_start) / 2
        next_window = self.time_service.get_next_viewing_window(middle_time)
        
        # Should return current time since we're already in window
        self.assertEqual(next_window, middle_time)
    
    def test_get_next_viewing_window_before_today_window(self):
        """Test getting next viewing window when before today's window"""
        test_date = date(2024, 6, 15)
        window_start, _ = self.time_service.get_viewing_window(test_date)
        
        # Test from morning (before today's window)
        morning_time = self.melbourne_tz.localize(datetime.combine(test_date, datetime.min.time().replace(hour=10)))
        next_window = self.time_service.get_next_viewing_window(morning_time)
        
        # Should return today's window start
        self.assertEqual(next_window, window_start)
    
    def test_get_next_viewing_window_after_today_window(self):
        """Test getting next viewing window when after today's window"""
        test_date = date(2024, 6, 15)
        _, window_end = self.time_service.get_viewing_window(test_date)
        
        # Test from after today's window ends
        after_window = window_end + timedelta(hours=2)
        next_window = self.time_service.get_next_viewing_window(after_window)
        
        # Should return tomorrow's window start
        tomorrow_start, _ = self.time_service.get_viewing_window(test_date + timedelta(days=1))
        self.assertEqual(next_window, tomorrow_start)
    
    def test_timezone_handling_with_naive_datetime(self):
        """Test that naive datetimes are properly handled"""
        # Test with naive datetime
        naive_dt = datetime(2024, 6, 15, 22, 0, 0)  # 10 PM
        
        # Should work without raising exceptions
        is_active = self.time_service.is_viewing_window_active(naive_dt)
        self.assertIsInstance(is_active, bool)
        
        next_window = self.time_service.get_next_viewing_window(naive_dt)
        self.assertIsNotNone(next_window.tzinfo)
        self.assertEqual(next_window.tzinfo, self.melbourne_tz)
    
    def test_timezone_conversion_from_utc(self):
        """Test timezone conversion from UTC to Melbourne time"""
        # Create UTC datetime
        utc_dt = pytz.UTC.localize(datetime(2024, 6, 15, 12, 0, 0))  # Noon UTC
        
        # Should work with UTC input
        is_active = self.time_service.is_viewing_window_active(utc_dt)
        self.assertIsInstance(is_active, bool)
        
        next_window = self.time_service.get_next_viewing_window(utc_dt)
        self.assertEqual(next_window.tzinfo, self.melbourne_tz)
    
    def test_date_boundary_edge_cases(self):
        """Test edge cases around date boundaries"""
        # Test last day of year
        year_end = date(2024, 12, 31)
        sunrise, sunset = self.time_service.calculate_sunrise_sunset(year_end)
        self.assertEqual(sunrise.date(), year_end)
        self.assertEqual(sunset.date(), year_end)
        
        # Test first day of year
        year_start = date(2024, 1, 1)
        sunrise, sunset = self.time_service.calculate_sunrise_sunset(year_start)
        self.assertEqual(sunrise.date(), year_start)
        self.assertEqual(sunset.date(), year_start)
        
        # Test leap year day
        leap_day = date(2024, 2, 29)  # 2024 is a leap year
        sunrise, sunset = self.time_service.calculate_sunrise_sunset(leap_day)
        self.assertEqual(sunrise.date(), leap_day)
        self.assertEqual(sunset.date(), leap_day)


if __name__ == '__main__':
    unittest.main()