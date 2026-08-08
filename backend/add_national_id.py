import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()
db_url = os.getenv("DATABASE_URL")

try:
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS national_id VARCHAR(9) UNIQUE;")
    conn.commit()
    print("Successfully added national_id column to users table.")
    cur.close()
    conn.close()
except Exception as e:
    print(f"Error: {e}")
