import os
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from dotenv import load_dotenv

load_dotenv()
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.user import User
from app.models.trip import Trip
from app.models.trip_assignment import TripAssignment
from app.models.trip_report import TripReport
from app.models.notification import Notification

try:
    engine = create_engine(os.getenv("DATABASE_URL"))
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()

    print("--- MOR'S USER ---")
    users = db.query(User).filter(User.full_name.like('%מור%')).all()
    for u in users:
        print(f"ID: {u.id} | Name: {u.full_name} | Phone: {u.phone}")

    if not users:
        print("No user found")
        sys.exit(0)

    user_id = users[0].id

    print("\n--- TRIPS ---")
    trips = db.query(Trip).filter((Trip.location.like('%זומר%')) | (Trip.location.like('%רמת גן%'))).order_by(Trip.start_date.desc()).limit(3).all()
    for t in trips:
        print(f"ID: {t.id} | Loc: {t.location} | Start: {t.start_date} | End: {t.end_date}")

    print("\n--- RECENT NOTIFICATIONS FOR MOR ---")
    notifs = db.query(Notification).filter(Notification.user_id == user_id).order_by(Notification.created_at.desc()).limit(8).all()
    for n in notifs:
        print(f"[{n.created_at}] - {n.message}")

    print("\n--- ASSIGNMENTS FOR MOR ---")
    assignments = db.query(TripAssignment).filter(TripAssignment.user_id == user_id).order_by(TripAssignment.id.desc()).limit(3).all()
    for a in assignments:
        print(f"Assignment ID: {a.id} (Trip ID: {a.trip_id}) | Status: {a.status} | Confirmed: {a.is_confirmed}")
        reports = db.query(TripReport).filter(TripReport.assignment_id == a.id).all()
        for r in reports:
            print(f"   -> Report ID: {r.id} | Status: {r.manager_status}")
        if not reports:
            print("   -> NO REPORT FOUND")

except Exception as e:
    print("ERROR:", e)
