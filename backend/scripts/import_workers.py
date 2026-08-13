import csv
from decimal import Decimal
import sys
import os

# Ensure backend directory is in path for imports
sys.path.append('/app')

from app.database import SessionLocal
from app.models.user import User
from app.auth import get_password_hash

csv_path = '/app/Workers.csv'

def main():
    if not os.path.exists(csv_path):
        print(f"Error: {csv_path} not found.")
        return

    db = SessionLocal()
    updated_count = 0
    created_count = 0
    
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            name = row.get('EmployeeName', '').strip()
            rate_str = row.get('HourlyRate', '').strip()
            emp_type = row.get('Type', '').strip()
            
            if emp_type != 'employee' or not name or not rate_str:
                continue
                
            rate = Decimal(rate_str)
            
            user = db.query(User).filter(User.full_name == name).first()
            if user:
                user.hourly_rate = rate
                updated_count += 1
                print(f"Updated: {name} -> {rate} ₪/h")
            else:
                new_user = User(
                    full_name=name,
                    phone=f"לא הוזן-{created_count}",
                    role="employee",
                    hourly_rate=rate,
                    base_daily_hours=Decimal('8.6'),
                    password_hash=get_password_hash("123456")
                )
                db.add(new_user)
                created_count += 1
                print(f"Created: {name} -> {rate} ₪/h")
                
    db.commit()
    db.close()
    
    print(f"\nDone! Updated {updated_count} existing employees. Created {created_count} new employees.")

if __name__ == "__main__":
    main()
