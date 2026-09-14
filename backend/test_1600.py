from app.database import SessionLocal
from datetime import datetime, timedelta
from app.models.trip import Trip

def check():
    db = SessionLocal()
    now = datetime.now()
    tomorrow = now + timedelta(days=1)
    tomorrow_start = tomorrow.replace(hour=0, minute=0, second=0, microsecond=0)
    tomorrow_end = tomorrow.replace(hour=23, minute=59, second=59, microsecond=999999)

    upcoming_trips = db.query(Trip).filter(
        Trip.start_date >= tomorrow_start,
        Trip.start_date <= tomorrow_end
    ).all()

    count = 0
    for trip in upcoming_trips:
        for assignment in trip.assignments:
            if assignment.is_confirmed and assignment.status == "assigned" and not assignment.employee_confirmed_arrival:
                user = assignment.user
                if user and user.role != 'admin':
                    print(f"Unconfirmed: {user.full_name}, Phone: {user.phone}")
                    count += 1
    print(f"Total unconfirmed: {count}")
    db.close()

if __name__ == '__main__':
    check()
