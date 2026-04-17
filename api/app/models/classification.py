"""Pydantic models for the VLM classification endpoint."""

from __future__ import annotations

from pydantic import BaseModel


class AlternativeInfo(BaseModel):
    type: str
    confidence: float


class ClassifyResponse(BaseModel):
    pest_type: str
    confidence: float
    reasoning: str
    alternatives: list[AlternativeInfo]
    model: str
