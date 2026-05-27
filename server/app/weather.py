# app/weather.py
# This file contains all routes related to fetching weather data.

import os
import logging
from flask import Blueprint, jsonify
import requests
from app.middleware.auth import require_any_auth

logger = logging.getLogger(__name__)

# 1. Create a Blueprint instance.
# The first argument is the blueprint's name.
# The second is the import name, which is usually __name__.
# The url_prefix will be added to all routes in this blueprint.
weather_bp = Blueprint('weather', __name__, url_prefix='/weather')

# ThingSpeak API configuration
THINGSPEAK_API_BASE_URL = os.getenv('THINGSPEAK_API_BASE_URL', 'https://api.thingspeak.com')

def _get_thingspeak_channel_id():
    from app.services.database import get_db
    from app.models.setting import SystemSetting
    try:
        with get_db() as db:
            setting = db.query(SystemSetting).filter_by(key="thingspeak_channel_id").first()
            if setting and setting.value:
                return setting.value
    except Exception as e:
        pass
    return os.getenv('THINGSPEAK_CHANNEL_ID', '270748')

def _get_endpoint(path_template):
    channel_id = _get_thingspeak_channel_id()
    return f"{THINGSPEAK_API_BASE_URL.rstrip('/')}/channels/{channel_id}/{path_template}"

# 2. Create the routes and attach them to the blueprint.
# This route will now be accessible at /weather/feeds
@weather_bp.route('/feeds', methods=['GET'])
@require_any_auth
def get_weather_feeds():
    """Fetches the complete weather feed data."""
    try:
        response = requests.get(_get_endpoint("feeds.json?results=10"))
        response.raise_for_status()  # Raise an exception for bad status codes
        data = response.json()
        return jsonify(data)
    except requests.exceptions.RequestException as e:
        logger.error(f"Error fetching feed data from ThingSpeak: {e}")
        return jsonify({"error": "Failed to fetch feed data from ThingSpeak API"}), 503

# This route will now be accessible at /weather/temperature
@weather_bp.route('/temperature', methods=['GET'])
@require_any_auth
def get_temperature_data():
    """Fetches only the temperature data."""
    try:
        response = requests.get(_get_endpoint("fields/1.json?results=2"))
        response.raise_for_status()
        data = response.json()
        return jsonify(data)
    except requests.exceptions.RequestException as e:
        logger.error(f"Error fetching temperature data from ThingSpeak: {e}")
        return jsonify({"error": "Failed to fetch temperature data from ThingSpeak API"}), 503

# This route will now be accessible at /weather/humidity
@weather_bp.route('/humidity', methods=['GET'])
@require_any_auth
def get_humidity_data():
    """Fetches only the humidity data."""
    try:
        response = requests.get(_get_endpoint("fields/2.json?results=2"))
        response.raise_for_status()
        data = response.json()
        return jsonify(data)
    except requests.exceptions.RequestException as e:
        logger.error(f"Error fetching humidity data from ThingSpeak: {e}")
        return jsonify({"error": "Failed to fetch humidity data from ThingSpeak API"}), 503

# This route will now be accessible at /weather/pressure
@weather_bp.route('/pressure', methods=['GET'])
@require_any_auth
def get_pressure_data():
    """Fetches only the pressure data."""
    try:
        response = requests.get(_get_endpoint("fields/3.json?results=2"))
        response.raise_for_status()
        data = response.json()
        return jsonify(data)
    except requests.exceptions.RequestException as e:
        logger.error(f"Error fetching pressure data from ThingSpeak: {e}")
        return jsonify({"error": "Failed to fetch pressure data from ThingSpeak API"}), 503

# This route will now be accessible at /weather/dew_point
@weather_bp.route('/dew_point', methods=['GET'])
@require_any_auth
def get_dew_point_data():
    """Fetches only the dew_point data."""
    try:
        response = requests.get(_get_endpoint("fields/4.json?results=2"))
        response.raise_for_status()
        data = response.json()
        return jsonify(data)
    except requests.exceptions.RequestException as e:
        logger.error(f"Error fetching dew_point data from ThingSpeak: {e}")
        return jsonify({"error": "Failed to fetch dew_point data from ThingSpeak API"}), 503
    
@weather_bp.route('/trends', methods=['GET'])
@require_any_auth
def get_weather_trends():
    """Fetches the last 10 readings for trend analysis."""
    try:
        response = requests.get(_get_endpoint("feeds.json?results=10"))
        response.raise_for_status()
        data = response.json()
        return jsonify(data)
    except requests.exceptions.RequestException as e:
        logger.error(f"Error fetching trend data from ThingSpeak: {e}")
        return jsonify({"error": "Failed to fetch trend data from ThingSpeak API"}), 503