from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.client import Client
from app.dependencies import get_admin_user
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/clients", tags=["clients"])

class ClientUpdate(BaseModel):
    name: Optional[str] = None
    contact_person: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    balance: Optional[str] = None
    notes: Optional[str] = None

@router.get("/")
def get_clients(db: Session = Depends(get_db)):
    clients = db.query(Client).all()
    return [
        {
            "id": str(c.id),
            "name": c.name,
            "contact_person": c.contact_person,
            "email": c.email,
            "phone": c.phone,
            "balance": c.balance,
            "notes": c.notes
        } for c in clients
    ]

@router.get("/search")
def search_clients(q: str = "", db: Session = Depends(get_db)):
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
            "notes": c.notes
        } for c in clients
    ]

@router.put("/{client_id}")
def update_client(client_id: str, data: ClientUpdate, db: Session = Depends(get_db)):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
        
    if data.name is not None: client.name = data.name
    if data.contact_person is not None: client.contact_person = data.contact_person
    if data.email is not None: client.email = data.email
    if data.phone is not None: client.phone = data.phone
    if data.balance is not None: client.balance = data.balance
    if data.notes is not None: client.notes = data.notes
    
    db.commit()
    db.refresh(client)
    return {"message": "Client updated successfully"}

@router.delete("/{client_id}")
def delete_client(client_id: str, db: Session = Depends(get_db)):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
        
    db.delete(client)
    db.commit()
    return {"message": "Client deleted successfully"}
