from app.models.trip import Trip
from app.models.trip_assignment import AssignmentStatus, TripAssignment
from app.models.trip_report import ManagerStatus, TripReport
from app.models.user import EmploymentType, User
from sqlalchemy import extract, not_
from sqlalchemy.orm import Session, joinedload


class ReportRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_pending_assignments_for_admin(self):
        reported_assignment_ids = self.db.query(TripReport.assignment_id).subquery()
        return (
            self.db.query(TripAssignment)
            .options(joinedload(TripAssignment.user), joinedload(TripAssignment.trip))
            .join(Trip)
            .join(User, TripAssignment.user_id == User.id)
            .filter(
                TripAssignment.status == AssignmentStatus.assigned,
                TripAssignment.is_confirmed == True,
                not_(TripAssignment.id.in_(reported_assignment_ids)),
            )
            .order_by(Trip.start_date.desc())
            .all()
        )

    def get_pending_assignments_for_employee(self, user_id: str):
        submitted_assignment_ids = (
            self.db.query(TripReport.assignment_id)
            .filter(TripReport.is_draft == False)
            .subquery()
        )

        return (
            self.db.query(TripAssignment)
            .options(joinedload(TripAssignment.trip))
            .join(Trip)
            .filter(
                TripAssignment.user_id == user_id,
                TripAssignment.status == AssignmentStatus.assigned,
                TripAssignment.is_confirmed == True,
                not_(TripAssignment.id.in_(submitted_assignment_ids)),
            )
            .order_by(Trip.start_date.desc())
            .all()
        )

    def get_employee_draft(self, assignment_id: str, user_id: str):
        return (
            self.db.query(TripReport)
            .join(TripAssignment)
            .filter(
                TripReport.assignment_id == assignment_id,
                TripReport.is_draft == True,
                TripAssignment.user_id == user_id,
            )
            .first()
        )

    def get_employee_reports(self, user_id: str):
        return (
            self.db.query(TripReport)
            .options(joinedload(TripReport.assignment).joinedload(TripAssignment.trip))
            .join(TripAssignment)
            .join(Trip)
            .filter(TripAssignment.user_id == user_id, TripReport.is_draft == False)
            .order_by(Trip.start_date.desc())
            .all()
        )

    def get_all_reports(self, skip: int, limit: int):
        return (
            self.db.query(TripReport)
            .options(
                joinedload(TripReport.assignment)
                .joinedload(TripAssignment.trip)
                .joinedload(Trip.client),
                joinedload(TripReport.assignment).joinedload(TripAssignment.user),
            )
            .join(TripAssignment)
            .join(Trip)
            .join(User)
            .filter(TripReport.is_draft == False)
            .order_by(TripReport.start_time.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    def get_report_by_id(self, report_id: str):
        return self.db.query(TripReport).filter(TripReport.id == report_id).first()

    def get_matrix_assignments(self, year: int, month: int):
        return (
            self.db.query(TripAssignment)
            .options(joinedload(TripAssignment.user), joinedload(TripAssignment.trip))
            .join(Trip)
            .join(User, TripAssignment.user_id == User.id)
            .filter(
                TripAssignment.status == AssignmentStatus.assigned,
                User.status != "inactive",
                User.employment_type == EmploymentType.EMPLOYEE,
                extract("year", Trip.start_date) == year,
                extract("month", Trip.start_date) == month,
            )
            .all()
        )

    def get_matrix_reports_with_join(self, year: int, month: int):
        return (
            self.db.query(TripAssignment, TripReport, User, Trip)
            .join(Trip, TripAssignment.trip_id == Trip.id)
            .join(User, TripAssignment.user_id == User.id)
            .join(TripReport, TripReport.assignment_id == TripAssignment.id)
            .filter(
                TripAssignment.status == AssignmentStatus.assigned,
                User.status != "inactive",
                User.employment_type == EmploymentType.EMPLOYEE,
                extract("year", Trip.start_date) == year,
                extract("month", Trip.start_date) == month,
                TripReport.manager_status == ManagerStatus.approved,
            )
            .all()
        )

    def get_approved_reports_by_assignments(self, assignment_ids: list):
        if not assignment_ids:
            return []
        return (
            self.db.query(TripReport)
            .filter(
                TripReport.assignment_id.in_(assignment_ids),
                TripReport.manager_status == ManagerStatus.approved,
            )
            .all()
        )
