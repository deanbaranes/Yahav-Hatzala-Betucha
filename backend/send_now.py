import os
from dotenv import load_dotenv
load_dotenv()

from app.database import SessionLocal
from app.models.trip import Trip
from datetime import datetime, timedelta
from app.services.notification_service import NotificationService

def main():
    db = SessionLocal()
    try:
        now = datetime.now()
        tomorrow = now + timedelta(days=1)
        ts = tomorrow.replace(hour=0, minute=0, second=0, microsecond=0)
        te = tomorrow.replace(hour=23, minute=59, second=59, microsecond=999999)
        
        trips = db.query(Trip).filter(Trip.start_date >= ts, Trip.start_date <= te).all()
        
        frontend_url = os.getenv("FRONTEND_URL", "https://yahav-hatzala-betucha.vercel.app")
        admin_phone = os.getenv("ADMIN_PHONE")
        
        unconfirmed = []
        for trip in trips:
            for assignment in trip.assignments:
                if assignment.is_confirmed and assignment.status == "assigned" and not assignment.employee_confirmed_arrival:
                    user = assignment.user
                    if user and user.role != 'admin':
                        unconfirmed.append(user.full_name)
                        
                        # 1. Send SMS to the employee
                        if user.phone:
                            schedule_link = f"{frontend_url}/employee/schedule"
                            contact_parts = []
                            if trip.employee_contact_name:
                                contact_parts.append(trip.employee_contact_name)
                            if trip.employee_contact_phone:
                                contact_parts.append(trip.employee_contact_phone)
                            contact_str = f" איש קשר: {' - '.join(contact_parts)}." if contact_parts else ""
                            msg = f"תזכורת שיבוץ למחר: {trip.location}.{contact_str} אנא היכנס/י לקישור לאישור הגעה סופית: {schedule_link}"
                            
                            print(f"Sending employee SMS to {user.full_name} ({user.phone})...")
                            NotificationService.send_sms(str(user.phone), msg, db=db, user_id=str(user.id))
        
        # 2. Send SMS to Yahav
        if unconfirmed and admin_phone:
            count = len(unconfirmed)
            details_str = ", ".join(unconfirmed)
            admin_msg = f"התראת משמרות מחר ({tomorrow.strftime('%d/%m')}): {count} עובדים טרם אישרו הגעה ({details_str}). נא להיכנס לאפליקציה לבדיקה!"
            print(f"Sending admin SMS to Yahav ({admin_phone})...")
            NotificationService.send_sms(admin_phone, admin_msg)
            print("Both notifications successfully dispatched!")
            
    finally:
        db.close()

if __name__ == "__main__":
    main()
