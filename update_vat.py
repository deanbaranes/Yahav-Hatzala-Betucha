import os
from sqlalchemy import create_engine
from sqlalchemy.sql import text
from dotenv import load_dotenv

load_dotenv(dotenv_path='backend/.env')
engine = create_engine(os.environ.get('DATABASE_URL'))
with engine.begin() as conn:
    conn.execute(text('UPDATE suppliers SET includes_vat = false;'))
    print('Updated all suppliers to includes_vat = false')
