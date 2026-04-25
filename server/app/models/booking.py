import uuid
from sqlalchemy import Column, String, DateTime, Text, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.services.database import Base

_STATUS_LABELS = {
    "confirmed": "Confirmed",
    "pending": "Pending",
    "completed": "Completed",
    "awaiting": "Awaiting",
    "cancelled": "Cancelled",
}


class Booking(Base):
    __tablename__ = "bookings"
    __table_args__ = {"schema": "app"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    teacher_id = Column(String(255), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    scheduled_start = Column(DateTime(timezone=True), nullable=False, index=True)
    scheduled_end = Column(DateTime(timezone=True), nullable=False)
    status = Column(String(20), nullable=False, default="confirmed")
    targets = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    sessions = relationship("ObservationSession", back_populates="booking", uselist=False)

    def to_dict(self):
        return {
            "id": str(self.id),
            "title": self.title,
            "description": self.description or "",
            "date": self.scheduled_start.strftime("%d/%m/%Y"),
            "time": f"{self.scheduled_start.strftime('%H:%M')} - {self.scheduled_end.strftime('%H:%M')}",
            "status": _STATUS_LABELS.get(self.status, self.status.title()),
            "statusColor": self.status,
            "captureCount": 0,
        }
