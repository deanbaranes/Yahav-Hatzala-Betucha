import csv
from sqlalchemy import text
from app.database import SessionLocal, engine
from app.models.client import Client

# 1. Add columns to the table if they don't exist
# (Already executed in previous run)

# 2. Read CSV and insert clients
db = SessionLocal()
added_count = 0
skipped_count = 0

seen_names = set()

with open("clients.csv", mode="r", encoding="utf-8") as f:
    reader = csv.reader(f)
    headers = next(reader)
    
    for row in reader:
        if len(row) < 10:
            continue
            
        name = row[6].strip()
        if not name or name in seen_names:
            continue
            
        seen_names.add(name)
        email = row[7].strip()
        contact = row[8].strip()
        phone = row[9].strip()
        
        balance = row[10].strip() if len(row) > 10 else ""
        date_updated = row[11].strip() if len(row) > 11 else ""
        
        notes_parts = []
        if date_updated: notes_parts.append(f"תאריך עדכון: {date_updated}")
        for i in range(12, len(row)):
            if row[i].strip():
                notes_parts.append(row[i].strip())
        notes = " | ".join(notes_parts)
        
        # Check if exists in DB
        existing = db.query(Client).filter(Client.name == name).first()
        if existing:
            existing.email = email if email else existing.email
            existing.phone = phone if phone else existing.phone
            existing.contact_person = contact if contact else existing.contact_person
            existing.balance = balance
            existing.notes = notes
            skipped_count += 1
        else:
            new_client = Client(
                name=name,
                email=email,
                phone=phone,
                contact_person=contact,
                balance=balance,
                notes=notes
            )
            db.add(new_client)
            added_count += 1

db.commit()
db.close()

print(f"Successfully added {added_count} new clients.")
print(f"Updated/Skipped {skipped_count} existing clients.")
