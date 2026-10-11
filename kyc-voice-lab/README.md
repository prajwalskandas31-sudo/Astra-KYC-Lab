# KYC Voice Verification Lab

A local-first, privacy-conscious proof of concept (PoC) for automated KYC voice verification in English.

This laboratory tests whether spoken customer responses can be transcribed locally, compared deterministically against expected synthetic customer records, and classified reliably without requiring paid AI APIs, telephony subscriptions, or cloud GPU infrastructure.

---

## 1. Architecture Overview

The system consists of two independently runnable local services:

```
                  ┌──────────────────────────────────────────┐
                  │          Next.js App Router UI           │
                  │   - Browser MediaRecorder audio capture   │
                  │   - Verification session orchestrator    │
                  │   - Real-time audit & latency reporting  │
                  └────────────────────┬─────────────────────┘
                                       │ HTTP / Multipart
                                       ▼
                  ┌──────────────────────────────────────────┐
                  │             FastAPI Backend              │
                  │   - Local faster-whisper (base.en)       │
                  │   - FFmpeg 16kHz mono audio conversion   │
                  │   - Deterministic verification engine    │
                  │   - SQLite & SQLAlchemy 2.x persistence  │
                  └──────────────────────────────────────────┘
```

- **Audio Acquisition:** Browser MediaRecorder API captures microphone audio (`audio/webm` or `audio/ogg`).
- **Local Speech-to-Text:** `faster-whisper` (`base.en` model running on CPU via CTranslate2 with `int8` quantization). Zero external STT API calls.
- **Verification Engine:** Deterministic rule engine parsing dates, PIN codes, emails, names, and yes/no confirmations without fuzzy approvals.
- **Audit Persistence:** Full lifecycle timestamps, attempts, latencies, and outcomes stored in SQLite.

---

## 2. Prerequisites

1. **Python 3.12+**: [python.org](https://www.python.org/downloads/)
2. **Node.js v18+** (v20+ or v24+ recommended): [nodejs.org](https://nodejs.org/)
3. **FFmpeg**: Required for audio transcoding to 16kHz mono PCM.

### Installing FFmpeg

#### Windows
- **Via Scoop:**
  ```powershell
  scoop install ffmpeg
  ```
- **Via Winget:**
  ```powershell
  winget install Gyan.FFmpeg
  ```
- **Manual:** Download essentials build from [gyan.dev/ffmpeg/builds](https://www.gyan.dev/ffmpeg/builds/) and add the `bin` folder to your system `PATH`.
- **Verification:** Run `ffmpeg -version` in PowerShell.

#### Linux (Ubuntu/Debian)
```bash
sudo apt update && sudo apt install -y ffmpeg
```

---

## 3. Installation & Setup

### A. Backend Setup

```powershell
cd kyc-voice-lab/backend

# Create virtual environment
python -m venv .venv

# Activate virtual environment
# Windows PowerShell:
.\.venv\Scripts\Activate.ps1
# Linux/macOS:
# source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables (optional defaults are already set)
cp .env.example .env
```

### B. Frontend Setup

```powershell
cd ../frontend

# Install Node dependencies
npm install

# Configure environment variables
cp .env.local.example .env.local
```

---

## 4. Environment Variables

### Backend (`backend/.env`)

| Variable | Default | Description |
| :--- | :--- | :--- |
| `DATABASE_URL` | `sqlite:///./kyc_voice_lab.db` | SQLite database file location |
| `WHISPER_MODEL_SIZE` | `base.en` | Model size (`tiny.en`, `base.en`, `small.en`) |
| `WHISPER_DEVICE` | `cpu` | Device (`cpu` or `cuda`) |
| `WHISPER_COMPUTE_TYPE` | `int8` | Compute quantization (`int8`, `float32`, `float16`) |
| `AUDIO_UPLOAD_DIR` | `./audio_uploads` | Temporary upload directory |
| `MAX_AUDIO_SIZE_MB` | `25` | Maximum upload size guard |
| `RETAIN_AUDIO` | `false` | If false, removes audio file after transcription |
| `CORS_ORIGINS` | `http://localhost:3000` | Restricted Next.js frontend origin |
| `MAX_RETRIES_PER_QUESTION` | `3` | Maximum retry attempts per question |

### Frontend (`frontend/.env.local`)

| Variable | Default | Description |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:8000/api/v1` | FastAPI v1 backend URL |

---

## 5. Running the Application

### Option 1: One-Click Startup Script (Windows PowerShell)

From `kyc-voice-lab/`:
```powershell
.\start-dev.ps1
```

### Option 2: Running Services Manually

#### Backend (Terminal 1)
```powershell
cd kyc-voice-lab/backend
.\.venv\Scripts\uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

#### Frontend (Terminal 2)
```powershell
cd kyc-voice-lab/frontend
npm run dev
```

### Local URLs

- **Web Dashboard:** [http://localhost:3000](http://localhost:3000)
- **Call Simulator:** [http://localhost:3000/sessions/new](http://localhost:3000/sessions/new)
- **Customer Directory:** [http://localhost:3000/customers](http://localhost:3000/customers)
- **FastAPI Interactive Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)
- **API Health Check:** [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health)

---

## 6. Model Download Behaviour

On the first transcription call (or when running the speech smoke test), `faster-whisper` will automatically download the `base.en` model weights (~140 MB) from Hugging Face Hub to your local cache (`~/.cache/huggingface/hub`). Subsequent executions load the cached weights directly with zero network requests.

---

## 7. Running Automated Tests

Run the full backend test suite:

```powershell
cd kyc-voice-lab/backend

# Run all deterministic & API tests
.\.venv\Scripts\pytest -v

# Run speech smoke test with real audio synthesis and faster-whisper inference
.\.venv\Scripts\pytest -v tests/test_speech_smoke.py
```

### Test Coverage Highlights

- **`test_normalisation.py`**: Validates date parsing, postal codes, name titles, and spoken email expressions (`"at"`, `"dot"`).
- **`test_verification.py`**: Field matching against synthetic customer ground truth with strict conservative rules.
- **`test_decision.py`**: Contradiction handling, empty speech detection, and session-level status calculation.
- **`test_api.py`**: Complete FastAPI route lifecycle (customers, sessions, answers, complete, results, dashboard).
- **`test_speech_smoke.py`**: Validates FFmpeg integration, guardrails against empty audio, and end-to-end local inference.

---

## 8. Resetting Sample Data

To reset all sessions and restore initial synthetic customer records:
- Click the **"Reset Prototype Data"** button on the dashboard or customer directory page.
- Or send a `POST` request to:
  ```powershell
  curl -X POST http://localhost:8000/api/v1/demo/reset
  ```

---

## 9. Performance Benchmarking

The verification engine measures:
- **Audio Duration:** Length of captured speech recording.
- **STT Duration:** Time spent transcribing with `faster-whisper`.
- **Real-Time Factor (RTF):** STT processing time divided by audio duration. An RTF < 1.0 indicates faster-than-realtime transcription.
- **Total Processing Duration:** End-to-end duration including audio save, FFmpeg conversion, transcription, and deterministic matching.

Metrics are viewable in the audit trail of each session and exported in JSON format.

---

## 10. Production Integration Boundaries (Astra CRM)

This proof of concept is intentionally isolated to test speech feasibility:
- **Clean Adapter Boundary:** Telephony logic is decoupled from the verification service.
- **Future Telephony Ingestion:** A future telephony worker (SIP, Asterisk, or FreeSWITCH) can post audio streams directly to `POST /api/v1/sessions/{id}/answers` without touching frontend code.
- **Zero Real Credentials:** No customer PII, Aadhaar numbers, PAN cards, or telephony API keys are included or required.
