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
from app.dependencies import get_employee_user

router = APIRouter(prefix="/api/reports", tags=["reports"])

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
def get_upload_url(current_user: User = Depends(get_employee_user)):
    file_name = f"receipts/{uuid.uuid4()}.jpg"
    try:
        response = s3_client.generate_presigned_post(
            Bucket=S3_BUCKET,
            Key=file_name,
            Fields={"acl": "public-read", "Content-Type": "image/jpeg"},
            Conditions=[
                {"acl": "public-read"},
                {"Content-Type": "image/jpeg"},
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
    db.commit()
    db.refresh(new_report)
    return new_report

from app.dependencies import get_admin_user

@router.get("/")
def get_all_reports(db: Session = Depends(get_db), current_user: User = Depends(get_admin_user)):
    reports = db.query(TripReport).join(TripAssignment).join(Trip).join(User).order_by(TripReport.created_at.desc()).all()
    
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
            "created_at": r.created_at.isoformat(),
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


