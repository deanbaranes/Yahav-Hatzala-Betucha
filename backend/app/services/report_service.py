"""
Report Service — extracted business logic for report processing.
Eliminates the 65-line duplication between employee and admin report submission.
"""
from decimal import Decimal, ROUND_HALF_UP
from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models.trip_report import TripReport
from app.models.trip_assignment import TripAssignment
from app.schemas import TripReportCreate
from app.constants import CLIENT_ACCOMMODATION_CHARGE
import os
import logging
from app.services.notification_service import NotificationService

logger = logging.getLogger(__name__)


def calculate_overtime_decimal(start_time, end_time) -> float:
    """
    Calculates overtime hours for a single shift.
    Any time beyond 9 hours is overtime, with a +0.4h bonus if > 0,
    rounded to the nearest 0.05.
    """
    total_time = end_time.replace(tzinfo=None) - start_time.replace(tzinfo=None)
    total_minutes = total_time.total_seconds() / 60.0
    overtime_minutes = max(0, total_minutes - (9 * 60))
    overtime_hours = overtime_minutes / 60.0

    # Use Decimal for strict financial precision rounding to nearest 0.05
    d_overtime = Decimal(str(overtime_hours))

    if d_overtime > 0:
        d_overtime += Decimal('0.4')

    d_scaled = d_overtime * Decimal('20')
    d_rounded = d_scaled.quantize(Decimal('1'), rounding=ROUND_HALF_UP)
    d_final = d_rounded / Decimal('20')

    return float(d_final)


def process_and_save_report(
    db: Session,
    assignment: TripAssignment,
    report_data: TripReportCreate
) -> TripReport:
    """
    Core logic shared by both employee and admin report submission.
    Calculates overtime, creates the TripReport, and auto-charges the client.
    """
    # Calculate overtime and total span
    total_overtime = 0.0
    final_start = report_data.start_time
    final_end = report_data.end_time
    shifts_json = None

    if report_data.daily_shifts and len(report_data.daily_shifts) > 0:
        shifts_json = [
            {"start_time": s.start_time.isoformat(), "end_time": s.end_time.isoformat()}
            for s in report_data.daily_shifts
        ]
        final_start = min(s.start_time for s in report_data.daily_shifts)
        final_end = max(s.end_time for s in report_data.daily_shifts)
        for shift in report_data.daily_shifts:
            total_overtime += calculate_overtime_decimal(shift.start_time, shift.end_time)
    else:
        if not report_data.start_time or not report_data.end_time:
            raise HTTPException(
                status_code=400,
                detail="Must provide start_time and end_time if no daily_shifts"
            )
        total_overtime = calculate_overtime_decimal(report_data.start_time, report_data.end_time)

    # Check if report already exists for draft upsert
    existing_report = db.query(TripReport).filter(
        TripReport.assignment_id == assignment.id
    ).first()

    if existing_report:
        if not existing_report.is_draft:
            raise HTTPException(
                status_code=400,
                detail="Report already fully submitted for this assignment"
            )
        # Update existing draft
        existing_report.start_time = final_start
        existing_report.end_time = final_end
        existing_report.daily_shifts = shifts_json
        existing_report.overtime_decimal = Decimal(str(total_overtime))
        existing_report.expenses = report_data.expenses
        existing_report.expenses_notes = report_data.expenses_notes
        existing_report.sleeps = report_data.sleeps
        existing_report.is_draft = report_data.is_draft
        if report_data.receipt_url:
            existing_report.receipt_url = report_data.receipt_url
        new_report = existing_report
    else:
        new_report = TripReport(
            assignment_id=assignment.id,
            start_time=final_start,
            end_time=final_end,
            daily_shifts=shifts_json,
            overtime_decimal=Decimal(str(total_overtime)),
            expenses=report_data.expenses,
            expenses_notes=report_data.expenses_notes,
            sleeps=report_data.sleeps,
            receipt_url=report_data.receipt_url,
            is_draft=report_data.is_draft
        )
        db.add(new_report)

    # Auto-charge client for accommodation (only if it's the final submission and wasn't charged yet)
    trip = assignment.trip
    if not new_report.is_draft and not existing_report and trip.start_date and trip.end_date:
        nights = (trip.end_date.date() - trip.start_date.date()).days
        if nights > 0:
            client = trip.client
            if client:
                try:
                    current_bal = float(str(client.balance or '0').replace(',', ''))
                except ValueError:
                    current_bal = 0.0

                charge = nights * CLIENT_ACCOMMODATION_CHARGE
                client.balance = str(current_bal - charge)
                note_addition = (
                    f"חיוב אוטומטי {charge} ₪ על לינת עובד בטיול "
                    f"{trip.location} ({trip.start_date.strftime('%d/%m/%Y')})"
                )
                client.notes = f"{client.notes or ''}\n{note_addition}".strip()
                db.add(client)

    db.commit()
    db.refresh(new_report)

    # Send Notification to Admin only on final submit
    if not new_report.is_draft:
        try:
            worker_name = assignment.user.full_name if assignment.user else "עובד"
            location = trip.location if trip else "לא ידוע"
            msg = f"העובד/ת {worker_name} הגיש/ה דיווח עבור הטיול ב-{location} וממתין לאישור."
            admin_phone = os.getenv("ADMIN_PHONE", "0533210777")
            NotificationService.send_sms(admin_phone, msg, db=db)
        except Exception as e:
            logger.error(f"Failed to send notification for report submission: {e}")

    return new_report
