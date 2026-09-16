import os
import sys
import logging
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from dotenv import load_dotenv

load_dotenv()
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.trip import Trip
from app.models.trip_assignment import TripAssignment
from app.models.trip_report import TripReport
from app.models.notification import Notification

try:
    engine = create_engine(os.getenv("DATABASE_URL"))
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()

    import datetime
    now = datetime.datetime.now()
    three_days_ago = now - datetime.timedelta(days=3)

    print(f"Current Now: {now}")
    print(f"Three Days Ago Criteria: {three_days_ago}")

    print("--- DEBUGGING MOR'S TRIP ---")
    trip = db.query(Trip).filter(Trip.id == '77142743-c8b1-499b-8264-bfac8df25c4d').first()
    if not trip:
        print("Trip not found.")
        sys.exit()

    end_dt = trip.end_date or trip.start_date
    if end_dt and hasattr(end_dt, 'tzinfo') and end_dt.tzinfo is not None:
        end_dt = end_dt.replace(tzinfo=None)
    
    start_dt = trip.start_date
    if start_dt and hasattr(start_dt, 'tzinfo') and start_dt.tzinfo is not None:
        start_dt = start_dt.replace(tzinfo=None)

    print(f"TRIP DATES DB: Start={start_dt}, End={end_dt}")
    print(f"Passes 'filter(Trip.start_date >= three_days_ago)'? : {trip.start_date >= three_days_ago}")
    print(f"Fail: 'end_dt <= now'? Evaluates to: {end_dt and end_dt <= now}")

    duration_hours = (end_dt - start_dt).total_seconds() / 3600.0 if start_dt and end_dt else 0
    print(f"Duration calculation: {duration_hours} hours")

    assignment = db.query(TripAssignment).filter(TripAssignment.id == 'cbab25fa-d6e1-4522-b025-cf080fb47f81').first()

    print(f"Assignment status: {assignment.status}, Confirmed: {assignment.is_confirmed}")
    report = db.query(TripReport).filter(TripReport.assignment_id == assignment.id).first()
    print(f"Has report? {report}")

    if assignment.user and assignment.user.phone:
        print(f"User: {assignment.user.full_name}, Phone: {assignment.user.phone}")
        from dateutil import tz
        il_tz = tz.gettz('Asia/Jerusalem')
        il_hour = datetime.datetime.now(il_tz).hour if il_tz else datetime.datetime.now().hour
        print(f"Current IL Hour inside logic: {il_hour}")
        if 22 <= il_hour or il_hour < 8:
            print("BLOCKED BY HOUR CHECK!")
        else:
            print("HOUR CHECK PASSED")
            
            msg = (
                f"היי {assignment.user.full_name}, המשמרת: {trip.location} הסתיימה. "
                f"אנא היכנס לאזור האישי למלא דוח. "
                f"שים לב: דיווח שלא ימולא עד מחר יחושב כשכר בסיס בלבד!"
            )
            print("Generated MSG Length:", len(msg))
            print(f"Msg Preview: {msg[:60]}...")
            
            existing_notif = db.query(Notification).filter(
                Notification.user_id == assignment.user_id,
                Notification.message == msg
            ).first()
            if existing_notif:
                print("ABORTED: Message is already in DB! Sent at:", existing_notif.created_at)
            else:
                print("Message NOT IN DB! The application SHOULD have sent SMS.")

except Exception as e:
    print("ERROR IN DEBUG:", e)
