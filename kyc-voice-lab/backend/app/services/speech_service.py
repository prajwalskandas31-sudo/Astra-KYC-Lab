"""Local speech-to-text service using faster-whisper.

Loads the model once and reuses it. Runs on CPU by default.
"""

import logging
import os
import subprocess
import tempfile
import time
from pathlib import Path
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)

# Singleton model reference
_model = None
_model_load_error: Optional[str] = None

SUPPORTED_AUDIO_EXTENSIONS = {".wav", ".mp3", ".ogg", ".webm", ".m4a", ".flac", ".opus"}
MAX_UPLOAD_BYTES = settings.max_audio_size_mb * 1024 * 1024


def _check_ffmpeg() -> bool:
    """Return True if ffmpeg is available on PATH."""
    try:
        subprocess.run(
            ["ffmpeg", "-version"],
            capture_output=True,
            timeout=5,
        )
        return True
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


def load_model():
    """Load the faster-whisper model once."""
    global _model, _model_load_error
    if _model is not None:
        return _model
    try:
        from faster_whisper import WhisperModel

        logger.info(
            "Loading Whisper model '%s' on %s (%s)…",
            settings.whisper_model_size,
            settings.whisper_device,
            settings.whisper_compute_type,
        )
        _model = WhisperModel(
            settings.whisper_model_size,
            device=settings.whisper_device,
            compute_type=settings.whisper_compute_type,
        )
        logger.info("Whisper model loaded successfully.")
        return _model
    except Exception as exc:
        _model_load_error = str(exc)
        logger.error("Failed to load Whisper model: %s", exc)
        return None


def is_model_loaded() -> bool:
    return _model is not None


def get_model_error() -> Optional[str]:
    return _model_load_error


def is_ffmpeg_available() -> bool:
    return _check_ffmpeg()


def _convert_to_wav(input_path: Path) -> Path:
    """Convert an audio file to 16kHz mono WAV using ffmpeg."""
    output_path = input_path.with_suffix(".converted.wav")
    try:
        result = subprocess.run(
            [
                "ffmpeg", "-y", "-i", str(input_path),
                "-ar", "16000", "-ac", "1", "-f", "wav",
                str(output_path),
            ],
            capture_output=True,
            timeout=30,
        )
        if result.returncode != 0:
            raise RuntimeError(f"ffmpeg conversion failed: {result.stderr.decode(errors='replace')}")
        return output_path
    except FileNotFoundError:
        raise RuntimeError(
            "FFmpeg is not installed or not on PATH. "
            "Install it: https://ffmpeg.org/download.html"
        )


def transcribe_audio(audio_path: Path) -> dict:
    """Transcribe an audio file and return result dict.

    Returns:
        dict with keys: transcript, audio_duration_seconds,
        processing_duration_seconds, real_time_factor
    """
    # Validate file exists and is not empty before loading model
    if not audio_path.exists():
        raise FileNotFoundError(f"Audio file not found: {audio_path}")
    if audio_path.stat().st_size == 0:
        raise ValueError("Audio file is empty.")
    if audio_path.stat().st_size > MAX_UPLOAD_BYTES:
        raise ValueError(f"Audio file exceeds {settings.max_audio_size_mb}MB limit.")

    model = load_model()
    if model is None:
        raise RuntimeError(
            f"Speech model is not available. {_model_load_error or 'Check faster-whisper installation.'}"
        )

    # Convert to WAV if needed
    converted_path = None
    process_path = audio_path
    if audio_path.suffix.lower() not in {".wav"}:
        converted_path = _convert_to_wav(audio_path)
        process_path = converted_path

    try:
        start = time.monotonic()
        segments, info = model.transcribe(
            str(process_path),
            beam_size=5,
            language="en",
            vad_filter=True,
        )
        transcript_parts = []
        for segment in segments:
            transcript_parts.append(segment.text.strip())

        elapsed = time.monotonic() - start
        transcript = " ".join(transcript_parts).strip()

        audio_duration = info.duration if info.duration else 0.0
        rtf = elapsed / audio_duration if audio_duration > 0 else 0.0

        return {
            "transcript": transcript,
            "audio_duration_seconds": round(audio_duration, 3),
            "processing_duration_seconds": round(elapsed, 3),
            "real_time_factor": round(rtf, 3),
        }
    finally:
        # Clean up converted file
        if converted_path and converted_path.exists():
            try:
                converted_path.unlink()
            except OSError:
                pass
