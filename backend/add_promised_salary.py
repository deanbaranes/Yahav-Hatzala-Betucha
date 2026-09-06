import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()
DATABASE_URL = os.environ.get("DATABASE_URL")
if DATABASE_URL:
    engine = create_engine(DATABASE_URL)
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE trip_assignments ADD COLUMN IF NOT EXISTS promised_salary NUMERIC(10, 2);"))
    print("Column added successfully.")
else:
    print("No database url")
