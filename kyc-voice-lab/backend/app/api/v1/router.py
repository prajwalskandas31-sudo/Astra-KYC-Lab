"""FastAPI v1 API routes implementation."""

import os
import shutil
import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.seed import reset_seed_data
from app.db.session import get_db
from app.models.models import Customer, QuestionType, SessionStatus, VerificationSession
from app.schemas.schemas import (
    AnswerCreate,
    AnswerOut,
    CustomerOut,
    DashboardStats,
    HealthCheck,
    QuestionOut,
    SessionCreate,
    SessionOut,
    SessionResultOut,
    SessionWithCustomer,
)
from app.services import session_service, speech_service

router = APIRouter()


# ---------- Health Check ----------

@router.get("/health", response_model=HealthCheck, tags=["System"])
def health_check(db: Session = Depends(get_db)):
    """Check service health including model availability, FFmpeg, and DB connection."""
    db_ok = False
    try:
        db.query(Customer).count()
        db_ok = True
    except Exception:
        db_ok = False

    return HealthCheck(
        status="ok" if db_ok else "degraded",
        speech_model_loaded=speech_service.is_model_loaded(),
        ffmpeg_available=speech_service.is_ffmpeg_available(),
        database_ok=db_ok,
    )


# ---------- Customers ----------

@router.get("/customers", response_model=list[CustomerOut], tags=["Customers"])
def list_customers(db: Session = Depends(get_db)):
    """Retrieve all synthetic customers."""
    return session_service.get_customers(db)


@router.get("/customers/{customer_id}", response_model=CustomerOut, tags=["Customers"])
def get_customer(customer_id: str, db: Session = Depends(get_db)):
    """Retrieve details for a specific synthetic customer."""
    customer = session_service.get_customer(db, customer_id)
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Customer '{customer_id}' not found.",
        )
    return customer


# ---------- Sessions ----------

@router.post("/sessions", response_model=SessionOut, status_code=status.HTTP_201_CREATED, tags=["Sessions"])
def create_verification_session(payload: SessionCreate, db: Session = Depends(get_db)):
    """Create a new verification session for a synthetic customer."""
    try:
        return session_service.create_session(db, payload.customer_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/sessions", response_model=list[SessionOut], tags=["Sessions"])
def list_sessions(db: Session = Depends(get_db)):
    """List all verification sessions ordered by start time."""
    return session_service.get_sessions(db)


@router.get("/sessions/{session_id}", response_model=SessionWithCustomer, tags=["Sessions"])
def get_session_details(session_id: str, db: Session = Depends(get_db)):
    """Get verification session details including associated customer info."""
    sess = session_service.get_session(db, session_id)
    if not sess:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session '{session_id}' not found.",
        )
    customer = session_service.get_customer(db, sess.customer_id)
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Customer '{sess.customer_id}' not found for this session.",
        )
    return SessionWithCustomer(
        id=sess.id,
        customer_id=sess.customer_id,
        status=sess.status,
        started_at=sess.started_at,
        completed_at=sess.completed_at,
        total_duration_seconds=sess.total_duration_seconds,
        current_question_index=sess.current_question_index,
        customer=CustomerOut.model_validate(customer),
    )


@router.get("/sessions/{session_id}/questions", response_model=list[QuestionOut], tags=["Sessions"])
def get_session_questions(session_id: str, db: Session = Depends(get_db)):
    """Get all questionnaire questions rendered with customer data for this session."""
    sess = session_service.get_session(db, session_id)
    if not sess:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session '{session_id}' not found.",
        )
    customer = session_service.get_customer(db, sess.customer_id)
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found.",
        )
    return session_service.get_session_questions(customer)


# ---------- Answers & Audio Upload / Transcription ----------

@router.post("/sessions/{session_id}/answers", response_model=AnswerOut, tags=["Answers"])
async def submit_answer(
    session_id: str,
    question_index: int,
    question_field: str,
    question_type: QuestionType,
    audio: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
):
    """
    Submit an audio recording answer attempt for a specific question.
    Saves the uploaded audio securely and creates an AnswerAttempt record.
    """
    audio_path_str: Optional[str] = None

    if audio:
        ext = Path(audio.filename or "recording.webm").suffix.lower()
        if not ext:
            ext = ".webm"
        if ext not in speech_service.SUPPORTED_AUDIO_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported audio format '{ext}'. Allowed: {', '.join(speech_service.SUPPORTED_AUDIO_EXTENSIONS)}",
            )

        unique_filename = f"{session_id}_q{question_index}_{uuid.uuid4().hex[:8]}{ext}"
        target_path = settings.upload_path / unique_filename

        try:
            with open(target_path, "wb") as buffer:
                shutil.copyfileobj(audio.file, buffer)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to save audio file: {e}",
            )

        # Check empty audio
        if target_path.stat().st_size == 0:
            target_path.unlink(missing_ok=True)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded audio file is empty.",
            )

        audio_path_str = str(target_path)

    try:
        answer = session_service.create_answer(
            db=db,
            session_id=session_id,
            question_index=question_index,
            question_field=question_field,
            question_type=question_type,
            audio_file_path=audio_path_str,
        )
        return answer
    except ValueError as e:
        if audio_path_str and Path(audio_path_str).exists():
            Path(audio_path_str).unlink(missing_ok=True)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/sessions/{session_id}/answers/{answer_id}/transcribe", response_model=AnswerOut, tags=["Answers"])
def transcribe_answer(
    session_id: str,
    answer_id: str,
    db: Session = Depends(get_db),
):
    """
    Execute local speech-to-text on the stored audio for the given answer attempt,
    run deterministic field verification, and update the record.
    """
    sess = session_service.get_session(db, session_id)
    if not sess:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session '{session_id}' not found.",
        )

    # Fetch answer attempt
    from app.models.models import AnswerAttempt
    answer = db.query(AnswerAttempt).filter(
        AnswerAttempt.id == answer_id,
        AnswerAttempt.session_id == session_id,
    ).first()

    if not answer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Answer '{answer_id}' not found in session '{session_id}'.",
        )

    if not answer.audio_file_path:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No audio file uploaded for this answer attempt.",
        )

    audio_path = Path(answer.audio_file_path)
    if not audio_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Stored audio file could not be found on the filesystem.",
        )

    try:
        res = speech_service.transcribe_audio(audio_path)
    except FileNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Transcription failure: {e}")
    finally:
        # Retention check
        if not settings.retain_audio and audio_path.exists():
            try:
                audio_path.unlink(missing_ok=True)
            except Exception:
                pass

    updated_answer = session_service.update_answer_with_transcription(
        db=db,
        answer_id=answer_id,
        transcript=res["transcript"],
        audio_duration=res["audio_duration_seconds"],
        transcription_duration=res["processing_duration_seconds"],
    )

    return updated_answer


# ---------- Session Lifecycle & Results ----------

@router.post("/sessions/{session_id}/complete", response_model=SessionResultOut, tags=["Sessions"])
def complete_verification_session(session_id: str, db: Session = Depends(get_db)):
    """Complete a verification session and calculate final status and field outcomes."""
    try:
        session_service.complete_session(db, session_id)
        results = session_service.get_session_results(db, session_id)
        if not results:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Failed to retrieve session results after completion.",
            )
        return results
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/sessions/{session_id}/cancel", response_model=SessionOut, tags=["Sessions"])
def cancel_verification_session(session_id: str, db: Session = Depends(get_db)):
    """Cancel a verification session and mark it as INCOMPLETE."""
    try:
        return session_service.cancel_session(db, session_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/sessions/{session_id}/results", response_model=SessionResultOut, tags=["Sessions"])
def get_session_results(session_id: str, db: Session = Depends(get_db)):
    """Get full audit trail results for a session."""
    results = session_service.get_session_results(db, session_id)
    if not results:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Results for session '{session_id}' not found.",
        )
    return results


# ---------- Dashboard & Demo Reset ----------

@router.get("/dashboard/stats", response_model=DashboardStats, tags=["Dashboard"])
def get_dashboard_metrics(db: Session = Depends(get_db)):
    """Retrieve overview metrics for the verification dashboard."""
    return session_service.get_dashboard_stats(db)


@router.post("/demo/reset", tags=["Demo"])
def reset_database_data(db: Session = Depends(get_db)):
    """Reset the database back to initial seed data."""
    reset_seed_data(db)
    return {"message": "Database successfully reset to initial synthetic seed data."}
