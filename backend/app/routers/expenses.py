from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models.business_expense import BusinessExpense
from app.models.user import User
from app.dependencies import get_current_user, get_admin_user
from app.schemas import BusinessExpenseOut, BusinessExpenseUpdate
from app.services.storage_service import StorageService

router = APIRouter(prefix="/expenses", tags=["expenses"])

@router.post("/", response_model=BusinessExpenseOut)
async def upload_expense(
    file: UploadFile = File(...),
    expense_month: int = Form(...),
    expense_year: int = Form(...),
    notes: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp", "application/pdf"}
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="סוג קובץ לא נתמך. יש להעלות תמונה או PDF.")

    try:
        url = StorageService.upload_file(file.file, folder="business_expenses", content_type=file.content_type)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload file: {str(e)}")
        
    expense = BusinessExpense(
        file_url=url,
        file_name=file.filename,
        notes=notes,
        uploaded_by_id=current_user.id,
        status="pending",
        expense_month=expense_month,
        expense_year=expense_year
    )
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return expense

@router.get("/", response_model=List[BusinessExpenseOut])
def list_expenses(
    status: Optional[str] = None, 
    expense_month: Optional[int] = None,
    expense_year: Optional[int] = None,
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_admin_user)
):
    query = db.query(BusinessExpense)
    if status:
        query = query.filter(BusinessExpense.status == status)
    if expense_month is not None:
        query = query.filter(BusinessExpense.expense_month == expense_month)
    if expense_year is not None:
        query = query.filter(BusinessExpense.expense_year == expense_year)
    
    # Sort pending by newest first, processed by newest first
    expenses = query.order_by(BusinessExpense.created_at.desc()).all()
    return expenses

@router.put("/{expense_id}", response_model=BusinessExpenseOut)
def update_expense(expense_id: str, data: BusinessExpenseUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_admin_user)):
    expense = db.query(BusinessExpense).filter(BusinessExpense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
        
    if data.status is not None:
        expense.status = data.status
    if data.notes is not None:
        expense.notes = data.notes
        
    db.commit()
    db.refresh(expense)
    return expense

@router.delete("/{expense_id}")
def delete_expense(expense_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_admin_user)):
    expense = db.query(BusinessExpense).filter(BusinessExpense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
        
    # Delete from storage if possible
    if expense.file_url:
        StorageService.delete_file(expense.file_url)
        
    db.delete(expense)
    db.commit()
    return {"message": "Expense deleted successfully"}
