"""
סקריפט חד-פעמי: מסמן עובד כבעל שכר גלובלי ב-DB.
הרץ פעם אחת בלבד, ואז ניתן למחוק.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app.database import SessionLocal
from app.models.user import User

db = SessionLocal()

try:
    user = db.query(User).filter(User.full_name == "דין ברנס").first()
    if not user:
        print("❌ לא נמצא משתמש בשם 'דין ברנס'")
    else:
        user.is_global_salary = True
        db.commit()
        print(f"✅ עודכן בהצלחה: {user.full_name} — is_global_salary = True")
finally:
    db.close()
