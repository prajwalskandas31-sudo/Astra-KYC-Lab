"""Deterministic verification engine.

Compares a spoken transcript against expected customer data
using conservative normalisation rules. Never uses fuzzy matching
to automatically approve identity fields.
"""

import re
from datetime import datetime
from typing import Optional

from app.models.models import VerificationOutcome, QuestionType
from app.schemas.schemas import FieldVerificationResult


# ---------- Normalisation helpers ----------

def normalise_whitespace(text: str) -> str:
    """Collapse whitespace and strip."""
    return re.sub(r"\s+", " ", text).strip()


def normalise_yes_no(transcript: str) -> Optional[str]:
    """Parse yes/no from a transcript. Returns 'yes', 'no', or None."""
    t = normalise_whitespace(transcript).lower()
    # Remove common filler words
    t = re.sub(r"\b(um|uh|ah|well|okay|ok|so|like)\b", "", t).strip()
    t = normalise_whitespace(t)

    yes_patterns = [
        r"^yes\b", r"^yeah\b", r"^yep\b", r"^yup\b", r"^correct\b",
        r"^that(?:\s+is|'?s)?\s+(?:right|correct|me)\b", r"^speaking\b",
        r"^this is\b", r"^i am\b", r"^affirmative\b",
    ]
    no_patterns = [
        r"^no\b", r"^nope\b", r"^nah\b", r"^negative\b",
        r"^that(?:\s+is|'?s)?\s+(?:not|wrong|incorrect)\b", r"^wrong\b",
    ]

    for pat in yes_patterns:
        if re.search(pat, t):
            return "yes"
    for pat in no_patterns:
        if re.search(pat, t):
            return "no"
    return None


def normalise_name(text: str) -> str:
    """Normalise a name: lowercase, strip titles, collapse whitespace."""
    t = normalise_whitespace(text).lower()
    # Remove common titles
    t = re.sub(r"\b(mr|mrs|ms|miss|dr|prof|sir|madam)\.?\s*", "", t)
    return normalise_whitespace(t)


def normalise_date(text: str) -> Optional[str]:
    """Attempt to parse a spoken date into YYYY-MM-DD.

    Supports common formats. Returns None for ambiguous dates.
    """
    t = normalise_whitespace(text).lower()
    # Remove ordinal suffixes
    t = re.sub(r"(\d+)(st|nd|rd|th)", r"\1", t)
    # Replace spoken separators
    t = t.replace(" of ", " ").replace(",", " ")
    t = normalise_whitespace(t)

    # Map month names/abbreviations
    month_map = {
        "january": "01", "jan": "01", "february": "02", "feb": "02",
        "march": "03", "mar": "03", "april": "04", "apr": "04",
        "may": "05", "june": "06", "jun": "06", "july": "07", "jul": "07",
        "august": "08", "aug": "08", "september": "09", "sep": "09", "sept": "09",
        "october": "10", "oct": "10", "november": "11", "nov": "11",
        "december": "12", "dec": "12",
    }

    # Try "15 march 1990" or "march 15 1990"
    for month_name, month_num in month_map.items():
        # Day Month Year
        m = re.match(rf"(\d{{1,2}})\s+{month_name}\s+(\d{{4}})", t)
        if m:
            day, year = int(m.group(1)), int(m.group(2))
            if 1 <= day <= 31 and 1900 <= year <= 2100:
                return f"{year}-{month_num}-{day:02d}"
        # Month Day Year
        m = re.match(rf"{month_name}\s+(\d{{1,2}})\s+(\d{{4}})", t)
        if m:
            day, year = int(m.group(1)), int(m.group(2))
            if 1 <= day <= 31 and 1900 <= year <= 2100:
                return f"{year}-{month_num}-{day:02d}"

    # Try common numeric formats
    # YYYY-MM-DD
    m = re.match(r"(\d{4})[-/](\d{1,2})[-/](\d{1,2})", t)
    if m:
        year, month, day = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if 1 <= month <= 12 and 1 <= day <= 31:
            return f"{year}-{month:02d}-{day:02d}"

    # DD-MM-YYYY or DD/MM/YYYY (assume day-first for unambiguous cases)
    m = re.match(r"(\d{1,2})[-/](\d{1,2})[-/](\d{4})", t)
    if m:
        first, second, year = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if first > 12 and 1 <= second <= 12:
            # Unambiguously DD-MM-YYYY
            return f"{year}-{second:02d}-{first:02d}"
        elif second > 12 and 1 <= first <= 12:
            # Unambiguously MM-DD-YYYY
            return f"{year}-{first:02d}-{second:02d}"
        else:
            # Ambiguous — do not guess
            return None

    return None


def normalise_postal_code(text: str) -> str:
    """Normalise a postal code: strip whitespace, dashes, keep digits/letters."""
    t = normalise_whitespace(text).upper()
    # Remove common separators
    t = re.sub(r"[\s\-]", "", t)
    return t


def normalise_email(text: str) -> str:
    """Parse spoken email into standard format.

    Handles: "at" → @, "dot" → ., "underscore" → _
    """
    t = normalise_whitespace(text).lower()
    # Remove "my email is" type prefixes
    t = re.sub(r"^(my\s+)?(email|e-mail|mail)(\s+(?:is|address))?\s*:?\s*", "", t)

    # If it already contains @ and looks like an email, just clean it
    if "@" in t and "." in t.split("@")[-1]:
        return re.sub(r"\s+", "", t)

    # Replace spoken words with symbols
    t = re.sub(r"\s+at\s+", "@", t)
    t = re.sub(r"\s+dot\s+", ".", t)
    t = re.sub(r"\s+underscore\s+", "_", t)
    t = re.sub(r"\s+dash\s+", "-", t)
    t = re.sub(r"\s+hyphen\s+", "-", t)
    # Remove remaining spaces
    t = re.sub(r"\s+", "", t)
    return t


def normalise_account_reference(text: str) -> str:
    """Normalise account reference: preserve significant letters and digits."""
    t = normalise_whitespace(text).upper()
    # Remove filler words
    t = re.sub(r"\b(MY|ACCOUNT|REFERENCE|NUMBER|IS|THE)\b", "", t, flags=re.IGNORECASE)
    # Keep only alphanumeric and dash
    t = re.sub(r"[^A-Z0-9\-]", "", t)
    return t


def normalise_city(text: str) -> str:
    """Normalise a city name."""
    t = normalise_whitespace(text).lower()
    # Remove "the city is", "i live in", "in", "it's" prefixes
    t = re.sub(r"^(the\s+)?(city|town)(\s+is)?\s*:?\s*", "", t)
    t = re.sub(r"^(i\s+live\s+in|living\s+in|in|it'?s?\s+in|it'?s?)\s+", "", t)
    return normalise_whitespace(t)


# ---------- Field verification ----------

def verify_identity_confirmation(transcript: str, expected_name: str) -> FieldVerificationResult:
    """Verify yes/no identity confirmation."""
    parsed = normalise_yes_no(transcript)
    if parsed is None:
        return FieldVerificationResult(
            field_name="identity_confirmation",
            expected_value=expected_name,
            original_transcript=transcript,
            normalised_answer=transcript.strip(),
            outcome=VerificationOutcome.NEEDS_CLARIFICATION,
            reason="Could not parse a yes/no response from the transcript.",
            needs_manual_review=True,
        )
    if parsed == "yes":
        return FieldVerificationResult(
            field_name="identity_confirmation",
            expected_value=expected_name,
            original_transcript=transcript,
            normalised_answer="yes",
            outcome=VerificationOutcome.MATCH,
            reason="Customer confirmed their identity.",
            needs_manual_review=False,
        )
    return FieldVerificationResult(
        field_name="identity_confirmation",
        expected_value=expected_name,
        original_transcript=transcript,
        normalised_answer="no",
        outcome=VerificationOutcome.MISMATCH,
        reason="Customer denied being the named individual.",
        needs_manual_review=True,
    )


def verify_date_of_birth(transcript: str, expected_dob: str) -> FieldVerificationResult:
    """Verify date of birth."""
    normalised = normalise_date(transcript)
    if normalised is None:
        return FieldVerificationResult(
            field_name="date_of_birth",
            expected_value=expected_dob,
            original_transcript=transcript,
            normalised_answer=transcript.strip(),
            outcome=VerificationOutcome.NEEDS_CLARIFICATION,
            reason="Could not parse a recognisable date from the transcript.",
            needs_manual_review=True,
        )
    if normalised == expected_dob:
        return FieldVerificationResult(
            field_name="date_of_birth",
            expected_value=expected_dob,
            original_transcript=transcript,
            normalised_answer=normalised,
            outcome=VerificationOutcome.MATCH,
            reason="Date of birth matches.",
            needs_manual_review=False,
        )
    return FieldVerificationResult(
        field_name="date_of_birth",
        expected_value=expected_dob,
        original_transcript=transcript,
        normalised_answer=normalised,
        outcome=VerificationOutcome.MISMATCH,
        reason=f"Date of birth '{normalised}' does not match expected '{expected_dob}'.",
        needs_manual_review=False,
    )


def verify_city(transcript: str, expected_city: str) -> FieldVerificationResult:
    """Verify city name."""
    normalised = normalise_city(transcript)
    expected_norm = normalise_city(expected_city)

    if not normalised:
        return FieldVerificationResult(
            field_name="city",
            expected_value=expected_city,
            original_transcript=transcript,
            normalised_answer="",
            outcome=VerificationOutcome.NOT_PROVIDED,
            reason="No city name detected in the transcript.",
            needs_manual_review=False,
        )
    if normalised == expected_norm:
        return FieldVerificationResult(
            field_name="city",
            expected_value=expected_city,
            original_transcript=transcript,
            normalised_answer=normalised,
            outcome=VerificationOutcome.MATCH,
            reason="City matches.",
            needs_manual_review=False,
        )
    return FieldVerificationResult(
        field_name="city",
        expected_value=expected_city,
        original_transcript=transcript,
        normalised_answer=normalised,
        outcome=VerificationOutcome.MISMATCH,
        reason=f"City '{normalised}' does not match expected '{expected_norm}'.",
        needs_manual_review=False,
    )


def verify_postal_code(transcript: str, expected_code: str) -> FieldVerificationResult:
    """Verify postal code with exact match after normalisation."""
    normalised = normalise_postal_code(transcript)
    expected_norm = normalise_postal_code(expected_code)

    if not normalised:
        return FieldVerificationResult(
            field_name="postal_code",
            expected_value=expected_code,
            original_transcript=transcript,
            normalised_answer="",
            outcome=VerificationOutcome.NOT_PROVIDED,
            reason="No postal code detected.",
            needs_manual_review=False,
        )
    if normalised == expected_norm:
        return FieldVerificationResult(
            field_name="postal_code",
            expected_value=expected_code,
            original_transcript=transcript,
            normalised_answer=normalised,
            outcome=VerificationOutcome.MATCH,
            reason="Postal code matches.",
            needs_manual_review=False,
        )
    return FieldVerificationResult(
        field_name="postal_code",
        expected_value=expected_code,
        original_transcript=transcript,
        normalised_answer=normalised,
        outcome=VerificationOutcome.MISMATCH,
        reason=f"Postal code '{normalised}' does not match expected '{expected_norm}'.",
        needs_manual_review=False,
    )


def verify_email(transcript: str, expected_email: str) -> FieldVerificationResult:
    """Verify email with spoken-email parsing."""
    normalised = normalise_email(transcript)
    expected_norm = expected_email.lower().strip()

    if not normalised or normalised == "":
        return FieldVerificationResult(
            field_name="email",
            expected_value=expected_email,
            original_transcript=transcript,
            normalised_answer="",
            outcome=VerificationOutcome.NOT_PROVIDED,
            reason="No email detected.",
            needs_manual_review=False,
        )
    if normalised == expected_norm:
        return FieldVerificationResult(
            field_name="email",
            expected_value=expected_email,
            original_transcript=transcript,
            normalised_answer=normalised,
            outcome=VerificationOutcome.MATCH,
            reason="Email matches.",
            needs_manual_review=False,
        )
    # Check if it's close but ambiguous (e.g., missing domain)
    if "@" not in normalised:
        return FieldVerificationResult(
            field_name="email",
            expected_value=expected_email,
            original_transcript=transcript,
            normalised_answer=normalised,
            outcome=VerificationOutcome.NEEDS_CLARIFICATION,
            reason="Could not parse a complete email address from the transcript.",
            needs_manual_review=True,
        )
    return FieldVerificationResult(
        field_name="email",
        expected_value=expected_email,
        original_transcript=transcript,
        normalised_answer=normalised,
        outcome=VerificationOutcome.MISMATCH,
        reason=f"Email '{normalised}' does not match expected '{expected_norm}'.",
        needs_manual_review=False,
    )


def verify_account_reference(transcript: str, expected_ref: str) -> FieldVerificationResult:
    """Verify account reference."""
    normalised = normalise_account_reference(transcript)
    expected_norm = normalise_account_reference(expected_ref)

    if not normalised:
        return FieldVerificationResult(
            field_name="account_reference",
            expected_value=expected_ref,
            original_transcript=transcript,
            normalised_answer="",
            outcome=VerificationOutcome.NOT_PROVIDED,
            reason="No account reference detected.",
            needs_manual_review=False,
        )
    if normalised == expected_norm:
        return FieldVerificationResult(
            field_name="account_reference",
            expected_value=expected_ref,
            original_transcript=transcript,
            normalised_answer=normalised,
            outcome=VerificationOutcome.MATCH,
            reason="Account reference matches.",
            needs_manual_review=False,
        )
    return FieldVerificationResult(
        field_name="account_reference",
        expected_value=expected_ref,
        original_transcript=transcript,
        normalised_answer=normalised,
        outcome=VerificationOutcome.MISMATCH,
        reason=f"Account reference '{normalised}' does not match expected '{expected_norm}'.",
        needs_manual_review=False,
    )


# ---------- Main dispatch ----------

FIELD_VERIFIERS = {
    "identity_confirmation": verify_identity_confirmation,
    "date_of_birth": verify_date_of_birth,
    "city": verify_city,
    "postal_code": verify_postal_code,
    "email": verify_email,
    "account_reference": verify_account_reference,
}


def verify_field(field_name: str, transcript: str, expected_value: str) -> FieldVerificationResult:
    """Verify a single field against its expected value."""
    if not transcript or not transcript.strip():
        return FieldVerificationResult(
            field_name=field_name,
            expected_value=expected_value,
            original_transcript=transcript or "",
            normalised_answer="",
            outcome=VerificationOutcome.NOT_PROVIDED,
            reason="No answer was provided.",
            needs_manual_review=False,
        )

    verifier = FIELD_VERIFIERS.get(field_name)
    if verifier is None:
        return FieldVerificationResult(
            field_name=field_name,
            expected_value=expected_value,
            original_transcript=transcript,
            normalised_answer=transcript.strip(),
            outcome=VerificationOutcome.NOT_APPLICABLE,
            reason=f"No verifier configured for field '{field_name}'.",
            needs_manual_review=True,
        )

    return verifier(transcript, expected_value)
