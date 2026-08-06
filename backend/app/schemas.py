import uuid
from datetime import datetime, date
from typing import Optional, Dict, List
from pydantic import BaseModel
from app.models.user import UserRole, UserStatus
from app.models.trip_assignment import AssignmentStatus
from app.models.trip_report import ManagerStatus, BillingStatus

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    phone: Optional[str] = None

class UserBase(BaseModel):
    full_name: str
    phone: str
    national_id: Optional[str] = None
    email: Optional[str] = None

class UserCreate(UserBase):
    password: str
    role: UserRole

class UserOut(UserBase):
    id: uuid.UUID
    role: UserRole
    status: UserStatus
    email: Optional[str] = None

    class Config:
        from_attributes = True

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

class ClientBase(BaseModel):
    name: str
    contact_person: Optional[str] = None

class ClientOut(ClientBase):
    id: uuid.UUID

    class Config:
        from_attributes = True



class TripCreate(BaseModel):
    client_name: str
    client_contact_person: Optional[str] = None
    location: str
    start_date: datetime
    end_date: datetime
    capacity: int
    roles_requirements: Optional[Dict[str, int]] = {}
    color: Optional[str] = None
    global_salary: Optional[float] = None

class TripOut(BaseModel):
    id: uuid.UUID
    client_id: uuid.UUID
    location: str
    start_date: datetime
    end_date: datetime
    capacity: int
    roles_requirements: Optional[Dict[str, int]] = {}
    color: Optional[str] = None
    global_salary: Optional[float] = None
    is_billed: bool = False
    client: ClientOut

    class Config:
        from_attributes = True

class JoinTripRequest(BaseModel):
    role: str



class DailyShift(BaseModel):
    start_time: datetime
    end_time: datetime

class TripReportCreate(BaseModel):
    assignment_id: uuid.UUID
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    daily_shifts: Optional[List[DailyShift]] = None
    expenses: Optional[float] = 0.0
    expenses_notes: Optional[str] = None
    sleeps: Optional[int] = 0
    receipt_url: Optional[str] = None

class TripReportOut(BaseModel):
    id: uuid.UUID
    assignment_id: uuid.UUID
    start_time: datetime
    end_time: datetime
    daily_shifts: Optional[List[DailyShift]] = None
    overtime_decimal: float
    expenses: float
    expenses_notes: Optional[str] = None
    sleeps: int = 0
    receipt_url: Optional[str]
    manager_status: ManagerStatus
    billing_status: BillingStatus

    class Config:
        from_attributes = True

class SupplierBase(BaseModel):
    name: str
    debt_date: date
    amount: float
    details: Optional[str] = None
    is_invoiced: bool = False
    invoice_date: Optional[date] = None

class SupplierCreate(SupplierBase):
    pass

class SupplierUpdate(BaseModel):
    name: Optional[str] = None
    debt_date: Optional[date] = None
    amount: Optional[float] = None
    details: Optional[str] = None
    is_invoiced: Optional[bool] = None
    invoice_date: Optional[date] = None

class SupplierOut(SupplierBase):
    id: uuid.UUID
    created_at: datetime

    class Config:
        from_attributes = True
