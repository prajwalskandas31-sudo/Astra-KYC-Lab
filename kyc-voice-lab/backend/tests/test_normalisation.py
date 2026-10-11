"""Unit tests for normalisation functions."""

import pytest
from app.services.verification_service import (
    normalise_whitespace,
    normalise_yes_no,
    normalise_name,
    normalise_date,
    normalise_postal_code,
    normalise_email,
    normalise_account_reference,
    normalise_city,
)


def test_normalise_whitespace():
    assert normalise_whitespace("  hello   world  \n\t") == "hello world"


def test_normalise_yes_no():
    # Affirmatives
    assert normalise_yes_no("yes") == "yes"
    assert normalise_yes_no("yeah") == "yes"
    assert normalise_yes_no("yep, that is me") == "yes"
    assert normalise_yes_no("correct") == "yes"
    assert normalise_yes_no("speaking") == "yes"
    assert normalise_yes_no("this is Priya") == "yes"
    assert normalise_yes_no("that's right") == "yes"
    assert normalise_yes_no("um yes correct") == "yes"

    # Negatives
    assert normalise_yes_no("no") == "no"
    assert normalise_yes_no("nope") == "no"
    assert normalise_yes_no("that is wrong") == "no"
    assert normalise_yes_no("wrong person") == "no"

    # Ambiguous / non-answers
    assert normalise_yes_no("maybe") is None
    assert normalise_yes_no("who are you") is None
    assert normalise_yes_no("") is None


def test_normalise_name():
    assert normalise_name("Mr. Rahul Verma") == "rahul verma"
    assert normalise_name("Dr Priya Sharma") == "priya sharma"
    assert normalise_name("ms.  Ananya Patel") == "ananya patel"


def test_normalise_date():
    # Day Month Year formats
    assert normalise_date("15 march 1990") == "1990-03-15"
    assert normalise_date("15th of March 1990") == "1990-03-15"
    assert normalise_date("22nd July, 1985") == "1985-07-22"
    assert normalise_date("8 november 1992") == "1992-11-08"

    # Month Day Year formats
    assert normalise_date("March 15th 1990") == "1990-03-15"
    assert normalise_date("July 22 1985") == "1985-07-22"

    # ISO format
    assert normalise_date("1990-03-15") == "1990-03-15"
    assert normalise_date("1985/07/22") == "1985-07-22"

    # Unambiguous numeric
    assert normalise_date("25/03/1990") == "1990-03-25"  # 25 > 12 -> DD-MM-YYYY

    # Ambiguous numeric -> must return None without guessing
    assert normalise_date("04/05/1990") is None

    # Invalid / nonsense
    assert normalise_date("yesterday") is None
    assert normalise_date("") is None


def test_normalise_postal_code():
    assert normalise_postal_code("400 001") == "400001"
    assert normalise_postal_code("400-001") == "400001"
    assert normalise_postal_code("  110001 ") == "110001"
    assert normalise_postal_code("sw1a 1aa") == "SW1A1AA"


def test_normalise_email():
    # Spoken email parsing
    assert normalise_email("priya dot sharma at example dot com") == "priya.sharma@example.com"
    assert normalise_email("my email is rahul dot verma at example dot com") == "rahul.verma@example.com"
    assert normalise_email("ananya underscore patel at example dot com") == "ananya_patel@example.com"
    assert normalise_email("deepa.krishnan@example.com") == "deepa.krishnan@example.com"


def test_normalise_account_reference():
    assert normalise_account_reference("ACC-78432") == "ACC-78432"
    assert normalise_account_reference("my account reference is ACC 78432") == "ACC78432"
    assert normalise_account_reference("ACC-56219") == "ACC-56219"


def test_normalise_city():
    assert normalise_city("Mumbai") == "mumbai"
    assert normalise_city("The city is Bangalore") == "bangalore"
    assert normalise_city("It's Delhi") == "delhi"
    assert normalise_city("  hyderabad  ") == "hyderabad"
