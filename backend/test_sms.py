import os
import sys
import requests
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from dotenv import load_dotenv

load_dotenv()

GLOBALSMS_API_KEY = os.getenv("GLOBALSMS_API_KEY", "")
GLOBALSMS_SENDER = os.getenv("GLOBALSMS_SENDER", "YAHAV")
phone = "0504851269" # Number for Admin
message = 'היי מור, זו הודעת בדיקה ממערכת יהב לבדיקת תקינות הקו.'

xml_payload = f"""<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <sendSmsToRecipients xmlns="apiGlobalSms">
      <ApiKey>{GLOBALSMS_API_KEY}</ApiKey>
      <txtOriginator>{GLOBALSMS_SENDER}</txtOriginator>
      <destinations>{phone}</destinations>
      <txtSMSmessage>{message}</txtSMSmessage>
      <dteToDeliver></dteToDeliver>
      <txtAddInf></txtAddInf>
    </sendSmsToRecipients>
  </soap:Body>
</soap:Envelope>"""

headers = {
    "Content-Type": "text/xml; charset=utf-8",
    "SOAPAction": '"apiGlobalSms/sendSmsToRecipients"'
}

url = "https://sapi.itnewsletter.co.il/webservices/wssms.asmx"
print("Sending test SMS directly to GlobalSMS API...")
response = requests.post(url, data=xml_payload.encode('utf-8'), headers=headers)
print("Status Code:", response.status_code)
print("Raw API Response:")
print(response.text)
