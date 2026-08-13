from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi import Depends, HTTPException
import os
from app.database import engine, Base
from app.models import user, client, trip, trip_assignment, trip_report, payroll_adjustment
from app.models import refresh_token        # register RefreshToken table
from app.models import password_reset_token # register PasswordResetToken table
from app.models import supplier             # register Supplier table
from app.models import notification         # register Notification table
from app.models import payslip              # register Payslip table
from app.models import business_expense
from app.routers import auth, trips, assignments, reports, clients, payroll, suppliers, notifications, expenses
from app.dependencies import get_current_user
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

# ── Rate limiter (shared instance) ────────────────────────────────────────────
from app.rate_limiter import limiter

# Create database tables
Base.metadata.create_all(bind=engine)

from sqlalchemy import text, inspect
try:
    inspector = inspect(engine)
    
    # Check users table
    if 'users' in inspector.get_table_names():
        users_cols = {col['name'] for col in inspector.get_columns('users')}
        if 'employment_type' not in users_cols:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE users ADD COLUMN employment_type VARCHAR DEFAULT 'שכיר'"))
                
    # Check business_expenses table
    if 'business_expenses' in inspector.get_table_names():
        be_cols = {col['name'] for col in inspector.get_columns('business_expenses')}
        with engine.begin() as conn:
            if 'expense_month' not in be_cols:
                conn.execute(text("ALTER TABLE business_expenses ADD COLUMN expense_month INTEGER"))
            if 'expense_year' not in be_cols:
                conn.execute(text("ALTER TABLE business_expenses ADD COLUMN expense_year INTEGER"))
                
    # Check suppliers table
    if 'suppliers' in inspector.get_table_names():
        sup_cols = {col['name'] for col in inspector.get_columns('suppliers')}
        with engine.begin() as conn:
            if 'debt_end_date' not in sup_cols:
                conn.execute(text("ALTER TABLE suppliers ADD COLUMN debt_end_date DATE"))
            if 'report_id' not in sup_cols:
                conn.execute(text("ALTER TABLE suppliers ADD COLUMN report_id UUID UNIQUE"))
except Exception as e:
    import logging
    logging.getLogger(__name__).warning(f"Auto-migration failed: {e}")

from contextlib import asynccontextmanager
from app.tasks.scheduler import start_scheduler

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    start_scheduler()
    yield
    # Shutdown
    pass

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
    raise RuntimeError("CRITICAL SECURITY ERROR: ALLOWED_ORIGINS environment variable is missing in production.")
else:
    ALLOWED_ORIGINS = ["http://localhost:5173", "http://localhost:3000"]

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
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

@app.get("/")
def read_root():
    return {"message": "Welcome to Yahav Hatzala Betucha API"}

os.makedirs("uploads", exist_ok=True)

@app.get("/uploads/{file_path:path}")
def get_upload_file(file_path: str, current_user = Depends(get_current_user)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Unauthorized access to files")
        
    file_location = os.path.join("uploads", file_path)
    # Basic directory traversal protection
    if not os.path.abspath(file_location).startswith(os.path.abspath("uploads")):
        raise HTTPException(status_code=403, detail="Forbidden")
        
    if not os.path.exists(file_location) or not os.path.isfile(file_location):
        raise HTTPException(status_code=404, detail="File not found")
        
    return FileResponse(file_location)

