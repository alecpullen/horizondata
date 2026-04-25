# app/routes/visibility.py
# API routes for enhanced visibility service

from flask import Blueprint, request, jsonify
from app.services.visibility_service import get_visibility_service
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)

# Create blueprint
visibility_bp = Blueprint('visibility', __name__, url_prefix='/api/visibility')


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
    response.update(data)
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
        
        # Apply type filter (skip if 'all')
        if object_type and object_type.lower() != 'all':
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
        logger.error(f"Error getting visible objects: {e}")
        return create_error_response('internal_error', 'Failed to calculate visible objects', 500)


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