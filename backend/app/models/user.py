import enum
import uuid
from sqlalchemy import Column, String, Enum, Numeric
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base

class UserRole(str, enum.Enum):
    admin = "admin"
    employee = "employee"

class UserStatus(str, enum.Enum):
    pending = "pending"
    active = "active"
    inactive = "inactive"

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    role = Column(Enum(UserRole), nullable=False, index=True)
    status = Column(Enum(UserStatus), nullable=False, default=UserStatus.pending, index=True)
    full_name = Column(String, nullable=False)
    phone = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    hourly_rate = Column(Numeric(10, 2), default=0.0)
    base_daily_hours = Column(Numeric(10, 2), default=8.6)
