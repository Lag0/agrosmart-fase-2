"""Health check endpoint."""

from __future__ import annotations

import shutil

from fastapi import APIRouter

from app.config import get_settings

router = APIRouter()


@router.get("/health")
async def health() -> dict:
    """Return service liveness and disk availability."""
    settings = get_settings()
    disk = shutil.disk_usage(settings.uploads_dir)
    return {
        "ok": True,
        "version": settings.api_version,
        "disk_free_gb": round(disk.free / (1024**3), 2),
    }
