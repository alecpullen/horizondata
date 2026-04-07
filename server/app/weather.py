# app/weather.py
# This file contains all routes related to fetching weather data.

import os
from flask import Blueprint, jsonify
import requests

# 1. Create a Blueprint instance.
# The first argument is the blueprint's name.
# The second is the import name, which is usually __name__.
# The url_prefix will be added to all routes in this blueprint.
weather_bp = Blueprint('weather', __name__, url_prefix='/weather')

# ThingSpeak API configuration
THINGSPEAK_API_BASE_URL = os.getenv('THINGSPEAK_API_BASE_URL', 'https://api.thingspeak.com')
THINGSPEAK_CHANNEL_ID = os.getenv('THINGSPEAK_CHANNEL_ID', '270748')

# API URL paths
get_feeds_endpoint = f"{THINGSPEAK_API_BASE_URL}/channels/{THINGSPEAK_CHANNEL_ID}/feeds.json?results=10"
get_temperature_endpoint = f"{THINGSPEAK_API_BASE_URL}/channels/{THINGSPEAK_CHANNEL_ID}/fields/1.json?results=2"
get_humidity_endpoint = f"{THINGSPEAK_API_BASE_URL}/channels/{THINGSPEAK_CHANNEL_ID}/fields/2.json?results=2"
get_pressure_endpoint = f"{THINGSPEAK_API_BASE_URL}/channels/{THINGSPEAK_CHANNEL_ID}/fields/3.json?results=2"
get_dew_point_endpoint = f"{THINGSPEAK_API_BASE_URL}/channels/{THINGSPEAK_CHANNEL_ID}/fields/4.json?results=2"

# 2. Create the routes and attach them to the blueprint.
# This route will now be accessible at /weather/feeds
@weather_bp.route('/feeds', methods=['GET'])
def get_weather_feeds():
    """Fetches the complete weather feed data."""
    try:
        response = requests.get(get_feeds_endpoint)
        response.raise_for_status()  # Raise an exception for bad status codes
        data = response.json()
        return jsonify(data)
    except requests.exceptions.RequestException as e:
        print(f"Error fetching feed data from ThingSpeak: {e}")
        return jsonify({"error": "Failed to fetch feed data from ThingSpeak API"}), 503

# This route will now be accessible at /weather/temperature
@weather_bp.route('/temperature', methods=['GET'])
def get_temperature_data():
    """Fetches only the temperature data."""
    try:
        response = requests.get(get_temperature_endpoint)
        response.raise_for_status()
        data = response.json()
        return jsonify(data)
    except requests.exceptions.RequestException as e:
        print(f"Error fetching temperature data from ThingSpeak: {e}")
        return jsonify({"error": "Failed to fetch temperature data from ThingSpeak API"}), 503

# This route will now be accessible at /weather/humidity
@weather_bp.route('/humidity', methods=['GET'])
def get_humidity_data():
    """Fetches only the humidity data."""
    try:
        response = requests.get(get_humidity_endpoint)
        response.raise_for_status()
        data = response.json()
        return jsonify(data)
    except requests.exceptions.RequestException as e:
        print(f"Error fetching humidity data from ThingSpeak: {e}")
        return jsonify({"error": "Failed to fetch humidity data from ThingSpeak API"}), 503

# This route will now be accessible at /weather/pressure
@weather_bp.route('/pressure', methods=['GET'])
def get_pressure_data():
    """Fetches only the pressure data."""
    try:
        response = requests.get(get_pressure_endpoint)
        response.raise_for_status()
        data = response.json()
        return jsonify(data)
    except requests.exceptions.RequestException as e:
        print(f"Error fetching pressure data from ThingSpeak: {e}")
        return jsonify({"error": "Failed to fetch pressure data from ThingSpeak API"}), 503

# This route will now be accessible at /weather/dew_point
@weather_bp.route('/dew_point', methods=['GET'])
def get_dew_point_data():
    """Fetches only the dew_point data."""
    try:
        response = requests.get(get_dew_point_endpoint)
        response.raise_for_status()
        data = response.json()
        return jsonify(data)
    except requests.exceptions.RequestException as e:
        print(f"Error fetching dew_point data from ThingSpeak: {e}")
        return jsonify({"error": "Failed to fetch dew_point data from ThingSpeak API"}), 503
    
@weather_bp.route('/trends', methods=['GET'])
def get_weather_trends():
    """Fetches the last 10 readings for trend analysis."""
    try:
        response = requests.get(get_feeds_endpoint)
        response.raise_for_status()
        data = response.json()
        return jsonify(data)
    except requests.exceptions.RequestException as e:
        print(f"Error fetching trend data from ThingSpeak: {e}")
        return jsonify({"error": "Failed to fetch trend data from ThingSpeak API"}), 503