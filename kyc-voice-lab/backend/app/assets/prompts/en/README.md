# Audio Prompts Directory

This directory holds prerecorded English audio prompt files for each question in the verification questionnaire:
- `q0_identity_confirmation.wav`: Prompt for Question 0 (identity confirmation)
- `q1_date_of_birth.wav`: Prompt for Question 1 (date of birth)
- `q2_city.wav`: Prompt for Question 2 (city)
- `q3_postal_code.wav`: Prompt for Question 3 (postal code)
- `q4_email.wav`: Prompt for Question 4 (email)
- `q5_account_reference.wav`: Prompt for Question 5 (account reference)

### Text Fallback
When a `.wav` file is not present in this directory, the frontend simulator automatically falls back to:
1. Browser Web Speech Synthesis (`window.speechSynthesis`) to speak the prompt aloud dynamically with the customer's name.
2. Clear textual prompt display on screen.
