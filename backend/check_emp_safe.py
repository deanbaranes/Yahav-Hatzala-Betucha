import os
from dotenv import load_dotenv
load_dotenv()

from app.database import SessionLocal
from app.models.trip import Trip
from datetime import datetime, timedelta

def main():
    db = SessionLocal()
    try:
        ts = (datetime.now() + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        te = ts.replace(hour=23, minute=59, second=59, microsecond=999999)
        trips = db.query(Trip).filter(Trip.start_date >= ts, Trip.start_date <= te).all()
        
        unconf = []
        for t in trips:
            for a in t.assignments:
                if a.is_confirmed and a.status == 'assigned' and not a.employee_confirmed_arrival:
                    if a.user and a.user.role != 'admin':
                        unconf.append(f"- {a.user.full_name} ({t.location})")
        
        unconf = set(unconf)
        print("\n=== עובדים שטרם אישרו הגעה למחר ===\n")
        print("\n".join(unconf) if unconf else "אין עובדים חסרים!")
        print("\n===================================\n")
    finally:
        db.close()

if __name__ == "__main__":
    main()
