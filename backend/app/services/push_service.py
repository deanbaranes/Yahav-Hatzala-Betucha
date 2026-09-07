import os
import json
from pywebpush import webpush, WebPushException
from sqlalchemy.orm import Session
from app.models.push_subscription import PushSubscription
from app.models.user import User

def send_push_notification(db: Session, user_id, title: str, body: str, url: str = "/employee/schedule"):
    # --- TODO REVERT HACK: Only allow Admin to get pushes for 5 minutes ---
    admin_phone = os.environ.get("BILLING_ADMIN_PHONE", "0504851269")
    admin_usr = db.query(User).filter(User.phone == admin_phone).first()
    if not admin_usr or user_id != admin_usr.id:
        return # Blocking push sequence for everyone EXCEPT admin testing
    # --- END REVERT HACK ---

    vapid_private_key = os.environ.get("VAPID_PRIVATE_KEY")
    vapid_claims_email = os.environ.get("VAPID_CLAIMS_EMAIL", "mailto:deanbaranes1@gmail.com")

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
                },
                ttl=86400,
                headers={"Urgency": "high"}
            )
        except WebPushException as ex:
            # If subscription is gone/unsubscribed, remove it from DB
            if ex.response and ex.response.status_code in [404, 410]:
                db.delete(sub)
                db.commit()
            else:
                print("Push Error:", ex)

def broadcast_push_notification(db: Session, title: str, body: str, url: str = "/employee/schedule"):
    # (return removed for admin broadcast testing)

    print(f"DEBUG PUSH: Attempting to broadcast push notification. Title: {title}")
    vapid_private_key = os.environ.get("VAPID_PRIVATE_KEY")
    vapid_claims_email = os.environ.get("VAPID_CLAIMS_EMAIL", "mailto:deanbaranes1@gmail.com")

    if not vapid_private_key:
        print("DEBUG PUSH Error: VAPID_PRIVATE_KEY is missing from environment variables!")
        return

    # --- TODO REVERT HACK: Get ONLY admin's push subscriptions for 5 minutes ---
    admin_phone = os.environ.get("BILLING_ADMIN_PHONE", "0504851269")
    admin_usr = db.query(User).filter(User.phone == admin_phone).first()
    if admin_usr:
        subscriptions = db.query(PushSubscription).filter(PushSubscription.user_id == admin_usr.id).all()
    else:
        subscriptions = []
    # --- END REVERT HACK ---
    print(f"DEBUG PUSH: Found {len(subscriptions)} push subscriptions in database.")
    
    if not subscriptions:
        return

    payload = json.dumps({
        "title": title,
        "body": body,
        "url": url
    })

    success_count = 0
    for sub in subscriptions:
        try:
            print(f"DEBUG PUSH: Sending to endpoint {sub.endpoint[:30]}...")
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
                },
                ttl=86400,
                headers={"Urgency": "high"}
            )
            success_count += 1
            print(f"DEBUG PUSH: Successfully sent to {sub.endpoint[:30]}")
        except WebPushException as ex:
            if ex.response and ex.response.status_code in [404, 410]:
                print(f"DEBUG PUSH: Subscription expired/invalid (404/410). Deleting from DB. Endpoint: {sub.endpoint[:30]}")
                db.delete(sub)
                db.commit()
            else:
                print(f"DEBUG PUSH: WebPushException during broadcast: {ex}")
        except Exception as e:
            print(f"DEBUG PUSH: General exception during broadcast: {e}")
            
    print(f"DEBUG PUSH: Finished broadcast. Successfully sent to {success_count}/{len(subscriptions)} devices.")
