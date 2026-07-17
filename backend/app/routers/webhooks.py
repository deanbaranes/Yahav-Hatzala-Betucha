import logging
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.trip_assignment import TripAssignment, AssignmentStatus
from app.models.trip import Trip
from datetime import datetime, timedelta

router = APIRouter(prefix="/webhooks", tags=["webhooks"])
logger = logging.getLogger(__name__)

@router.post("/twilio")
async def twilio_webhook(request: Request, db: Session = Depends(get_db)):
    # Twilio sends data as form-urlencoded
    form_data = await request.form()
    
    from_number = form_data.get("From")
    body = str(form_data.get("Body", "")).strip()
    
    logger.info(f"Received webhook from {from_number} with body {body}")
    
    if body == "1" and from_number:
        phone = from_number.replace("whatsapp:", "")
        
        user = db.query(User).filter(User.phone == phone).first()
        if user:
            tomorrow_start = datetime.utcnow() + timedelta(days=1)
            tomorrow_end = tomorrow_start + timedelta(days=1)
            
            assignment = db.query(TripAssignment).join(Trip).filter(
                TripAssignment.user_id == user.id,
                TripAssignment.status == AssignmentStatus.assigned,
                TripAssignment.is_confirmed == False,
                Trip.start_date >= tomorrow_start.date(),
                Trip.start_date < tomorrow_end.date()
            ).first()
            
            if assignment:
                assignment.is_confirmed = True
                db.commit()
                logger.info(f"Confirmed assignment {assignment.id} for user {user.phone}")
                return {"message": "Success"}
            else:
                logger.info(f"No unconfirmed trip for tomorrow found for user {user.phone}")
        else:
             logger.info(f"User not found for phone {phone}")
             
    return {"message": "Acknowledged"}
