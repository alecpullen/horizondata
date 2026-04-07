# app/telescope.py
# This file will contain all routes related to telescope control and data.

from flask import Blueprint, jsonify, request
from app.services.visibility_service import get_visibility_service
from datetime import datetime, timezone
import logging

# --- ASTROPY IMPORTS ---
# These are the specific tools we need from the AstroPy library.
from astropy.coordinates import EarthLocation, SkyCoord, AltAz, get_sun, get_body
from astropy import units as u
from astropy.time import Time
import warnings

logger = logging.getLogger(__name__)

# 1. Create a Blueprint instance for the telescope features.
telescope_bp = Blueprint('telescope', __name__, url_prefix='/api/telescope')

# 2. Define the observer's location (Bundoora, Victoria)
# These are the coordinates for La Trobe University.
BUNDOORA_LOCATION = EarthLocation(
    lat=-37.7214 * u.deg,
    lon=145.0489 * u.deg,
    height=140 * u.m
)

# 3. Define the list of celestial objects we are interested in.
# AstroPy will find the coordinates for these objects dynamically.
TARGET_LIST = [
    {"name": "Saturn", "type": "Planet"},
    {"name": "Jupiter", "type": "Planet"},
    {"name": "Carina Nebula", "type": "Emission Nebula"},
    {"name": "Tarantula Nebula", "type": "Emission Nebula"},
    {"name": "Orion Nebula", "type": "Emission Nebula"},
    {"name": "Large Magellanic Cloud", "type": "Irregular Galaxy"},
    {"name": "Small Magellanic Cloud", "type": "Irregular Galaxy"},
    {"name": "47 Tucanae", "type": "Globular Cluster"},
    {"name": "Omega Centauri", "type": "Globular Cluster"},
    {"name": "The Pleiades", "type": "Open Cluster"},
    {"name": "Alpha Centauri", "type": "Star System"},
    {"name": "Canopus", "type": "Star"},
]

# Enhanced endpoint using the new visibility service
@telescope_bp.route('/visible-objects', methods=['GET'])
def get_visible_objects():
    """
    Uses enhanced visibility service to return celestial objects
    currently visible from Melbourne with comprehensive metadata.
    """
    try:
        # Get query parameters
        object_type = request.args.get('type')
        constellation = request.args.get('constellation')
        min_elevation = request.args.get('min_elevation', type=float)
        use_cache = request.args.get('cache', 'true').lower() == 'true'
        
        # Get visibility service
        visibility_service = get_visibility_service()
        
        # Get visible objects (with or without cache)
        if use_cache:
            visible_objects = visibility_service.get_cached_visible_objects()
        else:
            visible_objects = visibility_service.get_visible_objects()
        
        # Apply filters if specified
        if object_type:
            visible_objects = [
                obj for obj in visible_objects 
                if obj['type'].lower() == object_type.lower()
            ]
        
        if constellation:
            visible_objects = [
                obj for obj in visible_objects 
                if obj.get('metadata', {}).get('constellation', '').lower() == constellation.lower()
            ]
        
        if min_elevation is not None:
            visible_objects = visibility_service.filter_by_elevation(visible_objects, min_elevation)
        
        # Format response for compatibility with existing frontend
        formatted_objects = []
        for obj in visible_objects:
            formatted_obj = {
                "name": obj["name"],
                "type": obj["type"],
                "ra": obj["coordinates"]["ra"],
                "dec": obj["coordinates"]["dec"],
                "elevation": obj["coordinates"]["elevation"],
                "azimuth": obj["coordinates"]["azimuth"],
                "magnitude": obj["visibility"]["magnitude"],
                "constellation": obj["metadata"]["constellation"],
                "distance": obj["metadata"]["distance"],
                "description": obj["metadata"]["description"]
            }
            
            # Add catalog ID if available
            if obj["metadata"].get("catalog_id"):
                formatted_obj["catalog_id"] = obj["metadata"]["catalog_id"]
            
            # Add rise/set times if available
            if obj["visibility"]["rise_time"]:
                formatted_obj["rise_time"] = obj["visibility"]["rise_time"]
            if obj["visibility"]["set_time"]:
                formatted_obj["set_time"] = obj["visibility"]["set_time"]
            
            formatted_objects.append(formatted_obj)
        
        return jsonify(formatted_objects)
        
    except Exception as e:
        logger.error(f"Error getting visible objects: {e}")
        return jsonify({"error": "Failed to calculate visible objects"}), 500


# Legacy endpoint for backward compatibility
@telescope_bp.route('/visible-objects-legacy', methods=['GET'])
def get_visible_objects_legacy():
    """
    Legacy endpoint using original AstroPy calculations for backward compatibility.
    """
    visible_objects = []
    # Get the current time for our calculations
    observation_time = Time.now()

    # Suppress warnings from AstroPy about IERS data being out of date
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")

        for target in TARGET_LIST:
            try:
                # Get the celestial coordinates (RA/Dec) for the target
                if target["type"] == "Planet":
                    # For planets, coordinates change over time
                    target_coords = get_body(target["name"], observation_time, BUNDOORA_LOCATION)
                else:
                    # For deep sky objects, coordinates are fixed
                    target_coords = SkyCoord.from_name(target["name"])

                # Transform the fixed RA/Dec coordinates to the local Altitude/Azimuth frame
                # This tells us where the object is in our local sky right now
                local_frame = AltAz(obstime=observation_time, location=BUNDOORA_LOCATION)
                local_coords = target_coords.transform_to(local_frame)

                # Check if the object is above a reasonable horizon (e.g., 20 degrees)
                if local_coords.alt.degree > 20:
                    visible_objects.append({
                        "name": target["name"],
                        "type": target["type"],
                        # Format RA in hours and Dec in degrees for the frontend
                        "ra": target_coords.ra.hour,
                        "dec": target_coords.dec.degree
                    })
            except Exception as e:
                # If AstroPy can't find an object by name, we print an error and continue
                print(f"Could not resolve coordinates for {target['name']}: {e}")

    return jsonify(visible_objects)


# New endpoint for visibility service statistics
@telescope_bp.route('/visibility-stats', methods=['GET'])
def get_visibility_stats():
    """
    Get statistics about the visibility service cache and performance.
    """
    try:
        visibility_service = get_visibility_service()
        stats = visibility_service.get_cache_stats()
        return jsonify(stats)
    except Exception as e:
        logger.error(f"Error getting visibility stats: {e}")
        return jsonify({"error": "Failed to get visibility statistics"}), 500

