import os
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from dotenv import load_dotenv

load_dotenv()
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.trip import Trip

try:
    engine = create_engine(os.getenv("DATABASE_URL"))
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()

    target_trip = db.query(Trip).filter(Trip.id == '77142743-c8b1-499b-8264-bfac8df25c4d').first()
    if target_trip:
        print(f"TRIP ID: {target_trip.id}")
        print(f"Location: {target_trip.location}")
        print(f"Start: {target_trip.start_date} | End: {target_trip.end_date}")
        duration = (target_trip.end_date - target_trip.start_date).total_seconds() / 3600.0 if target_trip.end_date else 0
        print(f"Calculated Duration: {duration} hours")
    else:
        print("Trip not found in DB.")

except Exception as e:
    print("ERROR:", e)
