import uuid
from datetime import date, datetime
from sqlalchemy import Column, String, DateTime, Numeric, Boolean, Date
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base

class Supplier(Base):
    __tablename__ = "suppliers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, index=True, nullable=False)
    debt_date = Column(Date, nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    details = Column(String, nullable=True)
    is_invoiced = Column(Boolean, default=False, nullable=False)
    invoice_date = Column(Date, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
