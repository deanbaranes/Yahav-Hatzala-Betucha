import os
import sys

# Ensure backend dir is in path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from app.database import SessionLocal

def main():
    db = SessionLocal()
    try:
        res = db.execute(text("SELECT id, daily_shifts, receipt_url FROM trip_reports ORDER BY start_time DESC LIMIT 5;"))
        rows = [dict(r._mapping) for r in res]
        print(rows)
    except Exception as e:
        print(f"error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    main()
