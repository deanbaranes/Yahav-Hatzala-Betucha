import os
import json
from pywebpush import webpush, WebPushException
from sqlalchemy.orm import Session
from app.models.push_subscription import PushSubscription

def send_push_notification(db: Session, user_id, title: str, body: str, url: str = "/employee/schedule"):
    vapid_private_key = os.environ.get("VAPID_PRIVATE_KEY")
    vapid_claims_email = os.environ.get("VAPID_CLAIMS_EMAIL", "mailto:admin@example.com")

    if not vapid_private_key:
        return

    subscriptions = db.query(PushSubscription).filter(PushSubscription.user_id == user_id).all()
    if not subscriptions:
        return

    payload = json.dumps({
        "title": title,
        "body": body,
        "url": url
    })

    for sub in subscriptions:
        try:
            webpush(
                subscription_info={
                    "endpoint": sub.endpoint,
                    "keys": {
                        "p256dh": sub.p256dh,
                        "auth": sub.auth
                    }
                },
                data=payload,
                vapid_private_key=vapid_private_key,
                vapid_claims={
                    "sub": vapid_claims_email
                }
            )
        except WebPushException as ex:
            # If subscription is gone/unsubscribed, remove it from DB
            if ex.response and ex.response.status_code in [404, 410]:
                db.delete(sub)
                db.commit()
            else:
                print("Push Error:", ex)
