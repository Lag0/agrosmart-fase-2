"""Application settings — driven by environment variables."""

from __future__ import annotations

from functools import lru_cache

from pydantic import ConfigDict
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # CORS
    cors_origins: list[str] = ["http://localhost:3000"]
    public_origin: str = "http://localhost:3000"

    # Storage
    uploads_dir: str = "/data/uploads"

    # Analysis
    analysis_timeout_s: float = 10.0

    # VLM Classification (OpenRouter)
    openrouter_api_key: str = ""
    openrouter_model: str = "google/gemini-3.1-flash-lite-preview"
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    classify_timeout_s: float = 10.0
    classify_max_tokens: int = 300
    cache_ttl_s: int = 3600

    # API metadata
    api_version: str = "1.0.0"

    model_config = ConfigDict(
        env_prefix="AGROSMART_",
        env_file=".env",
        env_file_encoding="utf-8",
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
