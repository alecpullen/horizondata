from flask import Flask
from flask_cors import CORS
import os
import time
import logging

logger = logging.getLogger(__name__)
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
from .routes.admin_teachers import admin_teachers_bp
from .routes.admin_summary import admin_summary_bp
from .routes.settings import settings_bp

def create_app():
    """
    This is the application factory. It creates and configures the Flask app.
    """
    app = Flask(__name__)

    secret = os.getenv("JWT_SECRET_KEY")
    if not secret or secret == "super-secret-default-key-change-me":
        logger.warning(
            "JWT_SECRET_KEY is not set or using default value. "
            "Set a strong random secret in your .env file for production."
        )
        secret = "super-secret-default-key-change-me"
    app.config["JWT_SECRET_KEY"] = secret
    app.config["JWT_ACCESS_TOKEN_EXPIRES"] = 900  # 15 minutes
    app.config["JWT_REFRESH_TOKEN_EXPIRES"] = 604800  # 7 days

    from flask_jwt_extended import JWTManager
    jwt = JWTManager(app)

    @jwt.token_in_blocklist_loader
    def check_if_token_revoked(jwt_header, jwt_payload: dict) -> bool:
        jti = jwt_payload["jti"]
        from app.services.database import get_db
        from app.models.token_blocklist import TokenBlocklist
        with get_db() as db:
            token = db.query(TokenBlocklist.id).filter_by(jti=jti).scalar()
            return token is not None

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
    app.register_blueprint(admin_teachers_bp)
    app.register_blueprint(admin_summary_bp)
    app.register_blueprint(settings_bp)

    if os.getenv("HEADLESS_SCHEDULER_ENABLED", "true").lower() != "false":
        from .services.headless_runner import init_scheduler
        init_scheduler(app)

    return app
