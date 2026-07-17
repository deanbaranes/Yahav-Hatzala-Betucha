from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.trip import Trip
from app.models.client import Client
from app.models.user import User
from app.models.trip_assignment import TripAssignment
from app.schemas import TripCreate, TripOut, JoinTripRequest
from app.dependencies import get_admin_user, get_current_user
from pydantic import BaseModel
import requests as http_requests
from icalendar import Calendar as ICalendar

router = APIRouter(prefix="/trips", tags=["trips"])

@router.post("/", response_model=TripOut)
def create_trip(trip_data: TripCreate, db: Session = Depends(get_db), current_user: User = Depends(get_admin_user)):
    # Validations
    now = datetime.now()
    # Ensure start date is not in the past (allow 1 hour buffer)
    # Since trip_data.start_date is naive (from datetime-local), now() should also be naive
    start_date_naive = trip_data.start_date.replace(tzinfo=None)
    
    if start_date_naive < now and (now - start_date_naive).total_seconds() > 3600:
        raise HTTPException(status_code=400, detail="Start date cannot be in the past")
    
    if trip_data.end_date <= trip_data.start_date:
        raise HTTPException(status_code=400, detail="End date must be after start date")

    # Soft Client Creation
    client = db.query(Client).filter(Client.name == trip_data.client_name).first()
    if not client:
        client = Client(name=trip_data.client_name, contact_person=trip_data.client_contact_person)
        db.add(client)
        db.commit()
        db.refresh(client)
        
    new_trip = Trip(
        client_id=client.id,
        location=trip_data.location,
        start_date=trip_data.start_date,
        end_date=trip_data.end_date,
        capacity=trip_data.capacity,
        roles_requirements=trip_data.roles_requirements,
        color=trip_data.color
    )
    db.add(new_trip)
    db.commit()
    db.refresh(new_trip)
    return new_trip

@router.put("/{trip_id}", response_model=TripOut)
def update_trip(trip_id: str, trip_data: TripCreate, db: Session = Depends(get_db), current_user: User = Depends(get_admin_user)):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
        
    client = db.query(Client).filter(Client.name == trip_data.client_name).first()
    if not client:
        client = Client(name=trip_data.client_name, contact_person=trip_data.client_contact_person)
        db.add(client)
        db.commit()
        db.refresh(client)
        
    trip.client_id = client.id
    trip.location = trip_data.location
    trip.start_date = trip_data.start_date
    trip.end_date = trip_data.end_date
    trip.capacity = trip_data.capacity
    trip.roles_requirements = trip_data.roles_requirements
    trip.color = trip_data.color
    
    db.commit()
    db.refresh(trip)
    return trip

@router.get("/available")
def get_available_trips(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    now = datetime.now()
    # Fetch trips that haven't ended yet
    trips = db.query(Trip).filter(Trip.start_date >= now).order_by(Trip.start_date.asc()).all()
    result = []
    for t in trips:
        # Count assignments
        assigned_count = sum(1 for a in t.assignments if a.status == "assigned")
        
        # Calculate assignments per role
        role_counts = {}
        for a in t.assignments:
            if a.status == "assigned" and a.role:
                role_counts[a.role] = role_counts.get(a.role, 0) + 1
        
        # Check if current user is already assigned or waitlisted
        user_assignment = next((a for a in t.assignments if a.user_id == current_user.id and a.status in ["assigned", "waitlisted"]), None)
            
        result.append({
            "id": str(t.id),
            "location": t.location,
            "start_date": t.start_date.isoformat(),
            "end_date": t.end_date.isoformat() if t.end_date else None,
            "capacity": t.capacity,
            "roles_requirements": t.roles_requirements or {},
            "role_counts": role_counts,
            "assigned_count": assigned_count,
            "user_status": user_assignment.status if user_assignment else None,
            "client": {"id": str(t.client.id), "name": t.client.name} if t.client else None
        })
    return result

@router.post("/{trip_id}/join")
def join_trip(trip_id: str, request: JoinTripRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Verify trip exists
    trip = db.query(Trip).with_for_update().filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
        
    # Check if trip is in the past
    now = datetime.now()
    start_dt = trip.start_date
    if isinstance(start_dt, str):
        start_dt = datetime.fromisoformat(start_dt)
    if start_dt.replace(tzinfo=None) < now:
        raise HTTPException(status_code=400, detail="Cannot join a trip that already started")

    # Check if user already registered
    existing_assignment = db.query(TripAssignment).filter(
        TripAssignment.trip_id == trip.id,
        TripAssignment.user_id == current_user.id,
        TripAssignment.status.in_(["assigned", "waitlisted"])
    ).first()
    
    if existing_assignment:
        raise HTTPException(status_code=400, detail="You are already registered for this trip")
        
    # Check role capacity
    assigned_count_for_role = db.query(TripAssignment).filter(
        TripAssignment.trip_id == trip.id,
        TripAssignment.role == request.role,
        TripAssignment.status == "assigned"
    ).count()
    
    # If the trip has roles_requirements, check capacity per role
    if trip.roles_requirements and request.role in trip.roles_requirements:
        max_capacity = trip.roles_requirements[request.role]
    else:
        # Fallback to general capacity or fail
        max_capacity = 0 # Cannot join a role that is not requested
        
    if max_capacity == 0 and not trip.roles_requirements:
        # Legacy trip fallback
        max_capacity = trip.capacity
        assigned_count_for_role = db.query(TripAssignment).filter(
            TripAssignment.trip_id == trip.id,
            TripAssignment.status == "assigned"
        ).count()
    
    if max_capacity == 0:
        raise HTTPException(status_code=400, detail="Role not required for this trip")
        
    status = "waitlisted" if assigned_count_for_role >= max_capacity else "assigned"
    
    new_assignment = TripAssignment(
        trip_id=trip.id,
        user_id=current_user.id,
        status=status,
        role=request.role
    )
    db.add(new_assignment)
    db.commit()
    db.refresh(new_assignment)
    
    return {"message": f"Successfully joined. Status: {status}", "status": status}

@router.post("/{trip_id}/cancel")
def cancel_trip(trip_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    assignment = db.query(TripAssignment).filter(
        TripAssignment.trip_id == trip_id,
        TripAssignment.user_id == current_user.id,
        TripAssignment.status.in_(["assigned", "waitlisted"])
    ).first()
    
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
        
    was_assigned = assignment.status == "assigned"
    assignment.status = "cancelled"
    db.commit()
    
    # If the user was assigned, we might have a waitlisted user to promote
    promoted_user = None
    if was_assigned:
        trip = db.query(Trip).filter(Trip.id == trip_id).first()
        # Find oldest waitlisted
        next_in_line = db.query(TripAssignment).filter(
            TripAssignment.trip_id == trip_id,
            TripAssignment.status == "waitlisted"
        ).order_by(TripAssignment.created_at.asc()).first()
        
        if next_in_line:
            next_in_line.status = "assigned"
            db.commit()
            promoted_user = next_in_line.user_id
            # TODO: Trigger Twilio SMS notification here (mocked in tests)
            pass
            
    return {"message": "Cancelled successfully", "promoted_user": str(promoted_user) if promoted_user else None}

@router.get("/next")
def get_next_trip(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    now = datetime.now()
    # Find the next upcoming trip the user is assigned to
    assignment = db.query(TripAssignment).join(Trip).filter(
        TripAssignment.user_id == current_user.id,
        TripAssignment.status == "assigned",
        Trip.start_date >= now
    ).order_by(Trip.start_date.asc()).first()
    
    if not assignment:
        return None
        
    t = assignment.trip
    return {
        "id": str(t.id),
        "assignment_id": str(assignment.id),
        "location": t.location,
        "start_date": t.start_date.isoformat(),
        "is_confirmed": assignment.is_confirmed,
        "client": {"name": t.client.name} if t.client else None
    }

@router.get("/")
def get_trips(db: Session = Depends(get_db)):
    trips = db.query(Trip).order_by(Trip.start_date.desc()).all()
    # Serialize trips and their client + assignments
    result = []
    for t in trips:
        result.append({
            "id": str(t.id),
            "location": t.location,
            "start_date": t.start_date.isoformat(),
            "end_date": t.end_date.isoformat() if t.end_date else None,
            "capacity": t.capacity,
            "roles_requirements": t.roles_requirements or {},
            "is_billed": t.is_billed,
            "color": t.color,
            "client": {
                "id": str(t.client.id),
                "name": t.client.name,
            } if t.client else None,
            "assignments": [
                {
                    "id": str(a.id),
                    "is_confirmed": a.is_confirmed,
                    "user_id": str(a.user_id),
                    "status": a.status,
                    "user": {
                        "full_name": a.user.full_name
                    } if a.user else None
                } for a in t.assignments
            ] if hasattr(t, 'assignments') and t.assignments else []
        })
    return result
@router.get("/assignments/unconfirmed")
def get_unconfirmed_assignments(db: Session = Depends(get_db), admin_user: User = Depends(get_admin_user)):
    assignments = db.query(TripAssignment).join(Trip).join(User).filter(
        TripAssignment.is_confirmed == False,
        TripAssignment.status == "assigned"
    ).order_by(Trip.start_date.asc()).all()
    
    return [
        {
            "id": str(a.id),
            "trip_id": str(a.trip_id),
            "user_id": str(a.user_id),
            "full_name": a.user.full_name,
            "phone": a.user.phone,
            "role": a.role,
            "trip_location": a.trip.location,
            "trip_start": a.trip.start_date.isoformat()
        } for a in assignments
    ]

@router.patch("/assignments/{assignment_id}/confirm")
def confirm_assignment(assignment_id: str, db: Session = Depends(get_db)):
    assignment = db.query(TripAssignment).filter(TripAssignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
        
    assignment.is_confirmed = True
    db.commit()
    return {"message": "Assignment confirmed"}

@router.delete("/assignments/{assignment_id}")
def delete_assignment(assignment_id: str, db: Session = Depends(get_db), admin_user: User = Depends(get_admin_user)):
    assignment = db.query(TripAssignment).filter(TripAssignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    trip_id = assignment.trip_id
    db.delete(assignment)
    db.commit()
    
    # Try to promote waitlisted user
    next_in_line = db.query(TripAssignment).filter(
        TripAssignment.trip_id == trip_id,
        TripAssignment.status == "waitlisted"
    ).order_by(TripAssignment.created_at.asc()).first()
    
    if next_in_line:
        next_in_line.status = "assigned"
        db.commit()
        
    return {"message": "Assignment deleted"}

@router.delete("/{trip_id}")
def delete_trip(trip_id: str, db: Session = Depends(get_db), admin_user: User = Depends(get_admin_user)):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
        
    db.delete(trip)
    db.commit()
    return {"message": "Trip deleted successfully"}

@router.put("/{trip_id}/mark-billed")
def mark_trip_billed(trip_id: str, db: Session = Depends(get_db), admin_user: User = Depends(get_admin_user)):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
        
    trip.is_billed = not trip.is_billed
    db.commit()
    return {"message": "Trip billing status toggled", "is_billed": trip.is_billed}


class IcalImportRequest(BaseModel):
    ical_url: str
    default_client_name: str = "לקוח מיומן גוגל"

@router.post("/import-ical")
def import_from_ical(
    body: IcalImportRequest,
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_admin_user)
):
    """
    Imports trips from a Google Calendar secret ICS URL.
    Parses each VEVENT and creates a Trip in the DB.
    If client_name is found in the event summary/description, it links the trip to that client.
    """
    try:
        resp = http_requests.get(body.ical_url, timeout=15)
        resp.raise_for_status()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"לא ניתן לגשת ל-URL של היומן: {str(e)}")

    try:
        cal = ICalendar.from_ical(resp.content)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"שגיאה בפרסור קובץ ICS: {str(e)}")

    created = 0
    skipped = 0
    errors = []

    for component in cal.walk():
        if component.name != "VEVENT":
            continue

        try:
            summary = str(component.get("SUMMARY", "")).strip()
            description = str(component.get("DESCRIPTION", "")).strip()
            location = str(component.get("LOCATION", "")).strip() or summary or "לא צוין"

            dtstart = component.get("DTSTART")
            dtend = component.get("DTEND")

            if not dtstart or not dtend:
                skipped += 1
                continue

            # Normalize to naive datetime
            start_dt = dtstart.dt
            end_dt = dtend.dt

            # Handle date-only events (all-day)
            if not hasattr(start_dt, 'hour'):
                from datetime import time
                start_dt = datetime.combine(start_dt, time(9, 0))
                end_dt = datetime.combine(end_dt, time(18, 0))
            else:
                # Convert timezone-aware to UTC naive
                if hasattr(start_dt, 'tzinfo') and start_dt.tzinfo is not None:
                    start_dt = start_dt.astimezone(timezone.utc).replace(tzinfo=None)
                if hasattr(end_dt, 'tzinfo') and end_dt.tzinfo is not None:
                    end_dt = end_dt.astimezone(timezone.utc).replace(tzinfo=None)

            # Skip events in the far past (over 1 year ago)
            if (datetime.utcnow() - start_dt).days > 365:
                skipped += 1
                continue

            # Determine client name from summary (use the event title as client name)
            client_name = summary if summary else body.default_client_name

            # Find or create client
            client = db.query(Client).filter(Client.name.ilike(client_name)).first()
            if not client:
                client = Client(name=client_name)
                db.add(client)
                db.flush()  # get ID without committing

            # Skip if trip with same client + start_date already exists
            existing = db.query(Trip).filter(
                Trip.client_id == client.id,
                Trip.start_date == start_dt
            ).first()
            if existing:
                skipped += 1
                continue

            trip = Trip(
                client_id=client.id,
                location=location,
                start_date=start_dt,
                end_date=end_dt,
                capacity=0,
                roles_requirements={},
                is_billed=False
            )
            db.add(trip)
            created += 1

        except Exception as e:
            errors.append(str(e))
            continue

    db.commit()
    return {
        "message": f"ייבוא הושלם בהצלחה!",
        "created": created,
        "skipped": skipped,
        "errors": errors[:5]  # return first 5 errors if any
    }
