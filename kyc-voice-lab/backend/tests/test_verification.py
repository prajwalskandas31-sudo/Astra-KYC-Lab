"""Unit tests for deterministic field verification."""

from app.models.models import VerificationOutcome
from app.services.verification_service import verify_field


def test_verify_identity_confirmation_match():
    res = verify_field("identity_confirmation", "Yes, that is me", "Priya Sharma")
    assert res.outcome == VerificationOutcome.MATCH
    assert res.needs_manual_review is False


def test_verify_identity_confirmation_mismatch():
    res = verify_field("identity_confirmation", "No, wrong number", "Priya Sharma")
    assert res.outcome == VerificationOutcome.MISMATCH
    assert res.needs_manual_review is True


def test_verify_identity_confirmation_clarification():
    res = verify_field("identity_confirmation", "Maybe, who is asking?", "Priya Sharma")
    assert res.outcome == VerificationOutcome.NEEDS_CLARIFICATION
    assert res.needs_manual_review is True


def test_verify_dob_match():
    res = verify_field("date_of_birth", "15th of March 1990", "1990-03-15")
    assert res.outcome == VerificationOutcome.MATCH
    assert res.normalised_answer == "1990-03-15"
    assert res.needs_manual_review is False


def test_verify_dob_mismatch():
    res = verify_field("date_of_birth", "10th of May 1988", "1990-03-15")
    assert res.outcome == VerificationOutcome.MISMATCH
    assert res.normalised_answer == "1988-05-10"


def test_verify_dob_ambiguous():
    res = verify_field("date_of_birth", "05/06/1990", "1990-03-15")
    assert res.outcome == VerificationOutcome.NEEDS_CLARIFICATION
    assert res.needs_manual_review is True


def test_verify_city_match():
    res = verify_field("city", "I live in Mumbai", "Mumbai")
    assert res.outcome == VerificationOutcome.MATCH


def test_verify_city_mismatch():
    res = verify_field("city", "Pune", "Mumbai")
    assert res.outcome == VerificationOutcome.MISMATCH


def test_verify_postal_code_match():
    res = verify_field("postal_code", "400 001", "400001")
    assert res.outcome == VerificationOutcome.MATCH


def test_verify_postal_code_mismatch():
    res = verify_field("postal_code", "560001", "400001")
    assert res.outcome == VerificationOutcome.MISMATCH


def test_verify_email_match():
    res = verify_field("email", "priya dot sharma at example dot com", "priya.sharma@example.com")
    assert res.outcome == VerificationOutcome.MATCH


def test_verify_email_ambiguous():
    res = verify_field("email", "priya sharma at", "priya.sharma@example.com")
    assert res.outcome == VerificationOutcome.NEEDS_CLARIFICATION
    assert res.needs_manual_review is True


def test_verify_account_reference_match():
    res = verify_field("account_reference", "ACC-78432", "ACC-78432")
    assert res.outcome == VerificationOutcome.MATCH


def test_verify_not_provided():
    res = verify_field("city", "", "Mumbai")
    assert res.outcome == VerificationOutcome.NOT_PROVIDED
