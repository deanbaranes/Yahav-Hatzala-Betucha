from datetime import datetime, timedelta
from app.services.report_service import calculate_overtime_decimal

def test_exact_9_hours():
    start = datetime(2026, 1, 1, 8, 0)
    end = datetime(2026, 1, 1, 17, 0) # 9 hours
    assert calculate_overtime_decimal(start, end) == 0.0

def test_under_9_hours():
    start = datetime(2026, 1, 1, 8, 0)
    end = datetime(2026, 1, 1, 16, 0) # 8 hours
    assert calculate_overtime_decimal(start, end) == 0.0

def test_9_hours_15_minutes():
    start = datetime(2026, 1, 1, 8, 0)
    end = datetime(2026, 1, 1, 17, 15) # 9.25 hours
    # 0.25 hours overtime + 0.4 bonus = 0.65
    assert calculate_overtime_decimal(start, end) == 0.65

def test_9_hours_10_minutes():
    start = datetime(2026, 1, 1, 8, 0)
    end = datetime(2026, 1, 1, 17, 10) # 9h 10m -> 0.1666h
    # 0.1666 + 0.4 = 0.5666 -> rounded to 2 decimals = 0.57
    assert calculate_overtime_decimal(start, end) == 0.57

def test_9_hours_16_minutes():
    start = datetime(2026, 1, 1, 8, 0)
    end = datetime(2026, 1, 1, 17, 16) # 9h 16m -> 0.2666h
    # 0.2666 + 0.4 = 0.6666 -> rounded to 2 decimals = 0.67
    assert calculate_overtime_decimal(start, end) == 0.67

def test_9_hours_30_minutes():
    start = datetime(2026, 1, 1, 8, 0)
    end = datetime(2026, 1, 1, 17, 30) # 9.5 hours
    # 0.5 + 0.4 = 0.90
    assert calculate_overtime_decimal(start, end) == 0.90

def test_12_hours():
    start = datetime(2026, 1, 1, 8, 0)
    end = datetime(2026, 1, 1, 20, 0) # 12 hours
    # 3.0 + 0.4 = 3.4
    assert calculate_overtime_decimal(start, end) == 3.4
