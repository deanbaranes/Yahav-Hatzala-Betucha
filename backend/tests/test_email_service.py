import pytest
from unittest.mock import patch, MagicMock
from app.services.email_service import EmailService
import requests

@patch('app.services.email_service.requests.post')
def test_send_password_reset_success(mock_post):
    # Setup mock response
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_post.return_value = mock_response

    # Call the service
    result = EmailService.send_password_reset(
        to_email="test@example.com",
        full_name="Israel Israeli",
        token="test_token_123"
    )

    # Assertions
    assert result is True
    mock_post.assert_called_once()
    
    # Verify the payload structure sent to Brevo
    args, kwargs = mock_post.call_args
    assert "https://api.brevo.com/v3/smtp/email" in args[0]
    payload = kwargs.get('json')
    assert payload is not None
    assert payload['to'][0]['email'] == "test@example.com"
    assert "test_token_123" in payload['htmlContent']


@patch('app.services.email_service.requests.post')
def test_send_password_reset_failure(mock_post):
    # Setup mock to simulate a network error / Brevo rejection
    mock_post.side_effect = requests.exceptions.RequestException("API Error")

    # Call the service
    result = EmailService.send_password_reset(
        to_email="test@example.com",
        full_name="Israel Israeli",
        token="test_token_123"
    )

    # Assertions
    assert result is False
    mock_post.assert_called_once()
