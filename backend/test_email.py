from dotenv import load_dotenv
import os
import sys

# Load local .env
load_dotenv()

from app.services.email_service import EmailService

print("Testing EmailService with SMTP...")
success = EmailService.send_password_reset("saferescue03@gmail.com", "בדיקת מערכת", "TEST_TOKEN_12345")

if success:
    print("✅ Email sent successfully to saferescue03@gmail.com!")
    sys.exit(0)
else:
    print("❌ Failed to send email.")
    sys.exit(1)
