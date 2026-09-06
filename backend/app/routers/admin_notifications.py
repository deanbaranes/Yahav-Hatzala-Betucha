from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.notification import Notification
from app.models.user import User
from app.dependencies import get_admin_user

router = APIRouter(prefix="/notifications/admin", tags=["Admin Notifications"])

@router.get("/")
def get_admin_notifications(db: Session = Depends(get_db), admin_user: User = Depends(get_admin_user)):
    return db.query(Notification).filter(
        (Notification.user_id == None) | (Notification.user_id == admin_user.id)
    ).order_by(Notification.created_at.desc()).limit(50).all()

@router.put("/{notification_id}/read")
def mark_admin_read(notification_id: str, db: Session = Depends(get_db), admin_user: User = Depends(get_admin_user)):
    notif = db.query(Notification).filter(
        Notification.id == notification_id,
        (Notification.user_id == admin_user.id) | (Notification.user_id == None)
    ).first()

    if not notif:
        raise HTTPException(status_code=404, detail="התראה לא נמצאה")
    
    notif.is_read = True
    db.commit()
    return {"status": "success"}

@router.put("/read-all")
def mark_all_admin_read(db: Session = Depends(get_db), admin_user: User = Depends(get_admin_user)):
    db.query(Notification).filter(
        (Notification.user_id == None) | (Notification.user_id == admin_user.id),
        Notification.is_read == False
    ).update({"is_read": True}, synchronize_session=False)
    
    db.commit()
    return {"status": "success"}
