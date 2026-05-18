from app.models.user import User
from app.services.database import get_db

def sync_user(neon_user):
    with get_db() as db:
        user = db.query(User).filter_by(external_id=neon_user["id"]).first()
        if not user:
            user = User(
                external_id=neon_user["id"],
                email=neon_user.get("email"),
                username=neon_user.get("name", "").split("@")[0], # Fallback username
                institution=neon_user.get("name"),
                account_status="approved" # Automatically approve synced users from Neon Auth
            )
            db.add(user)
        else:
            # Update existing user info
            user.email = neon_user.get("email")
            user.institution = neon_user.get("name")
            
        db.commit()
        return user
