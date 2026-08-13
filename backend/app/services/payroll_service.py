from decimal import Decimal, ROUND_HALF_UP
from typing import List
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import extract
from datetime import datetime, date
import calendar

from app.models.user import User
from app.models.trip_report import TripReport
from app.models.trip_assignment import TripAssignment
from app.models.payroll_adjustment import PayrollAdjustment
from app.constants import (
    EMPLOYEE_ACCOMMODATION_PAY,
    EMPLOYEE_TRAVEL_PAY_PER_DAY,
    EMPLOYEE_RECOVERY_PAY_PER_DAY,
    OVERTIME_MULTIPLIER,
    DEFAULT_BASE_DAILY_HOURS
)

class PayrollService:
    def __init__(self, db: Session):
        self.db = db

    def generate_employee_report(self, user: User, month: int, year: int) -> str:
        if user.status == "inactive":
            raise ValueError(f"Cannot generate payroll for inactive user {user.full_name}")
            
        now = datetime.now()
        if year > now.year or (year == now.year and month > now.month):
            raise ValueError(f"Cannot generate payroll for future date {month}/{year}")

        last_day = calendar.monthrange(year, month)[1]
        start_date_bound = datetime(year, month, 1)
        end_date_bound = datetime(year, month, last_day, 23, 59, 59)

        reports = self.db.query(TripReport).options(
            joinedload(TripReport.assignment).joinedload(TripAssignment.trip)
        ).join(TripAssignment).filter(
            TripAssignment.user_id == user.id,
            TripReport.manager_status == "approved",
            TripReport.start_time >= start_date_bound,
            TripReport.start_time <= end_date_bound
        ).all()

        days_worked_set = set()
        for r in reports:
            if r.daily_shifts and len(r.daily_shifts) > 0:
                for shift in r.daily_shifts:
                    if "start_time" in shift:
                        shift_date = datetime.fromisoformat(shift["start_time"]).date()
                        days_worked_set.add(shift_date)
            elif r.start_time:
                days_worked_set.add(r.start_time.date())
        days_worked = len(days_worked_set)
        
        ot_hours = Decimal(0)
        auto_accom_nights = Decimal(0)
        for r in reports:
            ot_hours += Decimal(str(r.overtime_decimal or 0))
            if hasattr(r, 'sleeps') and r.sleeps is not None:
                auto_accom_nights += Decimal(str(r.sleeps))
            else:
                # Fallback to trip duration for backward compatibility
                if r.assignment.trip.start_date and r.assignment.trip.end_date:
                    trip_nights = (r.assignment.trip.end_date.date() - r.assignment.trip.start_date.date()).days
                    if trip_nights > 0:
                        auto_accom_nights += Decimal(trip_nights)

        hourly_rate = Decimal(str(user.hourly_rate or 0))
        base_daily = Decimal(str(user.base_daily_hours or DEFAULT_BASE_DAILY_HOURS))
        
        # Calculate bonus for global salary trips
        is_global_salary = bool(user.is_global_salary)
        trip_global_bonus = Decimal(0)

        for r in reports:
            if r.assignment.trip.global_salary:
                # Calculate regular pay components for this specific trip
                report_days_set = set()
                if r.daily_shifts and len(r.daily_shifts) > 0:
                    for shift in r.daily_shifts:
                        if "start_time" in shift:
                            report_days_set.add(datetime.fromisoformat(shift["start_time"]).date())
                elif r.start_time:
                    report_days_set.add(r.start_time.date())
                
                report_days = Decimal(len(report_days_set))
                report_base = report_days * base_daily * hourly_rate
                report_recovery = report_days * EMPLOYEE_RECOVERY_PAY_PER_DAY
                report_travel = report_days * EMPLOYEE_TRAVEL_PAY_PER_DAY
                report_regular_pay = report_base + report_recovery + report_travel
                
                promised = Decimal(str(r.assignment.trip.global_salary))
                if promised > report_regular_pay:
                    trip_global_bonus += (promised - report_regular_pay)

        total_hours = Decimal(days_worked) * base_daily

        adjustments = self.db.query(PayrollAdjustment).filter(
            PayrollAdjustment.user_id == user.id,
            PayrollAdjustment.month == month,
            PayrollAdjustment.year == year
        ).all()

        recovery_pay = Decimal(days_worked) * EMPLOYEE_RECOVERY_PAY_PER_DAY
        travel_pay = Decimal(days_worked) * EMPLOYEE_TRAVEL_PAY_PER_DAY
        
        accom_nights = auto_accom_nights
        accom_pay = auto_accom_nights * EMPLOYEE_ACCOMMODATION_PAY
        other_adjs = Decimal(0)
        
        # True = עובד בשכר גלובלי — נקבע ב-DB, לא לפי שם
        is_global_salary = bool(user.is_global_salary)
        global_days = 0
        global_money = Decimal(0)

        for a in adjustments:
            amt = Decimal(str(a.amount))
            if a.type == "הבראה":
                recovery_pay += amt
            elif a.type == "נסיעות":
                travel_pay += amt
            elif a.type == "לינה":
                accom_nights += amt
                accom_pay += amt * EMPLOYEE_ACCOMMODATION_PAY
            elif a.type == "שעות נוספות":
                ot_hours += amt
            elif a.type == "שכר יומי" and is_global_salary:
                global_days += 1
                global_money += amt
            else:
                other_adjs += amt

        if is_global_salary:
            # global_days and global_money are from legacy adjustments
            days_worked += global_days
            total_hours += global_money / Decimal('60') if global_money > 0 else Decimal(0)
            
            base_salary = Decimal(days_worked) * base_daily * hourly_rate
            # Include legacy global_money if any, though it's deprecated by trip_global_bonus
            other_adjs += global_money 
        else:
            base_salary = Decimal(days_worked) * base_daily * hourly_rate
            
        ot_total = ot_hours * hourly_rate * OVERTIME_MULTIPLIER

        gross_total = base_salary + ot_total + recovery_pay + travel_pay + accom_pay + other_adjs + trip_global_bonus

        return self._format_report(
            user.full_name, days_worked, total_hours, base_salary, 
            ot_hours, hourly_rate, ot_total, recovery_pay, travel_pay, 
            accom_nights, accom_pay, other_adjs, trip_global_bonus, gross_total
        )

    def _format_report(self, full_name, days_worked, total_hours, base_salary, ot_hours, 
                       hourly_rate, ot_total, recovery_pay, travel_pay, accom_nights, 
                       accom_pay, other_adjs, trip_global_bonus, gross_total) -> str:
        
        report_text = f"שם עובד: {full_name}\n"
        report_text += f"ימי עבודה: {days_worked}\n"
        report_text += f"שעות עבודה בחודש: {total_hours.quantize(Decimal('0.00'), rounding=ROUND_HALF_UP)}\n"
        report_text += f"שכר בסיס: {base_salary.quantize(Decimal('0.00'), rounding=ROUND_HALF_UP)} ₪\n"
        report_text += f"שעות נוספות: {ot_hours.quantize(Decimal('0.00'), rounding=ROUND_HALF_UP)} × {hourly_rate} × {float(OVERTIME_MULTIPLIER)} = {ot_total.quantize(Decimal('0.00'), rounding=ROUND_HALF_UP)} ₪\n"
        report_text += f"הבראה: {recovery_pay.quantize(Decimal('0.00'), rounding=ROUND_HALF_UP)} ₪\n"
        report_text += f"נסיעות: {travel_pay.quantize(Decimal('0.00'), rounding=ROUND_HALF_UP)} ₪"

        if accom_pay > 0:
            report_text += f"\nלינה ({accom_nights.quantize(Decimal('0'), rounding=ROUND_HALF_UP)} לילות): {accom_pay.quantize(Decimal('0.00'), rounding=ROUND_HALF_UP)} ₪"

        if other_adjs > 0:
            report_text += f"\nתוספות שונות: {other_adjs.quantize(Decimal('0.00'), rounding=ROUND_HALF_UP)} ₪"

        if trip_global_bonus > 0:
            report_text += f"\nהשלמה לשכר גלובלי (טיולים): {trip_global_bonus.quantize(Decimal('0.00'), rounding=ROUND_HALF_UP)} ₪"

        report_text += f"\n-----------------------------\n"
        report_text += f"סה\"כ ברוטו: {gross_total.quantize(Decimal('0.00'), rounding=ROUND_HALF_UP)} ₪"

        return report_text

    def create_supplier_record_from_report(self, report: TripReport):
        if report.manager_status != "approved" and report.assignment and report.assignment.user:
            user = report.assignment.user
            if user.employment_type == "עצמאי":
                from app.models.supplier import Supplier
                existing = self.db.query(Supplier).filter(Supplier.report_id == report.id).first()
                if not existing:
                    rounded_ot = round(float(report.overtime_decimal or 0) * 2) / 2
                    sleeps = report.sleeps or 0
                    trip_loc = report.assignment.trip.location if report.assignment.trip else ""
                    role = report.assignment.role if report.assignment.role else "תפקיד כללי"
                    
                    details_text = f"{role} בטיול: {trip_loc}"
                    if sleeps > 0:
                        details_text += f" | {sleeps} לילות"
                    if rounded_ot > 0:
                        ot_display = int(rounded_ot) if rounded_ot.is_integer() else rounded_ot
                        details_text += f" | {ot_display} שעות נוספות"
                    
                    supplier_entry = Supplier(
                        name=user.full_name,
                        debt_date=report.start_time.date() if report.start_time else date.today(),
                        amount=0,
                        details=details_text,
                        is_invoiced=False,
                        report_id=report.id
                    )
                    self.db.add(supplier_entry)
