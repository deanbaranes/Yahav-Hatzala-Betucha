import os
import sys
import logging
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from dotenv import load_dotenv

load_dotenv()
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.tasks.scheduler import check_ended_trips_for_reports

logging.basicConfig(level=logging.INFO)

try:
    print("Running check_ended_trips_for_reports()...")
    check_ended_trips_for_reports()
    print("Finished successfully without throwing exception!")
except Exception as e:
    print("FATAL EXCEPTION in running:", e)

