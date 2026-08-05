import logging
from sqlalchemy.orm import Session
from app.models.notification import Notification

logger = logging.getLogger(__name__)

class NotificationService:
    @staticmethod
    def send_sms(phone_number: str, message: str, db: Session = None, user_id: str = None) -> bool:
        """
        Mock function to send an SMS.
        Currently prints to the console for testing.
        """
        logger.info("=========================================")
        logger.info(f"📱 SMS MOCK SENDER")
        logger.info(f"To: {phone_number}")
        logger.info(f"Message:\n{message}")
        logger.info("=========================================")
        
        # Save to database if session is provided (in-app notification)
        if db:
            try:
                new_notif = Notification(
                    user_id=user_id,
                    title="התראת מערכת",
                    message=message
                )
                db.add(new_notif)
                db.commit()
            except Exception as e:
                logger.error(f"Failed to save notification to DB: {str(e)}")
        
        # TODO: Implement real SMS provider integration here (e.g. SMS2010 API)
        # response = requests.post("https://api.sms-provider.co.il/send", json={...})
        
        return True
