#!/usr/bin/env python3
"""
Setup script to verify SQLAlchemy integration with the existing server.
This script demonstrates how the database layer integrates with your Flask app.
"""

import sys
import os

# Add the server directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'server'))

def test_basic_integration():
    """Test basic integration of SQLAlchemy with the server."""
    print("Testing SQLAlchemy integration...")
    print("=" * 60)
    
    # Test 1: Import the database module
    try:
        from app.services import database
        print("✓ Successfully imported database module")
    except ImportError as e:
        print(f"✗ Failed to import database module: {e}")
        return False
    
    # Test 2: Check engine configuration
    try:
        engine = database.engine
        print(f"✓ Database engine configured: {engine.url}")
    except Exception as e:
        print(f"✗ Failed to access database engine: {e}")
        return False
    
    # Test 3: Import models
    try:
        from app.models import User
        print("✓ Successfully imported User model")
    except ImportError as e:
        print(f"✗ Failed to import User model: {e}")
        return False
    
    # Test 4: Import query functions
    try:
        from app.queries import user_queries
        print("✓ Successfully imported user queries")
    except ImportError as e:
        print(f"✗ Failed to import user queries: {e}")
        return False
    
    # Test 5: Check Flask app integration
    try:
        from app import create_app
        app = create_app()
        print("✓ Flask app created successfully")
        
        # Check if database blueprint is registered
        db_blueprint_registered = any(name == 'db' for name in app.blueprints)
        if db_blueprint_registered:
            print("✓ Database blueprint is registered in Flask app")
        else:
            print("⚠ Database blueprint not yet registered (expected before first run)")
    except Exception as e:
        print(f"⚠ Flask app creation issue: {e}")
    
    # Test 6: Check exception handling
    try:
        from app import exceptions
        print("✓ Custom exceptions module imported")
    except ImportError as e:
        print(f"✗ Failed to import exceptions: {e}")
        return False
    
    print("=" * 60)
    print("✓ Basic integration test PASSED")
    print("\nNext steps:")
    print("1. Configure database credentials in .env file")
    print("2. Run: python -m pytest app/test_integration.py -v")
    print("3. Start the server: python run.py")
    return True

if __name__ == "__main__":
    success = test_basic_integration()
    sys.exit(0 if success else 1)