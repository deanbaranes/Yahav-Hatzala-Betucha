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
    # 0.25 hours overtime -> 0.25 * 2 = 0.5 -> round(0.5) = 1 -> 1/2 = 0.5
    assert calculate_overtime_decimal(start, end) == 0.5

def test_9_hours_10_minutes_rounding_up():
    start = datetime(2026, 1, 1, 8, 0)
    end = datetime(2026, 1, 1, 17, 10) # 9h 10m -> 10m = 0.1666h
    # 0.1666 * 2 = 0.333 -> round(0.333) = 0 -> 0/2 = 0.0
    assert calculate_overtime_decimal(start, end) == 0.0

def test_9_hours_16_minutes_rounding_down():
    start = datetime(2026, 1, 1, 8, 0)
    end = datetime(2026, 1, 1, 17, 16) # 9h 16m -> 16m = 0.2666h
    # 0.2666 * 2 = 0.5333 -> round(0.533) = 1 -> 1/2 = 0.5
    assert calculate_overtime_decimal(start, end) == 0.5

def test_9_hours_30_minutes():
    start = datetime(2026, 1, 1, 8, 0)
    end = datetime(2026, 1, 1, 17, 30) # 9.5 hours
    assert calculate_overtime_decimal(start, end) == 0.50

def test_12_hours():
    start = datetime(2026, 1, 1, 8, 0)
    end = datetime(2026, 1, 1, 20, 0) # 12 hours
    assert calculate_overtime_decimal(start, end) == 3.0
