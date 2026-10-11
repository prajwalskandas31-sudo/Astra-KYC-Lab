"""Decision service — computes session-level outcomes from field results.

Implements retry handling, contradiction detection, and final status calculation.
Provides a clean interface for a future optional AI classification adapter.
"""

from typing import Optional
from app.models.models import SessionStatus, VerificationOutcome
from app.schemas.schemas import FieldVerificationResult


def detect_empty_answer(transcript: Optional[str]) -> bool:
    """Return True if the transcript is empty or contains only silence/noise."""
    if not transcript:
        return True
    cleaned = transcript.strip().lower()
    if not cleaned:
        return True
    # Common transcription artifacts for silence
    noise_patterns = {"", ".", "...", "[silence]", "(silence)", "[noise]", "(noise)"}
    return cleaned in noise_patterns


def detect_correction(transcript: str) -> bool:
    """Detect if the speaker is correcting a previous answer."""
    t = transcript.lower().strip()
    correction_phrases = [
        "actually", "sorry", "i meant", "i mean", "correction",
        "let me correct", "no wait", "wait", "that's wrong",
        "i said it wrong", "not that",
    ]
    return any(phrase in t for phrase in correction_phrases)


def detect_contradiction(results: list[FieldVerificationResult]) -> bool:
    """Detect if multiple attempts for the same field produced contradictory results."""
    # This is called per-field with all attempts; if we have both MATCH and MISMATCH, it's contradictory
    outcomes = {r.outcome for r in results}
    return VerificationOutcome.MATCH in outcomes and VerificationOutcome.MISMATCH in outcomes


def compute_field_outcome(
    attempts: list[FieldVerificationResult],
) -> FieldVerificationResult:
    """Given multiple attempts for one field, compute the final field outcome.

    Rules:
    - If the latest attempt is MATCH, the field passes.
    - If contradictions exist across attempts, flag for manual review.
    - Otherwise, use the latest attempt's outcome.
    """
    if not attempts:
        return FieldVerificationResult(
            field_name="unknown",
            expected_value="",
            original_transcript="",
            normalised_answer="",
            outcome=VerificationOutcome.NOT_PROVIDED,
            reason="No attempts recorded.",
            needs_manual_review=False,
        )

    latest = attempts[-1]

    if detect_contradiction(attempts):
        return FieldVerificationResult(
            field_name=latest.field_name,
            expected_value=latest.expected_value,
            original_transcript=latest.original_transcript,
            normalised_answer=latest.normalised_answer,
            outcome=VerificationOutcome.NEEDS_CLARIFICATION,
            reason="Contradictory answers detected across attempts. Manual review required.",
            needs_manual_review=True,
        )

    return latest


def compute_session_status(field_results: list[FieldVerificationResult]) -> SessionStatus:
    """Compute the overall session status from field-level outcomes.

    - VERIFIED: every required field is MATCH, no unresolved contradictions.
    - NEEDS_MANUAL_REVIEW: one or more fields are ambiguous or contradictory.
    - NOT_VERIFIED: at least one required field has a clear MISMATCH.
    - INCOMPLETE: required answers are missing.
    """
    if not field_results:
        return SessionStatus.INCOMPLETE

    has_mismatch = False
    has_needs_review = False
    has_not_provided = False
    has_needs_clarification = False

    for result in field_results:
        if result.outcome == VerificationOutcome.MISMATCH:
            has_mismatch = True
        elif result.outcome == VerificationOutcome.NEEDS_CLARIFICATION:
            has_needs_clarification = True
        elif result.outcome == VerificationOutcome.NOT_PROVIDED:
            has_not_provided = True
        if result.needs_manual_review:
            has_needs_review = True

    if has_mismatch:
        return SessionStatus.NOT_VERIFIED
    if has_needs_review or has_needs_clarification:
        return SessionStatus.NEEDS_MANUAL_REVIEW
    if has_not_provided:
        return SessionStatus.INCOMPLETE

    return SessionStatus.VERIFIED


# ---------- Future AI adapter interface ----------

class ClassificationAdapter:
    """Interface for a future optional Jev classification adapter.

    In this prototype, all decisions are made deterministically.
    A production implementation could subclass this to add AI-assisted
    classification without changing the core verification logic.

    IMPORTANT: An AI decision or confidence score must never independently
    establish a person's identity.
    """

    def classify(
        self,
        field_name: str,
        transcript: str,
        expected_value: str,
        deterministic_result: FieldVerificationResult,
    ) -> FieldVerificationResult:
        """Override in subclass to add AI classification.

        The default implementation returns the deterministic result unchanged.
        """
        return deterministic_result
