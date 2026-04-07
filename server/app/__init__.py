from flask import Flask
import os
import time
# from .telemetry import setup_telemetry  # Temporarily disabled
# Use a relative import to import from the same package (the 'app' folder)
from .weather import weather_bp
from .routes.telescope import telescope_bp
from .routes.safety import safety_bp
from .docs import docs_bp
from .routes.space_objects import space_objects_bp
from .routes.observability import observability_bp
from .routes.visibility import visibility_bp
from .routes.captures import captures_bp

def create_app():
    """
    This is the application factory. It creates and configures the Flask app.
    """
    app = Flask(__name__)

    # app = setup_telemetry(app)  # Temporarily disabled

    @app.route("/health")
    def health():
        return {"status": "healthy", "timestamp": time.time()}
    
    app.register_blueprint(docs_bp)
    app.register_blueprint(weather_bp)
    app.register_blueprint(telescope_bp)
    app.register_blueprint(safety_bp)
    app.register_blueprint(space_objects_bp)
    app.register_blueprint(observability_bp)
    app.register_blueprint(visibility_bp)
    app.register_blueprint(captures_bp)



    return app
