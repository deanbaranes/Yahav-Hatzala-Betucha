import logging
from datetime import datetime, date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import not_, extract

from app.database import get_db
from app.models.trip_report import TripReport
from app.models.trip_assignment import TripAssignment
from app.models.trip import Trip
from app.models.user import User
from app.models.supplier import Supplier
from app.schemas import TripReportCreate, TripReportOut, ReportUpdate
from app.dependencies import get_employee_user, get_admin_user
from app.services.report_service import (
    calculate_overtime_decimal,
    process_and_save_report,
    update_report_data
)
from app.services.storage_service import StorageService
from app.services.payroll_service import PayrollService
from app.constants import (
    EMPLOYEE_ACCOMMODATION_PAY,
    EMPLOYEE_TRAVEL_PAY_PER_DAY,
    EMPLOYEE_RECOVERY_PAY_PER_DAY,
    OVERTIME_MULTIPLIER,
    DEFAULT_BASE_DAILY_HOURS
)

logger = logging.getLogger(__name__)

# ── Constants ─────────────────────────────────────────────────────────────────
MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB

router = APIRouter(prefix="/reports", tags=["reports"])


# ── Pending reports ───────────────────────────────────────────────────────────

@router.get("/all-pending-reports")
def get_all_pending_reports(db: Session = Depends(get_db), current_user: User = Depends(get_admin_user)):
    # Find all assignments that are confirmed and do not have a report already
    reported_assignment_ids = db.query(TripReport.assignment_id).subquery()
    
    pending_assignments = db.query(TripAssignment).join(Trip).join(User, TripAssignment.user_id == User.id).filter(
        TripAssignment.status == "assigned",
        TripAssignment.is_confirmed == True,
        not_(TripAssignment.id.in_(reported_assignment_ids))
    ).order_by(Trip.start_date.desc()).all()
    
    return [
        {
            "assignment_id": str(a.id),
            "trip_id": str(a.trip_id),
            "employee_name": a.user.full_name,
            "location": a.trip.location,
            "start_date": a.trip.start_date.isoformat(),
            "role": a.role
        } for a in pending_assignments
    ]

@router.get("/my-pending-reports")
def get_my_pending_reports(db: Session = Depends(get_db), current_user: User = Depends(get_employee_user)):
    # Subquery: get assignment IDs that have a fully submitted (non-draft) report
    submitted_assignment_ids = db.query(TripReport.assignment_id).filter(
        TripReport.is_draft == False
    ).subquery()
    
    pending_assignments = db.query(TripAssignment).join(Trip).filter(
        TripAssignment.user_id == current_user.id,
        TripAssignment.status == "assigned",
        TripAssignment.is_confirmed == True,
        not_(TripAssignment.id.in_(submitted_assignment_ids))
    ).order_by(Trip.start_date.desc()).all()
    
    return [
        {
            "assignment_id": str(a.id),
            "trip_id": str(a.trip_id),
            "location": a.trip.location,
            "start_date": a.trip.start_date.isoformat(),
            "end_date": a.trip.end_date.isoformat() if a.trip.end_date else None,
            "role": a.role
        } for a in pending_assignments
    ]

@router.get("/my-draft/{assignment_id}")
def get_my_draft(assignment_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_employee_user)):
    report = db.query(TripReport).filter(
        TripReport.assignment_id == assignment_id,
        TripReport.is_draft == True
    ).first()
    if not report:
        raise HTTPException(status_code=404, detail="Draft not found")
        
    return {
        "start_time": report.start_time.isoformat() if report.start_time else None,
        "end_time": report.end_time.isoformat() if report.end_time else None,
        "daily_shifts": report.daily_shifts or [],
        "expenses": float(report.expenses or 0),
        "expenses_notes": report.expenses_notes,
        "sleeps": report.sleeps or 0,
        "receipt_url": report.receipt_url
    }


# ── File Upload ───────────────────────────────────────────────────────────────

@router.post("/upload")
async def upload_file(file: UploadFile = File(...), current_user: User = Depends(get_employee_user)):
    # Validate file size
    contents = await file.read()
    if len(contents) > MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"הקובץ גדול מדי. גודל מקסימלי: {MAX_UPLOAD_SIZE_BYTES // (1024*1024)} MB"
        )
    # Reset file position for subsequent reads
    await file.seek(0)

    try:
        url = StorageService.upload_file(
            file.file,
            folder="yahav_receipts",
            content_type=file.content_type or "",
        )
        return {"url": url}
    except RuntimeError as e:
        logger.error(f"Receipt upload failed: {e}")
        raise HTTPException(status_code=500, detail="שגיאה בהעלאת הקובץ. אנא נסה שנית.")


# ── Report Submission (Employee) ──────────────────────────────────────────────

@router.post("/", response_model=TripReportOut)
def submit_trip_report(report_data: TripReportCreate, db: Session = Depends(get_db), current_user: User = Depends(get_employee_user)):
    # Validate assignment belongs to employee
    assignment = db.query(TripAssignment).filter(
        TripAssignment.id == report_data.assignment_id,
        TripAssignment.user_id == current_user.id
    ).first()
    
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found or does not belong to you")

    return process_and_save_report(db, assignment, report_data)


# ── Report Submission (Admin Manual) ──────────────────────────────────────────

@router.post("/admin-manual", response_model=TripReportOut)
def submit_trip_report_admin(report_data: TripReportCreate, db: Session = Depends(get_db), current_user: User = Depends(get_admin_user)):
    # Validate assignment exists (doesn't need to belong to admin)
    assignment = db.query(TripAssignment).filter(
        TripAssignment.id == report_data.assignment_id
    ).first()
    
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    return process_and_save_report(db, assignment, report_data)


# ── Report List (Admin) ──────────────────────────────────────────────────────

@router.get("/")
def get_all_reports(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: User = Depends(get_admin_user)):
    reports = (
        db.query(TripReport)
        .options(
            joinedload(TripReport.assignment).joinedload(TripAssignment.trip).joinedload(Trip.client),
            joinedload(TripReport.assignment).joinedload(TripAssignment.user)
        )
        .join(TripAssignment)
        .join(Trip)
        .join(User)
        .filter(TripReport.is_draft == False)
        .order_by(TripReport.start_time.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    
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
            "manager_status": r.manager_status.value,
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


# ── Report Update / Delete / Approve / Reject ────────────────────────────────


@router.put("/{report_id}")
def update_report(report_id: str, data: ReportUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_admin_user)):
    report = db.query(TripReport).filter(TripReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
        
    update_report_data(db, report, data)
    return {"message": "Report updated"}

@router.delete("/{report_id}")
def delete_report(report_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_admin_user)):
    report = db.query(TripReport).filter(TripReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    db.delete(report)
    db.commit()
    return {"message": "Report deleted successfully"}

@router.patch("/{report_id}/approve")
def approve_report(report_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_admin_user)):
    report = db.query(TripReport).filter(TripReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    # Check if we should automatically create a Supplier record
    payroll_service = PayrollService(db)
    payroll_service.create_supplier_record_from_report(report)

    report.manager_status = "approved"
    db.commit()
    return {"message": "Report approved"}

@router.patch("/{report_id}/reject")
def reject_report(report_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_admin_user)):
    report = db.query(TripReport).filter(TripReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    report.manager_status = "rejected"
    db.commit()
    return {"message": "Report rejected"}


# ── Reports Matrix ────────────────────────────────────────────────────────────

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
