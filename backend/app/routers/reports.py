import os
import uuid
import boto3
from botocore.exceptions import ClientError
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import not_
from app.database import get_db
from app.models.trip_report import TripReport
from app.models.trip_assignment import TripAssignment
from app.models.trip import Trip
from app.models.user import User
from app.schemas import TripReportCreate, TripReportOut
from app.dependencies import get_employee_user, get_admin_user
from pydantic import BaseModel
from decimal import Decimal
from datetime import datetime
from sqlalchemy import extract

router = APIRouter(prefix="/reports", tags=["reports"])

@router.get("/my-pending-reports")
def get_my_pending_reports(db: Session = Depends(get_db), current_user: User = Depends(get_employee_user)):
    # Find all assignments for this user that are confirmed
    # AND do not have a report already
    
    # Subquery: get assignment IDs that already have a report
    reported_assignment_ids = db.query(TripReport.assignment_id).subquery()
    
    pending_assignments = db.query(TripAssignment).join(Trip).filter(
        TripAssignment.user_id == current_user.id,
        TripAssignment.status == "assigned",
        TripAssignment.is_confirmed == True,
        not_(TripAssignment.id.in_(reported_assignment_ids))
    ).order_by(Trip.start_date.desc()).all()
    
    return [
        {
            "assignment_id": str(a.id),
            "trip_id": str(a.trip_id),
            "location": a.trip.location,
            "start_date": a.trip.start_date.isoformat(),
            "role": a.role
        } for a in pending_assignments
    ]

# S3 Configuration
S3_BUCKET = os.getenv("S3_BUCKET", "yahav-receipts")
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID", "dummy")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY", "dummy")

s3_client = boto3.client(
    's3',
    region_name=AWS_REGION,
    aws_access_key_id=AWS_ACCESS_KEY_ID,
    aws_secret_access_key=AWS_SECRET_ACCESS_KEY
)

@router.get("/upload-url")
def get_upload_url(file_type: str = "image/jpeg", current_user: User = Depends(get_employee_user)):
    ext = ".pdf" if file_type == "application/pdf" else ".jpg"
    file_name = f"receipts/{uuid.uuid4()}{ext}"
    try:
        response = s3_client.generate_presigned_post(
            Bucket=S3_BUCKET,
            Key=file_name,
            Fields={"acl": "public-read", "Content-Type": file_type},
            Conditions=[
                {"acl": "public-read"},
                {"Content-Type": file_type},
                ["content-length-range", 0, 10485760] # 10MB limit
            ],
            ExpiresIn=3600
        )
    except ClientError as e:
        raise HTTPException(status_code=500, detail="Could not generate upload URL")
        
    return response

from decimal import Decimal, ROUND_HALF_UP

def calculate_overtime_decimal(start_time, end_time) -> float:
    total_time = end_time.replace(tzinfo=None) - start_time.replace(tzinfo=None)
    total_minutes = total_time.total_seconds() / 60.0
    overtime_minutes = max(0, total_minutes - (9 * 60))
    overtime_hours = overtime_minutes / 60.0
    
    # Use Decimal for strict financial precision rounding to nearest 0.05
    d_overtime = Decimal(str(overtime_hours))
    d_scaled = d_overtime * Decimal('20')
    d_rounded = d_scaled.quantize(Decimal('1'), rounding=ROUND_HALF_UP)
    d_final = d_rounded / Decimal('20')
    
    return float(d_final)

@router.post("/", response_model=TripReportOut)
def submit_trip_report(report_data: TripReportCreate, db: Session = Depends(get_db), current_user: User = Depends(get_employee_user)):
    # Validate assignment belongs to employee
    assignment = db.query(TripAssignment).filter(
        TripAssignment.id == report_data.assignment_id,
        TripAssignment.user_id == current_user.id
    ).first()
    
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found or does not belong to you")
        
    # Check if report already exists
    existing_report = db.query(TripReport).filter(TripReport.assignment_id == assignment.id).first()
    if existing_report:
         raise HTTPException(status_code=400, detail="Report already submitted for this assignment")

    overtime_decimal = calculate_overtime_decimal(report_data.start_time, report_data.end_time)

    new_report = TripReport(
        assignment_id=assignment.id,
        start_time=report_data.start_time,
        end_time=report_data.end_time,
        overtime_decimal=overtime_decimal,
        expenses=report_data.expenses,
        receipt_url=report_data.receipt_url
    )
    db.add(new_report)
    
    # Auto-charge client for accommodation
    trip = assignment.trip
    if trip.start_date and trip.end_date:
        nights = (trip.end_date.date() - trip.start_date.date()).days
        if nights > 0:
            client = trip.client
            if client:
                try:
                    current_bal = float(str(client.balance or '0').replace(',', ''))
                except ValueError:
                    current_bal = 0.0
                
                charge = nights * 180
                client.balance = str(current_bal - charge)
                note_addition = f"חיוב אוטומטי {charge} ₪ על לינת עובד בטיול {trip.location} ({trip.start_date.strftime('%d/%m/%Y')})"
                client.notes = f"{client.notes or ''}\n{note_addition}".strip()
                db.add(client)

    db.commit()
    db.refresh(new_report)
    return new_report

from app.dependencies import get_admin_user

@router.post("/admin-manual", response_model=TripReportOut)
def submit_trip_report_admin(report_data: TripReportCreate, db: Session = Depends(get_db), current_user: User = Depends(get_admin_user)):
    # Validate assignment exists (doesn't need to belong to admin)
    assignment = db.query(TripAssignment).filter(
        TripAssignment.id == report_data.assignment_id
    ).first()
    
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
        
    # Check if report already exists
    existing_report = db.query(TripReport).filter(TripReport.assignment_id == assignment.id).first()
    if existing_report:
         raise HTTPException(status_code=400, detail="Report already submitted for this assignment")

    overtime_decimal = calculate_overtime_decimal(report_data.start_time, report_data.end_time)

    new_report = TripReport(
        assignment_id=assignment.id,
        start_time=report_data.start_time,
        end_time=report_data.end_time,
        overtime_decimal=overtime_decimal,
        expenses=report_data.expenses,
        receipt_url=report_data.receipt_url
    )
    db.add(new_report)
    
    # Auto-charge client for accommodation
    trip = assignment.trip
    if trip.start_date and trip.end_date:
        nights = (trip.end_date.date() - trip.start_date.date()).days
        if nights > 0:
            client = trip.client
            if client:
                try:
                    current_bal = float(str(client.balance or '0').replace(',', ''))
                except ValueError:
                    current_bal = 0.0
                
                charge = nights * 180
                client.balance = str(current_bal - charge)
                note_addition = f"חיוב אוטומטי {charge} ₪ על לינת עובד בטיול {trip.location} ({trip.start_date.strftime('%d/%m/%Y')})"
                client.notes = f"{client.notes or ''}\n{note_addition}".strip()
                db.add(client)

    db.commit()
    db.refresh(new_report)
    return new_report

@router.get("/")
def get_all_reports(db: Session = Depends(get_db), current_user: User = Depends(get_admin_user)):
    reports = db.query(TripReport).join(TripAssignment).join(Trip).join(User).order_by(TripReport.start_time.desc()).all()
    
    result = []
    for r in reports:
        a = r.assignment
        t = a.trip
        u = a.user
        
        result.append({
            "id": str(r.id),
            "start_time": r.start_time.isoformat(),
            "end_time": r.end_time.isoformat(),
            "overtime_decimal": r.overtime_decimal,
            "expenses": r.expenses,
            "receipt_url": r.receipt_url,
            "created_at": r.start_time.isoformat(),
            "employee": {
                "id": str(u.id),
                "full_name": u.full_name,
                "phone": u.phone,
                "role": a.role
            },
            "trip": {
                "id": str(t.id),
                "location": t.location,
                "start_date": t.start_date.isoformat(),
                "client_name": t.client.name if t.client else None
            }
        })
    return result

class ReportUpdate(BaseModel):
    start_time: datetime
    end_time: datetime
    overtime_decimal: float
    expenses: float

@router.put("/{report_id}")
def update_report(report_id: str, data: ReportUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_admin_user)):
    report = db.query(TripReport).filter(TripReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
        
    report.start_time = data.start_time
    report.end_time = data.end_time
    
    # Auto-recalculate overtime based on the new times, unless they specifically inputted a massive override
    # but for safety, we just recalculate it here to ensure it's accurate to the times.
    new_overtime = calculate_overtime_decimal(data.start_time, data.end_time)
    
    # If the user explicitly provided a different overtime (e.g. manual override in UI), keep it, otherwise use calculated.
    # We will just force recalculation because the times changed.
    report.overtime_decimal = Decimal(str(new_overtime))
    
    report.expenses = Decimal(str(data.expenses))
    db.commit()
    return {"message": "Report updated"}

@router.get("/matrix/{year}/{month}")
def get_reports_matrix(year: int, month: int, db: Session = Depends(get_db), current_user: User = Depends(get_admin_user)):
    # Fetch all assignments in this month that are "assigned" for active/pending users
    assignments = db.query(TripAssignment).join(Trip).join(User, TripAssignment.user_id == User.id).filter(
        TripAssignment.status == "assigned",
        User.status != "inactive",
        extract('year', Trip.start_date) == year,
        extract('month', Trip.start_date) == month
    ).all()
    
    assignment_ids = [a.id for a in assignments]
    # N+1 FIX: Fetch all relevant reports at once
    reports = db.query(TripReport).filter(TripReport.assignment_id.in_(assignment_ids)).all() if assignment_ids else []
    reports_map = {r.assignment_id: r for r in reports}
    
    users_dict = {}
    for a in assignments:
        u = a.user
        date_str = a.trip.start_date.date().isoformat()
        
        if str(u.id) not in users_dict:
            users_dict[str(u.id)] = {"id": str(u.id), "name": u.full_name, "shifts": {}}
            
        report = reports_map.get(a.id)
        
        users_dict[str(u.id)]["shifts"][date_str] = {
            "role": a.role,
            "overtime": float(report.overtime_decimal) if report else 0.0,
            "report_id": str(report.id) if report else None
        }
        
    return {"matrix": list(users_dict.values())}
