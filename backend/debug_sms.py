import os
import logging
import requests
from dotenv import load_dotenv
load_dotenv()

logging.basicConfig(level=logging.INFO)

GLOBALSMS_API_KEY = os.getenv("GLOBALSMS_API_KEY", "")
GLOBALSMS_SENDER = os.getenv("GLOBALSMS_SENDER", "YAHAV")

clean_phone = "0544499086"
message = "תזכורת שיבוץ למחר: טיול דו יומי, יציאה מלוד בשעה 6:30, נסיעה לטיול ברמת הגולן לינה באבני איתן כפר האינדיאני, זמן חזרה משוערת מול האיש קשר לאחר השתבצות. אנא היכנס/י לקישור לאישור הגעה סופית: https://yahav-hatzala.co.il/employee/schedule"

url = "https://sapi.itnewsletter.co.il/webservices/wssms.asmx"
xml_payload = f"""<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <sendSmsToRecipients xmlns="apiGlobalSms">
      <ApiKey>{GLOBALSMS_API_KEY}</ApiKey>
      <txtOriginator>{GLOBALSMS_SENDER}</txtOriginator>
      <destinations>{clean_phone}</destinations>
      <txtSMSmessage><![CDATA[{message}]]></txtSMSmessage>
      <dteToDeliver></dteToDeliver>
      <txtAddInf></txtAddInf>
    </sendSmsToRecipients>
  </soap:Body>
</soap:Envelope>"""

headers = {
    "Content-Type": "text/xml; charset=utf-8",
    "SOAPAction": '"apiGlobalSms/sendSmsToRecipients"'
}

try:
    print("Sending API Request...")
    response = requests.post(url, data=xml_payload.encode('utf-8'), headers=headers, timeout=10)
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Exception: {e}")
