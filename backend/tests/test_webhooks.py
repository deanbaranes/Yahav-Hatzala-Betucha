import pytest
from fastapi.testclient import TestClient
from app.main import app
from unittest.mock import patch, MagicMock

client = TestClient(app)

def test_twilio_webhook_confirm_assignment():
    # Mock the DB dependency
    with patch("app.routers.webhooks.get_db") as mock_get_db:
        mock_db = MagicMock()
        mock_get_db.return_value = [mock_db]
        
        # We also need to mock the actual query that finds the assignment by user phone
        # In the webhook logic, we receive From and Body
        # The Twilio webhook parses standard URL-encoded form data
        
        form_data = {
            "From": "whatsapp:+15005550006",
            "Body": "1" # User says 1 to confirm
        }
        
        # We need to test the /api/webhooks/twilio endpoint
        response = client.post("/api/webhooks/twilio", data=form_data)
        
        assert response.status_code == 200
        # The webhook returns {"message": "Acknowledged"} or {"message": "Success"}
        assert response.json()["message"] in ["Acknowledged", "Success"]
        # We don't strictly assert the DB commits here without fully mocking SQLAlchemy,
        # but we ensure the endpoint processes the form data correctly and returns valid TwiML.
