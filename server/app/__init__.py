from flask import Flask
from flask_cors import CORS
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
from .routes.auth import auth_bp
from .routes.account import account_bp
from .routes.bookings import bookings_bp
from .routes.sessions import sessions_bp

def create_app():
    """
    This is the application factory. It creates and configures the Flask app.
    """
    app = Flask(__name__)

    # app = setup_telemetry(app)  # Temporarily disabled

    cors_origins = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174",
    ).split(",")

    allowed_headers = ["Content-Type", "Authorization", "X-Session-ID"]

    CORS(
        app,
        resources={
            r"/api/*":       {"origins": cors_origins,
                              "methods": ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
                              "allow_headers": allowed_headers},
            r"/weather/*":   {"origins": cors_origins,
                              "methods": ["GET", "OPTIONS"],
                              "allow_headers": allowed_headers},
            r"/telescope/*": {"origins": cors_origins,
                              "methods": ["GET", "POST", "OPTIONS"],
                              "allow_headers": allowed_headers},
        },
        supports_credentials=True,
    )

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
    app.register_blueprint(auth_bp)
    app.register_blueprint(account_bp)
    app.register_blueprint(bookings_bp)
    app.register_blueprint(sessions_bp)

    return app
