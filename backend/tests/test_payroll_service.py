import pytest
from decimal import Decimal
from unittest.mock import MagicMock
from app.services.payroll_service import PayrollService
from app.models.user import User

def test_format_report():
    # Setup mock service
    service = PayrollService(db=MagicMock())

    full_name = "ישראל ישראלי"
    days_worked = 10
    total_hours = Decimal('86.00')
    base_salary = Decimal('4000.00')
    ot_hours = Decimal('2.00')
    hourly_rate = Decimal('50.00')
    ot_total = Decimal('150.00')
    recovery_pay = Decimal('120.00')
    travel_pay = Decimal('226.00')
    accom_nights = Decimal('1')
    accom_pay = Decimal('80.00')
    other_adjs = Decimal('100.00')
    gross_total = Decimal('4676.00')

    report_text = service._format_report(
        full_name=full_name,
        days_worked=days_worked,
        total_hours=total_hours,
        base_salary=base_salary,
        ot_hours=ot_hours,
        hourly_rate=hourly_rate,
        ot_total=ot_total,
        recovery_pay=recovery_pay,
        travel_pay=travel_pay,
        accom_nights=accom_nights,
        accom_pay=accom_pay,
        other_adjs=other_adjs,
        gross_total=gross_total
    )

    # Asserts
    assert "ישראל ישראלי" in report_text
    assert "4000.00 ₪" in report_text
    assert "150.00 ₪" in report_text
    assert "לינה" in report_text
    assert "תוספות שונות" in report_text
    assert "4676.00 ₪" in report_text

def test_global_salary_handling():
    # Setup mock objects
    service = PayrollService(db=MagicMock())

    user = User(id="user1", full_name="דין ברנס", hourly_rate=0, base_daily_hours=0)
    
    # We will mock the database queries
    service.db.query().join().filter().all.return_value = [] # No reports
    service.db.query().filter().all.return_value = [
        MagicMock(type="שכר יומי", amount=Decimal('500.00')),
        MagicMock(type="הבראה", amount=Decimal('120.00'))
    ]

    report = service.generate_employee_report(user, 7, 2026)

    assert "דין ברנס" in report
    assert "שכר בסיס: 500.00 ₪" in report
    assert "הבראה: 120.00 ₪" in report
    assert "סה\"כ ברוטו: 620.00 ₪" in report
