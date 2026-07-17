from fastapi import APIRouter, Depends
from app.dependencies import get_admin_user
from app.models.user import User

router = APIRouter(prefix="/api/admin", tags=["admin"])

@router.get("/billing")
def get_billing_info(current_user: User = Depends(get_admin_user)):
    return {"message": "Secure billing data"}
