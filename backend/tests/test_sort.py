from dotenv import load_dotenv
load_dotenv()
import sys
sys.path.insert(0, '.')
from app.database import SessionLocal
from app.models.client import Client
import re

db = SessionLocal()
clients = db.query(Client).all()

def pb(s):
    if not s: return 0.0
    cleaned = str(s).replace(',', '')
    m = re.search(r'-?\d+(\.\d+)?', cleaned)
    return float(m.group()) if m else 0.0

clients.sort(key=lambda c: pb(c.balance))
for c in clients[:15]:
    print((c.balance, pb(c.balance)))
