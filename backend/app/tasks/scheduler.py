import logging
from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime, timedelta
import re
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.client import Client
from app.models.trip import Trip
from app.models.notification import Notification
from app.services.notification_service import NotificationService
from app.services.storage_service import StorageService
import os
from app.models.trip_report import TripReport
from app.models.business_expense import BusinessExpense
from app.models.refresh_token import RefreshToken

logger = logging.getLogger(__name__)

# Admin phone number to send alerts to
ADMIN_PHONE = os.environ.get("ADMIN_PHONE", "0533210777")

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
    
    # Clients with a debt_start_date where payment terms have passed
    clients = db.query(Client).filter(Client.debt_start_date.isnot(None)).all()
    now = datetime.now()
    
    for client in clients:
        # Simplistic parsing of payment terms: "שוטף + 30" -> 30, "שוטף + 60" -> 60
        # If no terms or unrecognized, default to 30
        days = 30
        if client.payment_terms:
            match = re.search(r'\d+', client.payment_terms)
            if match:
                days = int(match.group(0))
        
        # Calculate due date: end of the month of debt_start_date + days
        debt_start = client.debt_start_date
        # End of the month of debt_start
        if debt_start.month == 12:
            next_month = debt_start.replace(year=debt_start.year + 1, month=1, day=1)
        else:
            next_month = debt_start.replace(month=debt_start.month + 1, day=1)
        end_of_month = next_month - timedelta(days=1)
        
        due_date = end_of_month + timedelta(days=days)
        
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
        if len(confirmed_assignments) == 0:
            msg = f"התראת שיבוץ: לטיול ב-{trip.location} ב-{trip.start_date.strftime('%d/%m/%Y %H:%M')} אין עובדים משובצים!"
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
    for expense in old_expenses:
        if expense.file_url:
            StorageService.delete_file(expense.file_url)
        db.delete(expense)
        deleted_count += 1
        
    db.commit()
    logger.info(f"Deleted {deleted_count} old business expenses.")

def check_ended_trips_for_reports():
    """
    Check for trips that ended recently (within the last 3 days).
    For each confirmed assignment without a report, send an SMS and notification if not already sent.
    """
    logger.info("Running check_ended_trips_for_reports task...")
    db: Session = next(get_db())
    now = datetime.now()
    three_days_ago = now - timedelta(days=3)
    
    # Check trips from the last 3 days
    recent_trips = db.query(Trip).filter(Trip.start_date >= three_days_ago).all()
    
    for trip in recent_trips:
        end_dt = trip.end_date or trip.start_date
        if end_dt and hasattr(end_dt, 'tzinfo') and end_dt.tzinfo is not None:
            end_dt = end_dt.replace(tzinfo=None)
            
        # If trip has ended
        if end_dt and end_dt <= now:
            for assignment in trip.assignments:
                if assignment.is_confirmed and assignment.status == "assigned":
                    if not assignment.report:
                        if assignment.user and assignment.user.phone:
                            msg = f"היי {assignment.user.full_name}, הטיול ב-{trip.location} הסתיים. אנא היכנס לאזור האישי באפליקציה למלא דוח משמרת והוצאות."
                            
                            # Check if we already notified them
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

def cleanup_expired_tokens():
    """
    Deletes refresh tokens that have expired to keep the database clean.
    """
    logger.info("Running cleanup_expired_tokens task...")
    db: Session = next(get_db())
    now = datetime.now()
    
    expired_tokens = db.query(RefreshToken).filter(RefreshToken.expires_at < now).all()
    deleted_count = 0
    for token in expired_tokens:
        db.delete(token)
        deleted_count += 1
        
    db.commit()
    if deleted_count > 0:
        logger.info(f"Cleaned up {deleted_count} expired refresh tokens.")

def check_upcoming_trips_for_confirmation():
    """
    Check for trips in exactly 24-48 hours. Send an SMS to assigned employees asking them to confirm arrival.
    """
    logger.info("Running check_upcoming_trips_for_confirmation task...")
    db: Session = next(get_db())
    now = datetime.now()
    tomorrow = now + timedelta(days=1)
    tomorrow_start = tomorrow.replace(hour=0, minute=0, second=0, microsecond=0)
    tomorrow_end = tomorrow.replace(hour=23, minute=59, second=59, microsecond=999999)
    
    upcoming_trips = db.query(Trip).filter(
        Trip.start_date >= tomorrow_start,
        Trip.start_date <= tomorrow_end
    ).all()
    
    FRONTEND_URL = os.getenv("FRONTEND_URL", "https://yahav-hatzala-betucha.vercel.app")
    
    for trip in upcoming_trips:
        for assignment in trip.assignments:
            if assignment.is_confirmed and assignment.status == "assigned" and not assignment.employee_confirmed_arrival:
                if assignment.user and assignment.user.phone:
                    link = f"{FRONTEND_URL}/employee"
                    msg = f"תזכורת: מחר יש לך טיול ב-{trip.location}. אנא היכנס לאזור האישי באפליקציה כדי לאשר הגעה סופית: {link}"
                    
                    # Prevent spam
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
    
    # Check for upcoming trips and request confirmation every day at 16:00
    scheduler.add_job(check_upcoming_trips_for_confirmation, 'cron', hour=16, minute=0)
    
    scheduler.start()
    logger.info("APScheduler started successfully.")
