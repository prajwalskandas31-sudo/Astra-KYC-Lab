"""API endpoint integration tests using FastAPI TestClient."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.seed import seed_customers
from app.db.session import get_db
from app.main import app
from app.models.models import Base

from sqlalchemy.pool import StaticPool

# Setup temporary in-memory SQLite database for testing with shared connection pool
TEST_DATABASE_URL = "sqlite:///:memory:"
test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

Base.metadata.create_all(bind=test_engine)
_seed_db = TestingSessionLocal()
seed_customers(_seed_db)
_seed_db.close()


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


def test_health():
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    data = res.json()
    assert "status" in data
    assert data["database_ok"] is True


def test_list_and_get_customers():
    res = client.get("/api/v1/customers")
    assert res.status_code == 200
    customers = res.json()
    assert len(customers) >= 5
    cust_id = customers[0]["id"]

    res_single = client.get(f"/api/v1/customers/{cust_id}")
    assert res_single.status_code == 200
    assert res_single.json()["id"] == cust_id


def test_session_lifecycle():
    # 1. Create session
    create_res = client.post("/api/v1/sessions", json={"customer_id": "CUST-001"})
    assert create_res.status_code == 201
    sess_id = create_res.json()["id"]

    # 2. Get session questions
    q_res = client.get(f"/api/v1/sessions/{sess_id}/questions")
    assert q_res.status_code == 200
    questions = q_res.json()
    assert len(questions) == 6
    assert "Priya Sharma" in questions[0]["prompt_text"]

    # 3. Create answer attempt
    ans_res = client.post(
        f"/api/v1/sessions/{sess_id}/answers",
        params={
            "question_index": 0,
            "question_field": "identity_confirmation",
            "question_type": "YES_NO",
        },
    )
    assert ans_res.status_code == 200
    ans_data = ans_res.json()
    assert ans_data["attempt_number"] == 1

    # 4. Complete session
    comp_res = client.post(f"/api/v1/sessions/{sess_id}/complete")
    assert comp_res.status_code == 200
    comp_data = comp_res.json()
    assert comp_data["session_id"] == sess_id
    assert "status" in comp_data


def test_dashboard_stats():
    res = client.get("/api/v1/dashboard/stats")
    assert res.status_code == 200
    data = res.json()
    assert "total_sessions" in data
    assert "completed_sessions" in data
