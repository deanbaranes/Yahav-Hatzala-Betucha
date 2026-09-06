import os
import sys
from dotenv import load_dotenv

# Set path for imports
sys.path.append(os.path.abspath(os.path.dirname(__file__)))
load_dotenv()

from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.user import User
from app.models.notification import Notification
from app.routers.notifications import get_user_notifications

def test_leak():
    db: Session = SessionLocal()
    
    admin_user = db.query(User).filter(User.role == 'admin').first()
    employee_user = db.query(User).filter(User.role == 'employee').first()
    
    if not admin_user or not employee_user:
        print("Need both an admin and an employee to test.")
        return

    print(f"--- משתמשי בדיקה ---")
    print(f"מנהל: {admin_user.full_name}")
    print(f"עובד שטח רגיל: {employee_user.full_name}\n")

    test_notif = Notification(
        title="SYSTEM_TEST_ALERT",
        message="הודעה סודית למנהלים בלבד - נתוני כספים",
        user_id=None
    )
    db.add(test_notif)
    db.commit()
    print("נוצרה כעת התראת מנהלים חדשה וכללית (ללא משתמש ספציפי).\n")

    admin_notifs = get_user_notifications(db=db, current_user=admin_user)
    admin_sees_secret = any(n['title'] == "SYSTEM_TEST_ALERT" for n in admin_notifs)
    print(f"האם המנהל קיבל את ההתראה? {'כן ✅' if admin_sees_secret else 'לא ❌'}")

    employee_notifs = get_user_notifications(db=db, current_user=employee_user)
    employee_sees_secret = any(n['title'] == "SYSTEM_TEST_ALERT" for n in employee_notifs)
    print(f"האם העובד הרגיל קיבל את ההתראה? {'כן ❌ (דליפת מידע!)' if employee_sees_secret else 'לא ✅ (מאובטח לחלוטין)'}")

    # Clean up
    db.delete(test_notif)
    db.commit()
    print("\nהבדיקה הסתיימה, ההתראה המזויפת נמחקה מהמערכת.")

if __name__ == "__main__":
    test_leak()
