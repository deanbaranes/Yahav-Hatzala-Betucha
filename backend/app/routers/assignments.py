from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timezone, time
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.trip import Trip
from app.models.client import Client
from app.models.user import User
from app.models.trip_assignment import TripAssignment
from app.schemas import JoinTripRequest, AdminAssignRequest, PromisedSalaryUpdate
from app.dependencies import get_admin_user, get_current_user
from app.services.notification_service import NotificationService
import os

ADMIN_PHONE = os.getenv("ADMIN_PHONE", "")

router = APIRouter(prefix="/trips", tags=["assignments"])

@router.get("/assignments/unconfirmed")
def get_unconfirmed_assignments(db: Session = Depends(get_db), admin_user: User = Depends(get_admin_user)):
    assignments = db.query(TripAssignment).join(Trip).join(User).filter(
        TripAssignment.is_confirmed == False,
        TripAssignment.status.in_(["assigned", "waitlisted"])
    ).order_by(Trip.start_date.asc()).all()

    return [
        {
            "id": str(a.id),
            "trip_id": str(a.trip_id),
            "user_id": str(a.user_id),
            "full_name": a.user.full_name,
            "phone": a.user.phone,
            "role": a.role,
            "status": a.status,
            "trip_location": a.trip.location,
            "trip_start": a.trip.start_date.isoformat(),
            "contact_phone": a.trip.contact_phone
        } for a in assignments
    ]

@router.patch("/assignments/{assignment_id}/confirm")
def confirm_assignment(assignment_id: str, db: Session = Depends(get_db), admin_user: User = Depends(get_admin_user)):
    assignment = db.query(TripAssignment).filter(TripAssignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="שיבוץ לא נמצא")

    assignment.is_confirmed = True
    assignment.status = "assigned"
    db.commit()

    # Send notification to assigned user
    user = assignment.user
    trip = assignment.trip
    if user:
        contact_parts = []
        if trip.employee_contact_name:
            contact_parts.append(trip.employee_contact_name)
        if trip.employee_contact_phone:
            contact_parts.append(trip.employee_contact_phone)
            
        contact_str = f"פרטי איש קשר לטיול: {' - '.join(contact_parts)}" if contact_parts else ""
        date_str = trip.start_date.strftime("%d/%m/%Y %H:%M") if trip.start_date else ""
        msg = f"הטיול אושר! שובצת סופית לטיול ב-{trip.location} בתאריך {date_str} בתפקיד {assignment.role}. {contact_str}\nלפרטים נוספים: https://yahav-hatzala-betucha.vercel.app"
        NotificationService.create_in_app_notification(msg, db, user_id=user.id)
        if user.phone and user.role != 'admin':
            NotificationService.send_sms(user.phone, msg)

    return {"message": "Assignment confirmed"}

@router.patch("/assignments/{assignment_id}/confirm-arrival")
def confirm_arrival(assignment_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    assignment = db.query(TripAssignment).filter(
        TripAssignment.id == assignment_id,
        TripAssignment.user_id == current_user.id
    ).first()
    
    if not assignment:
        raise HTTPException(status_code=404, detail="שיבוץ לא נמצא או אינו שייך לך")
        
    assignment.employee_confirmed_arrival = True
    db.commit()
    
    # Notify Admin
    trip = assignment.trip
    admin_phone = os.getenv("ADMIN_PHONE")
    msg = f"אישור הגעה: העובד/ת {current_user.full_name} אישר/ה הגעה לטיול ב-{trip.location} (בתאריך {trip.start_date.strftime('%d/%m/%Y')})."
    NotificationService.create_in_app_notification(msg, db)
    if admin_phone:
        NotificationService.send_sms(admin_phone, msg)
        
    return {"message": "Arrival confirmed successfully"}

@router.patch("/assignments/{assignment_id}/promised-salary")
def update_promised_salary(assignment_id: str, request: PromisedSalaryUpdate, db: Session = Depends(get_db), admin_user: User = Depends(get_admin_user)):
    assignment = db.query(TripAssignment).filter(TripAssignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="שיבוץ לא נמצא")
    
    assignment.promised_salary = request.promised_salary
    db.commit()
    return {"message": "Promised salary updated successfully", "promised_salary": assignment.promised_salary}


@router.delete("/assignments/{assignment_id}")
def delete_assignment(assignment_id: str, db: Session = Depends(get_db), admin_user: User = Depends(get_admin_user)):
    assignment = db.query(TripAssignment).filter(TripAssignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="שיבוץ לא נמצא")

    db.delete(assignment)
    db.commit()

    return {"message": "Assignment deleted"}

@router.post("/{trip_id}/join")
def join_trip(trip_id: str, request: JoinTripRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Verify trip exists — with_for_update prevents race condition on capacity check
    trip = db.query(Trip).with_for_update().filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="טיול לא נמצא")

    # Check if trip is in the past
    now = datetime.now()
    start_dt = trip.start_date
    if isinstance(start_dt, str):
        start_dt = datetime.fromisoformat(start_dt)
    if start_dt.replace(tzinfo=None) < now:
        raise HTTPException(status_code=400, detail="לא ניתן להצטרף לטיול שכבר התחיל")

    # Check if user already registered
    existing_assignment = db.query(TripAssignment).filter(
        TripAssignment.trip_id == trip.id,
        TripAssignment.user_id == current_user.id,
        TripAssignment.status.in_(["assigned", "waitlisted"])
    ).first()

    if existing_assignment:
        raise HTTPException(status_code=400, detail="אתה כבר רשום לטיול זה")

    # Check role capacity
    assigned_count_for_role = db.query(TripAssignment).filter(
        TripAssignment.trip_id == trip.id,
        TripAssignment.role == request.role,
        TripAssignment.status == "assigned"
    ).count()

    if trip.roles_requirements and request.role in trip.roles_requirements:
        max_capacity = trip.roles_requirements[request.role]
    else:
        max_capacity = 0  # Cannot join a role that is not requested

    if max_capacity == 0 and not trip.roles_requirements:
        # Legacy trip fallback
        max_capacity = trip.capacity
        assigned_count_for_role = db.query(TripAssignment).filter(
            TripAssignment.trip_id == trip.id,
            TripAssignment.status == "assigned"
        ).count()

    if max_capacity == 0:
        raise HTTPException(status_code=400, detail="תפקיד זה אינו נדרש לטיול זה")

    total_assigned = db.query(TripAssignment).filter(
        TripAssignment.trip_id == trip.id,
        TripAssignment.status == "assigned"
    ).count()

    status = "waitlisted" if (assigned_count_for_role >= max_capacity or total_assigned >= trip.capacity) else "assigned"

    new_assignment = TripAssignment(
        trip_id=trip.id,
        user_id=current_user.id,
        status=status,
        role=request.role
    )
    db.add(new_assignment)
    db.commit()
    db.refresh(new_assignment)

    admin_msg = f"הודעת מערכת: העובד {current_user.full_name} נרשם לטיול ב-{trip.location}. נא להיכנס לאפליקציה כדי לאשר את השיבוץ."
    NotificationService.create_in_app_notification(admin_msg, db)
    
    # Send SMS to Admin
    if ADMIN_PHONE:
        NotificationService.send_sms(ADMIN_PHONE, admin_msg)

    return {"message": f"Successfully joined. Status: {status}", "status": status}

@router.post("/{trip_id}/cancel")
def cancel_trip(trip_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    assignment = db.query(TripAssignment).filter(
        TripAssignment.trip_id == trip_id,
        TripAssignment.user_id == current_user.id,
        TripAssignment.status.in_(["assigned", "waitlisted"])
    ).first()

    if not assignment:
        raise HTTPException(status_code=404, detail="שיבוץ לא נמצא")

    was_assigned = assignment.status == "assigned"
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    assignment.status = "cancelled"
    db.commit()

    admin_msg = f"הודעת מערכת: העובד {current_user.full_name} ביטל את הרישום שלו לטיול ב-{trip.location} ב-{trip.start_date.strftime('%d/%m/%Y')}."
    NotificationService.create_in_app_notification(admin_msg, db)
    
    # Send SMS to Admin
    if ADMIN_PHONE:
        NotificationService.send_sms(ADMIN_PHONE, admin_msg)

    return {"message": "Cancelled successfully"}

@router.post("/{trip_id}/assign")
def admin_assign_trip(trip_id: str, request: AdminAssignRequest, db: Session = Depends(get_db), current_user: User = Depends(get_admin_user)):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="טיול לא נמצא")

    existing = db.query(TripAssignment).filter(
        TripAssignment.trip_id == trip_id,
        TripAssignment.user_id == request.user_id
    ).first()

    if existing:
        existing.status = request.status
        existing.is_confirmed = request.is_confirmed
        existing.role = request.role
        if request.promised_salary is not None:
            existing.promised_salary = request.promised_salary
    else:
        new_assignment = TripAssignment(
            trip_id=trip_id,
            user_id=request.user_id,
            status=request.status,
            role=request.role,
            is_confirmed=request.is_confirmed,
            promised_salary=request.promised_salary
        )
        db.add(new_assignment)
        db.flush()  # flush to get new_assignment.id

    db.commit()

    # Send notification to assigned user
    user = db.query(User).filter(User.id == request.user_id).first()
    if user:
        contact_parts = []
        if trip.employee_contact_name:
            contact_parts.append(trip.employee_contact_name)
        if trip.employee_contact_phone:
            contact_parts.append(trip.employee_contact_phone)
            
        contact_str = f"פרטי איש קשר לטיול: {' - '.join(contact_parts)}" if contact_parts else ""
        date_str = trip.start_date.strftime("%d/%m/%Y %H:%M") if trip.start_date else ""
        msg = f"שובצת לטיול ב-{trip.location} בתאריך {date_str} בתפקיד {request.role}. {contact_str}\nלפרטים ואישור: https://yahav-hatzala-betucha.vercel.app/employee"
        NotificationService.create_in_app_notification(msg, db, user_id=user.id)
        if getattr(request, 'send_sms', True) and user.phone and user.role != 'admin' and user.full_name not in ["יהב כלפון", "דין ברנס"]:
            NotificationService.send_sms(user.phone, msg)
            
        # Send Push Notification
        try:
            from app.services.push_service import send_push_notification
            trip_title = trip.trip_name or trip.location
            push_title = f"שיבוץ חדש: {trip_title}"
            send_push_notification(db, user.id, push_title, msg)
        except Exception as e:
            print("Failed to send push notification:", e)

    return {"message": "Assigned and reported successfully"}

@router.delete("/{trip_id}/assign/{user_id}")
def admin_remove_trip_assignment(trip_id: str, user_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_admin_user)):
    assignment = db.query(TripAssignment).filter(
        TripAssignment.trip_id == trip_id,
        TripAssignment.user_id == user_id
    ).first()

    if not assignment:
        raise HTTPException(status_code=404, detail="שיבוץ לא נמצא")

    db.delete(assignment)
    db.commit()
    return {"message": "Assignment deleted successfully"}
