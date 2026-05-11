import uuid
from sqlalchemy import Column, String, DateTime, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.services.database import Base

class Capture(Base):
    __tablename__ = "captures"
    __table_args__ = {"schema": "app"}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    captured_by_teacher_id = Column(String(255), nullable=True, index=True)
    captured_by_student_session_id = Column(String(255), nullable=True)
    captured_by_name = Column(String(255), nullable=True)
    observation_session_id = Column(UUID(as_uuid=True), ForeignKey("app.observation_sessions.id"), nullable=True)
    file_path = Column(String(500), nullable=False)
    object_name = Column(String(255), nullable=True)
    coordinates = Column(JSONB, nullable=True)
    captured_at = Column(DateTime(timezone=True), server_default=func.now())
    file_size_bytes = Column(Integer, nullable=True)
    image_width = Column(Integer, nullable=True)
    image_height = Column(Integer, nullable=True)

    session = relationship("ObservationSession", back_populates="captures")

    def to_dict(self):
        coords = self.coordinates or {}
        captured_by = "teacher" if self.captured_by_teacher_id else "student"
        return {
            "id": str(self.id),
            "teacherId": self.captured_by_teacher_id,
            "observationSessionId": str(self.observation_session_id) if self.observation_session_id else None,
            "objectName": self.object_name,
            "coordinates": {
                "ra": coords.get("ra"),
                "dec": coords.get("dec"),
                "alt": coords.get("alt"),
                "az": coords.get("az"),
            },
            "capturedBy": captured_by,
            "capturedByName": self.captured_by_name,
            "capturedByTeacherId": self.captured_by_teacher_id,
            "capturedByStudentSessionId": self.captured_by_student_session_id,
            "timestamp": self.captured_at.isoformat() if self.captured_at else None,
        }
