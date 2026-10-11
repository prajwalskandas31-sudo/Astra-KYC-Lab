"""Application configuration loaded from environment variables."""

from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    database_url: str = "sqlite:///./kyc_voice_lab.db"

    # Speech model
    whisper_model_size: str = "base.en"
    whisper_device: str = "cpu"
    whisper_compute_type: str = "int8"

    # Audio uploads
    audio_upload_dir: str = "./audio_uploads"
    max_audio_size_mb: int = 25
    retain_audio: bool = False

    # Server
    host: str = "127.0.0.1"
    port: int = 8000

    # CORS
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    # Verification
    max_retries_per_question: int = 3

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    @property
    def upload_path(self) -> Path:
        p = Path(self.audio_upload_dir)
        p.mkdir(parents=True, exist_ok=True)
        return p

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
