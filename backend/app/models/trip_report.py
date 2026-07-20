import enum
import uuid
from sqlalchemy import Column, String, DateTime, Numeric, Enum, ForeignKey, JSON, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base

class ManagerStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"

class BillingStatus(str, enum.Enum):
    unbilled = "unbilled"
    billed = "billed"

class TripReport(Base):
    __tablename__ = "trip_reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    assignment_id = Column(UUID(as_uuid=True), ForeignKey("trip_assignments.id"), nullable=False, unique=True, index=True)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    daily_shifts = Column(JSON, nullable=True)
    overtime_decimal = Column(Numeric(10, 2), nullable=False)
    expenses = Column(Numeric(10, 2), default=0.0)
    expenses_notes = Column(String, nullable=True)
    sleeps = Column(Integer, default=0)
    receipt_url = Column(String, nullable=True)
    manager_status = Column(Enum(ManagerStatus), nullable=False, default=ManagerStatus.pending, index=True)
    billing_status = Column(Enum(BillingStatus), nullable=False, default=BillingStatus.unbilled, index=True)

    assignment = relationship("TripAssignment", back_populates="report")
