from flask import Blueprint, request, jsonify
from app.services.alpaca_client import AlpacaClient, AlpacaError, AlpacaConnectionError
from app.services.safety_manager import SafetyManager
import os
import logging
from datetime import datetime
from typing import Dict, List, Optional, Any
import math

logger = logging.getLogger(__name__)

# Create blueprint
space_objects_bp = Blueprint('space_objects', __name__, url_prefix='/api')

# Initialize Alpaca client and safety manager
ALPACA_BASE = os.getenv('ALPACA_BASE', 'http://localhost:32323/api/v1/telescope/0')
CLIENT_ID = int(os.getenv('CLIENT_ID', '1'))
alpaca_client = AlpacaClient(ALPACA_BASE, CLIENT_ID)
safety_manager = SafetyManager()


def create_error_response(error_code: str, message: str, status_code: int = 400):
    """Create standardized error response"""
    return jsonify({
        'success': False,
        'error': error_code,
        'message': message
    }), status_code


def create_success_response(data: Dict[str, Any]):
    """Create standardized success response"""
    response = {'success': True}
    response.update(data)
    return jsonify(response)


def parse_location(location_str: str) -> tuple[float, float]:
    """Parse location string in format 'latitude,longitude'"""
    try:
        parts = location_str.split(',')
        if len(parts) != 2:
            raise ValueError("Invalid format")
        
        lat = float(parts[0].strip())
        lon = float(parts[1].strip())
        
        if not (-90 <= lat <= 90):
            raise ValueError("Latitude must be between -90 and 90")
        if not (-180 <= lon <= 180):
            raise ValueError("Longitude must be between -180 and 180")
            
        return lat, lon
    except (ValueError, IndexError):
        raise ValueError("Location must be in format 'latitude,longitude'")


def parse_iso_timestamp(timestamp_str: str) -> datetime:
    """Parse ISO 8601 timestamp"""
    try:
        # Handle both with and without timezone
        if timestamp_str.endswith('Z'):
            return datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
        else:
            return datetime.fromisoformat(timestamp_str)
    except ValueError:
        raise ValueError("Time must be in ISO 8601 format")


def get_hardcoded_space_objects() -> List[Dict[str, Any]]:
    """Get hardcoded space objects data (as specified in API contract)"""
    return [
        {
            "id": "moon",
            "name": "Moon",
            "type": "moon",
            "rightAscension": "12h 30m 45.2s",
            "declination": "+15° 22' 18\"",
            "altitude": 65.8,
            "azimuth": 145.2,
            "magnitude": -12.6,
            "isVisible": True,
            "constellation": "Leo"
        },
        {
            "id": "mars",
            "name": "Mars",
            "type": "planet",
            "rightAscension": "14h 15m 39.7s",
            "declination": "+19° 10' 57\"",
            "altitude": 45.2,
            "azimuth": 180.5,
            "magnitude": -2.1,
            "isVisible": True,
            "constellation": "Virgo"
        },
        {
            "id": "jupiter",
            "name": "Jupiter",
            "type": "planet",
            "rightAscension": "22h 45m 12.3s",
            "declination": "-12° 35' 42\"",
            "altitude": 38.7,
            "azimuth": 220.8,
            "magnitude": -2.5,
            "isVisible": True,
            "constellation": "Aquarius"
        },
        {
            "id": "sirius",
            "name": "Sirius",
            "type": "star",
            "rightAscension": "06h 45m 08.9s",
            "declination": "-16° 42' 58\"",
            "altitude": 30.5,
            "azimuth": 120.3,
            "magnitude": -1.46,
            "isVisible": True,
            "constellation": "Canis Major"
        },
        {
            "id": "vega",
            "name": "Vega",
            "type": "star",
            "rightAscension": "18h 36m 56.3s",
            "declination": "+38° 47' 01\"",
            "altitude": 72.1,
            "azimuth": 295.4,
            "magnitude": 0.03,
            "isVisible": True,
            "constellation": "Lyra"
        },
        {
            "id": "m42",
            "name": "Orion Nebula (M42)",
            "type": "nebula",
            "rightAscension": "05h 35m 17.3s",
            "declination": "-05° 23' 28\"",
            "altitude": 25.8,
            "azimuth": 95.2,
            "magnitude": 4.0,
            "isVisible": True,
            "constellation": "Orion"
        },
        {
            "id": "m31",
            "name": "Andromeda Galaxy (M31)",
            "type": "galaxy",
            "rightAscension": "00h 42m 44.3s",
            "declination": "+41° 16' 09\"",
            "altitude": 55.3,
            "azimuth": 35.7,
            "magnitude": 3.4,
            "isVisible": True,
            "constellation": "Andromeda"
        },
        {
            "id": "saturn",
            "name": "Saturn",
            "type": "planet",
            "rightAscension": "21h 15m 22.1s",
            "declination": "-18° 45' 33\"",
            "altitude": 28.9,
            "azimuth": 205.6,
            "magnitude": 0.7,
            "isVisible": True,
            "constellation": "Capricornus"
        },
        {
            "id": "venus",
            "name": "Venus",
            "type": "planet",
            "rightAscension": "16h 22m 15.8s",
            "declination": "-22° 18' 45\"",
            "altitude": 15.2,
            "azimuth": 195.3,
            "magnitude": -4.2,
            "isVisible": True,
            "constellation": "Scorpius"
        },
        {
            "id": "polaris",
            "name": "Polaris (North Star)",
            "type": "star",
            "rightAscension": "02h 31m 49.1s",
            "declination": "+89° 15' 51\"",
            "altitude": 89.3,
            "azimuth": 0.0,
            "magnitude": 1.98,
            "isVisible": True,
            "constellation": "Ursa Minor"
        }
    ]


def filter_objects_by_type(objects: List[Dict], object_type: str) -> List[Dict]:
    """Filter objects by type"""
    valid_types = ['planet', 'star', 'nebula', 'galaxy', 'cluster', 'moon']
    if object_type not in valid_types:
        return objects
    return [obj for obj in objects if obj['type'] == object_type]


def ra_dec_to_decimal(ra_str: str, dec_str: str) -> tuple[float, float]:
    """Convert RA/Dec strings to decimal degrees for telescope control"""
    # Parse RA (format: "14h 15m 39.7s")
    ra_parts = ra_str.replace('h', '').replace('m', '').replace('s', '').split()
    ra_hours = float(ra_parts[0])
    ra_minutes = float(ra_parts[1]) if len(ra_parts) > 1 else 0
    ra_seconds = float(ra_parts[2]) if len(ra_parts) > 2 else 0
    ra_decimal = ra_hours + ra_minutes/60 + ra_seconds/3600
    
    # Parse Dec (format: "+19° 10' 57\"")
    dec_clean = dec_str.replace('°', '').replace("'", '').replace('"', '')
    dec_sign = 1 if dec_clean.startswith('+') else -1
    dec_clean = dec_clean.lstrip('+-')
    dec_parts = dec_clean.split()
    dec_degrees = float(dec_parts[0])
    dec_minutes = float(dec_parts[1]) if len(dec_parts) > 1 else 0
    dec_seconds = float(dec_parts[2]) if len(dec_parts) > 2 else 0
    dec_decimal = dec_sign * (dec_degrees + dec_minutes/60 + dec_seconds/3600)
    
    return ra_decimal, dec_decimal


@space_objects_bp.route('/space-objects', methods=['GET'])
def get_space_objects():
    """Get list of observable space objects"""
    try:
        # Parse query parameters
        location_str = request.args.get('location')
        time_str = request.args.get('time')
        limit_str = request.args.get('limit')
        object_type = request.args.get('type')
        
        # Parse and validate location if provided
        location = None
        if location_str:
            try:
                lat, lon = parse_location(location_str)
                location = {"latitude": lat, "longitude": lon}
            except ValueError as e:
                return create_error_response('invalid_location', str(e))
        else:
            # Default to Melbourne coordinates as specified in contract
            location = {"latitude": -37.7136, "longitude": 144.9631}
        
        # Parse and validate time if provided
        timestamp = None
        if time_str:
            try:
                timestamp = parse_iso_timestamp(time_str)
            except ValueError as e:
                return create_error_response('invalid_time', str(e))
        else:
            timestamp = datetime.utcnow()
        
        # Parse limit
        limit = None
        if limit_str:
            try:
                limit = int(limit_str)
                if limit <= 0:
                    return create_error_response('invalid_limit', 'Limit must be a positive integer')
            except ValueError:
                return create_error_response('invalid_limit', 'Limit must be a valid integer')
        
        # Get space objects data
        objects = get_hardcoded_space_objects()
        
        # Filter by type if specified
        if object_type:
            objects = filter_objects_by_type(objects, object_type)
        
        # Apply limit if specified
        if limit:
            objects = objects[:limit]
        
        # Create response
        response_data = {
            "timestamp": timestamp.isoformat() + "Z",
            "location": location,
            "objects": objects,
            "totalCount": len(objects)
        }
        
        return create_success_response(response_data)
        
    except Exception as e:
        logger.error(f"Unexpected error in get_space_objects: {e}")
        return create_error_response('internal_error', 'Unable to calculate visible objects', 500)


@space_objects_bp.route('/telescope/select', methods=['POST'])
def select_space_object():
    """Command telescope to move to selected space object"""
    try:
        # Check safety status before allowing telescope selection
        safety_status = safety_manager.get_current_status()
        if safety_status['status'] != 'ACTIVE':
            return create_error_response(
                'safety_lock', 
                f'Telescope operations are locked: {safety_status["reason"]}', 
                423  # Locked status code
            )
        
        # Parse request body
        data = request.get_json()
        if not data or 'objectId' not in data:
            return create_error_response('missing_field', 'objectId is required')
        
        object_id = data['objectId']
        
        # Find the object in our hardcoded data
        objects = get_hardcoded_space_objects()
        target_object = None
        for obj in objects:
            if obj['id'] == object_id:
                target_object = obj
                break
        
        if not target_object:
            return create_error_response('object_not_found', f'Space object with id \'{object_id}\' does not exist', 404)
        
        # Check telescope connection
        try:
            if not alpaca_client.get_connected():
                return create_error_response('telescope_connection_failed', 'Unable to connect to ASCOM telescope simulator', 503)
        except AlpacaConnectionError:
            return create_error_response('telescope_connection_failed', 'Unable to connect to ASCOM telescope simulator', 503)
        
        # Check if telescope is busy (slewing)
        try:
            if alpaca_client.get_slewing():
                return create_error_response('telescope_unavailable', 'Telescope is currently slewing to another target', 409)
        except AlpacaConnectionError:
            return create_error_response('telescope_connection_failed', 'Unable to connect to ASCOM telescope simulator', 503)
        
        # Convert coordinates to decimal for telescope control
        try:
            ra_decimal, dec_decimal = ra_dec_to_decimal(
                target_object['rightAscension'], 
                target_object['declination']
            )
        except Exception as e:
            logger.error(f"Error converting coordinates for {object_id}: {e}")
            return create_error_response('internal_error', 'Failed to process object coordinates', 500)
        
        # Ensure telescope is unparked and tracking
        try:
            if alpaca_client.get_parked():
                alpaca_client.unpark()
            
            if not alpaca_client.get_tracking():
                alpaca_client.set_tracking(True)
        except AlpacaConnectionError:
            return create_error_response('telescope_connection_failed', 'Unable to connect to ASCOM telescope simulator', 503)
        except Exception as e:
            logger.error(f"Error preparing telescope: {e}")
            return create_error_response('internal_error', 'Failed to prepare telescope for slewing', 500)
        
        # Start slewing to target
        try:
            alpaca_client.slew_to_coordinates(ra_decimal, dec_decimal)
        except AlpacaConnectionError:
            return create_error_response('telescope_connection_failed', 'Unable to connect to ASCOM telescope simulator', 503)
        except AlpacaError as e:
            return create_error_response('telescope_error', f'Telescope error: {e.message}', 503)
        except Exception as e:
            logger.error(f"Error starting slew: {e}")
            return create_error_response('internal_error', 'Failed to start telescope slew', 500)
        
        # Create success response
        response_data = {
            "message": f"Telescope moving to {target_object['name']}",
            "objectId": object_id,
            "objectName": target_object['name'],
            "targetCoordinates": {
                "rightAscension": target_object['rightAscension'],
                "declination": target_object['declination'],
                "altitude": target_object['altitude'],
                "azimuth": target_object['azimuth']
            },
            "estimatedTime": 5,  # Estimated seconds as per contract
            "status": "slewing"
        }
        
        return create_success_response(response_data)
        
    except Exception as e:
        logger.error(f"Unexpected error in select_space_object: {e}")
        return create_error_response('internal_error', 'Failed to process telescope selection', 500)
