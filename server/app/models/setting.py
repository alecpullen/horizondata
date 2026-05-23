from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from app.services.database import Base

class SystemSetting(Base):
    __tablename__ = "system_settings"
    __table_args__ = {"schema": "public"}

    id = Column(Integer, primary_key=True)
    key = Column(String(255), unique=True, index=True, nullable=False)
    value = Column(String, nullable=True)
    description = Column(String, nullable=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

    def to_dict(self):
        return {
            "key": self.key,
            "value": self.value,
            "description": self.description,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
