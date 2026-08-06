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
from app.routers import auth, trips, reports, webhooks, clients, admin, payroll, suppliers, notifications
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

# ── Rate limiter (shared instance) ────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])

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
app.include_router(admin.router)
app.include_router(payroll.router)
app.include_router(suppliers.router)
app.include_router(notifications.router)

@app.get("/")
def read_root():
    return {"message": "Welcome to Yahav Hatzala Betucha API"}

from app.database import get_db
from sqlalchemy.orm import Session
from app.auth import get_password_hash
from fastapi import Depends

@app.get("/setup-admins-temp")
def setup_admins_temp(db: Session = Depends(get_db)):
    yahav = db.query(user.User).filter(user.User.phone == "0533210777").first()
    if yahav:
        yahav.role = "admin"
        yahav.status = "active"
        yahav.password_hash = get_password_hash("yahav4590")
    
    dean = db.query(user.User).filter(user.User.phone == "0504851269").first()
    if dean:
        dean.role = "admin"
        dean.status = "active"
        dean.password_hash = get_password_hash("Dean2204")
        
    db.commit()
    return {"message": "Admins Yahav and Dean upgraded successfully!"}

os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

