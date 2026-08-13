import sys
import os
import re

# Add backend dir to python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))


from app.database import engine, SessionLocal
from app.models.client import Client
from sqlalchemy import text, inspect

def parse_balance(bal_str):
    if not bal_str: return 0.0
    cleaned = str(bal_str).replace(',', '')
    match = re.search(r'-?\d+(\.\d+)?', cleaned)
    if not match: return 0.0
    return float(match.group())

def migrate():
    print("Starting client balance migration...")
    
    # 1. Add column if it doesn't exist
    inspector = inspect(engine)
    existing_cols = {col['name'] for col in inspector.get_columns('clients')}
    
    if 'numeric_balance' not in existing_cols:
        print("Adding 'numeric_balance' column...")
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE clients ADD COLUMN numeric_balance NUMERIC(12, 2) DEFAULT 0.0 NOT NULL"))
        print("Column added.")
    else:
        print("'numeric_balance' column already exists.")

    # 2. Populate data
    print("Populating numeric_balance from balance string...")
    with SessionLocal() as db:
        clients = db.query(Client).all()
        updated_count = 0
        for c in clients:
            parsed_val = parse_balance(c.balance)
            if float(c.numeric_balance or 0) != parsed_val:
                c.numeric_balance = parsed_val
                updated_count += 1
        db.commit()
        print(f"Migration complete. Updated {updated_count} client records.")

if __name__ == "__main__":
    migrate()
