import uuid
from sqlalchemy import Column, String, Integer, Numeric, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base

class PayrollAdjustment(Base):
    __tablename__ = "payroll_adjustments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    month = Column(Integer, nullable=False, index=True)
    year = Column(Integer, nullable=False, index=True)
    type = Column(String, nullable=False) # e.g. "מענק התמדה", "לינה", "הבראה", "נסיעות"
    amount = Column(Numeric(10, 2), nullable=False)
    notes = Column(String, nullable=True)

    user = relationship("User")
