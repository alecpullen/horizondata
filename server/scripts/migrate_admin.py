import os
import sys
import requests
import logging

# Add the server directory to load .env
sys.path.insert(0, os.path.join(os.getcwd(), 'server'))

# Load environment variables manually
env_path = os.path.join(os.getcwd(), 'server', '.env')
if not os.path.exists(env_path):
    env_path = os.path.join(os.getcwd(), 'server', '\\')

if os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ.setdefault(key.strip(), value.strip('"\''))

NEON_AUTH_URL = os.getenv('NEON_AUTH_URL')
ADMIN_EMAIL = os.getenv('ADMIN_EMAILS', 'admin@test.edu.au').split(',')[0].strip()
ADMIN_PASSWORD = 'AdminPassword123!'

print(f"Targeting Neon Auth at: {NEON_AUTH_URL}")
print(f"Creating Admin User: {ADMIN_EMAIL}")

def create_admin():
    url = f"{NEON_AUTH_URL}/sign-up/email"
    data = {
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD,
        "name": "System Administrator"
    }
    
    try:
        headers = {
            "Origin": "http://localhost:5173"
        }
        response = requests.post(url, json=data, headers=headers)
        if response.status_code == 201 or response.status_code == 200:
            print(f"✅ Successfully created admin user: {ADMIN_EMAIL}")
            print(f"   Password: {ADMIN_PASSWORD}")
            return True
        elif response.status_code == 409 or "already exists" in response.text.lower():
            print(f"ℹ️ Admin user already exists: {ADMIN_EMAIL}")
            return True
        else:
            print(f"❌ Failed to create admin user: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error during sign-up: {e}")
        return False

def sync_to_public_db():
    print(f"Syncing {ADMIN_EMAIL} to public.users...")
    from sqlalchemy import create_engine, text
    
    DATABASE_URL = os.getenv("DATABASE_URL")
    engine = create_engine(DATABASE_URL, connect_args={"sslmode": "require"})
    
    try:
        with engine.connect() as conn:
            # Get the neon_auth user id
            result = conn.execute(text("SELECT id FROM neon_auth.user WHERE email = :email"), {"email": ADMIN_EMAIL})
            row = result.fetchone()
            if not row:
                print(f"❌ Could not find {ADMIN_EMAIL} in neon_auth.user")
                return False
            
            neon_id = str(row[0])
            
            # Check if exists in public.users
            result = conn.execute(text("SELECT id FROM public.users WHERE email = :email"), {"email": ADMIN_EMAIL})
            if result.fetchone():
                # Update existing
                conn.execute(text("""
                    UPDATE public.users 
                    SET external_id = :external_id, account_status = 'approved', institution = :institution
                    WHERE email = :email
                """), {
                    "external_id": neon_id, 
                    "email": ADMIN_EMAIL,
                    "institution": "System Administrator"
                })
                print(f"✅ Updated existing user {ADMIN_EMAIL} in public.users")
            else:
                # Insert new
                conn.execute(text("""
                    INSERT INTO public.users (email, username, external_id, hashed_password, account_status, institution)
                    VALUES (:email, :username, :external_id, :password, 'approved', :institution)
                """), {
                    "email": ADMIN_EMAIL,
                    "username": "admin",
                    "external_id": neon_id,
                    "password": "MANUAL_MIGRATION", # Password is handled by neon_auth
                    "institution": "System Administrator"
                })
                print(f"✅ Inserted new user {ADMIN_EMAIL} into public.users")
            
            conn.commit()
            return True
    except Exception as e:
        print(f"❌ Error syncing to public DB: {e}")
        return False

if __name__ == "__main__":
    if create_admin():
        sync_to_public_db()
