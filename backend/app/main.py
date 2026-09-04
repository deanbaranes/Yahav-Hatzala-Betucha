import os
from contextlib import asynccontextmanager

from app.database import Base, engine, get_db
from app.dependencies import get_current_user
from app.models import (  # noqa: F401
    business_expense,
    client,
    notification,  # register Notification table
    password_reset_token,  # register PasswordResetToken table
    payroll_adjustment,
    payslip,  # register Payslip table
    refresh_token,  # register RefreshToken table
    supplier,  # register Supplier table
    trip,
    trip_assignment,
    trip_report,
    user,
)
from app.models.payslip import Payslip
from app.models.user import UserRole

# ── Rate limiter (shared instance) ────────────────────────────────────────────
from app.rate_limiter import limiter
from app.routers import (
    assignments,
    auth,
    calendar,
    clients,
    expenses,
    notifications,
    payroll,
    push,
    reports,
    suppliers,
    trips,
)
from app.tasks.scheduler import start_scheduler
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from sqlalchemy.orm import Session

# Create database tables
Base.metadata.create_all(bind=engine)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    start_scheduler()
    yield
    # Shutdown


app = FastAPI(title="Yahav Hatzala Betucha API", lifespan=lifespan)

# Attach the limiter to the app state so slowapi decorators work
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# כתובות מותרות ל-CORS — מוגדרות ב-.env כ-ALLOWED_ORIGINS (מופרדות בפסיק)
is_prod = os.getenv("ENVIRONMENT", "development").lower() == "production"
raw_origins = os.getenv("ALLOWED_ORIGINS")

if raw_origins:
    ALLOWED_ORIGINS = raw_origins.split(",")
elif is_prod:
    # Fail safely in production if CORS is not configured
    raise RuntimeError(
        "CRITICAL SECURITY ERROR: ALLOWED_ORIGINS environment variable is missing in production."
    )
else:
    ALLOWED_ORIGINS = ["http://localhost:5173", "http://localhost:3000"]


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = (
        "max-age=31536000; includeSubDomains"
    )
    return response


app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(auth.router)
app.include_router(trips.router)
app.include_router(assignments.router)
app.include_router(clients.router)
app.include_router(reports.router)

app.include_router(payroll.router)
app.include_router(suppliers.router)
app.include_router(notifications.router)
app.include_router(expenses.router)
app.include_router(calendar.router)
app.include_router(push.router)


@app.get("/")
def read_root():
    return {"message": "Welcome to Yahav Hatzala Betucha API"}


os.makedirs("uploads", exist_ok=True)


@app.get("/uploads/{file_path:path}")
def get_upload_file(
    file_path: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Unauthorized access to files")

    file_location = os.path.join("uploads", file_path)
    # Basic directory traversal protection
    if not os.path.abspath(file_location).startswith(os.path.abspath("uploads")):
        raise HTTPException(status_code=403, detail="Forbidden")

    # Security Fix: RBAC for sensitive files (IDOR protection)
    # Strictly protect payslips
    if current_user.role != UserRole.admin and (
        file_path.startswith("payslips/") or "payslip" in file_path.lower()
    ):
        # In DB, file_path might be stored as "payslips/file.pdf" or full URL
        payslip = (
            db.query(Payslip).filter(Payslip.file_path.contains(file_path)).first()
        )
        if not payslip or payslip.user_id != current_user.id:
            raise HTTPException(
                status_code=403, detail="אין לך הרשאה לצפות בתלוש שכר זה"
            )

    if not os.path.exists(file_location) or not os.path.isfile(file_location):
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(file_location)
