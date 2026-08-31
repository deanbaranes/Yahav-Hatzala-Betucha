import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.supplier import Supplier, SupplierContact
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
    
    # Auto-save supplier to contact list if doesn't exist
    contact = db.query(SupplierContact).filter(SupplierContact.name == supplier.name).first()
    if not contact:
        new_contact = SupplierContact(name=supplier.name)
        db.add(new_contact)
        
    db.commit()
    db.refresh(new_supplier)
    return new_supplier

@router.get("/contacts", response_model=List[str])
def get_supplier_contacts(db: Session = Depends(get_db), admin_user: User = Depends(get_admin_user)):
    contacts = db.query(SupplierContact).all()
    return [c.name for c in contacts]

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

from fastapi import UploadFile, File
from datetime import datetime
from app.services.storage_service import StorageService
from app.models.business_expense import BusinessExpense
import logging

logger = logging.getLogger(__name__)

@router.post("/{supplier_id}/upload-receipt")
def upload_supplier_receipt(
    supplier_id: uuid.UUID, 
    file: UploadFile = File(...), 
    db: Session = Depends(get_db), 
    admin_user: User = Depends(get_admin_user)
):
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="ספק לא נמצא")
        
    try:
        url = StorageService.upload_file(
            file.file,
            folder="yahav_receipts",
            content_type=file.content_type or "",
        )
    except RuntimeError as e:
        logger.error(f"Receipt upload failed: {e}")
        raise HTTPException(status_code=500, detail="שגיאה בהעלאת הקובץ. אנא נסה שנית.")
        
    now = datetime.now()
    
    vat_note = "" if supplier.includes_vat else " (+ מע\"מ)"
    details_str = f" - {supplier.details}" if supplier.details else ""
    
    # Create Business Expense
    new_expense = BusinessExpense(
        file_url=url,
        file_name=file.filename or f"supplier_receipt_{supplier.name}_{now.date()}.jpg",
        status="processed",
        expense_month=now.month,
        expense_year=now.year,
        notes=f"תשלום לספק: {supplier.name} | סכום: {supplier.amount}{vat_note}{details_str}",
        uploaded_by_id=admin_user.id
    )
    db.add(new_expense)
    
    # Delete Supplier
    db.delete(supplier)
    db.commit()
    
    return {"message": "הקבלה הועלתה והספק הועבר להוצאות", "url": url}
