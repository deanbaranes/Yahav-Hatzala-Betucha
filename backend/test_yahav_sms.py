import os
import requests
from dotenv import load_dotenv
load_dotenv()

GLOBALSMS_API_KEY = os.getenv("GLOBALSMS_API_KEY", "")
GLOBALSMS_SENDER = os.getenv("GLOBALSMS_SENDER", "YAHAV")

def test_sms(phone, msg):
    url = "https://sapi.itnewsletter.co.il/webservices/wssms.asmx"
    xml_payload = f"""<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <sendSmsToRecipients xmlns="apiGlobalSms">
      <ApiKey>{GLOBALSMS_API_KEY}</ApiKey>
      <txtOriginator>{GLOBALSMS_SENDER}</txtOriginator>
      <destinations>{phone}</destinations>
      <txtSMSmessage><![CDATA[{msg}]]></txtSMSmessage>
      <dteToDeliver></dteToDeliver>
      <txtAddInf></txtAddInf>
    </sendSmsToRecipients>
  </soap:Body>
</soap:Envelope>"""

    headers = {
        "Content-Type": "text/xml; charset=utf-8",
        "SOAPAction": '"apiGlobalSms/sendSmsToRecipients"'
    }
    resp = requests.post(url, data=xml_payload.encode('utf-8'), headers=headers, timeout=10)
    print(f"To {phone} -> Result: {resp.text}")

print("Testing Noam's Message (With Link):")
test_sms("0544499086", "תזכורת שיבוץ למחר. אנא היכנס/י לקישור לאישור הגעה סופית: https://yahav-hatzala-betucha.vercel.app/employee/schedule")

print("\nTesting Noam's Message (WITHOUT Link):")
test_sms("0544499086", "תזכורת שיבוץ למחר. נא לאשר מול המנהל.")

print("\nTesting Yahav's Message:")
test_sms("0533210777", "התראת משמרות מחר (16/09): 1 עובדים טרם אישרו הגעה (נועם ראב). נא להיכנס לאפליקציה לבדיקה!")
