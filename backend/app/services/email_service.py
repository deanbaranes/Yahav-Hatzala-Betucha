import os
import logging
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

logger = logging.getLogger(__name__)

SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY", "")
FROM_EMAIL = os.getenv("FROM_EMAIL", "noreply@yahav-hatzala.co.il")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")


class EmailService:

    @staticmethod
    def send_password_reset(to_email: str, full_name: str, token: str) -> bool:
        """
        Sends a password reset email with a link containing the token.
        Returns True on success, False on failure.
        """
        reset_link = f"{FRONTEND_URL}/reset-password?token={token}"

        html_content = f"""
        <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #1d4ed8;">שחזור סיסמא — יהב הצלה בטוחה</h2>
            <p>שלום {full_name},</p>
            <p>קיבלנו בקשה לאיפוס הסיסמא שלך. לחץ על הכפתור למטה לאיפוס:</p>
            <a href="{reset_link}"
               style="display:inline-block; background: linear-gradient(to right, #1d4ed8, #06b6d4);
                      color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none;
                      font-weight: bold; margin: 16px 0;">
               אפס סיסמא
            </a>
            <p style="color: #6b7280; font-size: 13px;">
                הקישור תקף ל-15 דקות בלבד.<br>
                אם לא ביקשת לאפס סיסמא — התעלם מהודעה זו.
            </p>
        </div>
        """

        if not SENDGRID_API_KEY:
            # Dev mode — just log the link
            logger.warning(f"[EmailService] SENDGRID_API_KEY not set. Reset link: {reset_link}")
            return True

        try:
            message = Mail(
                from_email=FROM_EMAIL,
                to_emails=to_email,
                subject="איפוס סיסמא — יהב הצלה בטוחה",
                html_content=html_content
            )
            sg = SendGridAPIClient(SENDGRID_API_KEY)
            response = sg.send(message)
            logger.info(f"[EmailService] Password reset email sent to {to_email} — status {response.status_code}")
            return True
        except Exception as e:
            logger.error(f"[EmailService] Failed to send reset email to {to_email}: {e}")
            return False
