import os
from dotenv import load_dotenv
import psycopg2

load_dotenv()
DATABASE_URL = os.environ.get("DATABASE_URL")
conn = psycopg2.connect(DATABASE_URL)
conn.autocommit = True
try:
    with conn.cursor() as cur:
        # Kill idle connections
        cur.execute("""
            SELECT pg_terminate_backend(pid)
            FROM pg_stat_activity
            WHERE datname = current_database()
              AND pid <> pg_backend_pid()
              AND state IN ('idle', 'idle in transaction', 'idle in transaction (aborted)', 'disabled')
        """)
        
        # Create table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS push_subscriptions (
                id UUID PRIMARY KEY,
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                endpoint VARCHAR NOT NULL UNIQUE,
                p256dh VARCHAR NOT NULL,
                auth VARCHAR NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS ix_push_subscriptions_user_id ON push_subscriptions(user_id);
        """)
    print("Migration done.")
except Exception as e:
    print(f"Error: {e}")
