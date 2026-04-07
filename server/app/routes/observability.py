"""
Observability API endpoints for logs, metrics, and traces.
Provides access to telemetry data for the frontend dashboard.
"""

import logging
import json
from datetime import datetime, timedelta
from flask import Blueprint, jsonify, request
from opentelemetry import trace, metrics
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.metrics import MeterProvider

observability_bp = Blueprint('observability', __name__)

# Get the current tracer and meter
tracer = trace.get_tracer(__name__)
meter = metrics.get_meter(__name__)

# In-memory storage for demo purposes (in production, use proper storage)
log_entries = []
metric_data = []

class LogHandler(logging.Handler):
    """Custom log handler to capture logs for the observability dashboard."""
    
    def emit(self, record):
        try:
            log_entry = {
                'timestamp': datetime.fromtimestamp(record.created).isoformat(),
                'level': record.levelname,
                'logger': record.name,
                'message': record.getMessage(),
                'module': record.module,
                'function': record.funcName,
                'line': record.lineno
            }
            
            # Add exception info if present
            if record.exc_info:
                log_entry['exception'] = self.format(record)
            
            log_entries.append(log_entry)
            
            # Keep only last 1000 entries
            if len(log_entries) > 1000:
                log_entries.pop(0)
                
        except Exception:
            # Don't let logging errors break the application
            pass

# Set up the custom log handler
log_handler = LogHandler()
logging.getLogger().addHandler(log_handler)

@observability_bp.route('/api/observability/logs', methods=['GET'])
def get_logs():
    """Get recent log entries with optional filtering."""
    try:
        # Get query parameters
        level = request.args.get('level')
        limit = int(request.args.get('limit', 100))
        since = request.args.get('since')  # ISO timestamp
        
        filtered_logs = log_entries.copy()
        
        # Filter by level if specified
        if level:
            filtered_logs = [log for log in filtered_logs if log['level'] == level.upper()]
        
        # Filter by time if specified
        if since:
            try:
                since_dt = datetime.fromisoformat(since.replace('Z', '+00:00'))
                filtered_logs = [
                    log for log in filtered_logs 
                    if datetime.fromisoformat(log['timestamp']) >= since_dt
                ]
            except ValueError:
                pass  # Invalid timestamp format, ignore filter
        
        # Apply limit
        filtered_logs = filtered_logs[-limit:]
        
        return jsonify({
            'success': True,
            'logs': filtered_logs,
            'total': len(filtered_logs),
            'timestamp': datetime.utcnow().isoformat()
        })
        
    except Exception as e:
        logging.error(f"Error fetching logs: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@observability_bp.route('/api/observability/metrics', methods=['GET'])
def get_metrics():
    """Get current metrics data."""
    try:
        # In a real implementation, you'd query your metrics backend
        # For demo purposes, we'll return some sample metrics
        current_time = datetime.utcnow()
        
        # Generate sample metrics data
        sample_metrics = {
            'http_requests_total': {
                'value': len(log_entries),
                'timestamp': current_time.isoformat(),
                'labels': {'method': 'GET', 'status': '200'}
            },
            'http_request_duration_seconds': {
                'value': 0.125,
                'timestamp': current_time.isoformat(),
                'labels': {'method': 'GET', 'endpoint': '/api/telescope/status'}
            },
            'system_cpu_usage': {
                'value': 45.2,
                'timestamp': current_time.isoformat(),
                'labels': {'host': 'telescope-backend'}
            },
            'system_memory_usage': {
                'value': 67.8,
                'timestamp': current_time.isoformat(),
                'labels': {'host': 'telescope-backend'}
            },
            'telescope_connection_status': {
                'value': 1,
                'timestamp': current_time.isoformat(),
                'labels': {'device': 'alpaca'}
            }
        }
        
        return jsonify({
            'success': True,
            'metrics': sample_metrics,
            'timestamp': current_time.isoformat()
        })
        
    except Exception as e:
        logging.error(f"Error fetching metrics: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@observability_bp.route('/api/observability/traces', methods=['GET'])
def get_traces():
    """Get recent trace data."""
    try:
        # In a real implementation, you'd query your tracing backend
        # For demo purposes, we'll return some sample trace data
        current_time = datetime.utcnow()
        
        sample_traces = [
            {
                'trace_id': '1234567890abcdef',
                'span_id': 'abcdef1234567890',
                'operation_name': 'GET /api/telescope/status',
                'start_time': (current_time - timedelta(seconds=30)).isoformat(),
                'end_time': (current_time - timedelta(seconds=29.8)).isoformat(),
                'duration_ms': 200,
                'status': 'OK',
                'tags': {
                    'http.method': 'GET',
                    'http.url': '/api/telescope/status',
                    'http.status_code': 200,
                    'component': 'telescope-backend'
                }
            },
            {
                'trace_id': 'fedcba0987654321',
                'span_id': '0987654321fedcba',
                'operation_name': 'GET /weather/temperature',
                'start_time': (current_time - timedelta(seconds=45)).isoformat(),
                'end_time': (current_time - timedelta(seconds=44.5)).isoformat(),
                'duration_ms': 500,
                'status': 'OK',
                'tags': {
                    'http.method': 'GET',
                    'http.url': '/weather/temperature',
                    'http.status_code': 200,
                    'component': 'weather-service'
                }
            },
            {
                'trace_id': '1111222233334444',
                'span_id': '4444333322221111',
                'operation_name': 'POST /api/telescope/slew/coords',
                'start_time': (current_time - timedelta(minutes=2)).isoformat(),
                'end_time': (current_time - timedelta(minutes=1, seconds=58)).isoformat(),
                'duration_ms': 2000,
                'status': 'OK',
                'tags': {
                    'http.method': 'POST',
                    'http.url': '/api/telescope/slew/coords',
                    'http.status_code': 200,
                    'component': 'telescope-backend',
                    'telescope.ra': '12.5',
                    'telescope.dec': '45.2'
                }
            }
        ]
        
        return jsonify({
            'success': True,
            'traces': sample_traces,
            'total': len(sample_traces),
            'timestamp': current_time.isoformat()
        })
        
    except Exception as e:
        logging.error(f"Error fetching traces: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@observability_bp.route('/api/observability/health', methods=['GET'])
def health_check():
    """Health check endpoint for observability services."""
    return jsonify({
        'success': True,
        'status': 'healthy',
        'timestamp': datetime.utcnow().isoformat(),
        'services': {
            'logging': 'active',
            'metrics': 'active',
            'tracing': 'active'
        }
    })
