import uuid
from sqlalchemy import Column, String, DateTime, Float, JSON, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.services.database import Base

class Capture(Base):
    __tablename__ = "captures"
    __table_args__ = {"schema": "app"}
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    teacher_id = Column(String(255), nullable=False, index=True)  # Links to teacher for gallery
    observation_session_id = Column(UUID(as_uuid=True), ForeignKey("app.observation_sessions.id"))
    object_name = Column(String(255))
    file_path = Column(String(500), nullable=False)
    
    # Telescope coordinates at capture time
    ra = Column(Float, nullable=True)
    dec = Column(Float, nullable=True)
    alt = Column(Float, nullable=True)
    az = Column(Float, nullable=True)
    
    # Who captured this
    captured_by_type = Column(String(20), nullable=False)  # 'teacher' or 'student'
    captured_by_teacher_id = Column(String(255))  # If teacher captured
    captured_by_student_session_id = Column(String(255))  # If student captured
    captured_by_name = Column(String(255))  # Teacher's name OR student's display name
    
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    metadata_json = Column(JSON)  # Store full metadata
    
    # Relationship to observation session
    session = relationship("ObservationSession", back_populates="captures")
    
    def to_dict(self):
        return {
            "id": str(self.id),
            "teacherId": self.teacher_id,
            "observationSessionId": str(self.observation_session_id) if self.observation_session_id else None,
            "objectName": self.object_name,
            "file": self.file_path,
            "coordinates": {
                "ra": self.ra,
                "dec": self.dec,
                "alt": self.alt,
                "az": self.az,
            },
            "capturedBy": self.captured_by_type,
            "capturedByTeacherId": self.captured_by_teacher_id,
            "capturedByName": self.captured_by_name,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
        }