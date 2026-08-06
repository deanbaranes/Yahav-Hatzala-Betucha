import os
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

logger = logging.getLogger(__name__)

# Gmail SMTP Configuration
SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
FROM_EMAIL = os.getenv("FROM_EMAIL", SMTP_USERNAME)
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")


class EmailService:

    @staticmethod
    def send_password_reset(to_email: str, full_name: str, token: str) -> bool:
        """
        Sends a password reset email with a link containing the token via SMTP (e.g., Gmail).
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

        if not SMTP_USERNAME or not SMTP_PASSWORD:
            # Dev mode — just log the link
            logger.warning(f"[EmailService] SMTP_USERNAME or SMTP_PASSWORD not set. Reset link: {reset_link}")
            return True

        try:
            # Create message
            msg = MIMEMultipart('alternative')
            msg['Subject'] = "איפוס סיסמא — יהב הצלה בטוחה"
            msg['From'] = f"Yahav Hatzala <{FROM_EMAIL}>"
            msg['To'] = to_email

            # Attach HTML content
            part = MIMEText(html_content, 'html')
            msg.attach(part)

            # Connect to SMTP server and send
            server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
            server.starttls()
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.sendmail(FROM_EMAIL, to_email, msg.as_string())
            server.quit()
            
            logger.info(f"[EmailService] Password reset email sent to {to_email}")
            return True
        except Exception as e:
            logger.error(f"[EmailService] Failed to send reset email to {to_email}: {e}")
            return False
