from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from typing import List, Optional
from decimal import Decimal, ROUND_HALF_UP

from app.database import get_db
from app.models.user import User, UserRole
from app.models.payroll_adjustment import PayrollAdjustment
from app.models.trip_report import TripReport
from app.models.trip_assignment import TripAssignment
from app.models.trip import Trip
from app.dependencies import get_admin_user, get_current_user
from pydantic import BaseModel
from app.auth import get_password_hash

router = APIRouter(prefix="/payroll", tags=["payroll"])

class EmployeeRatesUpdate(BaseModel):
    hourly_rate: float
    base_daily_hours: float

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
    notes: Optional[str] = None

@router.post("/employees")
def create_employee(data: EmployeeCreate, db: Session = Depends(get_db), admin_user: User = Depends(get_admin_user)):
    # Check if phone exists (use dummy if needed)
    db_user = db.query(User).filter(User.phone == data.phone).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Phone already exists")
        
    new_user = User(
        full_name=data.full_name,
        phone=data.phone,
        password_hash=get_password_hash(data.password),
        role=UserRole.employee,
        status="active"
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@router.get("/employees")
def get_employees(month: Optional[int] = None, year: Optional[int] = None, db: Session = Depends(get_db), admin_user: User = Depends(get_admin_user)):
    query = db.query(User).filter(User.role == UserRole.employee, User.status != "inactive")
    
    if month and year:
        # Include employees who were ASSIGNED to a shift in this month (even if no report submitted yet)
        assigned_users = db.query(TripAssignment.user_id).join(Trip).filter(
            extract('month', Trip.start_date) == month,
            extract('year', Trip.start_date) == year,
            TripAssignment.status == "assigned"
        ).subquery()
        
        # Include employees who had a manual payroll adjustment this month
        adjusted_users = db.query(PayrollAdjustment.user_id).filter(
            PayrollAdjustment.month == month,
            PayrollAdjustment.year == year
        ).subquery()
        
        query = query.filter((User.id.in_(assigned_users)) | (User.id.in_(adjusted_users)))
        
    employees = query.order_by(User.full_name.asc()).all()
    return [
        {
            "id": str(e.id),
            "full_name": e.full_name,
            "hourly_rate": float(e.hourly_rate or 0),
            "base_daily_hours": float(e.base_daily_hours or 8.6)
        } for e in employees
    ]

@router.get("/employees/pending")
def get_pending_employees(db: Session = Depends(get_db), admin_user: User = Depends(get_admin_user)):
    pending = db.query(User).filter(User.role == UserRole.employee, User.status == "pending").order_by(User.full_name.asc()).all()
    return [
        {
            "id": str(e.id),
            "full_name": e.full_name,
            "phone": e.phone
        } for e in pending
    ]

@router.patch("/employees/{user_id}/approve")
def approve_employee(user_id: str, db: Session = Depends(get_db), admin_user: User = Depends(get_admin_user)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.status = "active"
    db.commit()
    return {"message": "User approved successfully"}

@router.delete("/employees/{user_id}/reject")
def reject_employee(user_id: str, db: Session = Depends(get_db), admin_user: User = Depends(get_admin_user)):
    user = db.query(User).filter(User.id == user_id, User.status == "pending").first()
    if not user:
        raise HTTPException(status_code=404, detail="Pending user not found")
    
    db.delete(user)
    db.commit()
    return {"message": "User rejected and deleted"}

@router.put("/employees/{user_id}")
def update_rates(user_id: str, data: EmployeeRatesUpdate, db: Session = Depends(get_db), admin_user: User = Depends(get_admin_user)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.hourly_rate = data.hourly_rate
    user.base_daily_hours = data.base_daily_hours
    db.commit()
    return {"message": "Rates updated successfully"}

@router.delete("/employees/{user_id}")
def deactivate_employee(user_id: str, db: Session = Depends(get_db), admin_user: User = Depends(get_admin_user)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.status = "inactive"
    db.commit()
    return {"message": "User deactivated successfully"}

@router.get("/adjustments/{user_id}/{month}/{year}")
def get_adjustments(user_id: str, month: int, year: int, db: Session = Depends(get_db), admin_user: User = Depends(get_admin_user)):
    adjs = db.query(PayrollAdjustment).filter(
        PayrollAdjustment.user_id == user_id,
        PayrollAdjustment.month == month,
        PayrollAdjustment.year == year
    ).all()
    return [
        {
            "id": str(a.id),
            "type": a.type,
            "amount": float(a.amount),
            "notes": a.notes
        } for a in adjs
    ]

@router.post("/adjustments")
def create_adjustment(data: AdjustmentCreate, db: Session = Depends(get_db), admin_user: User = Depends(get_admin_user)):
    adj = PayrollAdjustment(
        user_id=data.user_id,
        month=data.month,
        year=data.year,
        type=data.type,
        amount=data.amount,
        notes=data.notes
    )
    db.add(adj)
    db.commit()
    return {"message": "Adjustment added"}

@router.delete("/adjustments/{adj_id}")
def delete_adjustment(adj_id: str, db: Session = Depends(get_db), admin_user: User = Depends(get_admin_user)):
    adj = db.query(PayrollAdjustment).filter(PayrollAdjustment.id == adj_id).first()
    if not adj:
        raise HTTPException(status_code=404, detail="Adjustment not found")
    db.delete(adj)
    db.commit()
    return {"message": "Adjustment deleted"}

@router.get("/export/{employee_id}/{month}/{year}")
def export_payroll(employee_id: str, month: int, year: int, db: Session = Depends(get_db), admin_user: User = Depends(get_admin_user)):
    user = db.query(User).filter(User.id == employee_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    from app.services.payroll_service import PayrollService
    payroll_service = PayrollService(db)
    report_text = payroll_service.generate_employee_report(user, month, year)

    return {"report": report_text}

@router.get("/export-all/{month}/{year}")
def export_all_payroll(month: int, year: int, db: Session = Depends(get_db), admin_user: User = Depends(get_admin_user)):
    from app.services.payroll_service import PayrollService
    payroll_service = PayrollService(db)
    
    # Get all active employees who have any activity this month
    assigned_users = db.query(TripAssignment.user_id).join(Trip).filter(
        extract('month', Trip.start_date) == month,
        extract('year', Trip.start_date) == year,
        TripAssignment.status == "assigned"
    ).subquery()
    
    adjusted_users = db.query(PayrollAdjustment.user_id).filter(
        PayrollAdjustment.month == month,
        PayrollAdjustment.year == year
    ).subquery()
    
    employees = db.query(User).filter(
        User.role == UserRole.employee, 
        User.status != "inactive",
        ((User.id.in_(assigned_users)) | (User.id.in_(adjusted_users)))
    ).order_by(User.full_name.asc()).all()
    
    full_report = f"--- דוח שכר מרוכז: {month}/{year} ---\n\n"
    for emp in employees:
        try:
            report_text = payroll_service.generate_employee_report(emp, month, year)
            full_report += report_text + "\n\n=============================\n\n"
        except ValueError:
            pass 
            
    if not employees:
        full_report += "לא נמצאו נתוני שכר לאף עובד בחודש זה."
        
    return {"report": full_report}

@router.get("/my_payroll/{month}/{year}")
def get_my_payroll(month: int, year: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    from app.services.payroll_service import PayrollService
    payroll_service = PayrollService(db)
    report_text = payroll_service.generate_employee_report(current_user, month, year)
    return {"report": report_text}
