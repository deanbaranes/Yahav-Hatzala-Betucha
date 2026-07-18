import csv
import re
from datetime import datetime
from decimal import Decimal
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.user import User, UserRole
from app.models.trip import Trip
from app.models.trip_assignment import TripAssignment
from app.models.trip_report import TripReport
from app.models.payroll_adjustment import PayrollAdjustment

def parse_cell(text):
    if not text:
        return None
    text = str(text).strip()
    if not text:
        return None
    
    # Defaults
    role = "כללי"
    overtime = Decimal(0)
    adjustment = Decimal(0)

    # If it's Dean Baranes (numbers only mostly)
    if text.replace('.', '', 1).isdigit():
        return {"is_dean_wage": Decimal(text)}

    # Extract additional ILS (e.g., +50 ש"ח)
    money_match = re.search(r'\+(\d+)\s*ש"ח', text)
    if money_match:
        adjustment = Decimal(money_match.group(1))

    # Extract overtime (e.g., +3 נוספות)
    ot_match = re.search(r'\+(\d+)\s*נוספות', text)
    if ot_match:
        overtime = Decimal(ot_match.group(1))

    # Extract role
    if "חובש" in text:
        role = "חובש"
    elif "מער" in text:
        role = "מע\"ר"
    
    return {
        "role": role,
        "overtime": overtime,
        "adjustment": adjustment,
        "raw": text
    }

def run_import(file_path):
    db: Session = SessionLocal()
    
    with open(file_path, newline='', encoding='utf-8') as f:
        reader = csv.reader(f)
        headers = next(reader)
        
        # Identify names (columns from index 1 to 8 usually)
        names = [h.strip() for h in headers[1:] if h.strip() and h.strip() != "הערות"]
        user_map = {}
        
        # Create users if not exist
        for name in names:
            user = db.query(User).filter(User.full_name == name).first()
            if not user:
                user = User(
                    full_name=name,
                    phone=f"0500000{len(user_map)}", # dummy phone
                    password_hash="dummy",
                    role=UserRole.employee
                )
                db.add(user)
                db.commit()
                db.refresh(user)
            user_map[name] = user
            
        print(f"Users mapped: {user_map.keys()}")

        for row in reader:
            if not row or not row[0].strip() or row[0] == "הערות":
                continue
            
            date_str = row[0].strip()
            try:
                dt = datetime.strptime(date_str, "%Y-%m-%d")
            except ValueError:
                continue

            # Create a Trip for this day
            trip = db.query(Trip).filter(Trip.location == "פעילות מיובאת", Trip.start_date == dt).first()
            if not trip:
                # Need a client
                from app.models.client import Client
                client = db.query(Client).filter(Client.name == "לקוח כללי").first()
                if not client:
                    client = Client(name="לקוח כללי")
                    db.add(client)
                    db.commit()
                    db.refresh(client)
                
                trip = Trip(
                    client_id=client.id,
                    location="פעילות מיובאת",
                    start_date=dt,
                    end_date=dt.replace(hour=23, minute=59),
                    capacity=10,
                    is_billed=False
                )
                db.add(trip)
                db.commit()
                db.refresh(trip)

            for idx, name in enumerate(names):
                col_idx = idx + 1
                if col_idx >= len(row):
                    continue
                cell_val = row[col_idx]
                parsed = parse_cell(cell_val)
                
                if not parsed:
                    continue

                user = user_map[name]

                if "is_dean_wage" in parsed:
                    # Dean's wage addition
                    # For Dean, we'll just add it as a payroll adjustment "שכר יומי"
                    adj = PayrollAdjustment(
                        user_id=user.id,
                        month=dt.month,
                        year=dt.year,
                        type="שכר יומי",
                        amount=parsed["is_dean_wage"],
                        notes=f"שכר מיובא עבור {date_str}"
                    )
                    db.add(adj)
                    print(f"Added wage for Dean: {parsed['is_dean_wage']} on {date_str}")
                else:
                    # Regular employee assignment
                    assign = TripAssignment(
                        trip_id=trip.id,
                        user_id=user.id,
                        role=parsed["role"],
                        status="assigned",
                        is_confirmed=True
                    )
                    db.add(assign)
                    db.flush() # get assign id
                    
                    report = TripReport(
                        assignment_id=assign.id,
                        start_time=dt.replace(hour=8, minute=0),
                        end_time=dt.replace(hour=16, minute=36), # 8.6 hours base
                        overtime_decimal=parsed["overtime"],
                        expenses=0
                    )
                    db.add(report)
                    
                    if parsed["adjustment"] > 0:
                        adj = PayrollAdjustment(
                            user_id=user.id,
                            month=dt.month,
                            year=dt.year,
                            type="בונוס/שונות",
                            amount=parsed["adjustment"],
                            notes=f"בונוס מיובא {date_str}"
                        )
                        db.add(adj)
                    
                    print(f"Added shift for {name} on {date_str}: Role {parsed['role']}, OT {parsed['overtime']}, Adj {parsed['adjustment']}")

        db.commit()
        print("Import completed successfully.")

if __name__ == "__main__":
    import sys
    run_import("/app/salary.csv")
