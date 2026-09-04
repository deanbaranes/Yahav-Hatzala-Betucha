import logging
from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime, timedelta
import re
from sqlalchemy.orm import Session, joinedload
from app.database import SessionLocal
from app.models.client import Client
from app.models.supplier import Supplier
from app.models.trip import Trip
from app.models.trip_assignment import TripAssignment
from app.models.notification import Notification
from app.services.notification_service import NotificationService
from app.services.storage_service import StorageService
import os
from app.models.trip_report import TripReport
from app.models.business_expense import BusinessExpense
from app.models.refresh_token import RefreshToken
from app.models.user import User

logger = logging.getLogger(__name__)

# Admin phone number to send alerts to
ADMIN_PHONE = os.environ.get("ADMIN_PHONE", "")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def check_client_debts():
    """
    Check if any client has passed their payment terms and notify the admin.
    """
    logger.info("Running check_client_debts task...")
    db: Session = next(get_db())
    
    # Clients with a debt_start_date where payment terms have passed, and they actually have a debt
    clients = db.query(Client).filter(
        Client.debt_start_date.isnot(None),
        Client.numeric_balance < 0
    ).all()
    now = datetime.now()
    
    for client in clients:
        debt_start = client.debt_start_date
        
        if client.payment_terms and re.search(r'\d+', client.payment_terms):
            # Special payment terms (e.g., "שוטף + 30") -> Calculate End of Month + X days
            days = int(re.search(r'\d+', client.payment_terms).group(0))
            if debt_start.month == 12:
                next_month = debt_start.replace(year=debt_start.year + 1, month=1, day=1)
            else:
                next_month = debt_start.replace(month=debt_start.month + 1, day=1)
            end_of_month = next_month - timedelta(days=1)
            due_date = end_of_month + timedelta(days=days)
        else:
            # Default behavior: exactly 30 days (1 month) from the debt start date
            due_date = debt_start + timedelta(days=30)
        
        if now > due_date:
            msg = f"התראת חוב: הלקוח '{client.name}' עבר את תאריך התשלום ({due_date.strftime('%d/%m/%Y')}). הגיע הזמן לגבות!"
            
            # Prevent spam: alert once a week per debt
            last_week = now - timedelta(days=7)
            recent_notif = db.query(Notification).filter(
                Notification.message == msg,
                Notification.created_at >= last_week
            ).first()
            
            if not recent_notif:
                NotificationService.create_in_app_notification(msg, db, title="התראת חוב")
                billing_phone = "".join(filter(str.isdigit, os.getenv("BILLING_ADMIN_PHONE", "")))
                admin_phone = "".join(filter(str.isdigit, os.getenv("ADMIN_PHONE", "")))
                
                # Send Push to Dean (Billing Admin)
                if billing_phone:
                    billing_admin = db.query(User).filter(User.phone.like(f"%{billing_phone}%")).first()
                    if billing_admin:
                        from app.services.push_service import send_push_notification
                        send_push_notification(db, billing_admin.id, "התראת גבייה מלקוחות", msg, url="/admin/clients")
                        
                # Send Push to Yahav (General Admin)
                if admin_phone and admin_phone != billing_phone:
                    admin_user = db.query(User).filter(User.phone.like(f"%{admin_phone}%")).first()
                    if admin_user:
                        from app.services.push_service import send_push_notification
                        send_push_notification(db, admin_user.id, "התראת גבייה מלקוחות", msg, url="/admin/clients")
    
def check_unassigned_trips():
    """
    Check if there are any trips in the next 48 hours without any assigned employees.
    """
    logger.info("Running check_unassigned_trips task...")
    db: Session = next(get_db())
    now = datetime.now()
    in_48_hours = now + timedelta(hours=48)
    
    trips = db.query(Trip).filter(
        Trip.start_date > now,
        Trip.start_date <= in_48_hours
    ).all()
    
    for trip in trips:
        confirmed_assignments = [a for a in trip.assignments if a.is_confirmed and a.status == "assigned"]
        if trip.capacity > 0 and len(confirmed_assignments) < trip.capacity:
            missing = trip.capacity - len(confirmed_assignments)
            msg = f"התראת שיבוץ: לטיול ב-{trip.location} ב-{trip.start_date.strftime('%d/%m/%Y %H:%M')} חסרים {missing} עובדים משובצים (נדרשים {trip.capacity})!"
            if ADMIN_PHONE:
                NotificationService.send_sms(ADMIN_PHONE, msg, db=db)
        elif trip.capacity == 0 and len(confirmed_assignments) == 0:
            msg = f"התראת שיבוץ: לטיול ב-{trip.location} ב-{trip.start_date.strftime('%d/%m/%Y %H:%M')} אין עובדים משובצים!"
            if ADMIN_PHONE:
                NotificationService.send_sms(ADMIN_PHONE, msg, db=db)
            
def check_uninvoiced_trips():
    """
    Run at the end of the month to check for trips that ended in the current month,
    are not billed, and the client has no future trips scheduled for the month.
    """
    db: Session = next(get_db())
    now = datetime.now()
    # Find all trips in current month that are NOT billed
    start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    if now.month == 12:
        end_of_month = now.replace(year=now.year + 1, month=1, day=1) - timedelta(seconds=1)
    else:
        end_of_month = now.replace(month=now.month + 1, day=1) - timedelta(seconds=1)
        
    unbilled_trips = db.query(Trip).filter(
        Trip.end_date >= start_of_month,
        Trip.end_date <= end_of_month,
        Trip.is_billed == False
    ).all()
    
    # Group by client
    unbilled_by_client = {}
    for t in unbilled_trips:
        if t.client_id:
            unbilled_by_client.setdefault(t.client_id, []).append(t)
            
    # For each client, check if they have future trips THIS month
    for client_id, trips in unbilled_by_client.items():
        client = trips[0].client
        if not client or client.name == 'לקוח כללי':
            continue
            
        future_trips = db.query(Trip).filter(
            Trip.client_id == client_id,
            Trip.start_date > now,
            Trip.start_date <= end_of_month
        ).count()
        
        if future_trips == 0:
            msg = f"התראת חשבונית: ללקוח '{client.name}' יש {len(trips)} טיולים שהסתיימו החודש ללא חשבונית, ואין טיולים נוספים שנותרו לו החודש. כדאי להפיק חשבונית!"
            NotificationService.create_in_app_notification(msg, db, title="התראת מערכת")
            billing_phone = "".join(filter(str.isdigit, os.getenv("BILLING_ADMIN_PHONE", "")))
            if billing_phone:
                billing_admin = db.query(User).filter(User.phone.like(f"%{billing_phone}%")).first()
                if billing_admin:
                    from app.services.push_service import send_push_notification
                    send_push_notification(db, billing_admin.id, "התראה להפקת חשבוניות", msg, url="/admin/reports")

def delete_old_receipts():
    """
    Deletes receipt images older than 90 days from both DB and Cloudinary to save space/privacy.
    """
    logger.info("Running delete_old_receipts task...")
    db: Session = next(get_db())
    now = datetime.now()
    threshold = now - timedelta(days=90)
    
    # Find old reports with receipts
    old_reports = db.query(TripReport).filter(
        TripReport.start_time < threshold,
        TripReport.receipt_url.isnot(None),
        TripReport.receipt_url != ""
    ).all()
    
    deleted_count = 0
    for report in old_reports:
        # Delegate deletion to StorageService (handles Cloudinary + logging)
        if report.receipt_url:
            StorageService.delete_file(report.receipt_url)
        
        # Clear the URL regardless of storage backend
        report.receipt_url = None
        deleted_count += 1
        
    db.commit()
    logger.info(f"Deleted {deleted_count} old receipts.")

def delete_old_business_expenses():
    """
    Deletes business expenses based on their assigned folder (expense_month and expense_year).
    Runs on the 15th of each month, deleting folders older than 2 months.
    (e.g., on Oct 15th, deletes all expenses in the August folder and older).
    """
    logger.info("Running delete_old_business_expenses task...")
    
    # Check if today is the 15th
    now = datetime.now()
    if now.day != 15:
        logger.info("Not the 15th of the month. Skipping delete_old_business_expenses.")
        return
        
    db: Session = next(get_db())
    now = datetime.now()
    
    # Calculate the cutoff month/year (2 months ago)
    cutoff_month = now.month - 2
    cutoff_year = now.year
    if cutoff_month <= 0:
        cutoff_month += 12
        cutoff_year -= 1
        
    old_expenses = db.query(BusinessExpense).filter(
        (BusinessExpense.expense_year < cutoff_year) |
        ((BusinessExpense.expense_year == cutoff_year) & (BusinessExpense.expense_month <= cutoff_month))
    ).all()
    
    deleted_count = 0
    for exp in old_expenses:
        if exp.file_url:
            StorageService.delete_file(exp.file_url)
        db.delete(exp)
        deleted_count += 1
        
    db.commit()
    logger.info(f"Deleted {deleted_count} old business expenses.")


def check_ended_trips_for_reports():
    """
    Check for trips that ended recently (within the last 3 days).
    - Short trips (<8h): auto-generate an approved report (no SMS sent).
    - Long trips (>=8h): send an SMS reminder to the employee to submit their report.
    """
    logger.info("Running check_ended_trips_for_reports task...")
    db: Session = SessionLocal()
    try:
        now = datetime.now()
        three_days_ago = now - timedelta(days=3)

        # Eagerly load assignments, their users and reports to avoid N+1 queries
        recent_trips = db.query(Trip).options(
            joinedload(Trip.assignments).joinedload(TripAssignment.user),
            joinedload(Trip.assignments).joinedload(TripAssignment.report)
        ).filter(Trip.start_date >= three_days_ago).all()

        for trip in recent_trips:
            end_dt = trip.end_date or trip.start_date
            if end_dt and hasattr(end_dt, 'tzinfo') and end_dt.tzinfo is not None:
                end_dt = end_dt.replace(tzinfo=None)

            # Skip trips that haven't ended yet
            if not (end_dt and end_dt <= now):
                continue

            start_dt = trip.start_date
            if start_dt and hasattr(start_dt, 'tzinfo') and start_dt.tzinfo is not None:
                start_dt = start_dt.replace(tzinfo=None)

            duration_hours = (end_dt - start_dt).total_seconds() / 3600.0 if start_dt and end_dt else 0

            if duration_hours < 8:
                # Short trip: auto-create an approved report for 8.6 hours (full daily rate)
                for assignment in trip.assignments:
                    if assignment.is_confirmed and assignment.status == "assigned" and not assignment.report:
                        new_report = TripReport(
                            assignment_id=assignment.id,
                            start_time=start_dt,
                            end_time=start_dt + timedelta(hours=8.6),
                            overtime_decimal=0.0,
                            expenses=0.0,
                            expenses_notes="דיווח נוצר אוטומטית (יום קצר)",
                            sleeps=0,
                            is_draft=False,
                            manager_status="approved",
                            billing_status="not_billed"
                        )
                        db.add(new_report)
                db.commit()
                continue

            # Long trip: send SMS reminder to fill in the report
            for assignment in trip.assignments:
                if assignment.is_confirmed and assignment.status == "assigned" and not assignment.report:
                    if assignment.user and assignment.user.phone:
                        msg = (
                            f"היי {assignment.user.full_name}, הטיול ב-{trip.location} הסתיים. "
                            f"אנא היכנס לאזור האישי למלא דוח. "
                            f"שים לב: דיווח שלא ימולא עד מחר יחושב כשכר בסיס בלבד!"
                        )
                        existing_notif = db.query(Notification).filter(
                            Notification.user_id == assignment.user_id,
                            Notification.message == msg
                        ).first()
                        if not existing_notif:
                            NotificationService.send_sms(
                                phone_number=assignment.user.phone,
                                message=msg,
                                db=db,
                                user_id=assignment.user_id
                            )
    except Exception as e:
        logger.error(f"check_ended_trips_for_reports failed: {e}")
        db.rollback()
    finally:
        db.close()

def cleanup_expired_tokens():
    """
    Delete expired refresh tokens from the database.
    Runs nightly.
    """
    logger.info("Running cleanup_expired_tokens task...")
    db: Session = SessionLocal()
    try:
        now = datetime.now()
        deleted = db.query(RefreshToken).filter(RefreshToken.expires_at < now).delete()
        if deleted > 0:
            db.commit()
            logger.info(f"Deleted {deleted} expired refresh tokens.")
    finally:
        db.close()

def check_upcoming_trips_for_confirmation():
    """
    Check for trips happening tomorrow and send an SMS with a deep link to employees
    who are assigned and confirmed, so they can acknowledge their arrival.
    Runs daily.
    """
    logger.info("Running check_upcoming_trips_for_confirmation task...")
    db: Session = SessionLocal()
    try:
        now = datetime.now()
        tomorrow = now + timedelta(days=1)
        tomorrow_start = tomorrow.replace(hour=0, minute=0, second=0, microsecond=0)
        tomorrow_end = tomorrow.replace(hour=23, minute=59, second=59, microsecond=999999)
        
        upcoming_trips = db.query(Trip).filter(
            Trip.start_date >= tomorrow_start,
            Trip.start_date <= tomorrow_end
        ).all()
        
        frontend_url = os.getenv("FRONTEND_URL", "https://yahav-hatzala.co.il")
        
        for trip in upcoming_trips:
            for assignment in trip.assignments:
                if assignment.status == "assigned" and assignment.is_confirmed:
                    user = assignment.user
                    if user and user.phone:
                        # Construct a generic link to their schedule page where they can see the trip
                        schedule_link = f"{frontend_url}/employee/schedule"
                        msg = f"תזכורת שיבוץ: מחר יש לך טיול ב-{trip.location}. אנא היכנס/י לקישור הבא כדי לאשר הגעה סופית: {schedule_link}"
                        
                        # Prevent duplicate SMS on the same day for the same assignment
                        existing_notif = db.query(Notification).filter(
                            Notification.message == msg,
                            Notification.user_id == user.id,
                            Notification.created_at >= now.replace(hour=0, minute=0, second=0)
                        ).first()
                        
                        if not existing_notif:
                            NotificationService.send_sms(user.phone, msg)
                            NotificationService.create_in_app_notification(
                                message=msg,
                                db=db,
                                user_id=assignment.user_id
                            )
    finally:
        db.close()

def notify_admin_unconfirmed_arrivals():
    """
    Check for trips tomorrow where employees have not confirmed arrival, and notify the admin.
    Runs at 16:00.
    """
    logger.info("Running notify_admin_unconfirmed_arrivals task...")
    db: Session = SessionLocal()
    try:
        now = datetime.now()
        tomorrow = now + timedelta(days=1)
        tomorrow_start = tomorrow.replace(hour=0, minute=0, second=0, microsecond=0)
        tomorrow_end = tomorrow.replace(hour=23, minute=59, second=59, microsecond=999999)
        
        upcoming_trips = db.query(Trip).filter(
            Trip.start_date >= tomorrow_start,
            Trip.start_date <= tomorrow_end
        ).all()
        
        admin_phone = os.getenv("ADMIN_PHONE")
        
        for trip in upcoming_trips:
            for assignment in trip.assignments:
                if assignment.is_confirmed and assignment.status == "assigned" and not assignment.employee_confirmed_arrival:
                    user = assignment.user
                    if user:
                        msg = f"התראת אישור הגעה: העובד/ת {user.full_name} טרם אישר/ה הגעה לטיול מחר ב-{trip.location}!"
                        
                        # Prevent spam
                        existing_notif = db.query(Notification).filter(
                            Notification.message == msg
                        ).first()
                        
                        if not existing_notif:
                            NotificationService.create_in_app_notification(msg, db)
                            if admin_phone:
                                NotificationService.send_sms(admin_phone, msg)
    finally:
        db.close()

def check_unpaid_suppliers():
    """
    Check for suppliers who have not been paid yet (is_invoiced == False).
    Runs on the last day of the month at 10:00 AM.
    """
    logger.info("Running check_unpaid_suppliers task...")
    db: Session = SessionLocal()
    try:
        unpaid_suppliers = db.query(Supplier).filter(Supplier.is_invoiced == False).all()
        
        if not unpaid_suppliers:
            return
            
        supplier_names = ", ".join(list(set(s.name for s in unpaid_suppliers)))
        msg = f"תזכורת סוף חודש: קיימים ספקים במערכת שטרם שולמו: {supplier_names}."
        
        admin_phone = "".join(filter(str.isdigit, os.getenv("ADMIN_PHONE", "")))
        if admin_phone:
            admin_user = db.query(User).filter(User.phone.like(f"%{admin_phone}%")).first()
            if admin_user:
                from app.services.push_service import send_push_notification
                send_push_notification(db, admin_user.id, "תזכורת ספקים", msg, url="/admin/suppliers")
    except Exception as e:
        logger.error(f"check_unpaid_suppliers failed: {e}")
    finally:
        db.close()

def start_scheduler():
    scheduler = BackgroundScheduler()
    
    # Schedule checks
    scheduler.add_job(check_client_debts, 'cron', hour=9, minute=0)
    scheduler.add_job(check_unassigned_trips, 'cron', hour=9, minute=30)
    scheduler.add_job(check_uninvoiced_trips, 'cron', day='last', hour=17, minute=0)
    # Check ended trips every hour
    scheduler.add_job(check_ended_trips_for_reports, 'cron', minute=0)
    # Run deletion tasks every night at 3 AM
    scheduler.add_job(delete_old_receipts, 'cron', hour=3, minute=0)
    scheduler.add_job(cleanup_expired_tokens, 'cron', hour=3, minute=30)
    # Run business expenses cleanup on the 15th of every month at 4 AM
    scheduler.add_job(delete_old_business_expenses, 'cron', day=15, hour=4, minute=0)
    
    # Check for upcoming trips and request confirmation every day at 10:00
    scheduler.add_job(check_upcoming_trips_for_confirmation, 'cron', hour=10, minute=0)
    
    # Alert admin about unconfirmed arrivals every day at 16:00
    scheduler.add_job(notify_admin_unconfirmed_arrivals, 'cron', hour=16, minute=0)
    
    # Notify admin about unpaid suppliers on the last day of the month at 10:00
    scheduler.add_job(check_unpaid_suppliers, 'cron', day='last', hour=10, minute=0)
    
    scheduler.start()
    logger.info("APScheduler started successfully.")
