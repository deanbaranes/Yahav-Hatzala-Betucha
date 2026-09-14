import os
import sys
from dotenv import load_dotenv

load_dotenv()
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.tasks.scheduler import notify_admin_unconfirmed_arrivals

print("Running notify admin...")
notify_admin_unconfirmed_arrivals()
print("Done!")
