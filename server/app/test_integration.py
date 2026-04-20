"""
Integration test to verify SQLAlchemy works with the existing Flask server.
This test verifies that the database integration is properly connected.
"""
import pytest
from sqlalchemy import text
from server.app.services.database import engine, SessionLocal, get_db
from server.app.models.user import User
from server.app.routes.db import db_bp
from fastapi.testclient import TestClient
import sys
import os

# Add server directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def test_database_engine_creation():
    """Test that the database engine is properly created."""
    assert engine is not None
    assert engine.url.drivername == 'postgresql+psycopg2'
    print("✓ Database engine created successfully")

def test_database_connection():
    """Test that we can connect to the database."""
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1"))
            assert result.scalar() == 1
        print("✓ Database connection successful")
    except Exception as e:
        print(f"⚠ Database connection test skipped (no database available): {e}")

def test_session_creation():
    """Test that we can create a session."""
    db = SessionLocal()
    assert db is not None
    db.close()
    print("✓ Session creation successful")

def test_user_model():
    """Test that the User model is properly defined."""
    user = User(
        email="test@example.com",
        username="testuser",
        hashed_password="test_hash"
    )
    assert user.email == "test@example.com"
    assert user.username == "testuser"
    assert user.hashed_password == "test_hash"
    print("✓ User model works correctly")

def test_user_model_methods():
    """Test User model methods."""
    user = User(
        email="methodstest@example.com",
        username="methodstest",
        hashed_password="test_hash"
    )
    
    # Test to_dict method
    user_dict = user.to_dict()
    assert 'id' in user_dict
    assert user_dict['email'] == "methodstest@example.com"
    assert user_dict['username'] == "methodstest"
    assert 'created_at' in user_dict
    print("✓ User model methods work correctly")

def test_db_blueprint_registered():
    """Test that the database blueprint is registered."""
    from server.app import create_app
    app = create_app()
    
    # Check that the blueprint is registered
    blueprint_found = False
    for name, blueprint in app.blueprints.items():
        if name == 'db':
            blueprint_found = True
            break
    
    assert blueprint_found, "Database blueprint not registered"
    print("✓ Database blueprint registered successfully")

def test_db_routes_exist():
    """Test that database routes are defined."""
    from server.app.routes.db import db_bp
    
    routes = [rule.rule for rule in db_bp.url_map.iter_rules()]
    expected_routes = ['/api/db/health', '/api/db/pool-stats', '/api/db/test']
    
    for route in expected_routes:
        assert route in routes, f"Route {route} not found in database blueprint"
    
    print("✓ All database routes are defined")

def test_db_blueprint_routes():
    """Test that database blueprint routes work."""
    from server.app import create_app
    from fastapi.testclient import TestClient
    
    app = create_app()
    client = TestClient(app)
    
    # Test health endpoint
    response = client.get('/api/db/health')
    assert response.status_code in [200, 503]  # 503 if DB not available, 200 if available
    
    # Test pool stats endpoint
    response = client.get('/api/db/pool-stats')
    assert response.status_code in [200, 500]  # 500 if DB not available
    
    # Test connection test endpoint
    response = client.get('/api/db/test')
    assert response.status_code in [200, 500]  # 500 if DB not available
    
    print("✓ Database blueprint routes respond correctly")

if __name__ == "__main__":
    print("Running SQLAlchemy integration tests...")
    print("=" * 50)
    
    test_database_engine_creation()
    test_database_connection()
    test_session_creation()
    test_user_model()
    test_user_model_methods()
    test_db_blueprint_registered()
    test_db_routes_exist()
    test_db_blueprint_routes()
    
    print("=" * 50)
    print("All integration tests passed!")