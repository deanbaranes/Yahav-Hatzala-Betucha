import uuid
from sqlalchemy import Column, String, DateTime, Numeric
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base

class Client(Base):
    __tablename__ = "clients"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, unique=True, index=True, nullable=False)
    contact_person = Column(String, nullable=True)
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    balance = Column(String, nullable=True)
    numeric_balance = Column(Numeric(12, 2), nullable=False, server_default="0.0")
    debt_start_date = Column(DateTime, nullable=True)
    notes = Column(String, nullable=True)
    # תנאי תשלום מיוחדים — למשל "שוטף + 60". None = ללא תנאים מיוחדים
    payment_terms = Column(String, nullable=True)

    trips = relationship("Trip", back_populates="client")
