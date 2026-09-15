import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

os.environ["DATABASE_URL"] = "postgresql://yahav_db_user:rjHOz8wwMDYhSA27uB1JNZHtjNUQ9zVD@dpg-d9q7loht0dsc73cdom00-a.frankfurt-postgres.render.com/yahav_db"

from app.models.user import User
from app.models.push_subscription import PushSubscription

engine = create_engine(os.environ["DATABASE_URL"])
Session = sessionmaker(bind=engine)
db = Session()

# Try to find Yahav
yahav_users = db.query(User).filter(User.full_name.ilike('%הב%')).all()

print("Found matching users:")
for u in yahav_users:
    print(f"ID: {u.id}, Name: {u.full_name}, Phone: {u.phone}")
    subs = db.query(PushSubscription).filter(PushSubscription.user_id == u.id).all()
    print(f"  -> Push subscriptions: {len(subs)}")
    for s in subs:
        print(f"     Endpoint: {s.endpoint[:30]}...")

db.close()
