import os
import sys
import time
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv

load_dotenv()
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal
from app.models.trip import Trip
from app.models.notification import Notification
from app.services.notification_service import NotificationService

def trigger_1700_sms():
    print(f"[{datetime.now()}] Triggering 17:00 unconfirmed SMS via wait_1700 script...")
    db = SessionLocal()
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
        unconfirmed_details = []
        
        for trip in upcoming_trips:
            for assignment in trip.assignments:
                if assignment.is_confirmed and assignment.status == "assigned" and not assignment.employee_confirmed_arrival:
                    user = assignment.user
                    if user and user.role != 'admin':
                        base_trip_name = trip.location if trip.location else trip.trip_name
                        unconfirmed_details.append(f"{user.full_name} ({base_trip_name})")

        if unconfirmed_details:
            count = len(unconfirmed_details)
            details_str = ", ".join(unconfirmed_details)
            msg = f"התראת משמרות מחר ({tomorrow.strftime('%d/%m')}): {count} עובדים טרם אישרו הגעה ({details_str}). נא להיכנס לאפליקציה לבדיקה!"
            
            print(f"Prepared Message: {msg}")
            
            today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
            existing_notif = db.query(Notification).filter(
                Notification.message == msg,
                Notification.created_at >= today_start
            ).first()
            
            if not existing_notif:
                NotificationService.create_in_app_notification(msg, db)
                if admin_phone:
                    print(f"Sending via GlobalSMS to {admin_phone}...")
                    NotificationService.send_sms(admin_phone, msg)
                    print("SMS Sent!")
            else:
                print("Already sent today based on anti-spam check.")
        else:
            print("No unconfirmed workers found!")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()
    
    print("wait_1700 sequence finished.")

def main():
    print(f"[{datetime.now()}] Current Local Time: Waiting for 14:00:00 UTC (17:00 IDT)...")
    while True:
        now_utc = datetime.now(timezone.utc)
        print(f"[{now_utc.strftime('%H:%M:%S')} UTC] Waiting for 14:00 UTC (17:00 IDT).")
        
        # 14:00 UTC = 17:00 IDT (during Israel daylight savings time)
        if now_utc.hour == 14 and now_utc.minute == 0:
            print("\n!!! Time reached! Executing !!!")
            trigger_1700_sms()
            break
        elif now_utc.hour > 14 or (now_utc.hour == 14 and now_utc.minute > 0):
            print("\nIt is already past 17:00 IDT! Sending immediately.")
            trigger_1700_sms()
            break

        time.sleep(10)

if __name__ == '__main__':
    main()
