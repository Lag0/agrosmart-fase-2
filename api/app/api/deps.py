"""FastAPI dependency factories."""

from __future__ import annotations

from functools import lru_cache

from app.config import Settings, get_settings
from app.services import analysis as _analysis_module
from app.services import validation as _validation_module


def get_analysis_service():  # noqa: ANN201
    """Return the analysis service module (singleton-safe for stateless module)."""
    return _analysis_module


def get_validation_service():  # noqa: ANN201
    """Return the validation service module (singleton-safe for stateless module)."""
    return _validation_module
