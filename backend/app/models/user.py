import enum
import uuid

from app.database import Base
from sqlalchemy import Boolean, Column, Enum, Numeric, String
from sqlalchemy.dialects.postgresql import UUID


class UserRole(str, enum.Enum):
    admin = "admin"
    employee = "employee"


class UserStatus(str, enum.Enum):
    pending = "pending"
    active = "active"
    inactive = "inactive"


class EmploymentType(str, enum.Enum):
    EMPLOYEE = "שכיר"
    FREELANCER = "עצמאי"


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    role = Column(Enum(UserRole), nullable=False, index=True)
    status = Column(
        Enum(UserStatus), nullable=False, default=UserStatus.pending, index=True
    )
    full_name = Column(String, nullable=False)
    phone = Column(String, unique=True, index=True, nullable=False)
    national_id = Column(
        String(9), unique=True, index=True, nullable=True
    )  # Added for payslip matching
    email = Column(String, unique=True, index=True, nullable=True)
    password_hash = Column(String, nullable=False)
    hourly_rate = Column(Numeric(10, 2), default=0.0)
    base_daily_hours = Column(Numeric(10, 2), default=8.6)
    # True = עובד בשכר גלובלי (קבוע ליום) ולא לפי שעות
    is_global_salary = Column(Boolean, default=False, nullable=False)
    # סוג העסקה: "שכיר" או "עצמאי"
    employment_type = Column(
        Enum(EmploymentType), default=EmploymentType.EMPLOYEE, nullable=False
    )
