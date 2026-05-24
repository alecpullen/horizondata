import os
import sys
import argparse

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(__file__))))

from dotenv import load_dotenv
load_dotenv()

from app.services.database import get_db
from app.models.user import User

def create_admin(email, password, name):
    print(f"Creating Admin User: {email}")
    
    with get_db() as db:
        user = db.query(User).filter_by(email=email).first()
        if user:
            print(f"User {email} already exists. Promoting to admin...")
            user.role = "admin"
            user.set_password(password)
        else:
            print(f"Creating new admin user {email}...")
            user = User(
                email=email,
                username=name,
                account_status="approved",
                role="admin"
            )
            user.set_password(password)
            db.add(user)
        
        db.commit()
        print("✅ Admin user created/updated successfully!")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Create or update an admin user.')
    parser.add_argument('--email', required=True, help='Admin email address')
    parser.add_argument('--password', required=True, help='Admin password')
    parser.add_argument('--name', default='Admin', help='Admin display name')
    
    args = parser.parse_args()
    create_admin(args.email, args.password, args.name)
