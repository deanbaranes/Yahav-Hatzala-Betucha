import os
from sqlalchemy import create_engine
from sqlalchemy.sql import text

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    from dotenv import load_dotenv
    load_dotenv(dotenv_path=".env")
    DATABASE_URL = os.environ.get("DATABASE_URL")

engine = create_engine(DATABASE_URL)
with engine.begin() as conn:
    try:
        conn.execute(text("ALTER TABLE suppliers ADD COLUMN includes_vat BOOLEAN DEFAULT TRUE NOT NULL;"))
        print("Added includes_vat")
    except Exception as e:
        print(f"Error adding includes_vat: {e}")
