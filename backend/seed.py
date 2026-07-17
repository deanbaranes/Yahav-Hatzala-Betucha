from app.database import SessionLocal, engine, Base
from app.models.user import User, UserRole, UserStatus
from app.auth import get_password_hash

# Ensure tables are created
Base.metadata.create_all(bind=engine)

db = SessionLocal()

# Check if admin exists
admin = db.query(User).filter(User.phone == "0501234567").first()
if not admin:
    admin = User(
        full_name="מנהל מערכת",
        phone="0501234567",
        password_hash=get_password_hash("admin123"),
        role=UserRole.admin,
        status=UserStatus.active
    )
    db.add(admin)

# Check if employee exists
emp = db.query(User).filter(User.phone == "0507654321").first()
if not emp:
    emp = User(
        full_name="ישראל ישראלי",
        phone="0507654321",
        password_hash=get_password_hash("emp123"),
        role=UserRole.employee,
        status=UserStatus.active
    )
    db.add(emp)

db.commit()
db.close()
print("Database seeded with Admin and Employee!")
