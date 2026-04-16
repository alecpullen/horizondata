# app/services/visibility_service.py
# Enhanced visibility service for telescope safety scheduling system

from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timezone, timedelta
import logging
import warnings
import threading
import time
import hashlib
import json
import numpy as np

# AstroPy imports for astronomical calculations
from astropy.coordinates import EarthLocation, SkyCoord, AltAz, get_sun, get_body
from astropy import units as u
from astropy.time import Time
from astropy.coordinates import solar_system_ephemeris
import pytz
import hashlib

logger = logging.getLogger(__name__)

# Melbourne coordinates (La Trobe University, Bundoora)
MELBOURNE_LOCATION = EarthLocation(
    lat=-37.7214 * u.deg,
    lon=145.0489 * u.deg,
    height=140 * u.m
)

# Minimum elevation angle for visibility (degrees)
MIN_ELEVATION = 20.0

# Comprehensive object database with enhanced metadata
ENHANCED_OBJECT_DATABASE = [
    # Planets
    {"name": "Mercury", "type": "Planet", "magnitude_range": (-2.5, 5.7), "constellation": "Variable"},
    {"name": "Venus", "type": "Planet", "magnitude_range": (-4.9, -3.8), "constellation": "Variable"},
    {"name": "Mars", "type": "Planet", "magnitude_range": (-2.9, 1.9), "constellation": "Variable"},
    {"name": "Jupiter", "type": "Planet", "magnitude_range": (-2.9, -1.6), "constellation": "Variable"},
    {"name": "Saturn", "type": "Planet", "magnitude_range": (-0.5, 1.5), "constellation": "Variable"},
    {"name": "Uranus", "type": "Planet", "magnitude_range": (5.3, 6.0), "constellation": "Variable"},
    {"name": "Neptune", "type": "Planet", "magnitude_range": (7.7, 8.0), "constellation": "Variable"},
    
    # Bright Stars
    {"name": "Sirius", "type": "Star", "magnitude": -1.46, "constellation": "Canis Major", "distance": "8.6 ly"},
    {"name": "Canopus", "type": "Star", "magnitude": -0.74, "constellation": "Carina", "distance": "310 ly"},
    {"name": "Alpha Centauri", "type": "Star System", "magnitude": -0.27, "constellation": "Centaurus", "distance": "4.37 ly"},
    {"name": "Arcturus", "type": "Star", "magnitude": -0.05, "constellation": "Boötes", "distance": "37 ly"},
    {"name": "Vega", "type": "Star", "magnitude": 0.03, "constellation": "Lyra", "distance": "25 ly"},
    {"name": "Capella", "type": "Star", "magnitude": 0.08, "constellation": "Auriga", "distance": "43 ly"},
    {"name": "Rigel", "type": "Star", "magnitude": 0.13, "constellation": "Orion", "distance": "860 ly"},
    {"name": "Procyon", "type": "Star", "magnitude": 0.34, "constellation": "Canis Minor", "distance": "11.5 ly"},
    {"name": "Betelgeuse", "type": "Star", "magnitude": 0.50, "constellation": "Orion", "distance": "650 ly"},
    {"name": "Achernar", "type": "Star", "magnitude": 0.46, "constellation": "Eridanus", "distance": "139 ly"},
    {"name": "Aldebaran", "type": "Star", "magnitude": 0.85, "constellation": "Taurus", "distance": "65 ly"},
    {"name": "Antares", "type": "Star", "magnitude": 1.09, "constellation": "Scorpius", "distance": "600 ly"},
    {"name": "Spica", "type": "Star", "magnitude": 1.04, "constellation": "Virgo", "distance": "250 ly"},
    {"name": "Pollux", "type": "Star", "magnitude": 1.14, "constellation": "Gemini", "distance": "34 ly"},
    {"name": "Fomalhaut", "type": "Star", "magnitude": 1.16, "constellation": "Piscis Austrinus", "distance": "25 ly"},
    {"name": "Deneb", "type": "Star", "magnitude": 1.25, "constellation": "Cygnus", "distance": "2600 ly"},
    {"name": "Regulus", "type": "Star", "magnitude": 1.35, "constellation": "Leo", "distance": "79 ly"},
    
    # Deep Sky Objects - Nebulae
    {"name": "Orion Nebula", "type": "Emission Nebula", "magnitude": 4.0, "constellation": "Orion", "distance": "1344 ly", "catalog_id": "M42"},
    {"name": "Carina Nebula", "type": "Emission Nebula", "magnitude": 1.0, "constellation": "Carina", "distance": "7500 ly", "catalog_id": "NGC 3372"},
    {"name": "Tarantula Nebula", "type": "Emission Nebula", "magnitude": 8.0, "constellation": "Dorado", "distance": "160000 ly", "catalog_id": "NGC 2070"},
    {"name": "Eagle Nebula", "type": "Emission Nebula", "magnitude": 6.4, "constellation": "Serpens", "distance": "7000 ly", "catalog_id": "M16"},
    {"name": "Rosette Nebula", "type": "Emission Nebula", "magnitude": 9.0, "constellation": "Monoceros", "distance": "5200 ly", "catalog_id": "NGC 2237"},
    {"name": "Horsehead Nebula", "type": "Dark Nebula", "magnitude": 6.8, "constellation": "Orion", "distance": "1500 ly", "catalog_id": "Barnard 33"},
    {"name": "Cat's Eye Nebula", "type": "Planetary Nebula", "magnitude": 8.1, "constellation": "Draco", "distance": "3300 ly", "catalog_id": "NGC 6543"},
    {"name": "Ring Nebula", "type": "Planetary Nebula", "magnitude": 8.8, "constellation": "Lyra", "distance": "2300 ly", "catalog_id": "M57"},
    
    # Galaxies
    {"name": "Andromeda Galaxy", "type": "Spiral Galaxy", "magnitude": 3.4, "constellation": "Andromeda", "distance": "2.5 Mly", "catalog_id": "M31"},
    {"name": "Large Magellanic Cloud", "type": "Irregular Galaxy", "magnitude": 0.9, "constellation": "Dorado", "distance": "160000 ly", "catalog_id": "LMC"},
    {"name": "Small Magellanic Cloud", "type": "Irregular Galaxy", "magnitude": 2.7, "constellation": "Tucana", "distance": "200000 ly", "catalog_id": "SMC"},
    {"name": "Triangulum Galaxy", "type": "Spiral Galaxy", "magnitude": 5.7, "constellation": "Triangulum", "distance": "3 Mly", "catalog_id": "M33"},
    {"name": "Centaurus A", "type": "Elliptical Galaxy", "magnitude": 6.8, "constellation": "Centaurus", "distance": "13.7 Mly", "catalog_id": "NGC 5128"},
    {"name": "Whirlpool Galaxy", "type": "Spiral Galaxy", "magnitude": 8.4, "constellation": "Canes Venatici", "distance": "23 Mly", "catalog_id": "M51"},
    
    # Star Clusters
    {"name": "Omega Centauri", "type": "Globular Cluster", "magnitude": 3.7, "constellation": "Centaurus", "distance": "15800 ly", "catalog_id": "NGC 5139"},
    {"name": "47 Tucanae", "type": "Globular Cluster", "magnitude": 4.0, "constellation": "Tucana", "distance": "16700 ly", "catalog_id": "NGC 104"},
    {"name": "The Pleiades", "type": "Open Cluster", "magnitude": 1.6, "constellation": "Taurus", "distance": "444 ly", "catalog_id": "M45"},
    {"name": "Jewel Box Cluster", "type": "Open Cluster", "magnitude": 4.2, "constellation": "Crux", "distance": "6440 ly", "catalog_id": "NGC 4755"},
    {"name": "Hyades", "type": "Open Cluster", "magnitude": 0.5, "constellation": "Taurus", "distance": "153 ly", "catalog_id": "Mel 25"},
    {"name": "Double Cluster", "type": "Open Cluster", "magnitude": 4.3, "constellation": "Perseus", "distance": "7600 ly", "catalog_id": "NGC 869/884"},
    {"name": "Beehive Cluster", "type": "Open Cluster", "magnitude": 3.7, "constellation": "Cancer", "distance": "577 ly", "catalog_id": "M44"},
    {"name": "Wild Duck Cluster", "type": "Open Cluster", "magnitude": 6.3, "constellation": "Scutum", "distance": "6120 ly", "catalog_id": "M11"},
]


class VisibilityService:
    """Enhanced visibility service for dynamic object filtering and positioning"""
    
    def __init__(self, cache_duration_minutes: int = 5, update_interval_minutes: int = 2):
        self.location = MELBOURNE_LOCATION
        self.min_elevation = MIN_ELEVATION
        
        # Caching configuration
        self.cache_duration = timedelta(minutes=cache_duration_minutes)
        self.update_interval = timedelta(minutes=update_interval_minutes)
        
        # Cache storage
        self._visibility_cache = {}
        self._cache_timestamps = {}
        self._cache_lock = threading.RLock()
        
        # Session-specific cache storage
        self._session_cache = {}
        self._session_cache_timestamps = {}
        
        # Background update thread
        self._update_thread = None
        self._stop_updates = threading.Event()
        self._is_running = False
        
        # Change detection
        self._last_positions = {}
        self._position_threshold = 0.1  # degrees for significant position change
        
    def get_visible_objects(self, observation_time: Optional[datetime] = None, 
                          min_elevation: Optional[float] = None) -> List[Dict[str, Any]]:
        """
        Get list of celestial objects visible from Melbourne at specified time
        
        Args:
            observation_time: Time for visibility calculation (UTC), defaults to now
            min_elevation: Minimum elevation angle in degrees, defaults to class setting
            
        Returns:
            List of visible objects with position and metadata
        """
        if observation_time is None:
            observation_time = datetime.now(timezone.utc)
        
        if min_elevation is None:
            min_elevation = self.min_elevation
            
        # Convert to AstroPy Time object
        astro_time = Time(observation_time)
        
        visible_objects = []
        
        # Suppress AstroPy warnings about IERS data
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            
            for obj_data in ENHANCED_OBJECT_DATABASE:
                try:
                    visibility_info = self._calculate_object_visibility(
                        obj_data, astro_time, min_elevation
                    )
                    
                    if visibility_info and visibility_info['visibility']['is_visible']:
                        visible_objects.append(visibility_info)
                        
                except Exception as e:
                    logger.warning(f"Failed to calculate visibility for {obj_data['name']}: {e}")
                    continue
        
        # Sort by elevation (highest first)
        visible_objects.sort(key=lambda x: x['coordinates']['elevation'], reverse=True)
        
        return visible_objects
    
    def _calculate_object_visibility(self, obj_data: Dict[str, Any], 
                                   astro_time: Time, 
                                   min_elevation: float) -> Optional[Dict[str, Any]]:
        """
        Calculate visibility information for a single object
        
        Args:
            obj_data: Object metadata from database
            astro_time: AstroPy Time object for calculation
            min_elevation: Minimum elevation threshold
            
        Returns:
            Object visibility information or None if not visible
        """
        try:
            # Get object coordinates
            if obj_data["type"] == "Planet":
                # Use solar system ephemeris for planets
                with solar_system_ephemeris.set('builtin'):
                    target_coords = get_body(obj_data["name"].lower(), astro_time, self.location)
            else:
                # Use catalog lookup for deep sky objects and stars
                target_coords = SkyCoord.from_name(obj_data["name"])
            
            # Transform to local Alt/Az coordinates
            local_frame = AltAz(obstime=astro_time, location=self.location)
            local_coords = target_coords.transform_to(local_frame)
            
            elevation = local_coords.alt.degree
            azimuth = local_coords.az.degree
            
            # Check visibility threshold
            is_visible = elevation > min_elevation
            
            if not is_visible:
                return None
            
            # Calculate rise and set times (approximate)
            rise_time, set_time = self._calculate_rise_set_times(target_coords, astro_time)
            
            # Determine magnitude
            magnitude = self._get_object_magnitude(obj_data, astro_time)
            
            return {
                "name": obj_data["name"],
                "type": obj_data["type"],
                "coordinates": {
                    "ra": target_coords.ra.hour,
                    "dec": target_coords.dec.degree,
                    "elevation": elevation,
                    "azimuth": azimuth
                },
                "visibility": {
                    "is_visible": is_visible,
                    "elevation": elevation,
                    "magnitude": magnitude,
                    "rise_time": rise_time.isoformat() if rise_time else None,
                    "set_time": set_time.isoformat() if set_time else None
                },
                "metadata": {
                    "constellation": obj_data.get("constellation", "Unknown"),
                    "distance": obj_data.get("distance", "Unknown"),
                    "catalog_id": obj_data.get("catalog_id"),
                    "description": self._generate_description(obj_data)
                }
            }
            
        except Exception as e:
            logger.error(f"Error calculating visibility for {obj_data['name']}: {e}")
            return None
    
    def _calculate_rise_set_times(self, target_coords: SkyCoord, 
                                astro_time: Time) -> Tuple[Optional[datetime], Optional[datetime]]:
        """
        Calculate approximate rise and set times for an object
        
        Args:
            target_coords: Object coordinates
            astro_time: Current time
            
        Returns:
            Tuple of (rise_time, set_time) as datetime objects or None
        """
        try:
            # Simple approximation - calculate when object crosses elevation threshold
            # This is a simplified calculation; more sophisticated methods could be used
            
            # For now, return None to indicate times are not calculated
            # This can be enhanced with more sophisticated algorithms
            return None, None
            
        except Exception as e:
            logger.warning(f"Could not calculate rise/set times: {e}")
            return None, None
    
    def _get_object_magnitude(self, obj_data: Dict[str, Any], astro_time: Time) -> Optional[float]:
        """
        Get object magnitude, accounting for variable objects like planets
        
        Args:
            obj_data: Object metadata
            astro_time: Current time
            
        Returns:
            Magnitude value or None if unknown
        """
        if "magnitude" in obj_data:
            return obj_data["magnitude"]
        elif "magnitude_range" in obj_data:
            # For planets, use middle of range as approximation
            mag_range = obj_data["magnitude_range"]
            return (mag_range[0] + mag_range[1]) / 2
        else:
            return None
    
    def _generate_description(self, obj_data: Dict[str, Any]) -> str:
        """
        Generate a descriptive text for the object
        
        Args:
            obj_data: Object metadata
            
        Returns:
            Descriptive string
        """
        obj_type = obj_data["type"]
        name = obj_data["name"]
        
        if obj_type == "Planet":
            return f"{name} is a planet in our solar system"
        elif obj_type == "Star":
            return f"{name} is a bright star"
        elif obj_type == "Star System":
            return f"{name} is a multiple star system"
        elif "Nebula" in obj_type:
            return f"{name} is a {obj_type.lower()}"
        elif "Galaxy" in obj_type:
            return f"{name} is a {obj_type.lower()}"
        elif "Cluster" in obj_type:
            return f"{name} is a {obj_type.lower()}"
        else:
            return f"{name} is a {obj_type.lower()}"
    
    def filter_by_elevation(self, objects: List[Dict[str, Any]], 
                          min_elevation: float) -> List[Dict[str, Any]]:
        """
        Filter objects by minimum elevation angle
        
        Args:
            objects: List of object visibility data
            min_elevation: Minimum elevation in degrees
            
        Returns:
            Filtered list of objects
        """
        return [
            obj for obj in objects 
            if obj.get('coordinates', {}).get('elevation', 0) >= min_elevation
        ]
    
    def get_object_by_name(self, name: str, observation_time: Optional[datetime] = None) -> Optional[Dict[str, Any]]:
        """
        Get visibility information for a specific object by name
        
        Args:
            name: Object name to search for
            observation_time: Time for calculation, defaults to now
            
        Returns:
            Object visibility information or None if not found/visible
        """
        visible_objects = self.get_visible_objects(observation_time)
        
        for obj in visible_objects:
            if obj['name'].lower() == name.lower():
                return obj
        
        return None
    
    def get_objects_by_type(self, object_type: str, 
                          observation_time: Optional[datetime] = None) -> List[Dict[str, Any]]:
        """
        Get visible objects filtered by type
        
        Args:
            object_type: Type of objects to return (Planet, Star, Galaxy, etc.)
            observation_time: Time for calculation, defaults to now
            
        Returns:
            List of visible objects of specified type
        """
        visible_objects = self.get_visible_objects(observation_time)
        
        return [
            obj for obj in visible_objects 
            if obj['type'].lower() == object_type.lower()
        ]
    
    def get_objects_in_constellation(self, constellation: str, 
                                   observation_time: Optional[datetime] = None) -> List[Dict[str, Any]]:
        """
        Get visible objects in a specific constellation
        
        Args:
            constellation: Constellation name
            observation_time: Time for calculation, defaults to now
            
        Returns:
            List of visible objects in the constellation
        """
        visible_objects = self.get_visible_objects(observation_time)
        
        return [
            obj for obj in visible_objects 
            if obj.get('metadata', {}).get('constellation', '').lower() == constellation.lower()
        ]
    
    def start_real_time_updates(self):
        """Start background thread for real-time visibility updates"""
        if self._is_running:
            logger.warning("Real-time updates already running")
            return
        
        self._is_running = True
        self._stop_updates.clear()
        self._update_thread = threading.Thread(target=self._update_loop, daemon=True)
        self._update_thread.start()
        logger.info("Started real-time visibility updates")
    
    def stop_real_time_updates(self):
        """Stop background thread for real-time visibility updates"""
        if not self._is_running:
            return
        
        self._stop_updates.set()
        if self._update_thread and self._update_thread.is_alive():
            self._update_thread.join(timeout=5)
        
        self._is_running = False
        logger.info("Stopped real-time visibility updates")
    
    def _update_loop(self):
        """Background update loop for real-time visibility calculations"""
        while not self._stop_updates.is_set():
            try:
                self._update_visibility_cache()
                
                # Wait for next update interval
                self._stop_updates.wait(self.update_interval.total_seconds())
                
            except Exception as e:
                logger.error(f"Error in visibility update loop: {e}")
                # Continue running even if there's an error
                time.sleep(30)  # Wait 30 seconds before retrying
    
    def _update_visibility_cache(self):
        """Update the visibility cache with current calculations"""
        current_time = datetime.now(timezone.utc)
        
        try:
            # Calculate current visibility
            visible_objects = self._calculate_visibility_no_cache(current_time)
            
            # Detect significant changes
            changes_detected = self._detect_position_changes(visible_objects)
            
            # Update cache
            with self._cache_lock:
                cache_key = self._get_cache_key(current_time)
                self._visibility_cache[cache_key] = visible_objects
                self._cache_timestamps[cache_key] = current_time
                
                # Clean old cache entries
                self._cleanup_old_cache_entries(current_time)
            
            if changes_detected:
                logger.info(f"Significant position changes detected, cache updated at {current_time}")
            
        except Exception as e:
            logger.error(f"Failed to update visibility cache: {e}")
    
    def _calculate_visibility_no_cache(self, observation_time: datetime) -> List[Dict[str, Any]]:
        """Calculate visibility without using cache (for background updates)"""
        astro_time = Time(observation_time)
        visible_objects = []
        
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            
            for obj_data in ENHANCED_OBJECT_DATABASE:
                try:
                    visibility_info = self._calculate_object_visibility(
                        obj_data, astro_time, self.min_elevation
                    )
                    
                    if visibility_info and visibility_info['visibility']['is_visible']:
                        visible_objects.append(visibility_info)
                        
                except Exception as e:
                    logger.warning(f"Failed to calculate visibility for {obj_data['name']}: {e}")
                    continue
        
        visible_objects.sort(key=lambda x: x['coordinates']['elevation'], reverse=True)
        return visible_objects
    
    def _detect_position_changes(self, current_objects: List[Dict[str, Any]]) -> bool:
        """
        Detect if any objects have moved significantly since last update
        
        Args:
            current_objects: Current visibility calculations
            
        Returns:
            True if significant changes detected
        """
        changes_detected = False
        current_positions = {}
        
        # Build current position map
        for obj in current_objects:
            name = obj['name']
            coords = obj['coordinates']
            current_positions[name] = {
                'elevation': coords['elevation'],
                'azimuth': coords['azimuth']
            }
        
        # If no previous positions, this is a new state (changes detected)
        if not self._last_positions:
            changes_detected = True
        else:
            # Compare with last known positions
            for name, current_pos in current_positions.items():
                if name in self._last_positions:
                    last_pos = self._last_positions[name]
                    
                    # Calculate position difference
                    elev_diff = abs(current_pos['elevation'] - last_pos['elevation'])
                    azim_diff = abs(current_pos['azimuth'] - last_pos['azimuth'])
                    
                    # Handle azimuth wraparound (0/360 degrees)
                    if azim_diff > 180:
                        azim_diff = 360 - azim_diff
                    
                    # Check if change exceeds threshold
                    if elev_diff > self._position_threshold or azim_diff > self._position_threshold:
                        changes_detected = True
                        break
        
        # Update last known positions
        self._last_positions = current_positions
        
        return changes_detected
    
    def _get_cache_key(self, observation_time: datetime) -> str:
        """
        Generate cache key for given time (rounded to nearest minute)
        
        Args:
            observation_time: Time for cache key
            
        Returns:
            Cache key string
        """
        # Round to nearest minute for cache efficiency
        rounded_time = observation_time.replace(second=0, microsecond=0)
        return rounded_time.isoformat()
    
    def _is_cache_valid(self, cache_key: str, current_time: datetime) -> bool:
        """
        Check if cached data is still valid
        
        Args:
            cache_key: Cache key to check
            current_time: Current time for comparison
            
        Returns:
            True if cache is valid
        """
        if cache_key not in self._cache_timestamps:
            return False
        
        cache_time = self._cache_timestamps[cache_key]
        age = current_time - cache_time
        
        return age <= self.cache_duration
    
    def _cleanup_old_cache_entries(self, current_time: datetime):
        """
        Remove old cache entries to prevent memory buildup
        
        Args:
            current_time: Current time for age calculation
        """
        cutoff_time = current_time - (self.cache_duration * 2)  # Keep extra buffer
        
        keys_to_remove = []
        for cache_key, timestamp in self._cache_timestamps.items():
            if timestamp < cutoff_time:
                keys_to_remove.append(cache_key)
        
        for key in keys_to_remove:
            self._visibility_cache.pop(key, None)
            self._cache_timestamps.pop(key, None)
        
        if keys_to_remove:
            logger.debug(f"Cleaned up {len(keys_to_remove)} old cache entries")
    
    def get_cached_visible_objects(self, observation_time: Optional[datetime] = None) -> List[Dict[str, Any]]:
        """
        Get visible objects using cache when available
        
        Args:
            observation_time: Time for visibility calculation, defaults to now
            
        Returns:
            List of visible objects (cached or freshly calculated)
        """
        if observation_time is None:
            observation_time = datetime.now(timezone.utc)
        
        cache_key = self._get_cache_key(observation_time)
        
        with self._cache_lock:
            # Check if we have valid cached data
            if (cache_key in self._visibility_cache and 
                self._is_cache_valid(cache_key, observation_time)):
                logger.debug(f"Using cached visibility data for {cache_key}")
                return self._visibility_cache[cache_key].copy()
        
        # No valid cache, calculate fresh data
        logger.debug(f"Calculating fresh visibility data for {observation_time}")
        visible_objects = self.get_visible_objects(observation_time)
        
        # Cache the results
        with self._cache_lock:
            self._visibility_cache[cache_key] = visible_objects.copy()
            self._cache_timestamps[cache_key] = observation_time
        
        return visible_objects
    
    def get_cache_stats(self) -> Dict[str, Any]:
        """
        Get statistics about the visibility cache
        
        Returns:
            Dictionary with cache statistics
        """
        with self._cache_lock:
            return {
                'cache_entries': len(self._visibility_cache),
                'oldest_entry': min(self._cache_timestamps.values()) if self._cache_timestamps else None,
                'newest_entry': max(self._cache_timestamps.values()) if self._cache_timestamps else None,
                'cache_duration_minutes': self.cache_duration.total_seconds() / 60,
                'update_interval_minutes': self.update_interval.total_seconds() / 60,
                'is_running': self._is_running,
                'objects_tracked': len(self._last_positions)
            }
    
    def clear_cache(self):
        """Clear all cached visibility data"""
        with self._cache_lock:
            self._visibility_cache.clear()
            self._cache_timestamps.clear()
            self._last_positions.clear()
            self._session_cache.clear()
            self._session_cache_timestamps.clear()
        logger.info("Visibility cache cleared")
    
    def get_session_targets(self, start_time: datetime, end_time: datetime,
                           min_elevation: float = 30.0) -> Dict[str, Any]:
        """
        Calculate visibility for all objects during a session window.
        Caches results for 5 minutes using session window as cache key.
        
        Args:
            start_time: Session start time (UTC)
            end_time: Session end time (UTC)
            min_elevation: Minimum elevation threshold in degrees
            
        Returns:
            Dictionary with session metadata and categorized targets
        """
        # Validate inputs
        if end_time <= start_time:
            raise ValueError("end_time must be after start_time")
        
        max_duration = timedelta(hours=8)
        if (end_time - start_time) > max_duration:
            raise ValueError("Session duration cannot exceed 8 hours")
        
        if min_elevation > 90:
            raise ValueError("min_elevation cannot exceed 90 degrees")
        
        # Check cache first
        cache_key = self._get_session_cache_key(start_time, end_time, min_elevation)
        current_time = datetime.now(timezone.utc)
        
        with self._cache_lock:
            if (cache_key in self._session_cache and
                cache_key in self._session_cache_timestamps):
                cache_age = current_time - self._session_cache_timestamps[cache_key]
                if cache_age <= self.cache_duration:
                    logger.debug(f"Using cached session data for {cache_key}")
                    return self._session_cache[cache_key].copy()
        
        # Calculate session data
        targets = self._calculate_session_targets(start_time, end_time, min_elevation)
        moon_data = self._calculate_moon_phase(Time(end_time))
        sun_data = self._calculate_sun_times(start_time, end_time)
        
        # Determine if session is at night
        is_night = self._is_nighttime_session(start_time, end_time)
        
        # Build response
        result = {
            "session": {
                "start": start_time.isoformat(),
                "end": end_time.isoformat(),
                "duration_minutes": int((end_time - start_time).total_seconds() / 60),
                "timezone": "Australia/Melbourne",
                "local_start": start_time.astimezone(pytz.timezone("Australia/Melbourne")).isoformat(),
                "local_end": end_time.astimezone(pytz.timezone("Australia/Melbourne")).isoformat(),
                "is_night": is_night,
                "sun": sun_data,
                "moon": moon_data
            },
            "targets": targets,
            "summary": self._calculate_summary(targets),
            "cache_used": False
        }
        
        # Cache the result
        with self._cache_lock:
            self._session_cache[cache_key] = result.copy()
            self._session_cache_timestamps[cache_key] = current_time
            # Cleanup old entries
            self._cleanup_session_cache(current_time)
        
        return result
    
    def _get_session_cache_key(self, start: datetime, end: datetime, min_elev: float) -> str:
        """Generate cache key for session window."""
        key_string = f"{start.isoformat()}_{end.isoformat()}_{min_elev}"
        return hashlib.sha256(key_string.encode()).hexdigest()[:16]
    
    def _cleanup_session_cache(self, current_time: datetime):
        """Remove old session cache entries."""
        cutoff_time = current_time - (self.cache_duration * 2)
        keys_to_remove = [
            key for key, timestamp in self._session_cache_timestamps.items()
            if timestamp < cutoff_time
        ]
        for key in keys_to_remove:
            self._session_cache.pop(key, None)
            self._session_cache_timestamps.pop(key, None)
    
    def _sample_session_times(self, start: datetime, end: datetime) -> List[datetime]:
        """
        Adaptive sampling: 4-12 points based on session duration.
        
        Args:
            start: Session start time
            end: Session end time
            
        Returns:
            List of sample times
        """
        duration_sec = (end - start).total_seconds()
        # 4 samples minimum, 12 maximum, roughly one per 30 min
        num_samples = max(4, min(12, int(duration_sec / 1800) + 1))
        
        times = []
        for i in range(num_samples):
            fraction = i / (num_samples - 1) if num_samples > 1 else 0
            sample_time = start + timedelta(seconds=duration_sec * fraction)
            times.append(sample_time)
        
        return times
    
    def _calculate_session_targets(self, start_time: datetime, end_time: datetime,
                                   min_elevation: float) -> List[Dict[str, Any]]:
        """Calculate visibility data for all objects during session."""
        sample_times = self._sample_session_times(start_time, end_time)
        targets = []
        
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            
            for obj_data in ENHANCED_OBJECT_DATABASE:
                try:
                    target_info = self._calculate_target_session_data(
                        obj_data, sample_times, min_elevation
                    )
                    if target_info:
                        targets.append(target_info)
                except Exception as e:
                    logger.warning(f"Failed to calculate session data for {obj_data['name']}: {e}")
                    continue
        
        # Sort by quality score (highest first)
        targets.sort(key=lambda x: x.get("quality_score", 0), reverse=True)
        return targets
    
    def _calculate_target_session_data(self, obj_data: Dict[str, Any],
                                      sample_times: List[datetime],
                                      min_elevation: float) -> Optional[Dict[str, Any]]:
        """Calculate session visibility data for a single target."""
        # Get object coordinates at session midpoint
        mid_time = sample_times[len(sample_times) // 2]
        astro_mid = Time(mid_time)
        
        try:
            if obj_data["type"] == "Planet":
                with solar_system_ephemeris.set('builtin'):
                    target_coords = get_body(obj_data["name"].lower(), astro_mid, self.location)
            else:
                target_coords = SkyCoord.from_name(obj_data["name"])
        except Exception as e:
            logger.error(f"Could not get coordinates for {obj_data['name']}: {e}")
            return None
        
        # Calculate elevation at each sample time
        elevations = []
        for sample_time in sample_times:
            astro_time = Time(sample_time)
            local_frame = AltAz(obstime=astro_time, location=self.location)
            local_coords = target_coords.transform_to(local_frame)
            elevations.append(local_coords.alt.degree)
        
        if not elevations:
            return None
        
        elev_start = elevations[0]
        elev_end = elevations[-1]
        elev_min = min(elevations)
        elev_max = max(elevations)
        
        # Find transit time (when at maximum elevation)
        max_idx = elevations.index(elev_max)
        transit_time = sample_times[max_idx]
        transit_during = start_time <= transit_time <= end_time
        
        # Check visibility status
        visible_entire = all(e > min_elevation for e in elevations)
        sets_during = elev_start > min_elevation and elev_end < min_elevation
        
        # Skip if never above minimum elevation
        if elev_max < min_elevation:
            return None
        
        # Calculate quality score and grade
        score, grade = self._calculate_quality_score(
            elev_max, elev_min, transit_during, sets_during, min_elevation
        )
        
        # Generate recommendation
        recommendation = self._generate_session_recommendation(
            grade, transit_during, sets_during, transit_time, elev_max, min_elevation
        )
        
        # Format best observation time
        best_time = self._format_best_time(transit_time, transit_during, elev_max)
        
        # Get magnitude
        magnitude = self._get_object_magnitude(obj_data, astro_mid)
        
        return {
            "name": obj_data["name"],
            "type": obj_data["type"],
            "constellation": obj_data.get("constellation", "Unknown"),
            "magnitude": magnitude,
            "catalog_id": obj_data.get("catalog_id"),
            "coordinates": {
                "ra_hours": target_coords.ra.hour,
                "ra": f"{int(target_coords.ra.hms[0]):02d}h {int(target_coords.ra.hms[1]):02d}m {target_coords.ra.hms[2]:05.2f}s",
                "dec_degrees": target_coords.dec.degree,
                "dec": f"{target_coords.dec.dms[0]:+03d}° {abs(int(target_coords.dec.dms[1])):02d}' {abs(target_coords.dec.dms[2]):05.2f}\""
            },
            "quality_score": score,
            "quality_grade": grade,
            "elevation_start": round(elev_start, 1),
            "elevation_end": round(elev_end, 1),
            "elevation_min": round(elev_min, 1),
            "elevation_max": round(elev_max, 1),
            "transits_during_session": transit_during,
            "transit_time": transit_time.strftime("%H:%M") if transit_during else None,
            "visible_entire_session": visible_entire,
            "sets_during_session": sets_during,
            "best_time": best_time,
            "recommendation": recommendation
        }
    
    def _calculate_quality_score(self, max_elev: float, min_elev: float,
                                 transits: bool, sets_during: bool,
                                 min_elevation_threshold: float) -> Tuple[int, str]:
        """
        Calculate quality score (0-100) and grade.
        
        Scoring:
        - Elevation base: 0-70 points based on max elevation
        - Transit bonus: +15 if transits during session
        - Visibility penalty: -3 per degree below threshold
        - Set penalty: -20 if sets during session
        """
        score = 0
        
        # Elevation base (0-70 points)
        if max_elev > 60:
            score += 70
        elif max_elev > 45:
            score += 50 + (max_elev - 45)
        elif max_elev > 30:
            score += 30 + (max_elev - 30) * 1.33
        else:
            score += max_elev
        
        # Transit bonus
        if transits:
            score += 15
        
        # Visibility penalty
        if min_elev < min_elevation_threshold:
            score -= (min_elevation_threshold - min_elev) * 3
        
        # Set penalty
        if sets_during:
            score -= 20
        
        score = max(0, min(100, int(score)))
        
        # Determine grade
        if score >= 85:
            grade = "excellent"
        elif score >= 70:
            grade = "good"
        elif score >= 50:
            grade = "fair"
        elif score >= 20:
            grade = "poor"
        else:
            grade = "not_visible"
        
        return score, grade
    
    def _generate_session_recommendation(self, grade: str, transits: bool,
                                         sets_during: bool, transit_time: datetime,
                                         elev_max: float, min_elev: float) -> str:
        """Generate human-readable recommendation for session observation."""
        if grade == "excellent":
            if transits:
                return f"Transits during session at {transit_time.strftime('%H:%M')}, high elevation throughout"
            else:
                return f"High elevation ({elev_max:.1f}°) throughout session"
        elif grade == "good":
            return f"Well positioned, maximum elevation {elev_max:.1f}°"
        elif grade == "fair":
            return f"Moderate elevation, some portions below {min_elev}°"
        elif sets_during:
            return "Setting during session, observe early"
        else:
            return f"Low elevation, challenging observation"
    
    def _format_best_time(self, transit_time: datetime, transits: bool, elev_max: float) -> str:
        """Format the best observation time window."""
        if transits and elev_max > 30:
            # Window around transit
            start = (transit_time - timedelta(minutes=30)).strftime("%H:%M")
            end = (transit_time + timedelta(minutes=30)).strftime("%H:%M")
            return f"{start}-{end}"
        elif transits:
            return transit_time.strftime("%H:%M")
        else:
            return "Throughout session"
    
    def _calculate_moon_phase(self, astro_time: Time) -> Dict[str, Any]:
        """Calculate moon phase and position for session metadata."""
        try:
            moon_coords = get_body('moon', astro_time, location=self.location)
            local_frame = AltAz(obstime=astro_time, location=self.location)
            local_moon = moon_coords.transform_to(local_frame)
            
            # Calculate phase angle (simplified)
            sun_coords = get_sun(astro_time)
            elongation = moon_coords.separation(sun_coords).degree
            phase_angle = 180 - elongation
            
            # Illumination percentage
            illumination = (1 + np.cos(np.radians(phase_angle))) / 2 * 100
            
            # Phase name
            if phase_angle < 22.5:
                phase_name = "New Moon"
            elif phase_angle < 67.5:
                phase_name = "Waxing Crescent"
            elif phase_angle < 112.5:
                phase_name = "First Quarter"
            elif phase_angle < 157.5:
                phase_name = "Waxing Gibbous"
            elif phase_angle < 202.5:
                phase_name = "Full Moon"
            elif phase_angle < 247.5:
                phase_name = "Waning Gibbous"
            elif phase_angle < 292.5:
                phase_name = "Last Quarter"
            else:
                phase_name = "Waning Crescent"
            
            is_interfering = illumination > 75 and local_moon.alt.degree > 0
            
            return {
                "phase_name": phase_name,
                "illumination_percent": round(illumination, 1),
                "phase_angle": round(phase_angle, 1),
                "elevation_at_time": round(local_moon.alt.degree, 1),
                "is_interfering": is_interfering
            }
        except Exception as e:
            logger.warning(f"Could not calculate moon phase: {e}")
            return {
                "phase_name": "Unknown",
                "illumination_percent": None,
                "phase_angle": None,
                "elevation_at_time": None,
                "is_interfering": False
            }
    
    def _calculate_sun_times(self, start: datetime, end: datetime) -> Dict[str, Any]:
        """Calculate sun set/rise times for the session date."""
        try:
            melbourne_tz = pytz.timezone("Australia/Melbourne")
            local_date = start.astimezone(melbourne_tz).date()
            
            # Calculate sun times using astropy
            times = []
            for hour in range(24):
                t = datetime.combine(local_date, datetime.min.time().replace(hour=hour))
                t = melbourne_tz.localize(t)
                times.append(t.astimezone(timezone.utc))
            
            elevations = []
            for t in times:
                sun = get_sun(Time(t))
                local_frame = AltAz(obstime=Time(t), location=self.location)
                local_sun = sun.transform_to(local_frame)
                elevations.append(local_sun.alt.degree)
            
            # Find sunset and sunrise
            sunset_idx = None
            sunrise_idx = None
            for i, elev in enumerate(elevations):
                if sunset_idx is None and i > 0 and elevations[i-1] > 0 and elev <= 0:
                    sunset_idx = i
                if sunrise_idx is None and i > 0 and elevations[i-1] <= 0 and elev > 0:
                    sunrise_idx = i
            
            sun_data = {
                "set_time": times[sunset_idx].isoformat() if sunset_idx else None,
                "rise_time": times[sunrise_idx].isoformat() if sunrise_idx else None,
                "twilight_civil_end": None,
                "twilight_civil_start": None
            }
            
            return sun_data
        except Exception as e:
            logger.warning(f"Could not calculate sun times: {e}")
            return {"set_time": None, "rise_time": None}
    
    def _is_nighttime_session(self, start: datetime, end: datetime) -> bool:
        """Check if session occurs during nighttime (sun below -6 degrees)."""
        try:
            mid_time = start + (end - start) / 2
            astro_time = Time(mid_time)
            
            sun = get_sun(astro_time)
            local_frame = AltAz(obstime=astro_time, location=self.location)
            local_sun = sun.transform_to(local_frame)
            
            return local_sun.alt.degree < -6  # Civil twilight
        except Exception:
            return False
    
    def _calculate_summary(self, targets: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Calculate summary statistics for targets."""
        by_grade = {}
        for target in targets:
            grade = target.get("quality_grade", "not_visible")
            by_grade[grade] = by_grade.get(grade, 0) + 1
        
        # Ensure all grades are represented
        for grade in ["excellent", "good", "fair", "poor", "not_visible"]:
            if grade not in by_grade:
                by_grade[grade] = 0
        
        return {
            "total_checked": len(ENHANCED_OBJECT_DATABASE),
            "by_grade": by_grade
        }


# Global visibility service instance
_visibility_service_instance = None
_instance_lock = threading.Lock()


def get_visibility_service() -> VisibilityService:
    """
    Get singleton instance of VisibilityService
    
    Returns:
        VisibilityService instance
    """
    global _visibility_service_instance
    
    if _visibility_service_instance is None:
        with _instance_lock:
            if _visibility_service_instance is None:
                _visibility_service_instance = VisibilityService()
                # Start real-time updates by default
                _visibility_service_instance.start_real_time_updates()
    
    return _visibility_service_instance