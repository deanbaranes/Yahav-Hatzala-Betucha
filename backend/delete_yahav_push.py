import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

os.environ["DATABASE_URL"] = "postgresql://yahav_db_user:rjHOz8wwMDYhSA27uB1JNZHtjNUQ9zVD@dpg-d9q7loht0dsc73cdom00-a.frankfurt-postgres.render.com/yahav_db"

from app.models.push_subscription import PushSubscription

engine = create_engine(os.environ["DATABASE_URL"])
Session = sessionmaker(bind=engine)
db = Session()

yahav_id = 'd7a77d04-c31e-4bec-a73a-33ba43a42a24'
subs = db.query(PushSubscription).filter(PushSubscription.user_id == yahav_id).all()

count = 0
for s in subs:
    db.delete(s)
    count += 1

db.commit()
db.close()

print(f"Success! Deleted {count} push subscriptions for Yahav.")
