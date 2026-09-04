import logging

from app.database import get_db
from app.dependencies import get_admin_user, get_employee_user
from app.models.trip_assignment import TripAssignment
from app.models.trip_report import ManagerStatus, TripReport
from app.models.user import EmploymentType, User
from app.repositories.report_repository import ReportRepository
from app.schemas import ReportUpdate, TripReportCreate, TripReportOut
from app.services.payroll_service import PayrollService
from app.services.report_service import (
    process_and_save_report,
    update_report_data,
)
from app.services.storage_service import StorageService
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


def get_report_repo(db: Session = Depends(get_db)) -> ReportRepository:
    return ReportRepository(db)


def get_payroll_service(db: Session = Depends(get_db)) -> PayrollService:
    return PayrollService(db)


# ── Constants ─────────────────────────────────────────────────────────────────
MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB

router = APIRouter(prefix="/reports", tags=["reports"])


# ── Pending reports ───────────────────────────────────────────────────────────


@router.get("/all-pending-reports")
def get_all_pending_reports(
    repo: ReportRepository = Depends(get_report_repo),
    current_user: User = Depends(get_admin_user),
):
    pending_assignments = repo.get_pending_assignments_for_admin()
    return [
        {
            "assignment_id": str(a.id),
            "trip_id": str(a.trip_id),
            "employee_name": a.user.full_name,
            "location": a.trip.location,
            "notes": a.trip.notes,
            "start_date": a.trip.start_date.isoformat(),
            "role": a.role,
        }
        for a in pending_assignments
    ]


@router.get("/my-pending-reports")
def get_my_pending_reports(
    repo: ReportRepository = Depends(get_report_repo),
    current_user: User = Depends(get_employee_user),
):
    pending_assignments = repo.get_pending_assignments_for_employee(current_user.id)
    return [
        {
            "assignment_id": str(a.id),
            "trip_id": str(a.trip_id),
            "location": a.trip.location,
            "notes": a.trip.notes,
            "start_date": a.trip.start_date.isoformat(),
            "end_date": a.trip.end_date.isoformat() if a.trip.end_date else None,
            "role": a.role,
        }
        for a in pending_assignments
    ]


@router.get("/my-draft/{assignment_id}")
def get_my_draft(
    assignment_id: str,
    repo: ReportRepository = Depends(get_report_repo),
    current_user: User = Depends(get_employee_user),
):
    report = repo.get_employee_draft(assignment_id, current_user.id)
    if not report:
        raise HTTPException(status_code=404, detail="טיוטה לא נמצאה")

    return {
        "start_time": report.start_time.isoformat() if report.start_time else None,
        "end_time": report.end_time.isoformat() if report.end_time else None,
        "daily_shifts": report.daily_shifts or [],
        "expenses": float(report.expenses or 0),
        "expenses_notes": report.expenses_notes,
        "sleeps": report.sleeps or 0,
        "receipt_url": report.receipt_url,
    }


@router.get("/my-reports")
def get_my_reports(
    repo: ReportRepository = Depends(get_report_repo),
    current_user: User = Depends(get_employee_user),
):
    reports = repo.get_employee_reports(current_user.id)
    return [
        {
            "id": str(r.id),
            "assignment_id": str(r.assignment_id),
            "location": r.assignment.trip.location,
            "start_date": r.assignment.trip.start_date.isoformat(),
            "manager_status": r.manager_status,
            "billing_status": r.billing_status,
            "expenses": float(r.expenses or 0),
        }
        for r in reports
    ]


# ── File Upload ───────────────────────────────────────────────────────────────


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...), current_user: User = Depends(get_employee_user)
):
    # Validate file size
    contents = await file.read()
    if len(contents) > MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"הקובץ גדול מדי. גודל מקסימלי: {MAX_UPLOAD_SIZE_BYTES // (1024 * 1024)} MB",
        )
    # Reset file position for subsequent reads
    await file.seek(0)

    # Removed strict content_type validation to support all Android uploads

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
def submit_trip_report(
    report_data: TripReportCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_employee_user),
):
    # Validate assignment belongs to employee
    assignment = (
        db.query(TripAssignment)
        .filter(
            TripAssignment.id == report_data.assignment_id,
            TripAssignment.user_id == current_user.id,
        )
        .first()
    )

    if not assignment:
        raise HTTPException(status_code=404, detail="שיבוץ לא נמצא או שאינו שייך לך")

    return process_and_save_report(db, assignment, report_data)


# ── Report Submission (Admin Manual) ──────────────────────────────────────────


@router.post("/admin-manual", response_model=TripReportOut)
def submit_trip_report_admin(
    report_data: TripReportCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    # Validate assignment exists (doesn't need to belong to admin)
    assignment = (
        db.query(TripAssignment)
        .filter(TripAssignment.id == report_data.assignment_id)
        .first()
    )

    if not assignment:
        raise HTTPException(status_code=404, detail="שיבוץ לא נמצא")

    return process_and_save_report(db, assignment, report_data)


# ── Report List (Admin) ──────────────────────────────────────────────────────


@router.get("/")
def get_all_reports(
    skip: int = 0,
    limit: int = 100,
    repo: ReportRepository = Depends(get_report_repo),
    current_user: User = Depends(get_admin_user),
):
    reports = repo.get_all_reports(skip, limit)

    result = []
    for r in reports:
        a = r.assignment
        t = a.trip
        u = a.user

        result.append(
            {
                "id": str(r.id),
                "start_time": r.start_time.isoformat(),
                "end_time": r.end_time.isoformat(),
                "daily_shifts": r.daily_shifts,
                "overtime_decimal": r.overtime_decimal,
                "expenses": r.expenses,
                "expenses_notes": r.expenses_notes,
                "sleeps": r.sleeps,
                "receipt_url": r.receipt_url,
                "manager_status": r.manager_status.value if r.manager_status else None,
                "created_at": r.start_time.isoformat(),
                "employee": {
                    "id": str(u.id),
                    "full_name": u.full_name,
                    "phone": u.phone,
                    "role": a.role,
                    "employment_type": u.employment_type.value
                    if hasattr(u.employment_type, "value")
                    else (u.employment_type or EmploymentType.EMPLOYEE.value),
                },
                "trip": {
                    "id": str(t.id),
                    "location": t.location,
                    "start_date": t.start_date.isoformat(),
                    "client_name": t.client.name if t.client else None,
                },
            }
        )
    return result


# ── Report Update / Delete / Approve / Reject ────────────────────────────────


@router.put("/{report_id}")
def update_report(
    report_id: str,
    data: ReportUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    report = db.query(TripReport).filter(TripReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    update_report_data(db, report, data)
    return {"message": "Report updated"}


@router.delete("/{report_id}")
def delete_report(
    report_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    report = db.query(TripReport).filter(TripReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="דיווח לא נמצא")

    db.delete(report)
    db.commit()
    return {"message": "Report deleted successfully"}


@router.patch("/{report_id}/approve")
def approve_report(
    report_id: str,
    db: Session = Depends(get_db),
    payroll_service: PayrollService = Depends(get_payroll_service),
    current_user: User = Depends(get_admin_user),
):
    report = db.query(TripReport).filter(TripReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="דיווח לא נמצא")

    # Check if we should automatically create a Supplier record
    payroll_service.create_supplier_record_from_report(report)

    report.manager_status = ManagerStatus.approved
    db.commit()
    return {"message": "Report approved"}


@router.patch("/{report_id}/reject")
def reject_report(
    report_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    report = db.query(TripReport).filter(TripReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="דיווח לא נמצא")

    report.manager_status = ManagerStatus.rejected
    db.commit()
    return {"message": "Report rejected"}


# ── Reports Matrix ────────────────────────────────────────────────────────────


@router.get("/matrix/{year}/{month}")
def get_reports_matrix(
    year: int,
    month: int,
    repo: ReportRepository = Depends(get_report_repo),
    current_user: User = Depends(get_admin_user),
):
    assignments = repo.get_matrix_assignments(year, month)

    assignment_ids = [a.id for a in assignments]
    reports = repo.get_approved_reports_by_assignments(assignment_ids)

    reports_map = {r.assignment_id: r for r in reports}

    users_dict = {}
    for a in assignments:
        report = reports_map.get(a.id)
        if not report:
            continue  # Only show approved reports in the matrix

        u = a.user
        date_str = a.trip.start_date.date().isoformat()

        if str(u.id) not in users_dict:
            users_dict[str(u.id)] = {"id": str(u.id), "name": u.full_name, "shifts": {}}

        users_dict[str(u.id)]["shifts"][date_str] = {
            "role": a.role,
            "overtime": float(report.overtime_decimal)
            if report.overtime_decimal
            else 0,
            "report_id": str(report.id),
        }

    return {"matrix": list(users_dict.values())}
