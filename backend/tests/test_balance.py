from dotenv import load_dotenv
load_dotenv()
import sys
sys.path.insert(0, '.')
from app.database import SessionLocal
from app.models.client import Client
import re

db = SessionLocal()
clients = db.query(Client).all()
negs = [c for c in clients if c.balance and '-' in str(c.balance)]

def pb(s):
    if not s: return 0.0
    cleaned = str(s).replace(',', '')
    m = re.search(r'-?\d+(\.\d+)?', cleaned)
    return float(m.group()) if m else 0.0

bad = [(c.name, c.balance, pb(c.balance)) for c in negs if pb(c.balance) >= 0]
print('Bad parses:', len(bad))
for b in bad[:10]:
    print(b)
