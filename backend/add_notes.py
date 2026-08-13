from dotenv import load_dotenv
load_dotenv()
from app.database import engine
from sqlalchemy import text

with engine.connect() as con:
    try:
        con.execute(text("ALTER TABLE trips ADD COLUMN notes VARCHAR;"))
        con.commit()
        print("Notes column added.")
    except Exception as e:
        print("Error:", e)
