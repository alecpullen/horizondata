"""
SQLAlchemy Migration Script for NEON PostgreSQL
Creates users table and demonstrates full database operations
"""

from sqlalchemy import create_engine, Column, Integer, String, DateTime, Boolean, Index, MetaData, Table
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.sql import func, text
import os
import sys

# Add the server directory to load .env
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'server'))

# Load environment variables manually
env_path = os.path.join(os.path.dirname(__file__), 'server', '.env')
if os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ.setdefault(key.strip(), value.strip('"\''))

# Build connection string for NEON
DB_HOST = os.getenv("DB_HOST", "ep-young-darkness-a7kbzuma-pooler.ap-southeast-2.aws.neon.tech")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "neondb")
DB_USER = os.getenv("DB_USER", "neondb_owner")
DB_PASSWORD = os.getenv("DB_PASSWORD", "npg_fB2ixvKUcFp4")

# NEON requires SSL
DATABASE_URL = (
    f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    f"?channel_binding=require&sslmode=require"
)

print(f"NEON Database URL: {DATABASE_URL[:80]}...")

# Create engine with NEON-optimized settings
engine = create_engine(
    DATABASE_URL,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
    pool_recycle=3600,
)

# Create base
Base = declarative_base()

# Define example table: users
class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    def __repr__(self):
        return f"<User(id={self.id}, email='{self.email}')>"

# Create tables using Alembic-style migration
def run_migration():
    """Run database migration to create tables."""
    print("\n" + "="*60)
    print("Running Migration: Creating users table")
    print("="*60)
    
    try:
        # Create all tables
        with engine.connect() as conn:
            # Create the users table
            Base.metadata.create_all(conn)
            conn.commit()
            
            # Verify table was created
            result = conn.execute(text("""
                SELECT tablename FROM pg_tables 
                WHERE schemaname = 'public' 
                AND tablename = 'users'
            """))
            
            if result.scalar():
                print("✅ Table 'users' created successfully")
            else:
                print("⚠ Table creation may have failed")
                
            # Show tables
            result = conn.execute(text("""
                SELECT tablename FROM pg_tables 
                WHERE schemaname = 'public'
                ORDER BY tablename
            """))
            
            print("\nTables in public schema:")
            for row in result:
                print(f"  - {row[0]}")
                
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        raise

def insert_sample_data():
    """Insert sample data into users table."""
    print("\n" + "="*60)
    print("Inserting Sample Data")
    print("="*60)
    
    try:
        with engine.connect() as conn:
            # Check existing data
            result = conn.execute(text("SELECT COUNT(*) FROM users"))
            count = result.scalar()
            
            if count == 0:
                # Insert sample users
                conn.execute(text("""
                    INSERT INTO users (email, username, hashed_password, is_active)
                    VALUES 
                        ('alice@example.com', 'alice_wonder', 'hash_alice_123', true),
                        ('bob@example.com', 'bob_builder', 'hash_bob_456', true),
                        ('charlie@example.com', 'charlie_chocolate', 'hash_charlie_789', false)
                """))
                conn.commit()
                print("✅ Inserted 3 sample users")
            else:
                print(f"⚠ {count} users already exist")
                
    except Exception as e:
        print(f"❌ Error inserting users: {e}")
        raise

def query_data():
    """Query users from the table."""
    print("\n" + "="*60)
    print("Querying Data")
    print("="*60)
    
    try:
        with engine.connect() as conn:
            # Query all active users
            result = conn.execute(text("""
                SELECT id, email, username, is_active, created_at 
                FROM users 
                WHERE is_active = true
                ORDER BY id
            """))
            
            active_users = result.fetchall()
            print(f"\nActive Users ({len(active_users)}):")
            for user in active_users:
                print(f"  ID: {user[0]}, Email: {user[1]}, Username: {user[2]}")
            
            # Query all users
            result = conn.execute(text("SELECT COUNT(*) FROM users"))
            total = result.scalar()
            print(f"\nTotal Users: {total}")
            
    except Exception as e:
        print(f"❌ Error querying data: {e}")
        raise

def show_schema():
    """Show database schema."""
    print("\n" + "="*60)
    print("Database Schema")
    print("="*60)
    
    try:
        with engine.connect() as conn:
            # Show users table columns
            result = conn.execute(text("""
                SELECT 
                    column_name,
                    data_type,
                    character_maximum_length,
                    is_nullable,
                    column_default
                FROM information_schema.columns
                WHERE table_name = 'users'
                ORDER BY ordinal_position
            """))
            
            print("\nUsers Table Columns:")
            print(f"{'Column':<25} {'Type':<20} {'Null':<10} {'Default'}")
            print("-" * 70)
            for row in result:
                default = row[4] or ''
                print(f"{row[0]:<25} {row[1]:<20} {row[2]:<10} {default}")
                
            # Show indexes
            result = conn.execute(text("""
                SELECT indexname, indexdef 
                FROM pg_indexes 
                WHERE tablename = 'users'
            """))
            
            print("\nIndexes:")
            for row in result:
                print(f"  {row[0]}")
                
    except Exception as e:
        print(f"❌ Error showing schema: {e}")
        raise

# Run everything
if __name__ == "__main__":
    try:
        run_migration()
        insert_sample_data()
        query_data()
        show_schema()
        
        print("\n" + "="*60)
        print("✅ Migration Complete!")
        print("="*60)
        
    except Exception as e:
        print(f"\n❌ Process failed: {e}")
        raise