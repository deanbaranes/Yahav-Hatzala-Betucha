from datetime import datetime, timedelta
from app.routers.reports import calculate_overtime_decimal

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
    # 0.25 hours overtime is exactly 0.25
    assert calculate_overtime_decimal(start, end) == 0.25

def test_9_hours_10_minutes_rounding_up():
    start = datetime(2026, 1, 1, 8, 0)
    end = datetime(2026, 1, 1, 17, 10) # 9h 10m -> 10m = 0.1666h
    # 0.1666 * 20 = 3.33 -> round(3.33) = 3 -> 3 / 20 = 0.15
    assert calculate_overtime_decimal(start, end) == 0.15

def test_9_hours_16_minutes_rounding_down():
    start = datetime(2026, 1, 1, 8, 0)
    end = datetime(2026, 1, 1, 17, 16) # 9h 16m -> 16m = 0.2666h
    # 0.2666 * 20 = 5.33 -> round(5.33) = 5 -> 5 / 20 = 0.25
    assert calculate_overtime_decimal(start, end) == 0.25

def test_9_hours_30_minutes():
    start = datetime(2026, 1, 1, 8, 0)
    end = datetime(2026, 1, 1, 17, 30) # 9.5 hours
    assert calculate_overtime_decimal(start, end) == 0.50

def test_12_hours():
    start = datetime(2026, 1, 1, 8, 0)
    end = datetime(2026, 1, 1, 20, 0) # 12 hours
    assert calculate_overtime_decimal(start, end) == 3.0
