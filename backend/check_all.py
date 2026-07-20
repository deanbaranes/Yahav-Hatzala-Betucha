import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from app.database import SessionLocal

def main():
    db = SessionLocal()
    try:
        res = db.execute(text("SELECT id, start_time, daily_shifts, receipt_url FROM trip_reports;"))
        rows = [dict(r._mapping) for r in res]
        print(f"Total reports: {len(rows)}")
        for r in rows:
            if r['daily_shifts'] is not None:
                print("FOUND ONE:", r)
    except Exception as e:
        print(f"error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    main()
