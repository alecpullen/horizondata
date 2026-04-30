# app/routes/visibility.py
# API routes for enhanced visibility service

from flask import Blueprint, request, jsonify
from app.services.visibility_service import get_visibility_service
from datetime import datetime, timezone, timedelta
import logging
import numpy as np

logger = logging.getLogger(__name__)

# Create blueprint
visibility_bp = Blueprint('visibility', __name__, url_prefix='/api/visibility')


def convert_numpy(obj):
    """Convert numpy types to Python native types for JSON serialization"""
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    if isinstance(obj, (np.bool_,)):
        return bool(obj)
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        return float(obj)
    if isinstance(obj, dict):
        return {k: convert_numpy(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [convert_numpy(v) for v in obj]
    return obj


def create_error_response(error_code: str, message: str, status_code: int = 400):
    """Create standardized error response"""
    return jsonify({
        'success': False,
        'error': error_code,
        'message': message
    }), status_code


def create_success_response(data: dict):
    """Create standardized success response"""
    response = {'success': True}
    response.update(convert_numpy(data))
    return jsonify(response)


def parse_iso_timestamp(timestamp_str: str) -> datetime:
    """Parse ISO 8601 timestamp"""
    try:
        if timestamp_str.endswith('Z'):
            return datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
        else:
            return datetime.fromisoformat(timestamp_str)
    except ValueError:
        raise ValueError("Time must be in ISO 8601 format")


@visibility_bp.route('/objects', methods=['GET'])
def get_visible_objects():
    """Get list of currently visible celestial objects"""
    try:
        # Parse query parameters
        time_str = request.args.get('time')
        object_type = request.args.get('type')
        constellation = request.args.get('constellation')
        min_elevation = request.args.get('min_elevation', type=float)
        use_cache = request.args.get('cache', 'true').lower() == 'true'
        limit = request.args.get('limit', type=int)
        
        # Parse time if provided
        observation_time = None
        if time_str:
            try:
                observation_time = parse_iso_timestamp(time_str)
            except ValueError as e:
                return create_error_response('invalid_time', str(e))
        
        # Get visibility service
        visibility_service = get_visibility_service()
        
        # Get visible objects
        if use_cache and observation_time is None:
            # Only use cache for current time requests
            visible_objects = visibility_service.get_cached_visible_objects()
        else:
            visible_objects = visibility_service.get_visible_objects(observation_time, min_elevation)
        
        # Apply type filter
        if object_type:
            visible_objects = visibility_service.get_objects_by_type(object_type, observation_time)
        
        # Apply constellation filter
        if constellation:
            visible_objects = visibility_service.get_objects_in_constellation(constellation, observation_time)
        
        # Apply additional elevation filter if specified
        if min_elevation is not None and object_type is None and constellation is None:
            visible_objects = visibility_service.filter_by_elevation(visible_objects, min_elevation)
        
        # Apply limit
        if limit and limit > 0:
            visible_objects = visible_objects[:limit]
        
        # Create response
        response_data = {
            "timestamp": (observation_time or datetime.now(timezone.utc)).isoformat(),
            "location": {
                "latitude": -37.7214,
                "longitude": 145.0489,
                "name": "Melbourne, Australia"
            },
            "objects": visible_objects,
            "totalCount": len(visible_objects),
            "filters": {
                "type": object_type,
                "constellation": constellation,
                "min_elevation": min_elevation,
                "limit": limit
            }
        }
        
        return create_success_response(response_data)
        
    except Exception as e:
        import traceback
        logger.error(f"Error getting visible objects: {e}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        return create_error_response('internal_error', f'Failed to calculate visible objects: {str(e)}', 500)


@visibility_bp.route('/objects/<object_name>', methods=['GET'])
def get_object_visibility(object_name: str):
    """Get visibility information for a specific object"""
    try:
        # Parse query parameters
        time_str = request.args.get('time')
        
        # Parse time if provided
        observation_time = None
        if time_str:
            try:
                observation_time = parse_iso_timestamp(time_str)
            except ValueError as e:
                return create_error_response('invalid_time', str(e))
        
        # Get visibility service
        visibility_service = get_visibility_service()
        
        # Get object visibility
        object_info = visibility_service.get_object_by_name(object_name, observation_time)
        
        if not object_info:
            return create_error_response('object_not_visible', 
                                       f'Object "{object_name}" is not currently visible or not found', 404)
        
        response_data = {
            "timestamp": (observation_time or datetime.now(timezone.utc)).isoformat(),
            "object": object_info
        }
        
        return create_success_response(response_data)
        
    except Exception as e:
        logger.error(f"Error getting object visibility for {object_name}: {e}")
        return create_error_response('internal_error', 'Failed to get object visibility', 500)


@visibility_bp.route('/types', methods=['GET'])
def get_object_types():
    """Get list of available object types"""
    try:
        visibility_service = get_visibility_service()
        
        # Get all visible objects to determine available types
        visible_objects = visibility_service.get_cached_visible_objects()
        
        # Extract unique types
        types = list(set(obj['type'] for obj in visible_objects))
        types.sort()
        
        response_data = {
            "types": types,
            "totalTypes": len(types)
        }
        
        return create_success_response(response_data)
        
    except Exception as e:
        logger.error(f"Error getting object types: {e}")
        return create_error_response('internal_error', 'Failed to get object types', 500)


@visibility_bp.route('/constellations', methods=['GET'])
def get_constellations():
    """Get list of constellations with visible objects"""
    try:
        visibility_service = get_visibility_service()
        
        # Get all visible objects to determine available constellations
        visible_objects = visibility_service.get_cached_visible_objects()
        
        # Extract unique constellations
        constellations = list(set(
            obj['metadata']['constellation'] 
            for obj in visible_objects 
            if obj['metadata']['constellation'] != 'Unknown'
        ))
        constellations.sort()
        
        response_data = {
            "constellations": constellations,
            "totalConstellations": len(constellations)
        }
        
        return create_success_response(response_data)
        
    except Exception as e:
        logger.error(f"Error getting constellations: {e}")
        return create_error_response('internal_error', 'Failed to get constellations', 500)


@visibility_bp.route('/stats', methods=['GET'])
def get_visibility_stats():
    """Get visibility service statistics and cache information"""
    try:
        visibility_service = get_visibility_service()
        stats = visibility_service.get_cache_stats()
        
        return create_success_response({"stats": stats})
        
    except Exception as e:
        logger.error(f"Error getting visibility stats: {e}")
        return create_error_response('internal_error', 'Failed to get visibility statistics', 500)


@visibility_bp.route('/cache/clear', methods=['POST'])
def clear_visibility_cache():
    """Clear the visibility cache (admin function)"""
    try:
        visibility_service = get_visibility_service()
        visibility_service.clear_cache()
        
        return create_success_response({"message": "Visibility cache cleared successfully"})
        
    except Exception as e:
        logger.error(f"Error clearing visibility cache: {e}")
        return create_error_response('internal_error', 'Failed to clear visibility cache', 500)


@visibility_bp.route('/update', methods=['POST'])
def force_visibility_update():
    """Force an immediate visibility update (admin function)"""
    try:
        visibility_service = get_visibility_service()
        
        # Force a cache update
        visibility_service._update_visibility_cache()
        
        return create_success_response({"message": "Visibility update completed successfully"})
        
    except Exception as e:
        logger.error(f"Error forcing visibility update: {e}")
        return create_error_response('internal_error', 'Failed to force visibility update', 500)


@visibility_bp.route('/session', methods=['GET'])
def get_session_targets():
    """
    Get celestial targets optimized for a specific observation session window.

    Query Parameters:
    - start_time: ISO8601 UTC timestamp (required)
    - end_time: ISO8601 UTC timestamp (required)
    - min_elevation: Minimum elevation in degrees (optional, default: 30, max: 90)

    Returns targets categorized by quality grade with session metadata including
    moon phase information.
    """
    try:
        start_time_str = request.args.get('start_time')
        end_time_str = request.args.get('end_time')
        min_elevation = request.args.get('min_elevation', default=30.0, type=float)

        if not start_time_str:
            return create_error_response('missing_parameter', 'start_time is required')
        if not end_time_str:
            return create_error_response('missing_parameter', 'end_time is required')

        try:
            start_time = parse_iso_timestamp(start_time_str)
            end_time = parse_iso_timestamp(end_time_str)
        except ValueError:
            return create_error_response('invalid_format', 'Use ISO 8601 format (e.g., 2026-04-25T10:00:00Z)')

        if min_elevation > 90:
            return create_error_response('invalid_elevation', 'min_elevation cannot exceed 90 degrees')
        if min_elevation < 0:
            return create_error_response('invalid_elevation', 'min_elevation cannot be negative')

        current_time = datetime.now(timezone.utc)
        if start_time < current_time - timedelta(hours=24):
            return create_error_response('past_date', 'Cannot calculate visibility for dates more than 24 hours in the past')

        if (end_time - start_time) > timedelta(hours=8):
            return create_error_response('session_too_long', 'Maximum session duration is 8 hours')

        if end_time <= start_time:
            return create_error_response('invalid_range', 'end_time must be after start_time')

        visibility_service = get_visibility_service()
        result = visibility_service.get_session_targets(start_time, end_time, min_elevation)

        return create_success_response(result)

    except ValueError as e:
        return create_error_response('validation_error', str(e))
    except Exception as e:
        logger.error(f"Error getting session targets: {e}")
        return create_error_response('internal_error', 'Failed to calculate session targets', 500)