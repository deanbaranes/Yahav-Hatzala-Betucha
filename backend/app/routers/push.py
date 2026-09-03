from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.push_subscription import PushSubscription
from pydantic import BaseModel
import uuid
import os

router = APIRouter(prefix="/push", tags=["Push Notifications"])

@router.get("/public-key")
def get_public_key():
    return {"public_key": os.environ.get("VAPID_PUBLIC_KEY")}

class PushSubscriptionCreate(BaseModel):
    endpoint: str
    p256dh: str
    auth: str

@router.post("/subscribe")
def subscribe(sub: PushSubscriptionCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    existing = db.query(PushSubscription).filter(PushSubscription.endpoint == sub.endpoint).first()
    if existing:
        if existing.user_id != current_user.id:
            existing.user_id = current_user.id
            db.commit()
        return {"status": "already subscribed", "id": str(existing.id)}
    
    new_sub = PushSubscription(
        id=uuid.uuid4(),
        user_id=current_user.id,
        endpoint=sub.endpoint,
        p256dh=sub.p256dh,
        auth=sub.auth
    )
    db.add(new_sub)
    db.commit()
    db.refresh(new_sub)
    return {"status": "subscribed", "id": str(new_sub.id)}
