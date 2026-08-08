from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
import os
from app.database import engine, Base
from app.models import user, client, trip, trip_assignment, trip_report, payroll_adjustment
from app.models import refresh_token        # register RefreshToken table
from app.models import password_reset_token # register PasswordResetToken table
from app.models import supplier             # register Supplier table
from app.models import notification         # register Notification table
from app.models import payslip              # register Payslip table
from app.routers import auth, trips, reports, webhooks, clients, payroll, suppliers, notifications
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

# ── Rate limiter (shared instance) ────────────────────────────────────────────
from app.rate_limiter import limiter

# Create database tables
Base.metadata.create_all(bind=engine)

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
ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:3000"
).split(",")

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
app.include_router(clients.router)
app.include_router(reports.router)
app.include_router(webhooks.router, prefix="/api")

app.include_router(payroll.router)
app.include_router(suppliers.router)
app.include_router(notifications.router)

@app.get("/")
def read_root():
    return {"message": "Welcome to Yahav Hatzala Betucha API"}

os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

