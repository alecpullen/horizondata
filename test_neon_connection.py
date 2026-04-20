#!/usr/bin/env python3
"""
Test script to verify NEON PostgreSQL connection
"""

import os
import sys

# Add server directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'server'))

# Set environment variables from .env
from dotenv import load_dotenv
load_dotenv()

def test_connection():
    """Test database connection."""
    try:
        from app.services.database import engine, SessionLocal
        
        # Test connection
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1 as test"))
            test_value = result.scalar()
            
        print("✅ Connection successful!")
        print(f"✅ Test query returned: {test_value}")
        
        # Test session
        db = SessionLocal()
        print("✅ Session created successfully")
        db.close()
        
        return True
        
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        return False

def test_models():
    """Test model definitions."""
    try:
        from app.models.user import User
        
        # Create a test user instance
        user = User(
            email="test@example.com",
            username="testuser",
            hashed_password="test_hash"
        )
        
        print("✅ User model imported successfully")
        print(f"✅ User instance created: {user}")
        
        return True
        
    except Exception as e:
        print(f"❌ Model test failed: {e}")
        return False

def test_queries():
    """Test query functions."""
    try:
        from app.queries.user_queries import create_user, get_user_by_email
        
        print("✅ Query functions imported successfully")
        return True
        
    except Exception as e:
        print(f"❌ Query test failed: {e}")
        return False

if __name__ == "__main__":
    print("="*60)
    print("NEON PostgreSQL Connection Test")
    print("="*60)
    
    results = []
    
    # Test connection
    print("\n1. Testing database connection...")
    results.append(test_connection())
    
    # Test models
    print("\n2. Testing models...")
    results.append(test_models())
    
    # Test queries
    print("\n3. Testing queries...")
    results.append(test_queries())
    
    print("\n" + "="*60)
    if all(results):
        print("✅ All tests passed!")
    else:
        print("❌ Some tests failed")
        sys.exit(1)
    print("="*60)