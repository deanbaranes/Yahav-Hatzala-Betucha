import enum
import uuid
from datetime import datetime
from sqlalchemy import Column, Boolean, DateTime, Enum, ForeignKey, String, Numeric
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base

class AssignmentStatus(str, enum.Enum):
    assigned = "assigned"
    waitlisted = "waitlisted"
    cancelled = "cancelled"

class TripAssignment(Base):
    __tablename__ = "trip_assignments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    trip_id = Column(UUID(as_uuid=True), ForeignKey("trips.id"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    status = Column(Enum(AssignmentStatus), nullable=False, default=AssignmentStatus.assigned, index=True)
    is_confirmed = Column(Boolean, default=False, nullable=False)
    role = Column(String, nullable=True)
    employee_confirmed_arrival = Column(Boolean, default=False, nullable=False)
    promised_salary = Column(Numeric(10, 2), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    trip = relationship("Trip", back_populates="assignments")
    user = relationship("User")
    report = relationship("TripReport", back_populates="assignment", uselist=False, cascade="all, delete-orphan")
