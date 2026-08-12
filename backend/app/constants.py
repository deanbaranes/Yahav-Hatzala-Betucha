from decimal import Decimal

# ── Financial Constants ────────────────────────────────────────────────────────

# Rate charged to the client per accommodation night
CLIENT_ACCOMMODATION_CHARGE = 180.0

# Rate paid to the employee per accommodation night
EMPLOYEE_ACCOMMODATION_PAY = Decimal('100.00')

# Standard daily travel pay for employees
EMPLOYEE_TRAVEL_PAY_PER_DAY = Decimal('22.60')

# Standard daily recovery pay (Dmei Havraa) for employees
EMPLOYEE_RECOVERY_PAY_PER_DAY = Decimal('12.00')

# Overtime salary multiplier (150%)
OVERTIME_MULTIPLIER = Decimal('1.5')

# Standard daily hours before overtime applies (if no daily shifts provided)
# Note: Specific employees may have a custom base_daily_hours in the DB overriding this
DEFAULT_BASE_DAILY_HOURS = Decimal('8.6')
