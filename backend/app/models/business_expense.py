from sqlalchemy import Column, String, DateTime, Text, Integer
from sqlalchemy.dialects.postgresql import UUID
import uuid
import datetime
from app.database import Base

class BusinessExpense(Base):
    __tablename__ = "business_expenses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    file_url = Column(String, nullable=False)
    file_name = Column(String, nullable=True)
    status = Column(String, default="pending")  # pending, processed
    expense_month = Column(Integer, nullable=False)
    expense_year = Column(Integer, nullable=False)
    notes = Column(Text, nullable=True)
    uploaded_by_id = Column(UUID(as_uuid=True), nullable=True)
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
