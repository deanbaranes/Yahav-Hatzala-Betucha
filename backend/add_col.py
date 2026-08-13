from dotenv import load_dotenv
load_dotenv()
import sys
from app.database import engine
from sqlalchemy import text

try:
    with engine.connect() as conn:
        conn.execute(text('ALTER TABLE trip_assignments ADD COLUMN employee_confirmed_arrival BOOLEAN DEFAULT FALSE;'))
        conn.commit()
    print("Success")
except Exception as e:
    print("Error:", e)
