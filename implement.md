# Build a Local KYC Voice Verification Lab

## 1. Role and objective

Act as a senior full-stack architect and engineer specialising in Python, FastAPI, Next.js, local speech recognition, and secure application design.

Build a working, local-first proof of concept for an automated KYC voice verification system. This prototype will later be integrated into Astra CRM and connected to a production telephony provider.

The immediate objective is to test whether English-language spoken answers can be transcribed locally, compared with synthetic customer records, and classified reliably without requiring paid AI APIs or a telephone connection.

Implement the application, run the available tests, and document how to use it. Do not stop at a plan, design document, or static mockup.

## 2. Inspect the workspace before implementation

1. Inspect the current repository, its architecture, dependencies, conventions, and environment configuration.
2. If the Astra CRM repository is open, do not modify its existing production code, database, routes, or deployment configuration.
3. Create an isolated application directory named `kyc-voice-lab`.
4. Keep the prototype independently runnable.
5. Provide a brief implementation plan, then proceed with the implementation.

If no existing project is open, create the standalone project described below.

## 3. Mandatory technology stack

### Frontend
- Next.js with App Router.
- TypeScript.
- Tailwind CSS.
- shadcn/ui where appropriate.
- React Hook Form and Zod for forms and validation where useful.
- Browser MediaRecorder API for microphone recording.
- A clean, responsive, professional dashboard interface.

Use a currently supported Next.js version compatible with the installed Node.js version. Prefer a stable Next.js release rather than an experimental version.

### Backend
- Python 3.12, subject to compatibility with the installed dependencies.
- FastAPI.
- Pydantic v2.
- SQLAlchemy 2.x.
- SQLite for the local prototype.
- Alembic migrations if appropriate for the initial database setup.
- `faster-whisper` for local speech-to-text.

### Speech processing
- Start with the `base.en` Whisper model.
- Use CPU inference initially; do not assume a GPU is available.
- Allow the model size, device, and compute type to be configured through environment variables.
- Load the model once and reuse it.
- Do not send audio to external speech-recognition APIs.
- Download model weights on first use and document this requirement.

### Local development
Run the frontend and backend as separate services:

- Next.js frontend: `http://localhost:3000`
- FastAPI backend: `http://localhost:8000`
- FastAPI Swagger documentation: `http://localhost:8000/docs`

The application must work without a paid LLM API, telephone number, telephony provider, GPU, or external database.

## 4. Suggested project structure

Create a maintainable monorepo with separate frontend and backend directories.

    kyc-voice-lab/
    ├── frontend/
    │   ├── src/
    │   │   ├── app/
    │   │   │   ├── layout.tsx
    │   │   │   ├── page.tsx
    │   │   │   ├── customers/
    │   │   │   ├── sessions/
    │   │   │   └── results/
    │   │   ├── components/
    │   │   │   ├── dashboard/
    │   │   │   ├── call-simulator/
    │   │   │   ├── customers/
    │   │   │   └── results/
    │   │   ├── lib/
    │   │   │   ├── api.ts
    │   │   │   ├── schemas.ts
    │   │   │   └── utils.ts
    │   │   └── types/
    │   ├── public/
    │   │   └── audio/
    │   ├── package.json
    │   └── .env.local.example
    ├── backend/
    │   ├── app/
    │   │   ├── main.py
    │   │   ├── api/
    │   │   │   └── v1/
    │   │   ├── core/
    │   │   ├── db/
    │   │   ├── models/
    │   │   ├── schemas/
    │   │   ├── services/
    │   │   │   ├── speech_service.py
    │   │   │   ├── verification_service.py
    │   │   │   ├── session_service.py
    │   │   │   └── decision_service.py
    │   │   └── assets/
    │   │       └── prompts/
    │   │           └── en/
    │   ├── tests/
    │   ├── requirements.txt
    │   └── .env.example
    ├── .gitignore
    ├── README.md
    └── start-dev.ps1

You may adjust the structure when justified, but keep the Next.js frontend and FastAPI backend clearly separated. Do not move the backend into Next.js API routes.

## 5. Application features

### A. Dashboard

Display:
- Total test sessions.
- Completed sessions.
- Sessions requiring manual review.
- Sessions marked not verified.
- Incomplete sessions.
- Average transcription processing time when measurements are available.

Clearly label all metrics as local prototype test data.

### B. Synthetic customer management

Seed the database with several fictional customer records.

Each record should contain:
- Synthetic customer ID.
- Fictional full name.
- Date of birth.
- City.
- Postal code.
- Fictional registered email.
- Synthetic account reference.

Allow the user to select a customer, inspect the expected values, and reset the seed data.

Do not use real customer records, Aadhaar numbers, PAN details, or actual identity documents.

### C. Simulated verification call

Create a browser-based call simulator with:
- Selected customer details.
- Session ID.
- Current question number.
- English prompt text.
- Prompt playback controls.
- Microphone permission status.
- Recording timer.
- Start and stop recording controls.
- Transcription progress indicator.
- Recognised transcript.
- Retry answer and repeat question actions.
- Next-question and cancel-session actions.

Only one question should be active at a time.

The microphone must only record after an explicit user action. Handle denied permissions, empty recordings, duplicate submissions, and browser audio-format differences.

The browser records the audio. FastAPI performs the actual transcription.

### D. Results and audit trail

Display:
- Session ID.
- Customer ID.
- Start and completion timestamps.
- Question and expected field value.
- Recognised transcript.
- Normalised answer.
- Verification outcome and explanation.
- Number of attempts.
- Transcription latency.
- Total processing latency.
- Final session status.

Allow a completed session to be reopened for review. Provide JSON export for the session summary, excluding raw audio by default.

## 6. Verification questionnaire

Implement a configurable six-question English questionnaire.

1. Identity confirmation: "Hello. This is an automated verification test. Am I speaking with [customer name]?"
2. Date of birth: "Please state your date of birth."
3. City: "Please tell me the city associated with your registered address."
4. Postal code: "Please state your registered postal code."
5. Email: "Please state your registered email address, spelling it out if necessary."
6. Account reference: "Please state your account reference."

Support both open responses and yes/no confirmation questions.

Allow prompts to be repeated and answers to be retried. Configure the retry limit centrally.

Do not treat a yes to the first question as proof that all KYC fields are correct.

## 7. Local speech-to-text service

Implement a dedicated FastAPI speech service using `faster-whisper`.

The service must:
- Accept audio uploads.
- Validate upload size and supported audio formats.
- Reject empty audio.
- Convert audio using FFmpeg when necessary.
- Run transcription locally.
- Return the actual transcript.
- Record processing duration and audio duration.
- Handle silence, unintelligible speech, and model failures.
- Clean up temporary files safely.
- Never fabricate a transcript on failure.

Use the browser MediaRecorder API for recording. Do not use the browser Web Speech API as the primary recogniser.

If FFmpeg or the speech model is missing, return a useful error message and document how to fix it.

Do not represent uncalibrated model output as a reliable probability of transcription correctness.

## 8. Deterministic verification engine

Implement a separate Python verification service.

Each field result must contain:
- Field name.
- Expected value.
- Original transcript.
- Normalised answer.
- Outcome.
- Reason.
- Manual-review flag.

Supported outcomes:

- `MATCH`
- `MISMATCH`
- `NEEDS_CLARIFICATION`
- `NOT_PROVIDED`
- `NOT_APPLICABLE`

Implement conservative normalisation for names, dates, cities, postal codes, emails, and account references.

Specific requirements:
- Parse supported date formats into canonical dates.
- Avoid guessing ambiguous dates.
- Compare postal codes exactly after removing permitted formatting.
- Handle spoken email expressions such as "at" and "dot" with explicit parsing rules.
- Preserve significant letters and digits in account references.
- Never use fuzzy matching to automatically approve identity fields.
- Do not silently replace a spoken answer with the expected database value.

If an answer is unclear or contradictory, request clarification or mark it for manual review.

## 9. Decision logic

Use Python rules for ordinary verification decisions.

Implement:
- Yes/no parsing.
- Empty-answer detection.
- Correction detection.
- Retry handling.
- Contradiction handling.
- Field-level outcomes.
- Session-level outcome calculation.

Final session statuses:

- `VERIFIED`: every required field passes the configured checks, with no unresolved contradictions.
- `NEEDS_MANUAL_REVIEW`: one or more fields are ambiguous or contradictory.
- `NOT_VERIFIED`: at least one required field has a clear mismatch under the configured rules.
- `INCOMPLETE`: the session was cancelled or required answers are missing.

Store every answer attempt rather than overwriting prior transcripts.

Create a clean interface for a future optional Jev classification adapter, but do not call external AI APIs in this prototype.

An AI decision or confidence score must never independently establish a person's identity.

## 10. Prompt audio

Use prerecorded English audio prompts where available.

Create an asset directory under the backend for prompt files. Support static audio prompts, dynamic customer values, and a text fallback if an audio asset is missing.

Do not require an external text-to-speech API. Document how to replace the prompt audio with recorded files.

## 11. FastAPI endpoints

Implement versioned API routes such as:

- `GET /api/v1/health`
- `GET /api/v1/customers`
- `GET /api/v1/customers/{customer_id}`
- `POST /api/v1/sessions`
- `GET /api/v1/sessions`
- `GET /api/v1/sessions/{session_id}`
- `POST /api/v1/sessions/{session_id}/answers`
- `POST /api/v1/sessions/{session_id}/answers/{answer_id}/transcribe`
- `POST /api/v1/sessions/{session_id}/complete`
- `GET /api/v1/sessions/{session_id}/results`
- `POST /api/v1/demo/reset`

Keep route handlers thin. Put business logic into service modules and validate all inputs with Pydantic schemas.

Configure CORS for the local Next.js development origin only. Do not use unrestricted CORS.

Document request and response schemas and expected error responses.

## 12. Database and privacy

Use SQLite and SQLAlchemy 2.x.

Persist customers, sessions, questions, answer attempts, transcripts, verification results, timestamps, processing durations, and final outcomes.

Audio handling must:
- Keep recordings outside publicly served directories.
- Use generated filenames.
- Avoid path traversal vulnerabilities.
- Provide configurable recording retention.
- Delete temporary audio after processing when retention is disabled.
- Exclude audio from JSON export by default.

Bind services to localhost for development. Do not expose the application publicly or include production credentials.

Display a notice that recordings can contain personal information and that the prototype should only use authorised synthetic test data.

## 13. Next.js frontend requirements

Use the App Router and TypeScript throughout.

Build reusable components and keep API calls inside a central API client module.

Use React Server Components for static/server-rendered interface sections where appropriate, and Client Components for microphone recording, audio playback, session interaction, and live progress.

Do not place microphone access or browser-only APIs inside Server Components.

Validate user inputs and API response data appropriately. Use clear loading, success, empty, and error states.

Create a polished but restrained dashboard rather than a generic unstyled form. Ensure accessibility, keyboard usability, and responsive layouts.

Configure the backend URL through an environment variable such as:

`NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1`

Keep secrets out of `NEXT_PUBLIC_` variables. No external AI credentials should be required.

## 14. Testing

Create automated tests for:
- Field normalisation.
- Date parsing.
- Postal-code comparison.
- Email ambiguity.
- Account-reference matching.
- Yes/no recognition.
- Missing and contradictory answers.
- Retry handling.
- Final outcome calculation.
- Database persistence.
- Invalid audio uploads.
- Speech-service error handling.

Mock transcription in unit tests. Provide a separate smoke test using a real local audio sample and the actual speech model.

Run backend tests and frontend lint/build checks. Fix errors rather than merely reporting them.

## 15. Performance benchmarking

Record:
- Audio duration.
- Speech-to-text processing duration.
- Real-time factor: processing duration divided by audio duration.
- Verification processing duration.
- Total answer-processing duration.
- Total session duration.

Use monotonic timing for elapsed measurements.

Do not invent benchmark values. Clearly label unmeasured metrics.

Provide a manual test procedure using approximately 20–30 short English recordings, including correct answers, incorrect answers, Indian English accents, and spoken numbers.

## 16. Production integration boundaries

Keep the prototype ready for later integration with Astra CRM.

The eventual production flow should be:

Astra CRM → call scheduler → telephony adapter → call orchestration → speech recognition → deterministic verification → optional Jev classification → database → manual-review workflow.

Keep telephony-specific logic out of the verification service.

Do not implement real outbound calls, SIP, Asterisk, FreeSWITCH, telecom APIs, Redis, distributed workers, or production PostgreSQL in this initial phase.

The future telephony adapter must be able to feed the same audio/transcript events into the verification engine without requiring the browser UI.

## 17. Documentation and startup

Provide a complete README with:
- Prerequisites.
- Python environment setup.
- Backend installation.
- Frontend installation.
- Environment variables.
- FFmpeg installation instructions for Windows and Linux.
- Model download behaviour.
- Database initialisation.
- Startup commands.
- Local URLs.
- Test commands.
- Sample data reset instructions.
- Troubleshooting.
- Performance benchmarking.
- Production integration boundaries.

Since the expected development environment may be Windows, provide PowerShell commands and a `start-dev.ps1` script if useful.

Keep backend and frontend startup independently possible.

## 18. Definition of done

The project is complete only when:

1. The FastAPI backend starts locally.
2. The Next.js frontend starts locally.
3. Synthetic customer records are available.
4. A simulated English verification session can be started.
5. The browser can record an answer.
6. FastAPI transcribes the actual recording using the local speech model.
7. The transcript is displayed.
8. Python compares the answer against the expected value.
9. Retry attempts and outcomes are persisted.
10. Session results can be reopened after restarting the application.
11. Automated tests run successfully.
12. The README contains working startup and test commands.
13. The existing Astra CRM code remains unchanged.

After implementation, provide a concise report containing the files created, exact startup commands, local URLs, test results, known limitations, and the recommended next benchmark.

Never claim that an operation, test, or integration succeeded unless it was actually executed and verified.