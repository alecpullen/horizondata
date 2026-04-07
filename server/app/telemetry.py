"""
OpenTelemetry configuration for the Flask application.
This module sets up tracing, metrics, and logging instrumentation.
"""

import os
import logging
from opentelemetry import trace, metrics
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.sdk.resources import Resource, ResourceAttributes
from opentelemetry.instrumentation.flask import FlaskInstrumentor
from opentelemetry.instrumentation.requests import RequestsInstrumentor
from opentelemetry.instrumentation.logging import LoggingInstrumentor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import OTLPMetricExporter

def setup_telemetry(app):
    """
    Configure OpenTelemetry instrumentation for the Flask application.
    
    Args:
        app: Flask application instance
    """
    # Get configuration from environment variables
    otel_endpoint = os.getenv('OTEL_EXPORTER_OTLP_ENDPOINT', 'http://otel-lgtm:4317')
    service_name = os.getenv('OTEL_SERVICE_NAME', 'telescope-backend')
    environment = os.getenv('OTEL_ENVIRONMENT', 'development')
    
    # Create resource with service information
    resource = Resource.create({
        ResourceAttributes.SERVICE_NAME: service_name,
        ResourceAttributes.SERVICE_VERSION: "1.0.0",
        ResourceAttributes.DEPLOYMENT_ENVIRONMENT: environment,
    })
    
    # Configure tracing
    trace_provider = TracerProvider(resource=resource)
    otlp_exporter = OTLPSpanExporter(endpoint=otel_endpoint)
    trace_provider.add_span_processor(BatchSpanProcessor(otlp_exporter))
    trace.set_tracer_provider(trace_provider)
    
    # Configure metrics
    metric_reader = PeriodicExportingMetricReader(
        OTLPMetricExporter(endpoint=otel_endpoint),
        export_interval_millis=5000
    )
    metric_provider = MeterProvider(resource=resource, metric_readers=[metric_reader])
    metrics.set_meter_provider(metric_provider)
    
    # Instrument Flask
    FlaskInstrumentor().instrument_app(app)
    
    # Instrument requests library
    RequestsInstrumentor().instrument()
    
    # Instrument logging
    LoggingInstrumentor().instrument(
        set_logging_format=True,
        log_level=logging.INFO
    )
    
    # Create a meter for custom metrics
    meter = metrics.get_meter(__name__)
    
    # Create custom metrics
    request_counter = meter.create_counter(
        name="http_requests_total",
        description="Total number of HTTP requests",
        unit="1"
    )
    
    request_duration = meter.create_histogram(
        name="http_request_duration_seconds",
        description="HTTP request duration in seconds",
        unit="s"
    )
    
    # Store metrics in app context for access in routes
    app.request_counter = request_counter
    app.request_duration = request_duration
    
    # Log telemetry setup
    logging.info(f"OpenTelemetry configured with endpoint: {otel_endpoint}")
    logging.info(f"Service name: {service_name}")
    logging.info(f"Environment: {environment}")
    
    return app
