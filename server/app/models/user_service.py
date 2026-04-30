from app.models.user import User
from app.services.database import db

def sync_user(neon_user):
    user = User.query.filter_by(external_id=neon_user["id"]).first()

    if not user:
        user = User(
            external_id=neon_user["id"],
            email=neon_user.get("email")
        )
        db.session.add(user)

    db.session.commit()
    return user
