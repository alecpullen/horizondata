from flask import Blueprint, request, jsonify
from app.services.alpaca_client import AlpacaClient, AlpacaError, AlpacaConnectionError
from app.services.visibility_service import get_visibility_service
from app.services.safety_manager import SafetyManager
import os
import logging
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)

# Create blueprint
telescope_bp = Blueprint('telescope', __name__, url_prefix='/api/telescope')

# Initialize Alpaca client
ALPACA_BASE = os.getenv('ALPACA_BASE', 'http://localhost:32323/api/v1/telescope/0')
CLIENT_ID = int(os.getenv('CLIENT_ID', '1'))
alpaca_client = AlpacaClient(ALPACA_BASE, CLIENT_ID)

# Initialize services for enhanced visibility
visibility_service = get_visibility_service()
safety_manager = SafetyManager()


def create_error_response(error_code: str, message: str, status_code: int = 400):
    """Create standardized error response"""
    return jsonify({'error': error_code, 'message': message}), status_code


def get_telescope_status():
    """Get complete telescope status"""
    try:
        connected = alpaca_client.get_connected()
        if not connected:
            return {
                'connected': False,
                'tracking': False,
                'parked': True,
                'slewing': False,
                'ra': 0.0,
                'dec': 0.0,
                'az': 0.0,
                'alt': 0.0
            }
        
        tracking = alpaca_client.get_tracking()
        parked = alpaca_client.get_parked()
        slewing = alpaca_client.get_slewing()
        coords = alpaca_client.get_coordinates()
        
        return {
            'connected': connected,
            'tracking': tracking,
            'parked': parked,
            'slewing': slewing,
            'ra': coords['ra'],
            'dec': coords['dec'],
            'az': coords['az'],
            'alt': coords['alt']
        }
    except AlpacaConnectionError as e:
        logger.error(f"Connection error: {e}")
        raise
    except Exception as e:
        logger.error(f"Unexpected error getting status: {e}")
        raise


@telescope_bp.route('/status', methods=['GET'])
def status():
    """Get telescope status"""
    try:
        status_data = get_telescope_status()
        return jsonify(status_data)
    except AlpacaConnectionError:
        return create_error_response('connection_error', 'Cannot connect to telescope simulator', 503)
    except Exception as e:
        return create_error_response('internal_error', str(e), 500)


@telescope_bp.route('/connect', methods=['POST'])
def connect():
    """Connect/disconnect telescope"""
    try:
        # Check safety status before allowing connection
        safety_status = safety_manager.get_current_status()
        if safety_status['status'] != 'ACTIVE':
            return create_error_response(
                'safety_lock', 
                f'Telescope operations are locked: {safety_status["reason"]}', 
                423  # Locked status code
            )
        
        data = request.get_json()
        if not data or 'connected' not in data:
            return create_error_response('invalid_request', 'Missing "connected" field')
        
        connected = bool(data['connected'])
        alpaca_client.set_connected(connected)
        
        status_data = get_telescope_status()
        return jsonify(status_data)
        
    except AlpacaConnectionError:
        return create_error_response('connection_error', 'Cannot connect to telescope simulator', 503)
    except Exception as e:
        return create_error_response('internal_error', str(e), 500)


@telescope_bp.route('/tracking', methods=['POST'])
def tracking():
    """Enable/disable telescope tracking"""
    try:
        # Check safety status before allowing tracking changes
        safety_status = safety_manager.get_current_status()
        if safety_status['status'] != 'ACTIVE':
            return create_error_response(
                'safety_lock', 
                f'Telescope operations are locked: {safety_status["reason"]}', 
                423  # Locked status code
            )
        
        # Check if telescope is connected
        if not alpaca_client.get_connected():
            return create_error_response('not_connected', 'Telescope must be connected first')
        
        data = request.get_json()
        if not data or 'on' not in data:
            return create_error_response('invalid_request', 'Missing "on" field')
        
        tracking_on = bool(data['on'])
        alpaca_client.set_tracking(tracking_on)
        
        status_data = get_telescope_status()
        return jsonify(status_data)
        
    except AlpacaConnectionError:
        return create_error_response('connection_error', 'Cannot connect to telescope simulator', 503)
    except Exception as e:
        return create_error_response('internal_error', str(e), 500)


@telescope_bp.route('/park', methods=['POST'])
def park():
    """Park/unpark telescope"""
    try:
        # Check safety status before allowing park/unpark operations
        safety_status = safety_manager.get_current_status()
        if safety_status['status'] != 'ACTIVE':
            return create_error_response(
                'safety_lock', 
                f'Telescope operations are locked: {safety_status["reason"]}', 
                423  # Locked status code
            )
        
        # Check if telescope is connected
        if not alpaca_client.get_connected():
            return create_error_response('not_connected', 'Telescope must be connected first')
        
        data = request.get_json()
        if not data or 'action' not in data:
            return create_error_response('invalid_request', 'Missing "action" field')
        
        action = data['action']
        if action == 'park':
            alpaca_client.park()
        elif action == 'unpark':
            alpaca_client.unpark()
        else:
            return create_error_response('invalid_request', 'Action must be "park" or "unpark"')
        
        status_data = get_telescope_status()
        return jsonify(status_data)
        
    except AlpacaConnectionError:
        return create_error_response('connection_error', 'Cannot connect to telescope simulator', 503)
    except Exception as e:
        return create_error_response('internal_error', str(e), 500)


@telescope_bp.route('/abort', methods=['POST'])
def abort():
    """Abort current telescope operation"""
    try:
        # Check if telescope is connected
        if not alpaca_client.get_connected():
            return create_error_response('not_connected', 'Telescope must be connected first')
        
        alpaca_client.abort_slew()
        
        status_data = get_telescope_status()
        return jsonify(status_data)
        
    except AlpacaConnectionError:
        return create_error_response('connection_error', 'Cannot connect to telescope simulator', 503)
    except Exception as e:
        return create_error_response('internal_error', str(e), 500)


@telescope_bp.route('/slew/coords', methods=['POST'])
def slew_coords():
    """Slew telescope to RA/Dec coordinates"""
    try:
        # Check safety status before allowing slew operations
        safety_status = safety_manager.get_current_status()
        if safety_status['status'] != 'ACTIVE':
            return create_error_response(
                'safety_lock', 
                f'Telescope operations are locked: {safety_status["reason"]}', 
                423  # Locked status code
            )
        
        # Check if telescope is connected
        if not alpaca_client.get_connected():
            return create_error_response('not_connected', 'Telescope must be connected first')
        
        # Check if telescope is parked
        if alpaca_client.get_parked():
            return create_error_response('unpark_required', 'Telescope must be unparked before slewing')
        
        # Check if tracking is enabled
        if not alpaca_client.get_tracking():
            return create_error_response('tracking_required', 'Tracking must be enabled before slewing')
        
        data = request.get_json()
        if not data or 'ra' not in data or 'dec' not in data:
            return create_error_response('invalid_request', 'Missing "ra" or "dec" fields')
        
        ra = float(data['ra'])
        dec = float(data['dec'])
        
        # Validate coordinates
        if not (0 <= ra <= 24):
            return create_error_response('invalid_coordinates', 'RA must be between 0 and 24 hours')
        if not (-90 <= dec <= 90):
            return create_error_response('invalid_coordinates', 'Dec must be between -90 and 90 degrees')
        
        # Start slew
        alpaca_client.slew_to_coordinates(ra, dec)
        
        # Wait for slew to complete
        slew_completed = alpaca_client.wait_for_slew_complete(timeout=10)
        
        status_data = get_telescope_status()
        if not slew_completed:
            status_data['warning'] = 'Slew may still be in progress'
        
        return jsonify(status_data)
        
    except AlpacaError as e:
        if e.error_number == 1035:  # Alpaca error for tracking required
            return create_error_response('tracking_required', 'Tracking must be enabled before slewing')
        return create_error_response('alpaca_error', e.message)
    except AlpacaConnectionError:
        return create_error_response('connection_error', 'Cannot connect to telescope simulator', 503)
    except ValueError:
        return create_error_response('invalid_request', 'RA and Dec must be valid numbers')
    except Exception as e:
        return create_error_response('internal_error', str(e), 500)


@telescope_bp.route('/slew/altaz', methods=['POST'])
def slew_altaz():
    """Slew telescope to Alt/Az coordinates"""
    try:
        # Check safety status before allowing slew operations
        safety_status = safety_manager.get_current_status()
        if safety_status['status'] != 'ACTIVE':
            return create_error_response(
                'safety_lock', 
                f'Telescope operations are locked: {safety_status["reason"]}', 
                423  # Locked status code
            )
        
        # Check if telescope is connected
        if not alpaca_client.get_connected():
            return create_error_response('not_connected', 'Telescope must be connected first')
        
        # Check if telescope is parked
        if alpaca_client.get_parked():
            return create_error_response('unpark_required', 'Telescope must be unparked before slewing')
        
        # Check if tracking is enabled
        if not alpaca_client.get_tracking():
            return create_error_response('tracking_required', 'Tracking must be enabled before slewing')
        
        data = request.get_json()
        if not data or 'az' not in data or 'alt' not in data:
            return create_error_response('invalid_request', 'Missing "az" or "alt" fields')
        
        az = float(data['az'])
        alt = float(data['alt'])
        
        # Validate coordinates
        if not (0 <= az <= 360):
            return create_error_response('invalid_coordinates', 'Azimuth must be between 0 and 360 degrees')
        if not (-90 <= alt <= 90):
            return create_error_response('invalid_coordinates', 'Altitude must be between -90 and 90 degrees')
        
        # Start slew
        alpaca_client.slew_to_altaz(az, alt)
        
        # Wait for slew to complete
        slew_completed = alpaca_client.wait_for_slew_complete(timeout=10)
        
        status_data = get_telescope_status()
        if not slew_completed:
            status_data['warning'] = 'Slew may still be in progress'
        
        return jsonify(status_data)
        
    except AlpacaError as e:
        if e.error_number == 1035:  # Alpaca error for tracking required
            return create_error_response('tracking_required', 'Tracking must be enabled before slewing')
        return create_error_response('alpaca_error', e.message)
    except AlpacaConnectionError:
        return create_error_response('connection_error', 'Cannot connect to telescope simulator', 503)
    except ValueError:
        return create_error_response('invalid_request', 'Az and Alt must be valid numbers')
    except Exception as e:
        return create_error_response('internal_error', str(e), 500)


@telescope_bp.route('/visible-objects', methods=['GET'])
def get_visible_objects():
    """
    Get list of celestial objects visible from Melbourne with safety filtering.
    
    This endpoint provides enhanced visibility data including rise/set times,
    visibility duration, and safety-filtered results based on current system status.
    
    Query Parameters:
        - time: ISO 8601 timestamp for calculation (defaults to current time)
        - type: Filter by object type (Planet, Star, Galaxy, etc.)
        - constellation: Filter by constellation name
        - min_elevation: Minimum elevation angle in degrees (defaults to 20)
        - safety_filter: Apply safety filtering (true/false, defaults to true)
        - limit: Maximum number of objects to return
    
    Requirements addressed: 4.4, 4.5
    """
    try:
        # Parse query parameters
        time_str = request.args.get('time')
        object_type = request.args.get('type')
        constellation = request.args.get('constellation')
        min_elevation = request.args.get('min_elevation', type=float, default=20.0)
        safety_filter = request.args.get('safety_filter', 'true').lower() == 'true'
        limit = request.args.get('limit', type=int)
        
        # Parse observation time
        observation_time = None
        if time_str:
            try:
                if time_str.endswith('Z'):
                    observation_time = datetime.fromisoformat(time_str.replace('Z', '+00:00'))
                else:
                    observation_time = datetime.fromisoformat(time_str)
            except ValueError:
                return create_error_response('invalid_time', 'Time must be in ISO 8601 format')
        else:
            observation_time = datetime.now(timezone.utc)
        
        # Check safety status if safety filtering is enabled
        safety_status = None
        if safety_filter:
            try:
                safety_status = safety_manager.get_current_status()
                
                # If system is not ACTIVE, return empty list with safety information
                if safety_status['status'] != 'ACTIVE':
                    return jsonify({
                        'success': True,
                        'timestamp': observation_time.isoformat(),
                        'location': {
                            'latitude': -37.7214,
                            'longitude': 145.0489,
                            'name': 'Melbourne, Australia'
                        },
                        'objects': [],
                        'totalCount': 0,
                        'safety_status': {
                            'status': safety_status['status'],
                            'reason': safety_status['reason'],
                            'next_available': safety_status.get('next_available'),
                            'filtered': True
                        },
                        'filters': {
                            'type': object_type,
                            'constellation': constellation,
                            'min_elevation': min_elevation,
                            'safety_filter': safety_filter,
                            'limit': limit
                        }
                    })
            except Exception as e:
                logger.warning(f"Could not determine safety status: {e}")
                # Continue without safety filtering if safety check fails
                safety_filter = False
        
        # Get visible objects from visibility service
        if object_type:
            visible_objects = visibility_service.get_objects_by_type(object_type, observation_time)
        elif constellation:
            visible_objects = visibility_service.get_objects_in_constellation(constellation, observation_time)
        else:
            visible_objects = visibility_service.get_visible_objects(observation_time, min_elevation)
        
        # Apply additional elevation filter if specified and not already filtered
        if min_elevation != 20.0 and not object_type and not constellation:
            visible_objects = visibility_service.filter_by_elevation(visible_objects, min_elevation)
        
        # Apply limit
        if limit and limit > 0:
            visible_objects = visible_objects[:limit]
        
        # Enhance objects with additional real-time data
        enhanced_objects = []
        for obj in visible_objects:
            enhanced_obj = obj.copy()
            
            # Add visibility duration (simplified calculation)
            enhanced_obj['visibility']['duration_hours'] = _estimate_visibility_duration(
                enhanced_obj['coordinates']['elevation']
            )
            
            # Add observability rating based on elevation and magnitude
            enhanced_obj['visibility']['observability_rating'] = _calculate_observability_rating(
                enhanced_obj['coordinates']['elevation'],
                enhanced_obj['visibility'].get('magnitude')
            )
            
            # Add real-time position update timestamp
            enhanced_obj['position_updated'] = observation_time.isoformat()
            
            enhanced_objects.append(enhanced_obj)
        
        # Create response
        response_data = {
            'success': True,
            'timestamp': observation_time.isoformat(),
            'location': {
                'latitude': -37.7214,
                'longitude': 145.0489,
                'name': 'Melbourne, Australia'
            },
            'objects': enhanced_objects,
            'totalCount': len(enhanced_objects),
            'filters': {
                'type': object_type,
                'constellation': constellation,
                'min_elevation': min_elevation,
                'safety_filter': safety_filter,
                'limit': limit
            }
        }
        
        # Add safety status information if safety filtering was applied
        if safety_filter and safety_status:
            response_data['safety_status'] = {
                'status': safety_status['status'],
                'reason': safety_status['reason'],
                'filtered': False  # Objects were not filtered out due to safety
            }
        
        return jsonify(response_data)
        
    except Exception as e:
        logger.error(f"Error getting visible objects: {e}")
        return create_error_response('internal_error', 'Failed to get visible objects', 500)


def _estimate_visibility_duration(elevation: float) -> float:
    """
    Estimate visibility duration based on current elevation.
    
    This is a simplified calculation that estimates how long an object
    will remain visible based on its current elevation angle.
    
    Args:
        elevation: Current elevation angle in degrees
        
    Returns:
        Estimated visibility duration in hours
    """
    # Simple model: objects higher in the sky are visible longer
    # This is a rough approximation and could be enhanced with proper calculations
    if elevation >= 80:
        return 8.0  # Near zenith, visible most of the night
    elif elevation >= 60:
        return 6.0
    elif elevation >= 45:
        return 4.0
    elif elevation >= 30:
        return 2.5
    else:
        return 1.0  # Low on horizon, visible for shorter time


def _calculate_observability_rating(elevation: float, magnitude: Optional[float]) -> str:
    """
    Calculate observability rating based on elevation and magnitude.
    
    Args:
        elevation: Object elevation in degrees
        magnitude: Object magnitude (lower is brighter)
        
    Returns:
        Rating string: 'Excellent', 'Good', 'Fair', or 'Poor'
    """
    # Base rating on elevation
    if elevation >= 70:
        elev_score = 4  # Excellent
    elif elevation >= 50:
        elev_score = 3  # Good
    elif elevation >= 30:
        elev_score = 2  # Fair
    else:
        elev_score = 1  # Poor
    
    # Adjust for magnitude if available
    if magnitude is not None:
        if magnitude <= 2.0:  # Very bright
            mag_bonus = 1
        elif magnitude <= 4.0:  # Moderately bright
            mag_bonus = 0
        else:  # Dim
            mag_bonus = -1
        
        elev_score = max(1, min(4, elev_score + mag_bonus))
    
    # Convert score to rating
    if elev_score >= 4:
        return 'Excellent'
    elif elev_score >= 3:
        return 'Good'
    elif elev_score >= 2:
        return 'Fair'
    else:
        return 'Poor'
