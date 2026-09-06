import os
import sys
from dotenv import load_dotenv

sys.path.append(os.path.abspath(os.path.dirname(__file__)))
load_dotenv()

from app.database import SessionLocal
from app.models.user import User

def check_users():
    db = SessionLocal()
    # Fetch all users
    all_users = db.query(User).all()
    
    if not all_users:
        print("No users found.")
        return

    print("--- Last Users (Not guaranteed order since no created_at, but usually the newest) ---")
    for u in all_users[-5:]:
        print(f"- {u.full_name} | {u.phone} | status: {u.status.value} | role: {u.role.value}")

    pending = [u for u in all_users if u.status.value == "pending"]
    if pending:
        print("\n--- Users Waiting for Approval ---")
        for u in pending:
            print(f"- {u.full_name} | {u.phone}")
    else:
        print("\nNo pending users waiting for approval.")

if __name__ == "__main__":
    check_users()
