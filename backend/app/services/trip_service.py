from sqlalchemy.orm import Session, joinedload
from sqlalchemy import extract
from datetime import datetime, timezone, time, timedelta
from urllib.parse import urlparse
import requests as http_requests
from icalendar import Calendar as ICalendar
from fastapi import HTTPException

from app.models.trip import Trip
from app.models.client import Client
from app.models.user import User
from app.models.trip_assignment import TripAssignment
from app.schemas import TripCreate, IcalImportRequest, DuplicateRecurringRequest
from app.services.notification_service import NotificationService

class TripService:

    @staticmethod
    def get_all_trips(db: Session, skip: int = 0, limit: int = 100):
        trips = db.query(Trip).options(
            joinedload(Trip.client),
            joinedload(Trip.assignments).joinedload(TripAssignment.user)
        ).order_by(Trip.start_date.desc()).offset(skip).limit(limit).all()
        
        result = []
        for t in trips:
            result.append({
                "id": str(t.id),
                "trip_name": t.trip_name,
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
                        "promised_salary": float(a.promised_salary) if a.promised_salary is not None else None,
                        "employee_confirmed_arrival": getattr(a, 'employee_confirmed_arrival', False),
                        "user": {
                            "full_name": a.user.full_name
                        } if a.user else None
                    } for a in t.assignments
                ] if hasattr(t, 'assignments') and t.assignments else []
            })
        return result

    @staticmethod
    def get_available_trips(db: Session, current_user: User):
        now = datetime.now()
        trips = db.query(Trip).options(
            joinedload(Trip.client),
            joinedload(Trip.assignments).joinedload(TripAssignment.user)
        ).filter(
            Trip.start_date >= now,
            Trip.roles_requirements != None
        ).order_by(Trip.start_date.asc()).all()
        
        result = []
        for t in trips:
            reqs = t.roles_requirements or {}
            total_reqs = sum(int(v) for v in reqs.values() if str(v).isdigit())
            if total_reqs == 0:
                continue
                

            assigned_count = sum(1 for a in t.assignments if a.status == "assigned")

            # If trip is fully staffed, hide it from the available board
            if assigned_count >= total_reqs and total_reqs > 0:
                continue

            role_counts = {}
            for a in t.assignments:
                if a.status == "assigned" and a.role:
                    role_counts[a.role] = role_counts.get(a.role, 0) + 1

            user_assignment = next((a for a in t.assignments if a.user_id == current_user.id and a.status in ["assigned", "waitlisted"]), None)

            result.append({
                "id": str(t.id),
                "trip_name": t.trip_name,
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

    @staticmethod
    def get_next_trip(db: Session, current_user: User):
        now = datetime.now()
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
            "trip_name": t.trip_name,
            "location": t.location,
            "notes": t.notes,
            "start_date": t.start_date.isoformat(),
            "end_date": t.end_date.isoformat() if t.end_date else None,
            "is_confirmed": assignment.is_confirmed,
            "role": assignment.role,
            "employee_contact_name": t.employee_contact_name if assignment.is_confirmed else None,
            "employee_contact_phone": t.employee_contact_phone if assignment.is_confirmed else None,
            "client": {"name": t.client.name} if t.client else None
        }

    @staticmethod
    def get_my_trips(db: Session, current_user: User):
        assignments = db.query(TripAssignment).options(
            joinedload(TripAssignment.trip).joinedload(Trip.client)
        ).join(Trip).filter(
            TripAssignment.user_id == current_user.id,
            TripAssignment.status.in_(["assigned", "waitlisted"])
        ).order_by(Trip.start_date.desc()).all()

        result = []
        for a in assignments:
            t = a.trip
            
            # If the user is waitlisted, hide the trip if it is fully staffed
            if a.status == "waitlisted":
                reqs = t.roles_requirements or {}
                total_reqs = sum(int(v) for v in reqs.values() if str(v).isdigit())
                assigned_count = sum(1 for ta in t.assignments if ta.status == "assigned")
                if assigned_count >= total_reqs and total_reqs > 0:
                    continue

            result.append({
                "id": str(t.id),
                "assignment_id": str(a.id),
                "trip_name": t.trip_name,
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

    @staticmethod
    def get_billing_status(db: Session, year: int, month: int):
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

            # Calculate daily shift hours based on clock time
            start_time = start_dt.time() if start_dt else time(0, 0)
            end_time = trip_end.time() if trip_end else time(0, 0)
            start_mins = start_time.hour * 60 + start_time.minute
            end_mins = end_time.hour * 60 + end_time.minute
            
            if end_mins < start_mins:
                daily_duration = (end_mins + 24 * 60 - start_mins) / 60.0
            else:
                daily_duration = (end_mins - start_mins) / 60.0
                
            if daily_duration == 0 and duration_hours > 0:
                daily_duration = 24.0 if duration_hours >= 24 else duration_hours

            # If the total duration is <= 24 hours, it's considered a single shift (even if overnight)
            if duration_hours <= 24:
                stats["trips_details"].append({
                    "date": start_dt.strftime('%d.%m') if start_dt else "",
                    "location": t.location,
                    "planned_hours": round(duration_hours, 1),
                    "nights": nights
                })
            else:
                # Multi-day trip (multiple shifts)
                days_count = nights + 1
                for i in range(days_count):
                    current_day = start_dt + timedelta(days=i)
                    stats["trips_details"].append({
                        "date": current_day.strftime('%d.%m'),
                        "location": t.location,
                        "planned_hours": round(daily_duration, 1),
                        "nights": 0
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
            stats["total_overtime"] = round(stats["total_overtime"] * 2) / 2
            
            status = "פעיל"
            if stats["invoiced_trips"] == stats["total_trips"]:
                status = "חויב במלואו"
            elif stats["completed_trips"] == stats["total_trips"]:
                status = "מוכן לחיוב"

            stats["status"] = status
            stats["all_notes"] = sorted(list(set(stats["all_notes"])))
            
            result.append(stats)

        result.sort(key=lambda x: 0 if x["status"] == "מוכן לחיוב" else (1 if x["status"] == "פעיל" else 2))
        return result

    @staticmethod
    def create_trip(db: Session, trip_data: TripCreate):
        if trip_data.end_date <= trip_data.start_date:
            raise HTTPException(status_code=400, detail="תאריך הסיום חייב להיות אחרי תאריך ההתחלה")

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

        delta_days = 0
        if trip_data.recurring_type == 'weekly':
            delta_days = 7
        elif trip_data.recurring_type == 'biweekly':
            delta_days = 14

        current_start = trip_data.start_date
        current_end = trip_data.end_date
        end_date_limit = trip_data.recurring_end_date or trip_data.start_date
        
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
                notes=trip_data.notes,
                has_accommodation=trip_data.has_accommodation
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

        # Only broadcast if the trip is NOT fully assigned at creation
        is_fully_assigned = (trip_data.capacity == 1 and trip_data.assigned_user_id is not None)
        if first_trip and trip_data.capacity > 0 and not is_fully_assigned:
            try:
                from app.services.push_service import broadcast_push_notification
                
                trip_title = trip_data.trip_name or trip_data.location
                date_str = first_trip.start_date.strftime("%d/%m/%Y") if first_trip.start_date else ""
                msg = f"טיול ל{trip_title} בתאריך {date_str} נוסף הרגע למערכת. היכנסו עכשיו לאפליקציה כדי להשתבץ."
                push_title = "טיול חדש עלה ללוח! 🚌"
                
                # 1. Device Push Notification
                broadcast_push_notification(db, push_title, msg)
                
                # 2. In-App Bell Notification (user_id=None means broadcast to all)
                NotificationService.create_in_app_notification(message=msg, db=db, user_id=None, title=push_title)
            except Exception as e:
                print("Failed to broadcast push notification:", e)
        
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

    @staticmethod
    def bulk_bill_trips(db: Session, client_id: str, year: int, month: int):
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

    @staticmethod
    def update_trip(db: Session, trip_id: str, trip_data: TripCreate):
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
        trip.has_accommodation = trip_data.has_accommodation

        db.commit()
        db.refresh(trip)
        return trip

    @staticmethod
    def duplicate_trip_recurring(db: Session, trip_id: str, request: DuplicateRecurringRequest):
        base_trip = db.query(Trip).filter(Trip.id == trip_id).first()
        if not base_trip:
            raise HTTPException(status_code=404, detail="Trip not found")

        if request.recurring_type == 'weekly':
            delta_days = 7
        elif request.recurring_type == 'biweekly':
            delta_days = 14
        else:
            raise HTTPException(status_code=400, detail="Invalid recurring_type")

        end_date_limit = request.recurring_end_date
        if end_date_limit.tzinfo is not None:
            end_date_limit = end_date_limit.astimezone(timezone.utc).replace(tzinfo=None)

        current_start = base_trip.start_date + timedelta(days=delta_days)
        if base_trip.end_date:
            current_end = base_trip.end_date + timedelta(days=delta_days)
        else:
            current_end = current_start

        max_trips = 104
        created_count = 0

        base_assignments = db.query(TripAssignment).filter(TripAssignment.trip_id == base_trip.id, TripAssignment.status == "assigned").all()

        while current_start <= end_date_limit and created_count < max_trips:
            new_trip = Trip(
                client_id=base_trip.client_id,
                location=base_trip.location,
                start_date=current_start,
                end_date=current_end,
                capacity=base_trip.capacity,
                roles_requirements=base_trip.roles_requirements,
                color=base_trip.color,
                global_salary=base_trip.global_salary,
                contact_name=base_trip.contact_name,
                contact_phone=base_trip.contact_phone,
                employee_contact_name=base_trip.employee_contact_name,
                employee_contact_phone=base_trip.employee_contact_phone,
                notes=base_trip.notes,
                has_accommodation=base_trip.has_accommodation
            )
            db.add(new_trip)
            db.flush()

            for a in base_assignments:
                new_a = TripAssignment(
                    trip_id=new_trip.id,
                    user_id=a.user_id,
                    role=a.role,
                    status="assigned",
                    is_confirmed=True
                )
                db.add(new_a)
            
            created_count += 1
            current_start += timedelta(days=delta_days)
            current_end += timedelta(days=delta_days)

        db.commit()

        if created_count > 0:
            for a in base_assignments:
                user = db.query(User).filter(User.id == a.user_id).first()
                if user:
                    msg = f"שובצת לסדרת אירועים (סך הכל {created_count} מפגשים נוספים) במיקום {base_trip.location} בתפקיד {a.role}."
                    NotificationService.create_in_app_notification(msg, db, user_id=user.id)
                    if user.phone and user.role != 'admin' and user.full_name not in ["יהב כלפון", "דין ברנס"]:
                        NotificationService.send_sms(user.phone, msg)

        return {"message": f"Successfully created {created_count} recurring trips"}

    @staticmethod
    def mark_trip_billed(db: Session, trip_id: str):
        trip = db.query(Trip).filter(Trip.id == trip_id).first()
        if not trip:
            raise HTTPException(status_code=404, detail="טיול לא נמצא")

        trip.is_billed = not trip.is_billed
        db.commit()
        return {"message": "Trip billing status toggled", "is_billed": trip.is_billed}

    @staticmethod
    def delete_trip(db: Session, trip_id: str):
        trip = db.query(Trip).filter(Trip.id == trip_id).first()
        if not trip:
            raise HTTPException(status_code=404, detail="טיול לא נמצא")

        from app.services.notification_service import NotificationService
        from app.models.trip_assignment import TripAssignment
        
        assignments = db.query(TripAssignment).filter(
            TripAssignment.trip_id == trip.id, 
            TripAssignment.status == "assigned"
        ).all()
        
        trip_title = trip.trip_name or trip.location
        date_str = trip.start_date.strftime("%d/%m/%Y") if trip.start_date else ""
        msg = f"הודעת מערכת: הטיול ל{trip_title} בתאריך {date_str} אליו שובצת - בוטל."
        
        for assignment in assignments:
            user = assignment.user
            if user:
                NotificationService.create_in_app_notification(msg, db, user_id=user.id, title="ביטול טיול")
                if user.phone:
                    NotificationService.send_sms(user.phone, msg)

        db.delete(trip)
        db.commit()
        return {"message": "Trip deleted successfully"}
