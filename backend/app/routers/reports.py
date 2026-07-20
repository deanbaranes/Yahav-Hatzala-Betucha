import os
import uuid
import boto3
from typing import Optional, List
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

from fastapi import UploadFile, File
import shutil

@router.post("/upload")
async def upload_file(file: UploadFile = File(...), current_user: User = Depends(get_employee_user)):
    ext = ".pdf" if file.content_type == "application/pdf" else ".jpg"
    file_id = str(uuid.uuid4())
    
    if AWS_ACCESS_KEY_ID in ["dummy", "your_aws_access_key"] or not AWS_ACCESS_KEY_ID:
        file_name = f"{file_id}{ext}"
        file_path = f"uploads/{file_name}"
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        return {"url": f"http://localhost:8000/uploads/{file_name}"}
    
    # S3 Upload
    file_name = f"receipts/{file_id}{ext}"
    try:
        s3_client.upload_fileobj(
            file.file,
            S3_BUCKET,
            file_name,
            ExtraArgs={"ACL": "public-read", "ContentType": file.content_type}
        )
    except ClientError as e:
        print(f"S3 Upload Error: {e}")
        raise HTTPException(status_code=500, detail="Could not upload file to S3. Check AWS permissions.")
        
    s3_url = f"https://{S3_BUCKET}.s3.amazonaws.com/{file_name}"
    return {"url": s3_url}

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

    # Calculate overtime and total span
    total_overtime = 0.0
    final_start = report_data.start_time
    final_end = report_data.end_time
    shifts_json = None
    
    print("DEBUG: Received daily_shifts from client:", report_data.daily_shifts)
    if report_data.daily_shifts and len(report_data.daily_shifts) > 0:
        shifts_json = [{"start_time": s.start_time.isoformat(), "end_time": s.end_time.isoformat()} for s in report_data.daily_shifts]
        final_start = min([s.start_time for s in report_data.daily_shifts])
        final_end = max([s.end_time for s in report_data.daily_shifts])
        for shift in report_data.daily_shifts:
            total_overtime += calculate_overtime_decimal(shift.start_time, shift.end_time)
    else:
        if not report_data.start_time or not report_data.end_time:
            raise HTTPException(status_code=400, detail="Must provide start_time and end_time if no daily_shifts")
        total_overtime = calculate_overtime_decimal(report_data.start_time, report_data.end_time)

    new_report = TripReport(
        assignment_id=assignment.id,
        start_time=final_start,
        end_time=final_end,
        daily_shifts=shifts_json,
        overtime_decimal=Decimal(str(total_overtime)),
        expenses=report_data.expenses,
        expenses_notes=report_data.expenses_notes,
        sleeps=report_data.sleeps,
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

    # Calculate overtime and total span
    total_overtime = 0.0
    final_start = report_data.start_time
    final_end = report_data.end_time
    shifts_json = None
    
    if report_data.daily_shifts and len(report_data.daily_shifts) > 0:
        shifts_json = [{"start_time": s.start_time.isoformat(), "end_time": s.end_time.isoformat()} for s in report_data.daily_shifts]
        final_start = min([s.start_time for s in report_data.daily_shifts])
        final_end = max([s.end_time for s in report_data.daily_shifts])
        for shift in report_data.daily_shifts:
            total_overtime += calculate_overtime_decimal(shift.start_time, shift.end_time)
    else:
        if not report_data.start_time or not report_data.end_time:
            raise HTTPException(status_code=400, detail="Must provide start_time and end_time if no daily_shifts")
        total_overtime = calculate_overtime_decimal(report_data.start_time, report_data.end_time)

    new_report = TripReport(
        assignment_id=assignment.id,
        start_time=final_start,
        end_time=final_end,
        daily_shifts=shifts_json,
        overtime_decimal=Decimal(str(total_overtime)),
        expenses=report_data.expenses,
        expenses_notes=report_data.expenses_notes,
        sleeps=report_data.sleeps,
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
            "daily_shifts": r.daily_shifts,
            "overtime_decimal": r.overtime_decimal,
            "expenses": r.expenses,
            "expenses_notes": r.expenses_notes,
            "sleeps": r.sleeps,
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
    sleeps: int = 0
    daily_shifts: Optional[List[dict]] = None

@router.put("/{report_id}")
def update_report(report_id: str, data: ReportUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_admin_user)):
    report = db.query(TripReport).filter(TripReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
        
    report.start_time = data.start_time
    report.end_time = data.end_time
    
    new_overtime = 0.0
    if data.daily_shifts and len(data.daily_shifts) > 0:
        report.daily_shifts = data.daily_shifts
        report.start_time = min([datetime.fromisoformat(s['start_time'].replace('Z', '+00:00')) for s in data.daily_shifts])
        report.end_time = max([datetime.fromisoformat(s['end_time'].replace('Z', '+00:00')) for s in data.daily_shifts])
        for s in data.daily_shifts:
            st = datetime.fromisoformat(s['start_time'].replace('Z', '+00:00'))
            et = datetime.fromisoformat(s['end_time'].replace('Z', '+00:00'))
            new_overtime += calculate_overtime_decimal(st, et)
    else:
        report.daily_shifts = None
        new_overtime = calculate_overtime_decimal(data.start_time, data.end_time)
    
    # Allow manual override if they changed it specifically
    if abs(float(report.overtime_decimal) - float(data.overtime_decimal)) > 0.01:
        report.overtime_decimal = Decimal(str(data.overtime_decimal))
    else:
        report.overtime_decimal = Decimal(str(new_overtime))
    
    report.expenses = Decimal(str(data.expenses))
    report.sleeps = data.sleeps
    db.commit()
    return {"message": "Report updated"}

@router.delete("/{report_id}")
def delete_report(report_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_admin_user)):
    report = db.query(TripReport).filter(TripReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    db.delete(report)
    db.commit()
    return {"message": "Report deleted successfully"}

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
