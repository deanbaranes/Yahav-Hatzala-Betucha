from fastapi import FastAPI
from app.database import engine, Base
from app.models import user, client, trip, trip_assignment, trip_report
from app.routers import auth, trips, reports, webhooks, clients, admin

# Create database tables
Base.metadata.create_all(bind=engine)

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Yahav Hatzala Betucha API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

app.include_router(auth.router)
app.include_router(trips.router)
app.include_router(clients.router)
app.include_router(reports.router)
app.include_router(webhooks.router, prefix="/api")
app.include_router(admin.router)

@app.get("/")
def read_root():
    return {"message": "Welcome to Yahav Hatzala Betucha API"}
