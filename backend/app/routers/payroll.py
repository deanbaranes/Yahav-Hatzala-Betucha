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
from app.dependencies import get_admin_user
from pydantic import BaseModel
from app.auth import get_password_hash

router = APIRouter(prefix="/payroll", tags=["payroll"], dependencies=[Depends(get_admin_user)])

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
def create_employee(data: EmployeeCreate, db: Session = Depends(get_db)):
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
def get_employees(month: Optional[int] = None, year: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(User).filter(User.role == UserRole.employee)
    
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

@router.put("/employees/{user_id}")
def update_rates(user_id: str, data: EmployeeRatesUpdate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.hourly_rate = data.hourly_rate
    user.base_daily_hours = data.base_daily_hours
    db.commit()
    return {"message": "Rates updated successfully"}

@router.get("/adjustments/{user_id}/{month}/{year}")
def get_adjustments(user_id: str, month: int, year: int, db: Session = Depends(get_db)):
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
def create_adjustment(data: AdjustmentCreate, db: Session = Depends(get_db)):
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
def delete_adjustment(adj_id: str, db: Session = Depends(get_db)):
    adj = db.query(PayrollAdjustment).filter(PayrollAdjustment.id == adj_id).first()
    if not adj:
        raise HTTPException(status_code=404, detail="Adjustment not found")
    db.delete(adj)
    db.commit()
    return {"message": "Adjustment deleted"}

@router.get("/export/{employee_id}/{month}/{year}")
def export_payroll(employee_id: str, month: int, year: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == employee_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    reports = db.query(TripReport).join(TripAssignment).filter(
        TripAssignment.user_id == employee_id,
        extract('month', TripReport.start_time) == month,
        extract('year', TripReport.start_time) == year
    ).all()

    days_worked = len(set(r.start_time.date() for r in reports if r.start_time))
    
    ot_hours = Decimal(0)

    for r in reports:
        ot_hours += Decimal(str(r.overtime_decimal or 0))

    hourly_rate = Decimal(str(user.hourly_rate or 0))
    base_daily = Decimal(str(user.base_daily_hours or 8.6))
    
    total_hours = Decimal(days_worked) * base_daily

    adjustments = db.query(PayrollAdjustment).filter(
        PayrollAdjustment.user_id == employee_id,
        PayrollAdjustment.month == month,
        PayrollAdjustment.year == year
    ).all()

    recovery_pay = Decimal(days_worked) * Decimal('12.00')
    travel_pay = Decimal(days_worked) * Decimal('22.60')
    
    accom_nights = Decimal(0)
    accom_pay = Decimal(0)
    other_adjs = Decimal(0)
    
    dean_days = 0
    dean_money = Decimal(0)

    for a in adjustments:
        amt = Decimal(str(a.amount))
        if a.type == "הבראה":
            recovery_pay += amt
        elif a.type == "נסיעות":
            travel_pay += amt
        elif a.type == "לינה":
            accom_nights += amt
            accom_pay += amt * Decimal('80.00')
        elif a.type == "שעות נוספות":
            ot_hours += amt
        elif a.type == "שכר יומי" and user.full_name == "דין ברנס":
            dean_days += 1
            dean_money += amt
        else:
            other_adjs += amt

    if user.full_name == "דין ברנס":
        days_worked += dean_days
        total_hours += dean_money / Decimal('60')
        base_salary = dean_money
    else:
        base_salary = Decimal(days_worked) * base_daily * hourly_rate
        
    ot_total = ot_hours * hourly_rate * Decimal('1.5')

    gross_total = base_salary + ot_total + recovery_pay + travel_pay + accom_pay + other_adjs

    # Exact format required
    report_text = f"""שם עובד: {user.full_name}
ימי עבודה: {days_worked}
שעות עבודה בחודש: {total_hours.quantize(Decimal('0.00'), rounding=ROUND_HALF_UP)}
שכר בסיס: {base_salary.quantize(Decimal('0.00'), rounding=ROUND_HALF_UP)} ₪
שעות נוספות: {ot_hours.quantize(Decimal('0.00'), rounding=ROUND_HALF_UP)} × {hourly_rate} × 1.5 = {ot_total.quantize(Decimal('0.00'), rounding=ROUND_HALF_UP)} ₪
הבראה: {recovery_pay.quantize(Decimal('0.00'), rounding=ROUND_HALF_UP)} ₪
נסיעות: {travel_pay.quantize(Decimal('0.00'), rounding=ROUND_HALF_UP)} ₪"""

    if accom_pay > 0:
        report_text += f"\nלינה ({accom_nights.quantize(Decimal('0'), rounding=ROUND_HALF_UP)} לילות): {accom_pay.quantize(Decimal('0.00'), rounding=ROUND_HALF_UP)} ₪"

    if other_adjs > 0:
        report_text += f"\nתוספות שונות: {other_adjs.quantize(Decimal('0.00'), rounding=ROUND_HALF_UP)} ₪"

    report_text += f"""
-----------------------------
סה"כ ברוטו: {gross_total.quantize(Decimal('0.00'), rounding=ROUND_HALF_UP)} ₪"""

    return {"report": report_text}
