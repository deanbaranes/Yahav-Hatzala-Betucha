import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

# load models so Base is aware
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from app.models.user import User

load_dotenv('.env')
db_url = os.getenv('DATABASE_URL')
if not db_url:
    print('No DATABASE_URL found')
    exit(1)
    
engine = create_engine(db_url)
Session = sessionmaker(bind=engine)
session = Session()

user = session.query(User).filter(User.phone == '0532392520').first()
if user:
    print(f'Found user: {user.full_name}, status: {user.status}')
    session.delete(user)
    session.commit()
    print('User deleted successfully.')
else:
    print('User not found.')
