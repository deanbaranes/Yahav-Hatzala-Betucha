from decimal import Decimal, ROUND_HALF_UP
from typing import List
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import extract
from datetime import datetime

from app.models.user import User
from app.models.trip_report import TripReport
from app.models.trip_assignment import TripAssignment
from app.models.payroll_adjustment import PayrollAdjustment

class PayrollService:
    def __init__(self, db: Session):
        self.db = db

    def generate_employee_report(self, user: User, month: int, year: int) -> str:
        if user.status == "inactive":
            raise ValueError(f"Cannot generate payroll for inactive user {user.full_name}")
            
        now = datetime.now()
        if year > now.year or (year == now.year and month > now.month):
            raise ValueError(f"Cannot generate payroll for future date {month}/{year}")

        reports = self.db.query(TripReport).options(
            joinedload(TripReport.assignment).joinedload(TripAssignment.trip)
        ).join(TripAssignment).filter(
            TripAssignment.user_id == user.id,
            extract('month', TripReport.start_time) == month,
            extract('year', TripReport.start_time) == year
        ).all()

        days_worked = len(set(r.start_time.date() for r in reports if r.start_time))
        
        ot_hours = Decimal(0)
        auto_accom_nights = Decimal(0)
        for r in reports:
            ot_hours += Decimal(str(r.overtime_decimal or 0))
            if r.assignment.trip.start_date and r.assignment.trip.end_date:
                trip_nights = (r.assignment.trip.end_date.date() - r.assignment.trip.start_date.date()).days
                if trip_nights > 0:
                    auto_accom_nights += Decimal(trip_nights)

        hourly_rate = Decimal(str(user.hourly_rate or 0))
        base_daily = Decimal(str(user.base_daily_hours or 8.6))
        total_hours = Decimal(days_worked) * base_daily

        adjustments = self.db.query(PayrollAdjustment).filter(
            PayrollAdjustment.user_id == user.id,
            PayrollAdjustment.month == month,
            PayrollAdjustment.year == year
        ).all()

        recovery_pay = Decimal(days_worked) * Decimal('12.00')
        travel_pay = Decimal(days_worked) * Decimal('22.60')
        
        accom_nights = auto_accom_nights
        accom_pay = auto_accom_nights * Decimal('80.00')
        other_adjs = Decimal(0)
        
        # Special logic for global salaries (e.g. CEO/Manager)
        # Ideally this should be a DB column like `is_global_salary`
        is_global_salary = (user.full_name == "דין ברנס")
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
                accom_pay += amt * Decimal('80.00')
            elif a.type == "שעות נוספות":
                ot_hours += amt
            elif a.type == "שכר יומי" and is_global_salary:
                global_days += 1
                global_money += amt
            else:
                other_adjs += amt

        if is_global_salary:
            days_worked += global_days
            total_hours += global_money / Decimal('60') if global_money > 0 else Decimal(0)
            base_salary = global_money
        else:
            base_salary = Decimal(days_worked) * base_daily * hourly_rate
            
        ot_total = ot_hours * hourly_rate * Decimal('1.5')

        gross_total = base_salary + ot_total + recovery_pay + travel_pay + accom_pay + other_adjs

        return self._format_report(
            user.full_name, days_worked, total_hours, base_salary, 
            ot_hours, hourly_rate, ot_total, recovery_pay, travel_pay, 
            accom_nights, accom_pay, other_adjs, gross_total
        )

    def _format_report(self, full_name, days_worked, total_hours, base_salary, ot_hours, 
                       hourly_rate, ot_total, recovery_pay, travel_pay, accom_nights, 
                       accom_pay, other_adjs, gross_total) -> str:
        
        report_text = f"שם עובד: {full_name}\n"
        report_text += f"ימי עבודה: {days_worked}\n"
        report_text += f"שעות עבודה בחודש: {total_hours.quantize(Decimal('0.00'), rounding=ROUND_HALF_UP)}\n"
        report_text += f"שכר בסיס: {base_salary.quantize(Decimal('0.00'), rounding=ROUND_HALF_UP)} ₪\n"
        report_text += f"שעות נוספות: {ot_hours.quantize(Decimal('0.00'), rounding=ROUND_HALF_UP)} × {hourly_rate} × 1.5 = {ot_total.quantize(Decimal('0.00'), rounding=ROUND_HALF_UP)} ₪\n"
        report_text += f"הבראה: {recovery_pay.quantize(Decimal('0.00'), rounding=ROUND_HALF_UP)} ₪\n"
        report_text += f"נסיעות: {travel_pay.quantize(Decimal('0.00'), rounding=ROUND_HALF_UP)} ₪"

        if accom_pay > 0:
            report_text += f"\nלינה ({accom_nights.quantize(Decimal('0'), rounding=ROUND_HALF_UP)} לילות): {accom_pay.quantize(Decimal('0.00'), rounding=ROUND_HALF_UP)} ₪"

        if other_adjs > 0:
            report_text += f"\nתוספות שונות: {other_adjs.quantize(Decimal('0.00'), rounding=ROUND_HALF_UP)} ₪"

        report_text += f"\n-----------------------------\n"
        report_text += f"סה\"כ ברוטו: {gross_total.quantize(Decimal('0.00'), rounding=ROUND_HALF_UP)} ₪"

        return report_text
