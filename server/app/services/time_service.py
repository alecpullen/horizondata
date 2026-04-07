"""
Time Service

This service handles all time-related calculations for the telescope safety system,
including Melbourne timezone handling, sunrise/sunset calculations, and viewing
window determinations.

Requirements addressed: 1.1, 1.4
"""

import pytz
import logging
import math
from datetime import datetime, timedelta, date
from typing import Tuple

# OpenTelemetry imports for monitoring and observability
from opentelemetry import trace, metrics
from opentelemetry.trace import Status, StatusCode

# Get tracer and meter for this service
tracer = trace.get_tracer(__name__)
meter = metrics.get_meter(__name__)

# Create custom metrics for monitoring
time_calculation_counter = meter.create_counter(
    name="time_service_calculations_total",
    description="Total number of time calculations performed",
    unit="1"
)

time_calculation_duration = meter.create_histogram(
    name="time_service_calculation_duration_seconds",
    description="Duration of time calculations in seconds",
    unit="s"
)

viewing_window_checks = meter.create_counter(
    name="viewing_window_checks_total",
    description="Total number of viewing window checks",
    unit="1"
)

dst_checks = meter.create_counter(
    name="dst_checks_total",
    description="Total number of DST status checks",
    unit="1"
)


class TimeService:
    """
    Service for handling time calculations specific to Melbourne, Australia.
    Manages timezone conversions, daylight saving time, and astronomical calculations.
    """
    
    # Melbourne coordinates
    MELBOURNE_LAT = -37.8136  # degrees
    MELBOURNE_LON = 144.9631  # degrees
    
    # Melbourne timezone
    MELBOURNE_TZ = pytz.timezone('Australia/Melbourne')
    
    # Viewing window buffer (1 hour after sunset, 1 hour before sunrise)
    VIEWING_BUFFER_HOURS = 1
    
    def get_melbourne_time(self) -> datetime:
        """
        Get the current time in Melbourne timezone with DST handling.
        
        Returns:
            datetime: Current Melbourne time (AEST/AEDT)
        """
        with tracer.start_as_current_span("get_melbourne_time") as span:
            try:
                utc_now = datetime.utcnow().replace(tzinfo=pytz.UTC)
                melbourne_time = utc_now.astimezone(self.MELBOURNE_TZ)
                
                # Add telemetry attributes
                span.set_attribute("timezone", str(self.MELBOURNE_TZ))
                span.set_attribute("utc_time", utc_now.isoformat())
                span.set_attribute("melbourne_time", melbourne_time.isoformat())
                span.set_attribute("is_dst", melbourne_time.dst() != timedelta(0))
                
                # Log the operation
                logging.info(f"Retrieved Melbourne time: {melbourne_time.isoformat()}")
                
                return melbourne_time
                
            except Exception as e:
                span.record_exception(e)
                span.set_status(Status(StatusCode.ERROR, str(e)))
                logging.error(f"Error getting Melbourne time: {e}")
                raise
    
    def is_daylight_saving_active(self, dt: datetime = None) -> bool:
        """
        Check if daylight saving time is currently active in Melbourne.
        
        Args:
            dt: Optional datetime to check, defaults to current time
            
        Returns:
            bool: True if DST is active (AEDT), False if standard time (AEST)
        """
        with tracer.start_as_current_span("is_daylight_saving_active") as span:
            try:
                # Increment DST check counter
                dst_checks.add(1, {"operation": "dst_check"})
                
                if dt is None:
                    dt = self.get_melbourne_time()
                
                # Ensure datetime is timezone-aware
                if dt.tzinfo is None:
                    dt = self.MELBOURNE_TZ.localize(dt)
                elif dt.tzinfo != self.MELBOURNE_TZ:
                    dt = dt.astimezone(self.MELBOURNE_TZ)
                
                is_dst = dt.dst() != timedelta(0)
                
                # Add telemetry attributes
                span.set_attribute("check_time", dt.isoformat())
                span.set_attribute("is_dst", is_dst)
                span.set_attribute("timezone", str(dt.tzinfo))
                span.set_attribute("dst_offset_seconds", dt.dst().total_seconds())
                
                # Log the operation
                dst_status = "AEDT (DST active)" if is_dst else "AEST (standard time)"
                logging.info(f"DST check for {dt.isoformat()}: {dst_status}")
                
                return is_dst
                
            except Exception as e:
                span.record_exception(e)
                span.set_status(Status(StatusCode.ERROR, str(e)))
                logging.error(f"Error checking DST status: {e}")
                raise
    
    def calculate_sunrise_sunset(self, target_date: date) -> Tuple[datetime, datetime]:
        """
        Calculate sunrise and sunset times for Melbourne on a given date using astral library.
        
        Args:
            target_date: Date for which to calculate sunrise/sunset
            
        Returns:
            Tuple[datetime, datetime]: (sunrise_time, sunset_time) in Melbourne timezone
        """
        with tracer.start_as_current_span("calculate_sunrise_sunset") as span:
            telemetry_start_time = datetime.now()
            
            try:
                # Increment calculation counter
                time_calculation_counter.add(1, {"operation": "sunrise_sunset"})
                
                # Add telemetry attributes
                span.set_attribute("target_date", target_date.isoformat())
                span.set_attribute("location_lat", self.MELBOURNE_LAT)
                span.set_attribute("location_lon", self.MELBOURNE_LON)
                
                # Use astral library for accurate calculations
                from astral import LocationInfo
                from astral.sun import sun
                
                melbourne_location = LocationInfo("Melbourne", "Australia", "Australia/Melbourne", 
                                                self.MELBOURNE_LAT, self.MELBOURNE_LON)
                sun_times = sun(melbourne_location.observer, date=target_date, tzinfo=self.MELBOURNE_TZ)
                
                sunrise = sun_times['sunrise']
                sunset = sun_times['sunset']
                
                # Calculate duration and record metrics
                duration = (datetime.now() - telemetry_start_time).total_seconds()
                time_calculation_duration.record(duration, {"operation": "sunrise_sunset"})
                
                # Add result attributes
                span.set_attribute("sunrise_time", sunrise.isoformat())
                span.set_attribute("sunset_time", sunset.isoformat())
                span.set_attribute("daylight_hours", (sunset - sunrise).total_seconds() / 3600)
                
                # Log the successful calculation
                logging.info(f"Calculated sunrise/sunset for {target_date}: "
                           f"sunrise={sunrise.strftime('%H:%M')}, sunset={sunset.strftime('%H:%M')}")
                
                return sunrise, sunset
                
            except Exception as e:
                span.record_exception(e)
                span.set_status(Status(StatusCode.ERROR, str(e)))
                logging.error(f"Error calculating sunrise/sunset for {target_date}: {e}")
                raise
    
    def _calculate_sun_times_simple(self, target_date: date) -> Tuple[datetime, datetime]:
        """
        Simple sunrise/sunset calculation using approximate algorithm.
        Good enough for telescope scheduling purposes.
        """
        # Day of year
        day_of_year = target_date.timetuple().tm_yday
        
        # Approximate equation of time and solar declination
        B = 2 * math.pi * (day_of_year - 81) / 365
        E = 9.87 * math.sin(2 * B) - 7.53 * math.cos(B) - 1.5 * math.sin(B)
        solar_declination = 23.45 * math.sin(2 * math.pi * (284 + day_of_year) / 365)
        
        # Convert to radians
        lat_rad = math.radians(self.MELBOURNE_LAT)
        decl_rad = math.radians(solar_declination)
        
        # Hour angle calculation
        try:
            cos_hour_angle = -math.tan(lat_rad) * math.tan(decl_rad)
            # Clamp to valid range to avoid math domain errors
            cos_hour_angle = max(-1, min(1, cos_hour_angle))
            hour_angle = math.degrees(math.acos(cos_hour_angle))
        except (ValueError, ZeroDivisionError):
            # Fallback for extreme latitudes or edge cases
            hour_angle = 90  # Approximate 6 hours
        
        # Calculate sunrise and sunset times
        # For eastern longitudes, we subtract the longitude offset
        sunrise_hour = 12 - hour_angle / 15 - self.MELBOURNE_LON / 15 + E / 60
        sunset_hour = 12 + hour_angle / 15 - self.MELBOURNE_LON / 15 + E / 60
        
        # Ensure sunrise is before sunset
        if sunrise_hour > sunset_hour:
            sunrise_hour, sunset_hour = sunset_hour, sunrise_hour
        
        # Convert to datetime objects in Melbourne timezone
        sunrise_time = self._hour_to_datetime(target_date, sunrise_hour)
        sunset_time = self._hour_to_datetime(target_date, sunset_hour)
        
        return sunrise_time, sunset_time
    
    def _hour_to_datetime(self, target_date: date, hour_decimal: float) -> datetime:
        """Convert decimal hour to datetime in Melbourne timezone."""
        # Clamp hour to valid range
        hour_decimal = max(0, min(24, hour_decimal))
        
        hours = int(hour_decimal)
        minutes = int((hour_decimal - hours) * 60)
        
        # Handle edge cases
        if hours >= 24:
            hours = 23
            minutes = 59
        elif hours < 0:
            hours = 0
            minutes = 0
            
        time_obj = datetime.min.time().replace(hour=hours, minute=minutes)
        naive_datetime = datetime.combine(target_date, time_obj)
        
        return self.MELBOURNE_TZ.localize(naive_datetime)
    
    def get_viewing_window(self, target_date: date) -> Tuple[datetime, datetime]:
        """
        Calculate the viewing window for telescope operations on a given date.
        Viewing window is from 1 hour after sunset to 1 hour before sunrise (next day).
        
        Args:
            target_date: Date for which to calculate viewing window
            
        Returns:
            Tuple[datetime, datetime]: (window_start, window_end) in Melbourne timezone
        """
        with tracer.start_as_current_span("get_viewing_window") as span:
            start_time = datetime.now()
            
            try:
                # Increment calculation counter
                time_calculation_counter.add(1, {"operation": "viewing_window"})
                
                # Add telemetry attributes
                span.set_attribute("target_date", target_date.isoformat())
                span.set_attribute("buffer_hours", self.VIEWING_BUFFER_HOURS)
                
                # Get sunset for the target date
                _, sunset = self.calculate_sunrise_sunset(target_date)
                
                # Get sunrise for the next day
                next_day = target_date + timedelta(days=1)
                sunrise_next, _ = self.calculate_sunrise_sunset(next_day)
                
                # Calculate viewing window with buffers
                window_start = sunset + timedelta(hours=self.VIEWING_BUFFER_HOURS)
                window_end = sunrise_next - timedelta(hours=self.VIEWING_BUFFER_HOURS)
                
                # Calculate duration and record metrics
                duration = (datetime.now() - start_time).total_seconds()
                time_calculation_duration.record(duration, {"operation": "viewing_window"})
                
                # Calculate window duration
                window_duration = (window_end - window_start).total_seconds() / 3600
                
                # Add result attributes
                span.set_attribute("window_start", window_start.isoformat())
                span.set_attribute("window_end", window_end.isoformat())
                span.set_attribute("window_duration_hours", window_duration)
                span.set_attribute("spans_midnight", window_start.date() != window_end.date())
                
                # Log the calculation
                logging.info(f"Calculated viewing window for {target_date}: "
                           f"{window_start.strftime('%H:%M')} - {window_end.strftime('%H:%M')} "
                           f"({window_duration:.1f} hours)")
                
                return window_start, window_end
                
            except Exception as e:
                span.record_exception(e)
                span.set_status(Status(StatusCode.ERROR, str(e)))
                logging.error(f"Error calculating viewing window for {target_date}: {e}")
                raise
    
    def is_viewing_window_active(self, check_time: datetime = None) -> bool:
        """
        Check if the given time (or current time) falls within the viewing window.
        
        Args:
            check_time: Optional time to check, defaults to current Melbourne time
            
        Returns:
            bool: True if the time is within the viewing window
        """
        with tracer.start_as_current_span("is_viewing_window_active") as span:
            try:
                # Increment viewing window check counter
                viewing_window_checks.add(1, {"operation": "window_active_check"})
                
                if check_time is None:
                    check_time = self.get_melbourne_time()
                
                # Ensure we're working with Melbourne timezone
                if check_time.tzinfo is None:
                    check_time = self.MELBOURNE_TZ.localize(check_time)
                elif check_time.tzinfo != self.MELBOURNE_TZ:
                    check_time = check_time.astimezone(self.MELBOURNE_TZ)
                
                # Get viewing window for the current date
                current_date = check_time.date()
                window_start, window_end = self.get_viewing_window(current_date)
                
                # Check if we're in the viewing window
                # Note: viewing window may span midnight, so we need to handle that case
                if window_start.date() == window_end.date():
                    # Window doesn't span midnight
                    is_active = window_start <= check_time <= window_end
                else:
                    # Window spans midnight - check if we're in the correct time range
                    # For a window from evening to next morning (e.g., 8:51 PM to 5:15 AM)
                    check_date = check_time.date()
                    start_date = window_start.date()
                    end_date = window_end.date()
                    
                    if check_date == start_date:
                        # We're on the start date - check if we're after the start time
                        is_active = check_time >= window_start
                    elif check_date == end_date:
                        # We're on the end date - check if we're before the end time
                        is_active = check_time <= window_end
                    else:
                        # We're between the start and end dates - should be active
                        is_active = start_date < check_date < end_date
                    
                    # Special case: if we're on the start date but before the start time,
                    # we might be in the previous night's viewing window
                    if not is_active and check_date == start_date and check_time < window_start:
                        # Check if we're in the previous day's viewing window
                        prev_date = check_date - timedelta(days=1)
                        prev_window_start, prev_window_end = self.get_viewing_window(prev_date)
                        if prev_window_start.date() != prev_window_end.date():
                            # Previous window spans midnight, check if we're in it
                            is_active = check_time <= prev_window_end
                
                # Add telemetry attributes
                span.set_attribute("check_time", check_time.isoformat())
                span.set_attribute("window_start", window_start.isoformat())
                span.set_attribute("window_end", window_end.isoformat())
                span.set_attribute("is_active", is_active)
                span.set_attribute("spans_midnight", window_start.date() != window_end.date())
                
                # Calculate time until next window change
                if is_active:
                    # Time until window ends
                    if window_start.date() == window_end.date():
                        time_until_change = (window_end - check_time).total_seconds()
                    else:
                        # Handle midnight spanning
                        if check_time >= window_start:
                            time_until_change = (window_end - check_time).total_seconds()
                        else:
                            time_until_change = (window_end - check_time).total_seconds()
                else:
                    # Time until window starts
                    if check_time < window_start:
                        time_until_change = (window_start - check_time).total_seconds()
                    else:
                        # Next day's window
                        next_window_start, _ = self.get_viewing_window(current_date + timedelta(days=1))
                        time_until_change = (next_window_start - check_time).total_seconds()
                
                span.set_attribute("time_until_change_seconds", time_until_change)
                
                # Log the check
                status = "active" if is_active else "inactive"
                logging.info(f"Viewing window check at {check_time.strftime('%H:%M')}: {status} "
                           f"(next change in {time_until_change/3600:.1f} hours)")
                
                return is_active
                
            except Exception as e:
                span.record_exception(e)
                span.set_status(Status(StatusCode.ERROR, str(e)))
                logging.error(f"Error checking viewing window status: {e}")
                raise
    
    def get_next_viewing_window(self, from_time: datetime = None) -> datetime:
        """
        Get the next time when the viewing window will be active.
        
        Args:
            from_time: Optional time to calculate from, defaults to current Melbourne time
            
        Returns:
            datetime: Next viewing window start time
        """
        with tracer.start_as_current_span("get_next_viewing_window") as span:
            try:
                # Increment calculation counter
                time_calculation_counter.add(1, {"operation": "next_viewing_window"})
                
                if from_time is None:
                    from_time = self.get_melbourne_time()
                
                # Ensure we're working with Melbourne timezone
                if from_time.tzinfo is None:
                    from_time = self.MELBOURNE_TZ.localize(from_time)
                elif from_time.tzinfo != self.MELBOURNE_TZ:
                    from_time = from_time.astimezone(self.MELBOURNE_TZ)
                
                # Add telemetry attributes
                span.set_attribute("from_time", from_time.isoformat())
                
                # Check if we're currently in a viewing window
                if self.is_viewing_window_active(from_time):
                    # Already in viewing window, return current time
                    span.set_attribute("currently_in_window", True)
                    span.set_attribute("next_window_start", from_time.isoformat())
                    
                    logging.info(f"Currently in viewing window at {from_time.strftime('%H:%M')}")
                    return from_time
                
                # Get today's viewing window
                current_date = from_time.date()
                window_start, window_end = self.get_viewing_window(current_date)
                
                # If today's window hasn't started yet, return today's start time
                if from_time < window_start:
                    next_window = window_start
                    span.set_attribute("using_today_window", True)
                else:
                    # Otherwise, return tomorrow's viewing window start
                    next_date = current_date + timedelta(days=1)
                    next_window, _ = self.get_viewing_window(next_date)
                    span.set_attribute("using_tomorrow_window", True)
                
                # Calculate time until next window
                time_until_window = (next_window - from_time).total_seconds()
                
                span.set_attribute("currently_in_window", False)
                span.set_attribute("next_window_start", next_window.isoformat())
                span.set_attribute("time_until_window_seconds", time_until_window)
                span.set_attribute("time_until_window_hours", time_until_window / 3600)
                
                # Log the calculation
                logging.info(f"Next viewing window starts at {next_window.strftime('%H:%M')} "
                           f"({time_until_window/3600:.1f} hours from {from_time.strftime('%H:%M')})")
                
                return next_window
                
            except Exception as e:
                span.record_exception(e)
                span.set_status(Status(StatusCode.ERROR, str(e)))
                logging.error(f"Error calculating next viewing window: {e}")
                raise