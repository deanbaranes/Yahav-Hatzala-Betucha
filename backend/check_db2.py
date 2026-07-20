import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from app.database import SessionLocal

def main():
    db = SessionLocal()
    try:
        # Check raw string value
        res = db.execute(text("SELECT id, CAST(daily_shifts AS TEXT) as ds_text FROM trip_reports;"))
        rows = [dict(r._mapping) for r in res]
        for r in rows:
            print(r)
    except Exception as e:
        print(f"error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    main()
