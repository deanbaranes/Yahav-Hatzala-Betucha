import pandas as pd
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
load_dotenv()
from app.database import SessionLocal, engine
from app.models.client import Client
import math

def main():
    file_path = r"c:\Users\user\Desktop\Yahav Hatzala Betucha\טבלת לקוחות יהב.xlsx"
    df = pd.read_excel(file_path)
    
    db = SessionLocal()
    added_count = 0
    skipped_count = 0
    seen_names = set()

    for index, row in df.iterrows():
        name = str(row.get("שם לקוח", "")).strip()
        if not name or name == 'nan' or name in seen_names:
            continue
            
        seen_names.add(name)
        
        email = str(row.get("אימייל", "")).strip()
        if email == 'nan': email = ""
        
        contact = str(row.get("איש קשר", "")).strip()
        if contact == 'nan': contact = ""
        
        phone = str(row.get("טלפון", "")).strip()
        if phone.endswith(".0"): phone = phone[:-2]
        if phone == 'nan': phone = ""
        # Fix missing leading zero for Israeli mobile numbers (e.g. 52... -> 052...)
        if len(phone) == 9 and phone.startswith("5"):
            phone = "0" + phone
        
        balance = str(row.get("יתרה", "")).strip()
        if balance == 'nan': balance = ""
        
        date_updated = str(row.get("תאריך עדכון", "")).strip()
        if date_updated == 'nan': date_updated = ""
        
        # Parse date_updated (format usually DD.MM.YYYY or similar)
        parsed_date = None
        if date_updated:
            try:
                # Basic parsing, dateutil can handle it but let's be careful
                from dateutil import parser
                # since it's DD.MM.YYYY, we should specify dayfirst=True
                parsed_date = parser.parse(date_updated, dayfirst=True)
            except Exception:
                pass
        
        notes_parts = []
        for col in ["עמודה 1", "עמודה 2", "עמודה 3"]:
            val = str(row.get(col, "")).strip()
            if val and val != 'nan':
                notes_parts.append(val)
        notes = " | ".join(notes_parts)
        
        existing = db.query(Client).filter(Client.name == name).first()
        if existing:
            if email: existing.email = email
            if phone: existing.phone = phone
            if contact: existing.contact_person = contact
            existing.balance = balance
            existing.notes = notes
            if parsed_date: existing.debt_start_date = parsed_date
            skipped_count += 1
        else:
            new_client = Client(
                name=name,
                email=email,
                phone=phone,
                contact_person=contact,
                balance=balance,
                notes=notes,
                debt_start_date=parsed_date
            )
            db.add(new_client)
            added_count += 1

    db.commit()
    db.close()
    
    print(f"Successfully added {added_count} new clients.")
    print(f"Updated/Skipped {skipped_count} existing clients.")

if __name__ == "__main__":
    main()
