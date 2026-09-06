import os
import requests
import logging
from sqlalchemy.orm import Session
from app.models.notification import Notification

logger = logging.getLogger(__name__)

GLOBALSMS_API_KEY = os.getenv("GLOBALSMS_API_KEY", "")
GLOBALSMS_SENDER = os.getenv("GLOBALSMS_SENDER", "YAHAV")

class NotificationService:
    @staticmethod
    def create_in_app_notification(message: str, db: Session, user_id: str = None, title: str = "התראת מערכת") -> bool:
        try:
            new_notif = Notification(
                user_id=user_id,
                title=title,
                message=message
            )
            db.add(new_notif)
            db.commit()
            return True
        except Exception as e:
            logger.error(f"Failed to save notification to DB: {str(e)}")
            return False

    @staticmethod
    def send_sms(phone_number: str, message: str, db: Session = None, user_id: str = None) -> bool:
        """
        Sends an SMS using Global SMS REST API.
        Falls back to console mock if API key is not configured.
        """
        # Save to database if session is provided (in-app notification)
        if db:
            NotificationService.create_in_app_notification(message, db, user_id)
        
        return True # זמני: הושבת לשם בדיקות


        # Clean the phone number (remove hyphens, spaces)
        clean_phone = "".join(filter(str.isdigit, phone_number))
        
        # Get admin phone from env safely
        admin_phone_env = "".join(filter(str.isdigit, os.getenv("ADMIN_PHONE", "")))

        if admin_phone_env and clean_phone == admin_phone_env and db:
            try:
                from app.services.push_service import send_push_notification
                from app.models.user import User
                
                target_user = None
                if user_id:
                    target_user = db.query(User).filter(User.id == user_id).first()
                if not target_user:
                    target_user = db.query(User).filter(User.phone.like(f"%{clean_phone}%")).first()
                
                if target_user:
                    push_title = "התראת מנהל (ממערכת ה-SMS)"
                    if "אישור הגעה" in message:
                        push_title = "עדכון אישור הגעה"
                    elif "התראת שיבוץ" in message:
                        push_title = "התראת שיבוצים"
                    elif "נרשם לטיול" in message or "ביטל את הרישום" in message:
                        push_title = "עדכון רישום עובדים"
                    elif "ספקים" in message:
                        push_title = "תזכורת ספקים"
                    elif "התראת חוב" in message:
                        push_title = "התראת גבייה מלקוחות"
                    elif "התראת חשבונית" in message:
                        push_title = "התראה להפקת חשבוניות"
                        
                    # Skip pushing if it's one of the ignored employee keywords
                    employee_keywords = ["תזכורת שיבוץ", "שובצת לטיול", "לאשר הגעה סופית", "למלא דוח", "הסתיים"]
                    if not any(keyword in message for keyword in employee_keywords):
                        send_push_notification(db, target_user.id, push_title, message, url="/admin/trips")
            except Exception as e:
                logger.error(f"[SMS-to-Push] Failed to send push to admin: {e}")

        if not GLOBALSMS_API_KEY:
            logger.info("=========================================")
            logger.info(f"📱 SMS MOCK SENDER (No API Key set)")
            logger.info(f"To: {phone_number}")
            logger.info(f"Message:\n{message}")
            logger.info("=========================================")
            return True

        # Exclude admin from receiving employee-targeted SMS (assignments, confirmations, report reminders)
        if admin_phone_env and clean_phone == admin_phone_env:
            employee_keywords = ["תזכורת שיבוץ", "שובצת לטיול", "לאשר הגעה סופית", "למלא דוח", "הסתיים"]
            if any(keyword in message for keyword in employee_keywords):
                logger.info(f"[SMS] Skipped sending employee SMS to admin ({admin_phone_env}) based on user preference.")
                return True

        try:
            url = "https://sapi.itnewsletter.co.il/webservices/wssms.asmx"
            
            # Using the SOAP endpoint (sapi) which bypasses IP restrictions
            xml_payload = f"""<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <sendSmsToRecipients xmlns="apiGlobalSms">
      <ApiKey>{GLOBALSMS_API_KEY}</ApiKey>
      <txtOriginator>{GLOBALSMS_SENDER}</txtOriginator>
      <destinations>{clean_phone}</destinations>
      <txtSMSmessage>{message}</txtSMSmessage>
      <dteToDeliver></dteToDeliver>
      <txtAddInf>{f"user_{user_id}" if user_id else ""}</txtAddInf>
    </sendSmsToRecipients>
  </soap:Body>
</soap:Envelope>"""

            headers = {
                "Content-Type": "text/xml; charset=utf-8",
                "SOAPAction": '"apiGlobalSms/sendSmsToRecipients"'
            }
            
            response = requests.post(url, data=xml_payload.encode('utf-8'), headers=headers, timeout=10)
            
            if response.status_code == 200 and "sendSmsToRecipientsResult" in response.text:
                logger.info(f"[SMS] Successfully sent to {clean_phone}")
                return True
            else:
                logger.error(f"[SMS] Failed to send. Status: {response.status_code}, Response: {response.text}")
                return False
                
        except Exception as e:
            logger.error(f"[SMS] Exception during SMS sending: {str(e)}")
            return False
