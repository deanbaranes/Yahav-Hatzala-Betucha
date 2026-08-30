from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone, time, timedelta
from urllib.parse import urlparse
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.models.trip import Trip
from app.models.client import Client
from app.models.user import User
from app.models.trip_assignment import TripAssignment
from app.schemas import TripCreate, TripOut, JoinTripRequest, AdminAssignRequest, IcalImportRequest
from app.dependencies import get_admin_user, get_current_user
from app.services.notification_service import NotificationService
import requests as http_requests
from icalendar import Calendar as ICalendar
from sqlalchemy import extract
import os

# טלפון המנהל — מוגדר ב-.env כ-ADMIN_PHONE
ADMIN_PHONE = os.getenv("ADMIN_PHONE", "")

router = APIRouter(prefix="/trips", tags=["trips"])


# ── Static GET routes (no dynamic /{trip_id} as first segment) ─────────────────

@router.get("/")
def get_trips(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), admin_user: User = Depends(get_admin_user)):
    # Eager load client and assignments (with their users) to avoid severe N+1 bottlenecks
    trips = db.query(Trip).options(
        joinedload(Trip.client),
        joinedload(Trip.assignments).joinedload(TripAssignment.user)
    ).order_by(Trip.start_date.desc()).offset(skip).limit(limit).all()
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
            "global_salary": t.global_salary,
            "contact_name": t.contact_name,
            "contact_phone": t.contact_phone,
            "employee_contact_name": t.employee_contact_name,
            "employee_contact_phone": t.employee_contact_phone,
            "notes": t.notes,
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
                    "role": a.role,
                    "employee_confirmed_arrival": getattr(a, 'employee_confirmed_arrival', False),
                    "user": {
                        "full_name": a.user.full_name
                    } if a.user else None
                } for a in t.assignments
            ] if hasattr(t, 'assignments') and t.assignments else []
        })
    return result

@router.get("/available")
def get_available_trips(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    now = datetime.now()
    # Only show trips that have defined role requirements (capacity > 0 in at least one role).
    # Trips with empty roles_requirements are internal admin trips.
    trips = db.query(Trip).options(
        joinedload(Trip.client),
        joinedload(Trip.assignments)
    ).filter(
        Trip.start_date >= now,
        Trip.roles_requirements != None
    ).order_by(Trip.start_date.asc()).all()
    
    result = []
    for t in trips:
        # Only show trips that actually require staff
        reqs = t.roles_requirements or {}
        # Make sure we sum only numeric values safely
        total_reqs = sum(int(v) for v in reqs.values() if str(v).isdigit())
        if total_reqs == 0:
            continue

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
            "notes": t.notes,
            "capacity": t.capacity,
            "roles_requirements": t.roles_requirements or {},
            "role_counts": role_counts,
            "assigned_count": assigned_count,
            "user_status": user_assignment.status if user_assignment else None,
            "user_is_confirmed": user_assignment.is_confirmed if user_assignment else False,
            "client": {"id": str(t.client.id), "name": t.client.name} if t.client else None
        })
    return result

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
        "notes": t.notes,
        "start_date": t.start_date.isoformat(),
        "is_confirmed": assignment.is_confirmed,
        "client": {"name": t.client.name} if t.client else None
    }

@router.get("/my")
def get_my_trips(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    assignments = db.query(TripAssignment).join(Trip).filter(
        TripAssignment.user_id == current_user.id,
        TripAssignment.status.in_(["assigned", "waitlisted"])
    ).order_by(Trip.start_date.desc()).all()

    result = []
    for a in assignments:
        t = a.trip
        result.append({
            "id": str(t.id),
            "assignment_id": str(a.id),
            "location": t.location,
            "start_date": t.start_date.isoformat(),
            "end_date": t.end_date.isoformat() if t.end_date else None,
            "notes": t.notes,
            "status": a.status,
            "role": a.role,
            "is_confirmed": a.is_confirmed,
            "employee_confirmed_arrival": getattr(a, 'employee_confirmed_arrival', False),
            "employee_contact_name": t.employee_contact_name if a.is_confirmed else None,
            "employee_contact_phone": t.employee_contact_phone if a.is_confirmed else None,
            "client": {"name": t.client.name} if t.client else None
        })
    return result

@router.get("/billing-status/{year}/{month}")
def get_billing_status(year: int, month: int, db: Session = Depends(get_db), current_user: User = Depends(get_admin_user)):
    trips = db.query(Trip).options(
        joinedload(Trip.client),
        joinedload(Trip.assignments).joinedload(TripAssignment.report)
    ).filter(
        extract('year', Trip.start_date) == year,
        extract('month', Trip.start_date) == month
    ).order_by(Trip.start_date.asc()).all()

    client_stats = {}
    now = datetime.now()

    for t in trips:
        c_id = str(t.client_id)
        if c_id not in client_stats:
            client_stats[c_id] = {
                "client_id": c_id,
                "client_name": t.client.name if t.client else "לקוח כללי",
                "total_trips": 0,
                "completed_trips": 0,
                "invoiced_trips": 0,
                "total_overtime": 0.0,
                "total_expenses": 0.0,
                "roles_summary": {},
                "all_notes": [],
                "trips_details": [],
                "client_notes": t.client.notes if t.client else ""
            }

        stats = client_stats[c_id]
        stats["total_trips"] += 1

        start_dt = t.start_date
        if start_dt and hasattr(start_dt, 'tzinfo') and start_dt.tzinfo is not None:
            start_dt = start_dt.replace(tzinfo=None)
            
        trip_end = t.end_date or t.start_date
        if trip_end and hasattr(trip_end, 'tzinfo') and trip_end.tzinfo is not None:
            trip_end = trip_end.replace(tzinfo=None)
            
        duration_hours = (trip_end - start_dt).total_seconds() / 3600.0 if start_dt and trip_end else 0
        
        nights = 0
        if start_dt and trip_end:
            nights = (trip_end.date() - start_dt.date()).days
            if nights < 0:
                nights = 0
        
        stats["trips_details"].append({
            "date": start_dt.strftime('%d.%m') if start_dt else "",
            "location": t.location,
            "planned_hours": round(duration_hours, 1),
            "nights": nights
        })

        if t.notes and t.notes.strip():
            stats["all_notes"].append(t.notes.strip())

        if trip_end < now:
            stats["completed_trips"] += 1

        if t.is_billed:
            stats["invoiced_trips"] += 1

        has_confirmed_assignments = False
        for a in t.assignments:
            if a.status == "assigned" and a.is_confirmed:
                has_confirmed_assignments = True
                role = a.role or "כללי"
                if role not in stats["roles_summary"]:
                    stats["roles_summary"][role] = 0
                stats["roles_summary"][role] += 1

            if a.report and a.report.manager_status == "approved":
                stats["total_overtime"] += float(a.report.overtime_decimal or 0)
                stats["total_expenses"] += float(a.report.expenses or 0)
                
        # Fallback for billing: if they didn't assign staff in the app, use the trip's requirements
        if not has_confirmed_assignments:
            if t.roles_requirements and len(t.roles_requirements) > 0:
                for role, count in t.roles_requirements.items():
                    if role not in stats["roles_summary"]:
                        stats["roles_summary"][role] = 0
                    stats["roles_summary"][role] += int(count)
            elif t.capacity > 0:
                if "כללי" not in stats["roles_summary"]:
                    stats["roles_summary"]["כללי"] = 0
                stats["roles_summary"]["כללי"] += t.capacity

    result = []
    for stats in client_stats.values():
        # Round total overtime to nearest 0.5 (jumps of half an hour)
        stats["total_overtime"] = round(stats["total_overtime"] * 2) / 2
        
        status = "פעיל"
        if stats["invoiced_trips"] == stats["total_trips"]:
            status = "חויב במלואו"
        elif stats["completed_trips"] == stats["total_trips"]:
            status = "מוכן לחיוב"

        stats["status"] = status
        
        # Deduplicate and sort notes
        stats["all_notes"] = sorted(list(set(stats["all_notes"])))
        
        result.append(stats)

    # Sort so "מוכן לחיוב" comes first
    result.sort(key=lambda x: 0 if x["status"] == "מוכן לחיוב" else (1 if x["status"] == "פעיל" else 2))
    return result

@router.post("/", response_model=TripOut)
def create_trip(trip_data: TripCreate, db: Session = Depends(get_db), current_user: User = Depends(get_admin_user)):
    # Validations

    if trip_data.end_date <= trip_data.start_date:
        raise HTTPException(status_code=400, detail="תאריך הסיום חייב להיות אחרי תאריך ההתחלה")

    # Soft Client Creation
    client = db.query(Client).filter(Client.name == trip_data.client_name).first()
    if not client:
        client = Client(name=trip_data.client_name, contact_person=trip_data.contact_name, phone=trip_data.contact_phone)
        db.add(client)
        db.commit()
        db.refresh(client)
    else:
        updated = False
        if trip_data.contact_name and client.contact_person != trip_data.contact_name:
            client.contact_person = trip_data.contact_name
            updated = True
        if trip_data.contact_phone and client.phone != trip_data.contact_phone:
            client.phone = trip_data.contact_phone
            updated = True
        if updated:
            db.commit()
            db.refresh(client)

    # Calculate recurring delta if specified
    delta_days = 0
    if trip_data.recurring_type == 'weekly':
        delta_days = 7
    elif trip_data.recurring_type == 'biweekly':
        delta_days = 14

    current_start = trip_data.start_date
    current_end = trip_data.end_date
    end_date_limit = trip_data.recurring_end_date or trip_data.start_date
    
    # Max safety limit to prevent infinite loops (approx 2 years weekly)
    max_trips = 104
    created_count = 0
    first_trip = None

    while current_start <= end_date_limit and created_count < max_trips:
        new_trip = Trip(
            client_id=client.id,
            location=trip_data.location,
            start_date=current_start,
            end_date=current_end,
            capacity=trip_data.capacity,
            roles_requirements=trip_data.roles_requirements,
            color=trip_data.color,
            global_salary=trip_data.global_salary,
            contact_name=trip_data.contact_name,
            contact_phone=trip_data.contact_phone,
            employee_contact_name=trip_data.employee_contact_name,
            employee_contact_phone=trip_data.employee_contact_phone,
            notes=trip_data.notes
        )
        db.add(new_trip)
        db.flush()
        
        if trip_data.assigned_user_id:
            new_assignment = TripAssignment(
                trip_id=new_trip.id,
                user_id=trip_data.assigned_user_id,
                role=trip_data.assigned_role or "כללי",
                status="assigned",
                is_confirmed=True
            )
            db.add(new_assignment)
        
        if not first_trip:
            first_trip = new_trip
            
        created_count += 1
        
        if delta_days == 0:
            break
            
        current_start += timedelta(days=delta_days)
        current_end += timedelta(days=delta_days)

    db.commit()
    
    if trip_data.assigned_user_id and created_count > 0:
        assigned_user = db.query(User).filter(User.id == trip_data.assigned_user_id).first()
        if assigned_user:
            if created_count > 1:
                msg = f"שובצת לסדרת אירועים (סך הכל {created_count} מפגשים) במיקום {trip_data.location} בתפקיד {trip_data.assigned_role or 'כללי'}."
            else:
                date_str = first_trip.start_date.strftime("%d/%m/%Y %H:%M") if first_trip.start_date else ""
                msg = f"שובצת לטיול ב-{first_trip.location} בתאריך {date_str} בתפקיד {trip_data.assigned_role or 'כללי'}."
            
            NotificationService.create_in_app_notification(msg, db, user_id=assigned_user.id)
            if assigned_user.phone and assigned_user.role != 'admin':
                NotificationService.send_sms(assigned_user.phone, msg)

    db.refresh(first_trip)
    return first_trip

@router.post("/import-ical")
def import_from_ical(
    body: IcalImportRequest,
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_admin_user)
):
    """
    Imports trips from a Google Calendar secret ICS URL.
    Parses each VEVENT and creates a Trip in the DB.
    """
    # ── SSRF Protection: only allow known calendar providers ──
    ALLOWED_ICAL_HOSTS = {"calendar.google.com", "outlook.office365.com", "outlook.live.com", "p18-caldav.icloud.com"}
    parsed_url = urlparse(body.ical_url)
    if not parsed_url.scheme.startswith("https"):
        raise HTTPException(status_code=400, detail="רק כתובות HTTPS נתמכות.")
    if parsed_url.hostname not in ALLOWED_ICAL_HOSTS:
        raise HTTPException(status_code=400, detail=f"URL לא מורשה. נתמכים: Google Calendar, Outlook, iCloud בלבד.")

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
                start_dt = datetime.combine(start_dt, time(9, 0))
                end_dt = datetime.combine(end_dt, time(18, 0))
            else:
                # Convert timezone-aware to UTC naive
                if hasattr(start_dt, 'tzinfo') and start_dt.tzinfo is not None:
                    start_dt = start_dt.astimezone(timezone.utc).replace(tzinfo=None)
                if hasattr(end_dt, 'tzinfo') and end_dt.tzinfo is not None:
                    end_dt = end_dt.astimezone(timezone.utc).replace(tzinfo=None)

            # Skip events before July 1st, 2026 (prevent importing old history)
            if start_dt < datetime(2026, 7, 1):
                skipped += 1
                continue

            client_name = "לקוח כללי"
            client = db.query(Client).filter(Client.name == client_name).first()
            if not client:
                client = Client(name=client_name)
                db.add(client)
                db.flush()  # get ID without committing

            # Combine summary and location so no data is lost
            trip_location = location
            if summary and summary != location:
                trip_location = f"{summary} - {location}" if location != "לא צוין" else summary

            # Skip if trip with same client + start_date + location already exists
            existing = db.query(Trip).filter(
                Trip.client_id == client.id,
                Trip.start_date == start_dt,
                Trip.location == trip_location
            ).first()
            if existing:
                skipped += 1
                continue

            trip = Trip(
                client_id=client.id,
                location=trip_location,
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
        "message": "ייבוא הושלם בהצלחה!",
        "created": created,
        "skipped": skipped,
        "errors": errors[:5]
    }


# ── Static PATCH / DELETE routes (assignments prefix) ─────────────────────────

@router.put("/bulk-bill/{client_id}/{year}/{month}")
def bulk_bill_trips(client_id: str, year: int, month: int, db: Session = Depends(get_db), admin_user: User = Depends(get_admin_user)):
    trips = db.query(Trip).filter(
        Trip.client_id == client_id,
        extract('year', Trip.start_date) == year,
        extract('month', Trip.start_date) == month,
        Trip.is_billed == False
    ).all()
    
    count = 0
    for t in trips:
        t.is_billed = True
        count += 1
        
    db.commit()
    return {"message": f"Successfully billed {count} trips", "count": count}

# ── Dynamic routes (/{trip_id} as first segment) — MUST come after all static ──

@router.put("/{trip_id}", response_model=TripOut)
def update_trip(trip_id: str, trip_data: TripCreate, db: Session = Depends(get_db), current_user: User = Depends(get_admin_user)):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="טיול לא נמצא")

    client = db.query(Client).filter(Client.name == trip_data.client_name).first()
    if not client:
        client = Client(name=trip_data.client_name, contact_person=trip_data.contact_name, phone=trip_data.contact_phone)
        db.add(client)
        db.commit()
        db.refresh(client)
    else:
        updated = False
        if trip_data.contact_name and client.contact_person != trip_data.contact_name:
            client.contact_person = trip_data.contact_name
            updated = True
        if trip_data.contact_phone and client.phone != trip_data.contact_phone:
            client.phone = trip_data.contact_phone
            updated = True
        if updated:
            db.commit()
            db.refresh(client)

    trip.client_id = client.id
    trip.location = trip_data.location
    trip.start_date = trip_data.start_date
    trip.end_date = trip_data.end_date
    trip.capacity = trip_data.capacity
    trip.roles_requirements = trip_data.roles_requirements
    trip.color = trip_data.color
    trip.global_salary = trip_data.global_salary
    trip.contact_name = trip_data.contact_name
    trip.contact_phone = trip_data.contact_phone
    trip.employee_contact_name = trip_data.employee_contact_name
    trip.employee_contact_phone = trip_data.employee_contact_phone
    trip.notes = trip_data.notes

    db.commit()
    db.refresh(trip)
    return trip

@router.put("/{trip_id}/mark-billed")
def mark_trip_billed(trip_id: str, db: Session = Depends(get_db), admin_user: User = Depends(get_admin_user)):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="טיול לא נמצא")

    trip.is_billed = not trip.is_billed
    db.commit()
    return {"message": "Trip billing status toggled", "is_billed": trip.is_billed}

@router.delete("/{trip_id}")
def delete_trip(trip_id: str, db: Session = Depends(get_db), admin_user: User = Depends(get_admin_user)):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="טיול לא נמצא")

    db.delete(trip)
    db.commit()
    return {"message": "Trip deleted successfully"}
