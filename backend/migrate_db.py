import os
from dotenv import load_dotenv
import psycopg2

load_dotenv()
DATABASE_URL = os.environ.get("DATABASE_URL")
conn = psycopg2.connect(DATABASE_URL)
conn.autocommit = True
try:
    with conn.cursor() as cur:
        # Kill idle queries that might be blocking the lock
        cur.execute("""
            SELECT pg_terminate_backend(pid)
            FROM pg_stat_activity
            WHERE datname = current_database()
              AND pid <> pg_backend_pid()
              AND state IN ('idle', 'idle in transaction', 'idle in transaction (aborted)', 'disabled')
        """)
        print("Terminated idle connections.")
        cur.execute("ALTER TABLE trips ADD COLUMN IF NOT EXISTS trip_name VARCHAR;")
    print("Migration done via psycopg2.")
except Exception as e:
    print(f"Error: {e}")
