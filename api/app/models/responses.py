"""Pydantic response models and error helpers."""

from __future__ import annotations

from typing import Literal

from fastapi.responses import JSONResponse
from pydantic import BaseModel


# ---------------------------------------------------------------------------
# Success response
# ---------------------------------------------------------------------------


class BoundingBox(BaseModel):
    x: int
    y: int
    w: int
    h: int
    area_px: int


class AnalysisResponse(BaseModel):
    request_id: str
    severity: Literal["healthy", "beginning", "diseased"]
    severity_label_pt: str
    affected_pct: float
    leaf_pixels: int
    diseased_pixels: int
    bounding_boxes: list[BoundingBox]
    processing_ms: float
    api_version: str
    warnings: list[str] = []


# ---------------------------------------------------------------------------
# Error response
# ---------------------------------------------------------------------------


class ErrorDetail(BaseModel):
    code: str
    message: str
    message_pt: str


class ErrorResponse(BaseModel):
    request_id: str
    error: ErrorDetail


def make_error_response(
    request_id: str,
    code: str,
    msg_en: str,
    msg_pt: str,
    status: int,
) -> JSONResponse:
    """Return a uniform JSON error envelope."""
    return JSONResponse(
        status_code=status,
        content=ErrorResponse(
            request_id=request_id,
            error=ErrorDetail(code=code, message=msg_en, message_pt=msg_pt),
        ).model_dump(),
    )
