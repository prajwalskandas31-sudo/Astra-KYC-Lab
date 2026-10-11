"""Session orchestration service.

Manages session lifecycle, answer persistence, and result computation.
"""

import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.questionnaire import get_questions, get_question, render_prompt, QUESTIONS
from app.models.models import (
    Customer,
    VerificationSession,
    AnswerAttempt,
    SessionStatus,
    VerificationOutcome,
    QuestionType,
)
from app.schemas.schemas import (
    AnswerOut,
    FieldVerificationResult,
    QuestionOut,
    SessionResultOut,
    DashboardStats,
)
from app.services.verification_service import verify_field
from app.services.decision_service import (
    compute_field_outcome,
    compute_session_status,
    detect_empty_answer,
)


# ---------- Customer operations ----------

def get_customers(db: Session) -> list[Customer]:
    return db.query(Customer).all()


def get_customer(db: Session, customer_id: str) -> Optional[Customer]:
    return db.query(Customer).filter(Customer.id == customer_id).first()


# ---------- Session operations ----------

def create_session(db: Session, customer_id: str) -> VerificationSession:
    customer = get_customer(db, customer_id)
    if customer is None:
        raise ValueError(f"Customer '{customer_id}' not found.")

    session = VerificationSession(
        id=str(uuid.uuid4()),
        customer_id=customer_id,
        status=SessionStatus.IN_PROGRESS,
        current_question_index=0,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def get_sessions(db: Session) -> list[VerificationSession]:
    return db.query(VerificationSession).order_by(VerificationSession.started_at.desc()).all()


def get_session(db: Session, session_id: str) -> Optional[VerificationSession]:
    return db.query(VerificationSession).filter(VerificationSession.id == session_id).first()


# ---------- Question helpers ----------

def get_session_questions(customer: Customer) -> list[QuestionOut]:
    """Return all questions with prompts rendered for a customer."""
    questions = []
    for q in QUESTIONS:
        questions.append(
            QuestionOut(
                index=q["index"],
                field=q["field"],
                type=q["type"],
                prompt_text=render_prompt(q["index"], customer.full_name),
            )
        )
    return questions


def _get_expected_value(customer: Customer, field: str) -> str:
    """Map question field name to the customer's expected value."""
    field_map = {
        "identity_confirmation": customer.full_name,
        "date_of_birth": customer.date_of_birth,
        "city": customer.city,
        "postal_code": customer.postal_code,
        "email": customer.email,
        "account_reference": customer.account_reference,
    }
    return field_map.get(field, "")


# ---------- Answer operations ----------

def get_attempt_count(db: Session, session_id: str, question_index: int) -> int:
    """Count existing attempts for a question in a session."""
    return (
        db.query(AnswerAttempt)
        .filter(
            AnswerAttempt.session_id == session_id,
            AnswerAttempt.question_index == question_index,
        )
        .count()
    )


def create_answer(
    db: Session,
    session_id: str,
    question_index: int,
    question_field: str,
    question_type: QuestionType,
    audio_file_path: Optional[str] = None,
) -> AnswerAttempt:
    """Create a new answer attempt (audio uploaded, not yet transcribed)."""
    session = get_session(db, session_id)
    if session is None:
        raise ValueError(f"Session '{session_id}' not found.")
    if session.status != SessionStatus.IN_PROGRESS:
        raise ValueError(f"Session is not in progress (status: {session.status}).")

    attempt_number = get_attempt_count(db, session_id, question_index) + 1
    if attempt_number > settings.max_retries_per_question:
        raise ValueError(
            f"Maximum retries ({settings.max_retries_per_question}) reached for question {question_index}."
        )

    customer = get_customer(db, session.customer_id)
    expected = _get_expected_value(customer, question_field) if customer else ""

    answer = AnswerAttempt(
        id=str(uuid.uuid4()),
        session_id=session_id,
        question_index=question_index,
        question_field=question_field,
        question_type=question_type,
        attempt_number=attempt_number,
        audio_file_path=audio_file_path,
        expected_value=expected,
    )
    db.add(answer)
    db.commit()
    db.refresh(answer)
    return answer


def update_answer_with_transcription(
    db: Session,
    answer_id: str,
    transcript: str,
    audio_duration: float,
    transcription_duration: float,
) -> AnswerAttempt:
    """Update an answer with the transcription result and run verification."""
    answer = db.query(AnswerAttempt).filter(AnswerAttempt.id == answer_id).first()
    if answer is None:
        raise ValueError(f"Answer '{answer_id}' not found.")

    start = time.monotonic()

    answer.transcript = transcript
    answer.audio_duration_seconds = audio_duration
    answer.transcription_duration_seconds = transcription_duration

    # Run verification
    if detect_empty_answer(transcript):
        answer.normalised_answer = ""
        answer.outcome = VerificationOutcome.NOT_PROVIDED
        answer.outcome_reason = "No speech detected in the recording."
        answer.needs_manual_review = False
    else:
        result = verify_field(
            answer.question_field,
            transcript,
            answer.expected_value or "",
        )
        answer.normalised_answer = result.normalised_answer
        answer.outcome = result.outcome
        answer.outcome_reason = result.reason
        answer.needs_manual_review = result.needs_manual_review

    verification_elapsed = time.monotonic() - start
    answer.verification_duration_seconds = round(verification_elapsed, 3)
    answer.total_processing_seconds = round(transcription_duration + verification_elapsed, 3)

    db.commit()
    db.refresh(answer)
    return answer


# ---------- Session completion ----------

def complete_session(db: Session, session_id: str) -> VerificationSession:
    """Finalise a session and compute overall status."""
    session = get_session(db, session_id)
    if session is None:
        raise ValueError(f"Session '{session_id}' not found.")

    customer = get_customer(db, session.customer_id)

    # Collect the latest attempt per question field
    field_results = _compute_field_results(db, session_id, customer)

    status = compute_session_status(field_results)
    session.status = status
    now_utc = datetime.now(timezone.utc)
    session.completed_at = now_utc
    if session.started_at:
        started_at = session.started_at
        if started_at.tzinfo is None:
            started_at = started_at.replace(tzinfo=timezone.utc)
        delta = now_utc - started_at
        session.total_duration_seconds = round(delta.total_seconds(), 3)

    db.commit()
    db.refresh(session)
    return session


def cancel_session(db: Session, session_id: str) -> VerificationSession:
    """Cancel (mark incomplete) a session."""
    session = get_session(db, session_id)
    if session is None:
        raise ValueError(f"Session '{session_id}' not found.")
    session.status = SessionStatus.INCOMPLETE
    now_utc = datetime.now(timezone.utc)
    session.completed_at = now_utc
    if session.started_at:
        started_at = session.started_at
        if started_at.tzinfo is None:
            started_at = started_at.replace(tzinfo=timezone.utc)
        delta = now_utc - started_at
        session.total_duration_seconds = round(delta.total_seconds(), 3)
    db.commit()
    db.refresh(session)
    return session


# ---------- Results ----------

def _compute_field_results(
    db: Session, session_id: str, customer: Optional[Customer]
) -> list[FieldVerificationResult]:
    """Compute final field-level results from all answer attempts."""
    answers = (
        db.query(AnswerAttempt)
        .filter(AnswerAttempt.session_id == session_id)
        .order_by(AnswerAttempt.question_index, AnswerAttempt.attempt_number)
        .all()
    )

    # Group by field
    field_attempts: dict[str, list[FieldVerificationResult]] = {}
    for ans in answers:
        if ans.transcript is None:
            continue  # Not yet transcribed
        result = FieldVerificationResult(
            field_name=ans.question_field,
            expected_value=ans.expected_value or "",
            original_transcript=ans.transcript or "",
            normalised_answer=ans.normalised_answer or "",
            outcome=ans.outcome or VerificationOutcome.NOT_PROVIDED,
            reason=ans.outcome_reason or "",
            needs_manual_review=ans.needs_manual_review,
        )
        field_attempts.setdefault(ans.question_field, []).append(result)

    # Compute final outcome per field
    final_results = []
    for field_name, attempts in field_attempts.items():
        final_results.append(compute_field_outcome(attempts))

    return final_results


def get_session_results(db: Session, session_id: str) -> Optional[SessionResultOut]:
    """Build the full session result including all answers and field outcomes."""
    session = get_session(db, session_id)
    if session is None:
        return None

    customer = get_customer(db, session.customer_id)
    answers = (
        db.query(AnswerAttempt)
        .filter(AnswerAttempt.session_id == session_id)
        .order_by(AnswerAttempt.question_index, AnswerAttempt.attempt_number)
        .all()
    )

    field_results = _compute_field_results(db, session_id, customer)

    return SessionResultOut(
        session_id=session.id,
        customer_id=session.customer_id,
        customer_name=customer.full_name if customer else "Unknown",
        status=session.status,
        started_at=session.started_at,
        completed_at=session.completed_at,
        total_duration_seconds=session.total_duration_seconds,
        answers=[AnswerOut.model_validate(a) for a in answers],
        field_results=field_results,
    )


# ---------- Dashboard ----------

def get_dashboard_stats(db: Session) -> DashboardStats:
    """Compute dashboard statistics."""
    total = db.query(VerificationSession).count()
    completed = db.query(VerificationSession).filter(
        VerificationSession.status == SessionStatus.VERIFIED
    ).count()
    manual_review = db.query(VerificationSession).filter(
        VerificationSession.status == SessionStatus.NEEDS_MANUAL_REVIEW
    ).count()
    not_verified = db.query(VerificationSession).filter(
        VerificationSession.status == SessionStatus.NOT_VERIFIED
    ).count()
    incomplete = db.query(VerificationSession).filter(
        VerificationSession.status == SessionStatus.INCOMPLETE
    ).count()
    in_progress = db.query(VerificationSession).filter(
        VerificationSession.status == SessionStatus.IN_PROGRESS
    ).count()

    # Average transcription time
    from sqlalchemy import func

    avg_time = (
        db.query(func.avg(AnswerAttempt.transcription_duration_seconds))
        .filter(AnswerAttempt.transcription_duration_seconds.isnot(None))
        .scalar()
    )

    return DashboardStats(
        total_sessions=total,
        completed_sessions=completed,
        manual_review_sessions=manual_review,
        not_verified_sessions=not_verified,
        incomplete_sessions=incomplete,
        in_progress_sessions=in_progress,
        avg_transcription_time=round(avg_time, 3) if avg_time else None,
    )
