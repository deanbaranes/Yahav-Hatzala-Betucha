import uuid
from datetime import datetime
from typing import Optional
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

class UserCreate(UserBase):
    password: str
    role: UserRole

class UserOut(UserBase):
    id: uuid.UUID
    role: UserRole
    status: UserStatus
    
    class Config:
        from_attributes = True

class ClientBase(BaseModel):
    name: str
    contact_person: Optional[str] = None

class ClientOut(ClientBase):
    id: uuid.UUID

    class Config:
        from_attributes = True

from typing import Optional, Dict

class TripCreate(BaseModel):
    client_name: str
    client_contact_person: Optional[str] = None
    location: str
    start_date: datetime
    end_date: datetime
    capacity: int
    roles_requirements: Optional[Dict[str, int]] = {}
    color: Optional[str] = None

class TripOut(BaseModel):
    id: uuid.UUID
    client_id: uuid.UUID
    location: str
    start_date: datetime
    end_date: datetime
    capacity: int
    roles_requirements: Optional[Dict[str, int]] = {}
    color: Optional[str] = None
    client: ClientOut

    class Config:
        from_attributes = True

class JoinTripRequest(BaseModel):
    role: str

from typing import Optional, Dict, List

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
