from flask import Blueprint, jsonify, request
from server.app.services.database import get_db

# Create a blueprint for database API endpoints
db_bp = Blueprint('db', __name__, url_prefix='/api/db')

@db_bp.route('/health', methods=['GET'])
def db_health():
    """Check database connection health."""
    try:
        from server.app.services.database import check_db_health
        is_healthy = check_db_health()
        return jsonify({
            'status': 'healthy' if is_healthy else 'unhealthy',
            'database': 'connected' if is_healthy else 'disconnected'
        }), 200 if is_healthy else 503
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@db_bp.route('/pool-stats', methods=['GET'])
def pool_stats():
    """Get connection pool statistics."""
    try:
        from server.app.services.database import get_pool_stats
        stats = get_pool_stats()
        return jsonify(stats), 200
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@db_bp.route('/test', methods=['GET'])
def test_connection():
    """Test database connection with a simple query."""
    try:
        from sqlalchemy import text
        with get_db() as db:
            result = db.execute(text("SELECT 'Database connection is working!' AS status"))
            data = result.fetchone()
        return jsonify({
            'status': 'success',
            'message': data[0] if data else 'No data'
        }), 200
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

# Register the blueprint in your main app
# Add this to server/app/__init__.py after creating the app:
# from .routes.db import db_bp
# app.register_blueprint(db_bp)

print("Database blueprint created. Register it in your app's __init__.py")
print("Add: from .routes.db import db_bp")
print("Then register: app.register_blueprint(db_bp)")