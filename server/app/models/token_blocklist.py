from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from app.services.database import Base

class TokenBlocklist(Base):
    __tablename__ = "token_blocklist"
    __table_args__ = {"schema": "public"}

    id = Column(Integer, primary_key=True)
    jti = Column(String(36), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
