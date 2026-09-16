import os
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from dotenv import load_dotenv

load_dotenv()
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.notification import Notification

try:
    engine = create_engine(os.getenv("DATABASE_URL"))
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()

    notifs = db.query(Notification).filter(
        Notification.user_id == '5011ce79-ec74-4adc-aa9c-d5016236ccc1',
        Notification.message.like('%היי מור ברגיג, המשמרת:%הסתיימה%')
    ).all()

    for n in notifs:
        print("Deleting stuck notification:", n.id, n.created_at)
        db.delete(n)
    
    db.commit()
    print("Cleanup successful. Ready to simulate.")
except Exception as e:
    print("ERROR:", e)
