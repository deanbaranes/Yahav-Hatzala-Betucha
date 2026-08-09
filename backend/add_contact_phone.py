import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()
db_url = os.getenv("DATABASE_URL")

try:
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    cur.execute("ALTER TABLE trips ADD COLUMN IF NOT EXISTS contact_phone VARCHAR;")
    conn.commit()
    print("Successfully added contact_phone column to trips table.")
    cur.close()
    conn.close()
except Exception as e:
    print(f"Error: {e}")
