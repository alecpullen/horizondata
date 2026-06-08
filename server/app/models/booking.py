import uuid
import pytz
from sqlalchemy import Column, String, DateTime, Text, JSON, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.services.database import Base

# Bookings are stored in UTC (DateTime(timezone=True)). Display times must be
# converted to Melbourne local time so teachers/admins see the time they booked.
MELBOURNE_TZ = pytz.timezone("Australia/Melbourne")


def _to_melbourne(dt):
    """Convert a stored datetime to Melbourne local time.

    Naive datetimes are assumed to be UTC (defensive — the DB column is
    timezone-aware, but older rows or some drivers may return naive values).
    """
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = pytz.utc.localize(dt)
    return dt.astimezone(MELBOURNE_TZ)

_STATUS_LABELS = {
    "confirmed": "Confirmed",
    "pending": "Pending",
    "completed": "Completed",
    "awaiting": "Awaiting",
    "cancelled": "Cancelled",
}

# Expected JSON schema for targets field
# targets: {
#     "celestialObjects": [
#         {"name": "Mars", "ra": "04:35:00", "dec": "+23:45:00"},
#     ],
#     "captureSettings": {
#         "exposure": 1000,
#         "gain": 0,
#         "duration": 5
#     }
# }
TARGETS_SCHEMA = {
    "type": "object",
    "properties": {
        "celestialObjects": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "ra": {"type": "string"},
                    "dec": {"type": "string"},
                },
                "required": ["name"]
            }
        },
        "captureSettings": {
            "type": "object",
            "properties": {
                "exposure": {"type": "number"},
                "gain": {"type": "number"},
                "duration": {"type": "number"},
            }
        }
    }
}


def validate_targets(targets) -> bool:
    """Validate targets JSON field.
    
    Args:
        targets: Dictionary to validate
        
    Returns:
        True if valid, False otherwise
    """
    if targets is None:
        return True
    
    if not isinstance(targets, dict):
        return False
    
    # Validate celestialObjects array
    if "celestialObjects" in targets:
        if not isinstance(targets["celestialObjects"], list):
            return False
        for obj in targets["celestialObjects"]:
            if not isinstance(obj, dict):
                return False
            if "name" not in obj:
                return False
    
    # Validate captureSettings object
    if "captureSettings" in targets:
        if not isinstance(targets["captureSettings"], dict):
            return False
    
    return True

class Booking(Base):
    __tablename__ = "bookings"
    __table_args__ = {"schema": "app"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    teacher_id = Column(String(255), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    scheduled_start = Column(DateTime(timezone=True), nullable=False, index=True)
    scheduled_end = Column(DateTime(timezone=True), nullable=False)
    status = Column(String(20), nullable=False, default="pending")
    targets = Column(JSON, nullable=True)
    headless = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    session = relationship("ObservationSession", back_populates="booking", uselist=False)

    def to_dict(self, db=None):
        """Convert booking to dictionary.
        
        Args:
            db: Optional database session. If provided, will query captures table.
        """
        start_local = _to_melbourne(self.scheduled_start)
        end_local = _to_melbourne(self.scheduled_end)
        result = {
            "id": str(self.id),
            "title": self.title,
            "description": self.description or "",
            "date": start_local.strftime("%d/%m/%Y"),
            "time": f"{start_local.strftime('%H:%M')} - {end_local.strftime('%H:%M')}",
            "status": _STATUS_LABELS.get(self.status, self.status.title()),
            "statusColor": self.status,
            "headless": self.headless,
            "targets": self.targets,
            "captureCount": 0,
        }

        if db is not None:
            try:
                from app.models.capture import Capture
                from app.models.session import ObservationSession
                capture_count = db.query(Capture).join(
                    ObservationSession,
                    Capture.observation_session_id == ObservationSession.id
                ).filter(
                    ObservationSession.booking_id == self.id
                ).count()
                result["captureCount"] = capture_count
            except Exception as e:
                import logging
                logger = logging.getLogger(__name__)
                logger.warning(f"Could not calculate capture count for booking {self.id}: {e}")
        
        return result