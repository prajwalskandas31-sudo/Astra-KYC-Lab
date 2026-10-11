"""Pydantic v2 schemas for API request/response validation."""

from __future__ import annotations

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field

from app.models.models import SessionStatus, VerificationOutcome, QuestionType


# ---------- Customer ----------

class CustomerOut(BaseModel):
    id: str
    full_name: str
    date_of_birth: str
    city: str
    postal_code: str
    email: str
    account_reference: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------- Question ----------

class QuestionOut(BaseModel):
    index: int
    field: str
    type: QuestionType
    prompt_text: str


# ---------- Session ----------

class SessionCreate(BaseModel):
    customer_id: str


class SessionOut(BaseModel):
    id: str
    customer_id: str
    status: SessionStatus
    started_at: datetime
    completed_at: Optional[datetime] = None
    total_duration_seconds: Optional[float] = None
    current_question_index: int

    model_config = {"from_attributes": True}


class SessionWithCustomer(SessionOut):
    customer: CustomerOut


# ---------- Answer ----------

class AnswerCreate(BaseModel):
    question_index: int
    question_field: str
    question_type: QuestionType
    attempt_number: int = 1


class AnswerOut(BaseModel):
    id: str
    session_id: str
    question_index: int
    question_field: str
    question_type: QuestionType
    attempt_number: int
    transcript: Optional[str] = None
    normalised_answer: Optional[str] = None
    expected_value: Optional[str] = None
    outcome: Optional[VerificationOutcome] = None
    outcome_reason: Optional[str] = None
    needs_manual_review: bool = False
    audio_duration_seconds: Optional[float] = None
    transcription_duration_seconds: Optional[float] = None
    verification_duration_seconds: Optional[float] = None
    total_processing_seconds: Optional[float] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------- Transcription ----------

class TranscriptionResult(BaseModel):
    transcript: str
    audio_duration_seconds: float
    processing_duration_seconds: float
    real_time_factor: float


# ---------- Verification ----------

class FieldVerificationResult(BaseModel):
    field_name: str
    expected_value: str
    original_transcript: str
    normalised_answer: str
    outcome: VerificationOutcome
    reason: str
    needs_manual_review: bool


# ---------- Session Result ----------

class SessionResultOut(BaseModel):
    session_id: str
    customer_id: str
    customer_name: str
    status: SessionStatus
    started_at: datetime
    completed_at: Optional[datetime] = None
    total_duration_seconds: Optional[float] = None
    answers: list[AnswerOut]
    field_results: list[FieldVerificationResult]


# ---------- Dashboard ----------

class DashboardStats(BaseModel):
    total_sessions: int = 0
    completed_sessions: int = 0
    manual_review_sessions: int = 0
    not_verified_sessions: int = 0
    incomplete_sessions: int = 0
    in_progress_sessions: int = 0
    avg_transcription_time: Optional[float] = None


# ---------- Health ----------

class HealthCheck(BaseModel):
    status: str = "ok"
    speech_model_loaded: bool = False
    ffmpeg_available: bool = False
    database_ok: bool = False
