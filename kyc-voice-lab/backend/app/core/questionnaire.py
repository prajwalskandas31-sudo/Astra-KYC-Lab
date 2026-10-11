"""Verification questionnaire configuration."""

from app.models.models import QuestionType

QUESTIONS = [
    {
        "index": 0,
        "field": "identity_confirmation",
        "type": QuestionType.YES_NO,
        "prompt_template": "Hello. This is an automated verification test. Am I speaking with {customer_name}?",
    },
    {
        "index": 1,
        "field": "date_of_birth",
        "type": QuestionType.OPEN,
        "prompt_template": "Please state your date of birth.",
    },
    {
        "index": 2,
        "field": "city",
        "type": QuestionType.OPEN,
        "prompt_template": "Please tell me the city associated with your registered address.",
    },
    {
        "index": 3,
        "field": "postal_code",
        "type": QuestionType.OPEN,
        "prompt_template": "Please state your registered postal code.",
    },
    {
        "index": 4,
        "field": "email",
        "type": QuestionType.OPEN,
        "prompt_template": "Please state your registered email address, spelling it out if necessary.",
    },
    {
        "index": 5,
        "field": "account_reference",
        "type": QuestionType.OPEN,
        "prompt_template": "Please state your account reference.",
    },
]


def get_questions() -> list[dict]:
    """Return the full questionnaire."""
    return QUESTIONS


def get_question(index: int) -> dict | None:
    """Return a single question by index."""
    for q in QUESTIONS:
        if q["index"] == index:
            return q
    return None


def render_prompt(index: int, customer_name: str = "") -> str:
    """Render the prompt text for a question, substituting customer values."""
    q = get_question(index)
    if q is None:
        return ""
    return q["prompt_template"].format(customer_name=customer_name)
