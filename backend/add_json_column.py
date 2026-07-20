from sqlalchemy import create_engine, text

engine = create_engine("postgresql://yahav_user:yahav_password@db:5432/yahav_db")

with engine.connect() as conn:
    print("Adding daily_shifts JSON column to trip_reports if it doesn't exist...")
    conn.execute(text("ALTER TABLE trip_reports ADD COLUMN IF NOT EXISTS daily_shifts JSON;"))
    conn.commit()
    print("Done!")
