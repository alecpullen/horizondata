from sqlalchemy import Column, Integer, String, Boolean
from app.services.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    external_id = Column(String, unique=True, nullable=False)
    email = Column(String, unique=True)
    phone = Column(String(20), nullable=True)
    institution = Column(String(255), nullable=True)
    is_2fa_enabled = Column(Boolean, default=False)
    notifications_enabled = Column(Boolean, default=True)
