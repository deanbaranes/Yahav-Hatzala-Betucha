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
from app.services.payroll_service import PayrollService
from app.models.payslip import Payslip
import cloudinary
import cloudinary.uploader
import os
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
    national_id: Optional[str] = None
    email: Optional[str] = None
    notes: Optional[str] = None

class EmployeeUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    national_id: Optional[str] = None
    email: Optional[str] = None

@router.post("/employees")
def create_employee(data: EmployeeCreate, db: Session = Depends(get_db), admin_user: User = Depends(get_admin_user)):
    # Check if phone exists (use dummy if needed)
    db_user = db.query(User).filter(User.phone == data.phone).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Phone already exists")
        
    new_user = User(
        full_name=data.full_name,
        phone=data.phone,
        national_id=data.national_id,
        email=data.email,
        password_hash=get_password_hash(data.password),
        role=UserRole.employee,
        status="active"
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@router.put("/employees/{user_id}/details")
def update_employee_details(user_id: str, data: EmployeeUpdate, db: Session = Depends(get_db), admin_user: User = Depends(get_admin_user)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if data.full_name is not None:
        user.full_name = data.full_name
    if data.phone is not None:
        # Check if phone belongs to someone else
        existing = db.query(User).filter(User.phone == data.phone, User.id != user_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Phone already exists for another user")
        user.phone = data.phone
    if data.national_id is not None:
        user.national_id = data.national_id
    if data.email is not None:
        user.email = data.email
        
    db.commit()
    return {"message": "Employee details updated successfully"}

@router.get("/employees")
def get_employees(month: Optional[int] = None, year: Optional[int] = None, db: Session = Depends(get_db), admin_user: User = Depends(get_admin_user)):
    query = db.query(User).filter(User.role.in_([UserRole.employee, UserRole.admin]), User.status != "inactive")
    
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
            "phone": e.phone,
            "email": e.email,
            "national_id": e.national_id,
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

    payroll_service = PayrollService(db)
    report_text = payroll_service.generate_employee_report(user, month, year)

    return {"report": report_text}

@router.get("/export-all/{month}/{year}")
def export_all_payroll(month: int, year: int, db: Session = Depends(get_db), admin_user: User = Depends(get_admin_user)):
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
        User.role.in_([UserRole.employee, UserRole.admin]), 
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
    payroll_service = PayrollService(db)
    report_text = payroll_service.generate_employee_report(current_user, month, year)
    return {"report": report_text}

from fastapi import UploadFile, File, Form

@router.post("/payslips")
async def upload_payslip(
    user_id: str = Form(...),
    month: int = Form(...),
    year: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_admin_user)
):
    # Verify user
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    try:
        # Check if Cloudinary is configured
        if not os.getenv("CLOUDINARY_CLOUD_NAME"):
            # Fallback to local
            file_name = f"payslip_{user_id}_{month}_{year}.pdf"
            file_path = f"uploads/{file_name}"
            import shutil
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            file_url = f"http://localhost:8000/uploads/{file_name}"
        else:
            result = cloudinary.uploader.upload(
                file.file,
                folder="yahav_payslips",
                resource_type="auto"
            )
            file_url = result.get("secure_url")
            
        payslip = Payslip(
            user_id=user.id,
            month=month,
            year=year,
            file_url=file_url
        )
        db.add(payslip)
        db.commit()
        db.refresh(payslip)
        
        return {"message": "Payslip uploaded successfully", "id": str(payslip.id)}
    except Exception as e:
        print(f"Payslip upload error: {e}")
        raise HTTPException(status_code=500, detail="Could not upload payslip")

@router.get("/payslips/{user_id}")
def get_user_payslips(user_id: str, db: Session = Depends(get_db), admin_user: User = Depends(get_admin_user)):
    payslips = db.query(Payslip).filter(Payslip.user_id == user_id).order_by(Payslip.year.desc(), Payslip.month.desc()).all()
    return [{"id": str(p.id), "month": p.month, "year": p.year, "file_url": p.file_url} for p in payslips]

@router.get("/my_payslips")
def get_my_payslips(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    payslips = db.query(Payslip).filter(Payslip.user_id == current_user.id).order_by(Payslip.year.desc(), Payslip.month.desc()).all()
    return [{"id": str(p.id), "month": p.month, "year": p.year, "file_url": p.file_url} for p in payslips]

