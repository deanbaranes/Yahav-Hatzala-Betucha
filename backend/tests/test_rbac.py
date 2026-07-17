import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.models.user import UserRole, UserStatus
from app.dependencies import get_current_user

client = TestClient(app)

def override_get_current_employee():
    # Return a mock employee user
    class MockUser:
        id = "123e4567-e89b-12d3-a456-426614174000"
        role = UserRole.employee
        status = UserStatus.active
        
    return MockUser()

def test_employee_cannot_access_admin_billing():
    # Override the dependency to simulate an employee being logged in
    app.dependency_overrides[get_current_user] = override_get_current_employee
    
    response = client.get("/api/admin/billing")
    
    # 403 Forbidden is expected for employees hitting admin routes
    assert response.status_code == 403
    assert response.json()["detail"] == "Not enough privileges"
    
    # Clean up override
    app.dependency_overrides.clear()
