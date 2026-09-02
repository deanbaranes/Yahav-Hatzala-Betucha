from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.trip import Trip
from icalendar import Calendar, Event
import os
from dateutil import tz

router = APIRouter(prefix="/calendar", tags=["calendar"])

@router.get("/feed.ics")
def get_calendar_feed(token: str = Query(None), db: Session = Depends(get_db)):
    expected_token = os.getenv("CALENDAR_TOKEN", "yahav-secure-feed-2024")
    if token != expected_token:
        raise HTTPException(status_code=401, detail="Unauthorized calendar feed")

    cal = Calendar()
    cal.add('prodid', '-//Yahav Hatzala Betucha//Trips Calendar//EN')
    cal.add('version', '2.0')
    cal.add('name', 'יומן טיולים - יהב')
    cal.add('X-WR-CALNAME', 'יומן טיולים - יהב')
    cal.add('X-APPLE-CALENDAR-COLOR', '#039BE5')

    trips = db.query(Trip).all()
    il_tz = tz.gettz("Asia/Jerusalem")

    for t in trips:
        event = Event()
        client_name = t.client.name if t.client else 'לקוח כללי'
        event.add('summary', f"טיול ב{t.location} ({client_name})")
        
        start = t.start_date
        if start.tzinfo is None:
            start = start.replace(tzinfo=il_tz)
        
        end = t.end_date
        if end.tzinfo is None:
            end = end.replace(tzinfo=il_tz)

        event.add('dtstart', start)
        event.add('dtend', end)
        event.add('location', t.location)
        
        description = f"לקוח: {client_name}\n"
        if t.notes:
            description += f"הערות: {t.notes}\n"
        if t.contact_name or t.contact_phone:
            description += f"איש קשר בשטח: {t.contact_name or ''} {t.contact_phone or ''}\n"
        
        # add assigned workers names
        assigned = [a.user.full_name for a in t.assignments if a.status == 'assigned' and a.user]
        if assigned:
            description += f"\nעובדים משובצים:\n" + "\n".join([f"- {name}" for name in assigned])

        event.add('description', description)
        event.add('uid', f"trip-{t.id}@yahav-hatzala.com")
        cal.add_component(event)

    ics_data = cal.to_ical()
    return Response(content=ics_data, media_type="text/calendar")
