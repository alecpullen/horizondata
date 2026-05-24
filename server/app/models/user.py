from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.sql import func
from app.services.database import Base

class User(Base):
    __tablename__ = "users"
    __table_args__ = {"schema": "public"}

    id = Column(Integer, primary_key=True)
    external_id = Column(String(255), unique=True)
    email = Column(String, unique=True)
    username = Column(String)
    institution = Column(String(255))
    hashed_password = Column(String)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    account_status = Column(String(20), nullable=False, default="pending")
    role = Column(String(20), nullable=False, default="teacher")

    def to_dict(self):
        return {
            "id": self.id,
            "external_id": self.external_id,
            "email": self.email,
            "username": self.username,
            "institution": self.institution,
            "account_status": self.account_status,
            "role": self.role,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    def set_password(self, password):
        from werkzeug.security import generate_password_hash
        self.hashed_password = generate_password_hash(password)

    def check_password(self, password):
        from werkzeug.security import check_password_hash
        if not self.hashed_password:
            return False
        return check_password_hash(self.hashed_password, password)
