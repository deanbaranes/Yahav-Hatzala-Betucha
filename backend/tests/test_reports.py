import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.dependencies import get_employee_user
from unittest.mock import patch, MagicMock

client = TestClient(app)

def test_get_upload_url():
    # Mock user
    mock_user = MagicMock()
    app.dependency_overrides[get_employee_user] = lambda: mock_user
    
    # Mock boto3 client
    with patch("app.routers.reports.s3_client") as mock_s3:
        mock_s3.generate_presigned_post.return_value = {
            "url": "https://s3.amazonaws.com/test-bucket",
            "fields": {"key": "receipts/uuid-1234.jpg", "AWSAccessKeyId": "test"}
        }
        
        response = client.get("/api/reports/upload-url")
        
        assert response.status_code == 200
        data = response.json()
        assert "url" in data
        assert "fields" in data
        assert "key" in data["fields"]
        assert data["fields"]["key"].startswith("receipts/")
        assert data["fields"]["key"].endswith(".jpg")
        
    app.dependency_overrides.clear()
