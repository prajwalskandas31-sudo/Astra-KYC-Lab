"""Smoke test for local speech service and audio processing."""

import math
import struct
import tempfile
import wave
from pathlib import Path
import pytest

from app.services import speech_service


def _create_sample_wav(duration_seconds: float = 1.0, sample_rate: int = 16000) -> Path:
    """Generate a valid 16kHz mono PCM WAV file for testing."""
    temp_file = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    wav_path = Path(temp_file.name)
    temp_file.close()

    total_samples = int(duration_seconds * sample_rate)
    frequency = 440.0  # 440 Hz tone

    with wave.open(str(wav_path), "wb") as wav_out:
        wav_out.setnchannels(1)  # Mono
        wav_out.setsampwidth(2)  # 16-bit
        wav_out.setframerate(sample_rate)

        for i in range(total_samples):
            # Generate sine wave with low volume
            value = int(32767.0 * 0.1 * math.sin(2.0 * math.pi * frequency * (i / sample_rate)))
            data = struct.pack("<h", value)
            wav_out.writeframes(data)

    return wav_path


def test_ffmpeg_available():
    """Verify FFmpeg binary is detected on PATH."""
    assert speech_service.is_ffmpeg_available() is True


def test_empty_audio_rejected():
    """Verify empty audio files raise an error."""
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        empty_path = Path(f.name)
    try:
        with pytest.raises(ValueError, match="Audio file is empty"):
            speech_service.transcribe_audio(empty_path)
    finally:
        empty_path.unlink(missing_ok=True)


def test_nonexistent_audio_rejected():
    """Verify nonexistent audio file path raises FileNotFoundError."""
    missing = Path("nonexistent_test_audio_xyz.wav")
    with pytest.raises(FileNotFoundError):
        speech_service.transcribe_audio(missing)


def test_transcribe_sample_wav():
    """Smoke test transcribing a generated 1-second WAV sample with faster-whisper."""
    wav_path = _create_sample_wav(duration_seconds=1.0)
    try:
        # Load model & transcribe tone (should yield empty transcript or noise, but succeed cleanly)
        result = speech_service.transcribe_audio(wav_path)
        assert isinstance(result, dict)
        assert "transcript" in result
        assert "audio_duration_seconds" in result
        assert "processing_duration_seconds" in result
        assert "real_time_factor" in result
        assert result["audio_duration_seconds"] >= 0.9
        assert result["processing_duration_seconds"] >= 0.0
    finally:
        wav_path.unlink(missing_ok=True)
