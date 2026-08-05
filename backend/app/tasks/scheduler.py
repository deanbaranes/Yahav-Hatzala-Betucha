import logging
from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime, timedelta
import re
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.client import Client
from app.models.trip import Trip
from app.services.notification_service import NotificationService
import os
import cloudinary
import cloudinary.uploader
from app.models.trip_report import TripReport

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
            NotificationService.send_sms(ADMIN_PHONE, msg, db=db)
            
            # Reset or clear debt start date to avoid spamming everyday? 
            # (We will just alert for now, in a real system we'd log the alert)
    
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
            NotificationService.send_sms(ADMIN_PHONE, msg, db=db)

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
        url = report.receipt_url
        if "cloudinary.com" in url:
            # Extract public_id from url. 
            # typical url: https://res.cloudinary.com/cloud_name/image/upload/v1234567/yahav_receipts/filename.ext
            try:
                parts = url.split("/upload/")
                if len(parts) == 2:
                    # remove version (e.g. v1234567/) and extension
                    path_parts = parts[1].split("/")
                    if path_parts[0].startswith("v"):
                        path_parts = path_parts[1:]
                    
                    full_path = "/".join(path_parts)
                    public_id = full_path.rsplit(".", 1)[0]
                    
                    if os.getenv("CLOUDINARY_CLOUD_NAME"):
                        cloudinary.uploader.destroy(public_id)
            except Exception as e:
                logger.error(f"Failed to delete {url} from Cloudinary: {str(e)}")
        
        # Whether it's cloudinary or local, we clear the URL after 90 days
        report.receipt_url = None
        deleted_count += 1
        
    db.commit()
    logger.info(f"Deleted {deleted_count} old receipts.")

def start_scheduler():
    scheduler = BackgroundScheduler()
    
    # Schedule checks
    scheduler.add_job(check_client_debts, 'cron', hour=9, minute=0)
    scheduler.add_job(check_unassigned_trips, 'cron', hour=9, minute=30)
    scheduler.add_job(check_uninvoiced_trips, 'cron', day='last', hour=17, minute=0)
    # Run deletion task every night at 3 AM
    scheduler.add_job(delete_old_receipts, 'cron', hour=3, minute=0)
    
    scheduler.start()
    logger.info("APScheduler started successfully.")
