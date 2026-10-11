"""SQLAlchemy ORM models for KYC Voice Lab."""

import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, DateTime, Float, Integer, Text, Boolean, ForeignKey, Enum as SAEnum,
)
from sqlalchemy.orm import DeclarativeBase, relationship
import enum


class Base(DeclarativeBase):
    pass


# ---------- Enums ----------

class SessionStatus(str, enum.Enum):
    IN_PROGRESS = "IN_PROGRESS"
    VERIFIED = "VERIFIED"
    NEEDS_MANUAL_REVIEW = "NEEDS_MANUAL_REVIEW"
    NOT_VERIFIED = "NOT_VERIFIED"
    INCOMPLETE = "INCOMPLETE"


class VerificationOutcome(str, enum.Enum):
    MATCH = "MATCH"
    MISMATCH = "MISMATCH"
    NEEDS_CLARIFICATION = "NEEDS_CLARIFICATION"
    NOT_PROVIDED = "NOT_PROVIDED"
    NOT_APPLICABLE = "NOT_APPLICABLE"


class QuestionType(str, enum.Enum):
    YES_NO = "YES_NO"
    OPEN = "OPEN"


# ---------- Helpers ----------

def _uuid() -> str:
    return str(uuid.uuid4())


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ---------- Models ----------

class Customer(Base):
    __tablename__ = "customers"

    id = Column(String, primary_key=True, default=_uuid)
    full_name = Column(String, nullable=False)
    date_of_birth = Column(String, nullable=False)  # ISO format YYYY-MM-DD
    city = Column(String, nullable=False)
    postal_code = Column(String, nullable=False)
    email = Column(String, nullable=False)
    account_reference = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), default=_utcnow)

    sessions = relationship("VerificationSession", back_populates="customer")


class VerificationSession(Base):
    __tablename__ = "sessions"

    id = Column(String, primary_key=True, default=_uuid)
    customer_id = Column(String, ForeignKey("customers.id"), nullable=False)
    status = Column(SAEnum(SessionStatus), default=SessionStatus.IN_PROGRESS, nullable=False)
    started_at = Column(DateTime(timezone=True), default=_utcnow)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    total_duration_seconds = Column(Float, nullable=True)
    current_question_index = Column(Integer, default=0)

    customer = relationship("Customer", back_populates="sessions")
    answers = relationship("AnswerAttempt", back_populates="session", order_by="AnswerAttempt.created_at")


class AnswerAttempt(Base):
    __tablename__ = "answer_attempts"

    id = Column(String, primary_key=True, default=_uuid)
    session_id = Column(String, ForeignKey("sessions.id"), nullable=False)
    question_index = Column(Integer, nullable=False)
    question_field = Column(String, nullable=False)
    question_type = Column(SAEnum(QuestionType), nullable=False)
    attempt_number = Column(Integer, default=1)
    audio_file_path = Column(String, nullable=True)
    transcript = Column(Text, nullable=True)
    normalised_answer = Column(Text, nullable=True)
    expected_value = Column(String, nullable=True)
    outcome = Column(SAEnum(VerificationOutcome), nullable=True)
    outcome_reason = Column(Text, nullable=True)
    needs_manual_review = Column(Boolean, default=False)
    audio_duration_seconds = Column(Float, nullable=True)
    transcription_duration_seconds = Column(Float, nullable=True)
    verification_duration_seconds = Column(Float, nullable=True)
    total_processing_seconds = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)

    session = relationship("VerificationSession", back_populates="answers")
