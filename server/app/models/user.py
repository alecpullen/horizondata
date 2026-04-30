from app.services.database import db

class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)

    external_id = db.Column(db.String, unique=True, nullable=False)  # từ NeonAuth
    email = db.Column(db.String, unique=True)
  
    phone = db.Column(db.String(20), nullable=True)
    institution = db.Column(db.String(255), nullable=True)
    is_2fa_enabled = db.Column(db.Boolean, default=False)
    notifications_enabled = db.Column(db.Boolean, default=True)

