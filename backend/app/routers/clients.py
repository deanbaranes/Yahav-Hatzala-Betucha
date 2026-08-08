from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.client import Client
from app.models.user import User
from app.dependencies import get_admin_user
from app.schemas import ClientUpdate
from dateutil import parser

router = APIRouter(prefix="/clients", tags=["clients"])

@router.get("/")
def get_clients(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), admin_user: User = Depends(get_admin_user)):
    clients = db.query(Client).offset(skip).limit(limit).all()
    return [
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

@router.get("/search")
def search_clients(q: str = "", db: Session = Depends(get_db), admin_user: User = Depends(get_admin_user)):
    # Returns clients matching query
    query = db.query(Client)
    if q:
        query = query.filter(Client.name.ilike(f"%{q}%"))
    clients = query.limit(10).all()
    
    return [
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

@router.put("/{client_id}")
def update_client(client_id: str, data: ClientUpdate, db: Session = Depends(get_db), admin_user: User = Depends(get_admin_user)):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
        
    if data.name is not None: client.name = data.name
    if data.contact_person is not None: client.contact_person = data.contact_person
    if data.email is not None: client.email = data.email
    if data.phone is not None: client.phone = data.phone
    if data.balance is not None: client.balance = data.balance
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
        raise HTTPException(status_code=404, detail="Client not found")
        
    db.delete(client)
    db.commit()
    return {"message": "Client deleted successfully"}
