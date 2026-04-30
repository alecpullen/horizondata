from app.models.user import User
from app.services.database import get_db

def sync_user(neon_user):
    with get_db() as db:
        user = db.query(User).filter_by(external_id=neon_user["id"]).first()
        if not user:
            user = User(
                external_id=neon_user["id"],
                email=neon_user.get("email")
            )
            db.add(user)
        db.commit()
        return user
