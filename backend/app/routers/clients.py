from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.client import Client
from app.models.user import User
from app.dependencies import get_admin_user
from app.schemas import ClientUpdate, ClientCreate
from dateutil import parser

router = APIRouter(prefix="/clients", tags=["clients"])

import re

from sqlalchemy import func

def parse_balance(bal_str):
    if not bal_str: return 0.0
    cleaned = str(bal_str).replace(',', '')
    match = re.search(r'-?\d+(\.\d+)?', cleaned)
    if not match: return 0.0
    return float(match.group())

@router.get("/")
def get_clients(skip: int = 0, limit: int = 50, q: str = "", db: Session = Depends(get_db), admin_user: User = Depends(get_admin_user)):
    filters = []
    if q:
        filters.append(
            (Client.name.ilike(f"%{q}%")) | 
            (Client.contact_person.ilike(f"%{q}%"))
        )
        
    query = db.query(Client).filter(*filters) if filters else db.query(Client)
    total = query.count()
    
    # Calculate totals using DB aggregation for blazing fast performance
    total_positive = db.query(func.sum(Client.numeric_balance)).filter(*filters, Client.numeric_balance > 0).scalar() or 0.0
    total_negative = db.query(func.sum(Client.numeric_balance)).filter(*filters, Client.numeric_balance < 0).scalar() or 0.0

    # Sort by balance ascending (most negative / highest debt comes first) directly in the database
    clients = query.order_by(Client.numeric_balance.asc()).offset(skip).limit(limit).all()
    
    return {
        "total": total,
        "totalPositive": total_positive,
        "totalNegative": total_negative,
        "data": [
            {
                "id": str(c.id),
                "name": c.name,
                "contact_person": c.contact_person,
                "email": c.email,
                "phone": c.phone,
                "balance": c.balance,
                "debt_start_date": c.debt_start_date.isoformat() if c.debt_start_date else None,
                "notes": c.notes,
                "payment_terms": c.payment_terms
            } for c in clients
        ]
    }

@router.post("/")
def create_client(data: ClientCreate, db: Session = Depends(get_db), admin_user: User = Depends(get_admin_user)):
    existing = db.query(Client).filter(Client.name == data.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="לקוח עם שם זה כבר קיים במערכת")
    
    new_client = Client(
        name=data.name,
        contact_person=data.contact_person,
        email=data.email,
        phone=data.phone,
        balance="0",
        numeric_balance=0.0
    )
    db.add(new_client)
    db.commit()
    db.refresh(new_client)
    return {"id": str(new_client.id), "message": "Client created successfully"}

@router.put("/{client_id}")
def update_client(client_id: str, data: ClientUpdate, db: Session = Depends(get_db), admin_user: User = Depends(get_admin_user)):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="לקוח לא נמצא")
        
    if data.name is not None: client.name = data.name
    if data.contact_person is not None: client.contact_person = data.contact_person
    if data.email is not None: client.email = data.email
    if data.phone is not None: client.phone = data.phone
    if data.balance is not None: 
        client.balance = data.balance
        client.numeric_balance = parse_balance(data.balance)
    if data.debt_start_date is not None: 
        client.debt_start_date = parser.parse(data.debt_start_date) if data.debt_start_date else None
    if data.notes is not None: client.notes = data.notes
    if data.payment_terms is not None: client.payment_terms = data.payment_terms if data.payment_terms != '' else None
    
    db.commit()
    db.refresh(client)
    return {"message": "Client updated successfully"}

@router.delete("/{client_id}")
def delete_client(client_id: str, db: Session = Depends(get_db), admin_user: User = Depends(get_admin_user)):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="לקוח לא נמצא")
        
    db.delete(client)
    db.commit()
    return {"message": "Client deleted successfully"}
