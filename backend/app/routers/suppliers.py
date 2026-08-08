import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.supplier import Supplier
from app.models.user import User
from app.dependencies import get_admin_user
from app.schemas import SupplierCreate, SupplierUpdate, SupplierOut

router = APIRouter(prefix="/suppliers", tags=["suppliers"])

@router.get("/", response_model=List[SupplierOut])
def get_suppliers(db: Session = Depends(get_db), admin_user: User = Depends(get_admin_user)):
    # מיין לפי תאריך חוב יורד (החדשים קודם)
    suppliers = db.query(Supplier).order_by(Supplier.debt_date.desc()).all()
    return suppliers

@router.post("/", response_model=SupplierOut)
def create_supplier(supplier: SupplierCreate, db: Session = Depends(get_db), admin_user: User = Depends(get_admin_user)):
    new_supplier = Supplier(**supplier.model_dump())
    db.add(new_supplier)
    db.commit()
    db.refresh(new_supplier)
    return new_supplier

@router.put("/{supplier_id}", response_model=SupplierOut)
def update_supplier(supplier_id: uuid.UUID, supplier: SupplierUpdate, db: Session = Depends(get_db), admin_user: User = Depends(get_admin_user)):
    db_supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not db_supplier:
        raise HTTPException(status_code=404, detail="ספק לא נמצא")

    update_data = supplier.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_supplier, key, value)
    
    db.commit()
    db.refresh(db_supplier)
    return db_supplier

@router.delete("/{supplier_id}")
def delete_supplier(supplier_id: uuid.UUID, db: Session = Depends(get_db), admin_user: User = Depends(get_admin_user)):
    db_supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not db_supplier:
        raise HTTPException(status_code=404, detail="ספק לא נמצא")

    db.delete(db_supplier)
    db.commit()
    return {"detail": "ספק נמחק בהצלחה"}
