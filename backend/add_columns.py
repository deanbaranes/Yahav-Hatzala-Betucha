import os
import sys

# Ensure backend dir is in path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from app.database import SessionLocal

def main():
    db = SessionLocal()
    try:
        print("Adding expenses_notes column...")
        db.execute(text("ALTER TABLE trip_reports ADD COLUMN expenses_notes VARCHAR;"))
        db.commit()
        print("Added expenses_notes.")
    except Exception as e:
        print(f"expenses_notes might already exist or error: {e}")
        db.rollback()

    try:
        print("Adding sleeps column...")
        db.execute(text("ALTER TABLE trip_reports ADD COLUMN sleeps INTEGER DEFAULT 0;"))
        db.commit()
        print("Added sleeps.")
    except Exception as e:
        print(f"sleeps might already exist or error: {e}")
        db.rollback()
        
    db.close()
    print("Done!")

if __name__ == "__main__":
    main()
