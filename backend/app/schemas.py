import uuid
from datetime import datetime, date
from typing import Optional, Dict, List
from pydantic import BaseModel
from app.models.user import UserRole, UserStatus
from app.models.trip_assignment import AssignmentStatus
from app.models.trip_report import ManagerStatus, BillingStatus


# ── Auth Schemas ──────────────────────────────────────────────────────────────

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


# ── Client Schemas ────────────────────────────────────────────────────────────

class ClientBase(BaseModel):
    name: str
    contact_person: Optional[str] = None
    
class ClientCreate(ClientBase):
    email: Optional[str] = None
    phone: Optional[str] = None

class ClientOut(ClientBase):
    id: uuid.UUID

    class Config:
        from_attributes = True

class ClientUpdate(BaseModel):
    name: Optional[str] = None
    contact_person: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    balance: Optional[str] = None
    debt_start_date: Optional[str] = None
    notes: Optional[str] = None
    payment_terms: Optional[str] = None  # "שוטף + 30" / "שוטף + 60" / "שוטף + 75" / None


# ── Trip Schemas ──────────────────────────────────────────────────────────────

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
    contact_phone: Optional[str] = None

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
    contact_phone: Optional[str] = None
    is_billed: bool = False
    client: ClientOut

    class Config:
        from_attributes = True

class JoinTripRequest(BaseModel):
    role: str

class AdminAssignRequest(BaseModel):
    user_id: str
    role: str = "כללי"
    status: str = "assigned"
    is_confirmed: bool = True

class IcalImportRequest(BaseModel):
    ical_url: str
    default_client_name: str = "לקוח מיומן גוגל"


# ── Report Schemas ────────────────────────────────────────────────────────────

class DailyShift(BaseModel):
    start_time: datetime
    end_time: datetime
    is_absent: Optional[bool] = False

class TripReportCreate(BaseModel):
    assignment_id: uuid.UUID
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    daily_shifts: Optional[List[DailyShift]] = None
    expenses: Optional[float] = 0.0
    expenses_notes: Optional[str] = None
    sleeps: Optional[int] = 0
    receipt_url: Optional[str] = None
    is_draft: bool = False

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

class ReportUpdate(BaseModel):
    start_time: datetime
    end_time: datetime
    overtime_decimal: float
    expenses: float
    sleeps: int = 0
    daily_shifts: Optional[List[dict]] = None


# ── Payroll / Employee Schemas ────────────────────────────────────────────────

class EmployeeRatesUpdate(BaseModel):
    hourly_rate: float
    base_daily_hours: float
    employment_type: Optional[str] = None

class AdjustmentCreate(BaseModel):
    user_id: str
    month: int
    year: int
    type: str
    amount: float
    notes: Optional[str] = None

class EmployeeCreate(BaseModel):
    full_name: str
    phone: str
    password: str
    national_id: Optional[str] = None
    email: Optional[str] = None
    notes: Optional[str] = None

class EmployeeUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    national_id: Optional[str] = None
    email: Optional[str] = None
    employment_type: Optional[str] = None


# ── Supplier Schemas ──────────────────────────────────────────────────────────

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

# ── Business Expenses Schemas ──────────────────────────────────────────────────

class BusinessExpenseBase(BaseModel):
    notes: Optional[str] = None
    status: Optional[str] = "pending"
    file_name: Optional[str] = None
    expense_month: int
    expense_year: int

class BusinessExpenseUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None

class BusinessExpenseOut(BusinessExpenseBase):
    id: uuid.UUID
    file_url: str
    uploaded_by_id: Optional[uuid.UUID] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
