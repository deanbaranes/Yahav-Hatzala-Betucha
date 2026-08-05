import logging

logger = logging.getLogger(__name__)

class SMSService:
    @staticmethod
    def send_sms(phone_number: str, message: str) -> bool:
        """
        Sends an SMS to the specified phone number.
        For now, this is a mock implementation.
        """
        logger.info(f"[SMS] To: {phone_number} | Message: {message}")
        # In the future, integrate Twilio or local SMS gateway here
        return True
