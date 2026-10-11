"""Unit tests for decision logic and session outcome calculation."""

from app.models.models import SessionStatus, VerificationOutcome
from app.schemas.schemas import FieldVerificationResult
from app.services.decision_service import (
    compute_field_outcome,
    compute_session_status,
    detect_contradiction,
    detect_correction,
    detect_empty_answer,
)


def _make_result(
    field: str, outcome: VerificationOutcome, needs_review: bool = False
) -> FieldVerificationResult:
    return FieldVerificationResult(
        field_name=field,
        expected_value="val",
        original_transcript="raw",
        normalised_answer="val",
        outcome=outcome,
        reason="test",
        needs_manual_review=needs_review,
    )


def test_detect_empty_answer():
    assert detect_empty_answer(None) is True
    assert detect_empty_answer("") is True
    assert detect_empty_answer("   ") is True
    assert detect_empty_answer("[silence]") is True
    assert detect_empty_answer("Mumbai") is False


def test_detect_correction():
    assert detect_correction("Actually, I meant 1990") is True
    assert detect_correction("Sorry, my postal code is 400001") is True
    assert detect_correction("My name is Priya") is False


def test_detect_contradiction():
    res1 = _make_result("city", VerificationOutcome.MATCH)
    res2 = _make_result("city", VerificationOutcome.MISMATCH)
    assert detect_contradiction([res1, res2]) is True

    res3 = _make_result("city", VerificationOutcome.MATCH)
    assert detect_contradiction([res1, res3]) is False


def test_compute_field_outcome_contradiction():
    res1 = _make_result("city", VerificationOutcome.MATCH)
    res2 = _make_result("city", VerificationOutcome.MISMATCH)
    final = compute_field_outcome([res1, res2])
    assert final.outcome == VerificationOutcome.NEEDS_CLARIFICATION
    assert final.needs_manual_review is True


def test_compute_session_status_all_verified():
    results = [
        _make_result("identity_confirmation", VerificationOutcome.MATCH),
        _make_result("date_of_birth", VerificationOutcome.MATCH),
        _make_result("city", VerificationOutcome.MATCH),
        _make_result("postal_code", VerificationOutcome.MATCH),
        _make_result("email", VerificationOutcome.MATCH),
        _make_result("account_reference", VerificationOutcome.MATCH),
    ]
    assert compute_session_status(results) == SessionStatus.VERIFIED


def test_compute_session_status_mismatch():
    results = [
        _make_result("identity_confirmation", VerificationOutcome.MATCH),
        _make_result("city", VerificationOutcome.MISMATCH),
    ]
    assert compute_session_status(results) == SessionStatus.NOT_VERIFIED


def test_compute_session_status_needs_manual_review():
    results = [
        _make_result("identity_confirmation", VerificationOutcome.MATCH),
        _make_result("date_of_birth", VerificationOutcome.NEEDS_CLARIFICATION, needs_review=True),
    ]
    assert compute_session_status(results) == SessionStatus.NEEDS_MANUAL_REVIEW


def test_compute_session_status_incomplete():
    results = [
        _make_result("identity_confirmation", VerificationOutcome.MATCH),
        _make_result("date_of_birth", VerificationOutcome.NOT_PROVIDED),
    ]
    assert compute_session_status(results) == SessionStatus.INCOMPLETE
