from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.schemas import TripCreate, TripOut, DuplicateRecurringRequest
from app.dependencies import get_admin_user, get_current_user
from app.services.trip_service import TripService

router = APIRouter(prefix="/trips", tags=["trips"])

@router.get("/")
def get_trips(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), admin_user: User = Depends(get_admin_user)):
    return TripService.get_all_trips(db, skip, limit)

@router.get("/available")
def get_available_trips(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return TripService.get_available_trips(db, current_user)

@router.get("/next")
def get_next_trip(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return TripService.get_next_trip(db, current_user)

@router.get("/my")
def get_my_trips(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return TripService.get_my_trips(db, current_user)

@router.get("/billing-status/{year}/{month}")
def get_billing_status(year: int, month: int, db: Session = Depends(get_db), current_user: User = Depends(get_admin_user)):
    return TripService.get_billing_status(db, year, month)

@router.post("/", response_model=TripOut)
def create_trip(trip_data: TripCreate, db: Session = Depends(get_db), current_user: User = Depends(get_admin_user)):
    return TripService.create_trip(db, trip_data)

@router.put("/bulk-bill/{client_id}/{year}/{month}")
def bulk_bill_trips(client_id: str, year: int, month: int, db: Session = Depends(get_db), admin_user: User = Depends(get_admin_user)):
    return TripService.bulk_bill_trips(db, client_id, year, month)

@router.put("/{trip_id}", response_model=TripOut)
def update_trip(trip_id: str, trip_data: TripCreate, db: Session = Depends(get_db), current_user: User = Depends(get_admin_user)):
    return TripService.update_trip(db, trip_id, trip_data)

@router.post("/{trip_id}/duplicate-recurring")
def duplicate_trip_recurring(trip_id: str, request: DuplicateRecurringRequest, db: Session = Depends(get_db), admin_user: User = Depends(get_admin_user)):
    return TripService.duplicate_trip_recurring(db, trip_id, request)

@router.put("/{trip_id}/mark-billed")
def mark_trip_billed(trip_id: str, db: Session = Depends(get_db), admin_user: User = Depends(get_admin_user)):
    return TripService.mark_trip_billed(db, trip_id)

@router.delete("/{trip_id}")
def delete_trip(trip_id: str, db: Session = Depends(get_db), admin_user: User = Depends(get_admin_user)):
    return TripService.delete_trip(db, trip_id)
