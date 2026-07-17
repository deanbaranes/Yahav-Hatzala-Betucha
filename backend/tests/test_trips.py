import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.models.user import UserRole, UserStatus
from app.dependencies import get_current_user, get_admin_user
from app.database import get_db
from unittest.mock import MagicMock
from datetime import datetime, timedelta
import uuid

client = TestClient(app)

class MockUser:
    def __init__(self, role, user_id):
        self.id = user_id
        self.role = role
        self.status = UserStatus.active

class MockTrip:
    def __init__(self, start_delta_hours, capacity, is_full=False):
        self.id = uuid.uuid4()
        self.location = "Test Location"
        self.start_date = datetime.now() + timedelta(hours=start_delta_hours)
        self.end_date = self.start_date + timedelta(hours=2)
        self.capacity = capacity
        self.roles_requirements = {}
        
        self.client = MagicMock()
        self.client.id = uuid.uuid4()
        self.client.name = "Test Client"
        
        self.assignments = []
        if is_full:
            for i in range(capacity):
                mock_assign = MagicMock()
                mock_assign.status = "assigned"
                mock_assign.user_id = uuid.uuid4()
                mock_assign.role = "general"
                self.assignments.append(mock_assign)

def get_mock_db_with_trips(trips, assignments=None):
    mock_db = MagicMock()
    
    # Mocking query for Trip
    mock_query = MagicMock()
    mock_db.query.return_value = mock_query
    
    # Simple chain mocking for basic cases
    mock_query.with_for_update.return_value = mock_query
    mock_query.filter.return_value = mock_query
    mock_query.order_by.return_value = mock_query
    mock_query.all.return_value = trips
    mock_query.first.side_effect = lambda: trips[0] if trips else None
    
    if assignments is not None:
        # Complex mocking if we want to mock TripAssignment count/first specifically
        def query_side_effect(model):
            from app.models.trip_assignment import TripAssignment
            from app.models.trip import Trip
            q = MagicMock()
            q.with_for_update.return_value = q
            if model == Trip:
                q.filter.return_value.first.return_value = trips[0] if trips else None
            elif model == TripAssignment:
                filter_mock = MagicMock()
                q.filter.return_value = filter_mock
                filter_mock.first.return_value = None
                filter_mock.count.return_value = len([a for a in assignments if a.status == "assigned"])
            return q
        mock_db.query.side_effect = query_side_effect
        
    return mock_db

def test_get_available_trips_excludes_past():
    # Only 1 future trip, 1 past trip
    future_trip = MockTrip(24, 2)
    past_trip = MockTrip(-24, 2)
    
    mock_user = MockUser(UserRole.employee, uuid.uuid4())
    app.dependency_overrides[get_current_user] = lambda: mock_user
    
    mock_db = get_mock_db_with_trips([future_trip])
    app.dependency_overrides[get_db] = lambda: mock_db
    
    response = client.get("/trips/available")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["location"] == "Test Location"
    
def test_get_available_trips_includes_user_status():
    trip = MockTrip(24, 2)
    mock_user = MockUser(UserRole.employee, uuid.uuid4())
    
    # Add an assignment for this user
    mock_assign = MagicMock()
    mock_assign.status = "assigned"
    mock_assign.user_id = mock_user.id
    mock_assign.role = "general"
    trip.assignments.append(mock_assign)
    
    app.dependency_overrides[get_current_user] = lambda: mock_user
    mock_db = get_mock_db_with_trips([trip])
    app.dependency_overrides[get_db] = lambda: mock_db
    
    response = client.get("/trips/available")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1 # Trip is included
    assert data[0]["user_status"] == "assigned"
    
def test_join_trip_success():
    trip = MockTrip(24, 2)
    mock_user = MockUser(UserRole.employee, uuid.uuid4())
    
    app.dependency_overrides[get_current_user] = lambda: mock_user
    mock_db = get_mock_db_with_trips([trip], assignments=[])
    app.dependency_overrides[get_db] = lambda: mock_db
    
    response = client.post(f"/trips/{trip.id}/join", json={"role": "general"})
    assert response.status_code == 200
    assert response.json()["status"] == "assigned"
    
def test_join_trip_waitlist_if_full():
    trip = MockTrip(24, 2, is_full=True)
    mock_user = MockUser(UserRole.employee, uuid.uuid4())
    
    app.dependency_overrides[get_current_user] = lambda: mock_user
    
    # assignments array containing the 2 existing assignments
    mock_db = get_mock_db_with_trips([trip], assignments=trip.assignments)
    app.dependency_overrides[get_db] = lambda: mock_db
    
    # Wait, the first call to TripAssignment filter.first() is checking existing assignment
    # We want it to return None. Our complex mock might return the first assignment of OTHERS.
    # We must refine the mock so existing assignment check returns None, but count returns 2.
    # To keep it simple, we just override get_db inside a more specific mock.
    
    def override_db():
        from app.models.trip_assignment import TripAssignment
        from app.models.trip import Trip
        db = MagicMock()
        def query(model):
            q = MagicMock()
            q.with_for_update.return_value = q
            if model == Trip:
                q.filter.return_value.first.return_value = trip
            elif model == TripAssignment:
                # Mock the existing assignment check (first() -> None)
                # Mock the count() -> 2
                filter_mock = MagicMock()
                q.filter.return_value = filter_mock
                filter_mock.first.return_value = None
                filter_mock.count.return_value = 2
            return q
        db.query.side_effect = query
        return db
        
    app.dependency_overrides[get_db] = override_db
    
    response = client.post(f"/trips/{trip.id}/join", json={"role": "general"})
    assert response.status_code == 200
    assert response.json()["status"] == "waitlisted"

def test_join_trip_past_fails():
    trip = MockTrip(-2, 2) # Past trip
    mock_user = MockUser(UserRole.employee, uuid.uuid4())
    app.dependency_overrides[get_current_user] = lambda: mock_user
    
    def override_db():
        from app.models.trip import Trip
        db = MagicMock()
        q = MagicMock()
        q.with_for_update.return_value = q
        q.filter.return_value.first.return_value = trip
        db.query.return_value = q
        return db
        
    app.dependency_overrides[get_db] = override_db
    
    response = client.post(f"/trips/{trip.id}/join", json={"role": "general"})
    assert response.status_code == 400
    assert response.json()["detail"] == "Cannot join a trip that already started"

def test_cancel_trip_promotes_waitlisted():
    trip_id = str(uuid.uuid4())
    mock_user = MockUser(UserRole.employee, uuid.uuid4())
    app.dependency_overrides[get_current_user] = lambda: mock_user
    
    # Mock assignments
    assign1 = MagicMock()
    assign1.status = "assigned"
    assign1.user_id = mock_user.id
    
    waitlisted_user_id = uuid.uuid4()
    assign2 = MagicMock()
    assign2.status = "waitlisted"
    assign2.user_id = waitlisted_user_id
    
    def override_db():
        db = MagicMock()
        q = MagicMock()
        db.query.return_value = q
        q.filter.return_value = q
        q.order_by.return_value = q
        
        # When querying assignments for cancel, return assign1
        # When querying trip for promotion, return trip
        # When querying waitlisted assignments, return assign2
        def side_effect(*args, **kwargs):
            if "status" in str(q.filter.call_args):
                pass
            return q
            
        # Simplified mock return based on call order
        q.first.side_effect = [assign1, MagicMock(id=trip_id), assign2]
        return db
        
    app.dependency_overrides[get_db] = override_db
    
    response = client.post(f"/trips/{trip_id}/cancel")
    assert response.status_code == 200
    assert response.json()["message"] == "Cancelled successfully"
    assert response.json()["promoted_user"] == str(waitlisted_user_id)
    assert assign1.status == "cancelled"
    assert assign2.status == "assigned"

# Clean up overrides
def teardown_module(module):
    app.dependency_overrides.clear()
