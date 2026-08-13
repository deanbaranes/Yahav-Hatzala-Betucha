import os
import sys

# Add backend directory to python path
sys.path.insert(0, os.path.abspath('.'))

from app.tasks.scheduler import check_client_debts, check_unassigned_trips, check_uninvoiced_trips
import logging

logging.basicConfig(level=logging.INFO)

print("Checking debts...")
check_client_debts()
print("Checking unassigned...")
check_unassigned_trips()
print("Checking uninvoiced...")
check_uninvoiced_trips()
print("Done!")
