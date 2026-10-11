"""Seed the database with synthetic customer records."""

from sqlalchemy.orm import Session
from app.models.models import Customer


SEED_CUSTOMERS = [
    {
        "id": "CUST-001",
        "full_name": "Priya Sharma",
        "date_of_birth": "1990-03-15",
        "city": "Mumbai",
        "postal_code": "400001",
        "email": "priya.sharma@example.com",
        "account_reference": "ACC-78432",
    },
    {
        "id": "CUST-002",
        "full_name": "Rahul Verma",
        "date_of_birth": "1985-07-22",
        "city": "Delhi",
        "postal_code": "110001",
        "email": "rahul.verma@example.com",
        "account_reference": "ACC-56219",
    },
    {
        "id": "CUST-003",
        "full_name": "Ananya Patel",
        "date_of_birth": "1992-11-08",
        "city": "Bangalore",
        "postal_code": "560001",
        "email": "ananya.patel@example.com",
        "account_reference": "ACC-91047",
    },
    {
        "id": "CUST-004",
        "full_name": "Vikram Singh",
        "date_of_birth": "1988-01-30",
        "city": "Hyderabad",
        "postal_code": "500001",
        "email": "vikram.singh@example.com",
        "account_reference": "ACC-33876",
    },
    {
        "id": "CUST-005",
        "full_name": "Deepa Krishnan",
        "date_of_birth": "1995-06-12",
        "city": "Chennai",
        "postal_code": "600001",
        "email": "deepa.krishnan@example.com",
        "account_reference": "ACC-62503",
    },
]


def seed_customers(db: Session) -> None:
    """Insert synthetic customer records if the table is empty."""
    if db.query(Customer).count() > 0:
        return
    for data in SEED_CUSTOMERS:
        db.add(Customer(**data))
    db.commit()


def reset_seed_data(db: Session) -> None:
    """Delete all customers and re-seed. Also cascades sessions/answers logically."""
    from app.models.models import AnswerAttempt, VerificationSession

    db.query(AnswerAttempt).delete()
    db.query(VerificationSession).delete()
    db.query(Customer).delete()
    db.commit()
    seed_customers(db)
