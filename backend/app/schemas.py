import uuid
from datetime import date, datetime

from app.models.trip_assignment import AssignmentStatus
from app.models.trip_report import BillingStatus, ManagerStatus
from app.models.user import UserRole, UserStatus
from pydantic import BaseModel

# ── Auth Schemas ──────────────────────────────────────────────────────────────


class Token(BaseModel):
    access_token: str
    token_type: str
    refresh_token: str | None = None


class TokenData(BaseModel):
    phone: str | None = None


class UserBase(BaseModel):
    full_name: str
    phone: str
    national_id: str | None = None
    email: str | None = None


class UserCreate(UserBase):
    password: str
    employment_type: str | None = None
    # role is intentionally excluded — all self-registrations are employees


class UserOut(UserBase):
    id: uuid.UUID
    role: UserRole
    status: UserStatus
    email: str | None = None

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
    contact_person: str | None = None


class ClientCreate(ClientBase):
    email: str | None = None
    phone: str | None = None


class ClientOut(ClientBase):
    id: uuid.UUID

    class Config:
        from_attributes = True


class ClientUpdate(BaseModel):
    name: str | None = None
    contact_person: str | None = None
    email: str | None = None
    phone: str | None = None
    balance: str | None = None
    debt_start_date: str | None = None
    notes: str | None = None
    payment_terms: str | None = (
        None  # "שוטף + 30" / "שוטף + 60" / "שוטף + 75" / None
    )


# ── Trip Schemas ──────────────────────────────────────────────────────────────


class TripCreate(BaseModel):
    client_name: str
    client_contact_person: str | None = None
    location: str
    start_date: datetime
    end_date: datetime
    capacity: int
    roles_requirements: dict[str, int | None] = {}
    color: str | None = None
    global_salary: float | None = None
    contact_name: str | None = None
    contact_phone: str | None = None
    employee_contact_name: str | None = None
    employee_contact_phone: str | None = None
    notes: str | None = None
    trip_name: str | None = None
    recurring_type: str | None = None
    recurring_end_date: datetime | None = None
    assigned_user_id: str | None = None
    assigned_role: str | None = None
    has_accommodation: bool = True


class TripOut(BaseModel):
    id: uuid.UUID
    client_id: uuid.UUID
    location: str
    start_date: datetime
    end_date: datetime
    capacity: int
    roles_requirements: dict[str, int | None] = {}
    color: str | None = None
    global_salary: float | None = None
    contact_name: str | None = None
    contact_phone: str | None = None
    employee_contact_name: str | None = None
    employee_contact_phone: str | None = None
    notes: str | None = None
    trip_name: str | None = None
    has_accommodation: bool = True
    is_billed: bool = False
    client: ClientOut

    class Config:
        from_attributes = True


class DuplicateRecurringRequest(BaseModel):
    recurring_type: str
    recurring_end_date: datetime


class JoinTripRequest(BaseModel):
    role: str


class AdminAssignRequest(BaseModel):
    user_id: str
    role: str = "כללי"
    status: str = "assigned"
    is_confirmed: bool = True
    send_sms: bool = True


class IcalImportRequest(BaseModel):
    ical_url: str
    default_client_name: str = "לקוח מיומן גוגל"


# ── Report Schemas ────────────────────────────────────────────────────────────


class DailyShift(BaseModel):
    start_time: datetime
    end_time: datetime
    is_absent: bool | None = False


class TripReportCreate(BaseModel):
    assignment_id: uuid.UUID
    start_time: datetime | None = None
    end_time: datetime | None = None
    daily_shifts: list[DailyShift | None] = None
    expenses: float | None = 0.0
    expenses_notes: str | None = None
    sleeps: int | None = 0
    receipt_url: str | None = None
    is_draft: bool = False


class TripReportOut(BaseModel):
    id: uuid.UUID
    assignment_id: uuid.UUID
    start_time: datetime
    end_time: datetime
    daily_shifts: list[DailyShift | None] = None
    overtime_decimal: float
    expenses: float
    expenses_notes: str | None = None
    sleeps: int = 0
    receipt_url: str | None
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
    daily_shifts: list[dict | None] = None


# ── Payroll / Employee Schemas ────────────────────────────────────────────────


class EmployeeRatesUpdate(BaseModel):
    hourly_rate: float
    base_daily_hours: float
    employment_type: str | None = None


class AdjustmentCreate(BaseModel):
    user_id: str
    month: int
    year: int
    type: str
    amount: float
    notes: str | None = None


class EmployeeCreate(BaseModel):
    full_name: str
    phone: str
    password: str
    national_id: str | None = None
    email: str | None = None
    notes: str | None = None


class EmployeeUpdate(BaseModel):
    full_name: str | None = None
    phone: str | None = None
    national_id: str | None = None
    email: str | None = None
    employment_type: str | None = None


# ── Supplier Schemas ──────────────────────────────────────────────────────────


class SupplierBase(BaseModel):
    name: str
    debt_date: date
    debt_end_date: date | None = None
    amount: float
    details: str | None = None
    includes_vat: bool = False
    is_invoiced: bool = False
    invoice_date: date | None = None


class SupplierCreate(SupplierBase):
    pass


class SupplierUpdate(BaseModel):
    name: str | None = None
    debt_date: date | None = None
    debt_end_date: date | None = None
    amount: float | None = None
    details: str | None = None
    includes_vat: bool | None = None
    is_invoiced: bool | None = None
    invoice_date: date | None = None


class SupplierOut(SupplierBase):
    id: uuid.UUID
    created_at: datetime

    class Config:
        from_attributes = True


# ── Business Expenses Schemas ──────────────────────────────────────────────────


class BusinessExpenseBase(BaseModel):
    notes: str | None = None
    status: str | None = "pending"
    file_name: str | None = None
    expense_month: int
    expense_year: int


class BusinessExpenseUpdate(BaseModel):
    status: str | None = None
    notes: str | None = None


class BusinessExpenseOut(BusinessExpenseBase):
    id: uuid.UUID
    file_url: str
    uploaded_by_id: uuid.UUID | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
