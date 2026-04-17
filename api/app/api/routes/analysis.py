"""POST /analyze — image analysis endpoint."""

from __future__ import annotations

import asyncio
import logging
import shutil
import tempfile
import uuid
from pathlib import Path
from types import ModuleType

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile
from fastapi.responses import JSONResponse

from app.api.deps import get_analysis_service, get_validation_service
from app.config import Settings, get_settings
from app.models.responses import AnalysisResponse, make_error_response
from app.services.validation import ValidationError

logger = logging.getLogger("agrosmart")

router = APIRouter()

_EXT_MAP: dict[str, str] = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/bmp": ".bmp",
}


def _get_request_id(request: Request) -> str:
    """Extract X-Request-Id from headers or generate a fresh UUIDv4."""
    rid = request.headers.get("X-Request-Id")
    if rid:
        try:
            uuid.UUID(rid, version=4)
            return rid
        except ValueError:
            pass
    return str(uuid.uuid4())


def _ensure_dirs(uploads_dir: str) -> tuple[Path, Path]:
    """Ensure original/ and annotated/ subdirs exist, return their paths."""
    original_dir = Path(uploads_dir) / "original"
    annotated_dir = Path(uploads_dir) / "annotated"
    original_dir.mkdir(parents=True, exist_ok=True)
    annotated_dir.mkdir(parents=True, exist_ok=True)
    return original_dir, annotated_dir


@router.post("/analyze")
async def analyze(
    request: Request,
    image: UploadFile = File(...),
    request_id: str = Form(...),
    settings: Settings = Depends(get_settings),
    analysis_svc: ModuleType = Depends(get_analysis_service),
    validation_svc: ModuleType = Depends(get_validation_service),
) -> JSONResponse:
    rid = _get_request_id(request)

    # Validate request_id is UUIDv4
    try:
        uuid.UUID(request_id, version=4)
    except (ValueError, AttributeError):
        return make_error_response(
            request_id=rid,
            code="MISSING_FIELD",
            msg_en="request_id must be a valid UUIDv4.",
            msg_pt="request_id deve ser um UUIDv4 valido.",
            status=400,
        )

    # Reject non-multipart
    content_type = request.headers.get("content-type", "")
    if "multipart/form-data" not in content_type:
        return make_error_response(
            request_id=rid,
            code="INVALID_MIME",
            msg_en="Content-Type must be multipart/form-data.",
            msg_pt="Content-Type deve ser multipart/form-data.",
            status=415,
        )

    # Read image bytes
    file_bytes = await image.read()

    # Validate the upload (MIME, size, decode, dimensions)
    try:
        pil_image, sniffed_mime = validation_svc.validate_upload(
            file_bytes, image.filename or "upload.jpg"
        )
    except ValidationError as exc:
        return make_error_response(
            request_id=rid,
            code=exc.code,
            msg_en=exc.message_en,
            msg_pt=exc.message_pt,
            status=exc.status,
        )

    logger.info(
        "image validated",
        extra={
            "request_id": rid,
            "mime": sniffed_mime,
            "width": pil_image.width,
            "height": pil_image.height,
            "size_bytes": len(file_bytes),
        },
    )

    ext = _EXT_MAP.get(sniffed_mime, ".jpg")
    original_dir, annotated_dir = _ensure_dirs(settings.uploads_dir)
    original_path = original_dir / f"{request_id}{ext}"
    annotated_path = annotated_dir / f"{request_id}{ext}"

    # Write to disk safely, then run analysis
    tmp_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(mode="wb", suffix=ext, delete=False) as tmp:
            tmp_path = Path(tmp.name)
            tmp.write(file_bytes)
        shutil.move(str(tmp_path), str(original_path))
        tmp_path = None  # move succeeded — no cleanup needed in finally

        result = await asyncio.wait_for(
            asyncio.to_thread(analysis_svc.analyze, str(original_path), str(annotated_path)),
            timeout=settings.analysis_timeout_s,
        )

    except asyncio.TimeoutError:
        logger.error("analysis timed out", extra={"request_id": rid})
        for p in [original_path, annotated_path]:
            p.unlink(missing_ok=True)
        return make_error_response(
            request_id=rid,
            code="TIMEOUT",
            msg_en="Analysis timed out.",
            msg_pt="A análise demorou demais.",
            status=500,
        )
    except Exception:
        logger.exception("analysis failed", extra={"request_id": rid})
        for p in [original_path, annotated_path]:
            p.unlink(missing_ok=True)
        return make_error_response(
            request_id=rid,
            code="INTERNAL",
            msg_en="Internal server error during analysis.",
            msg_pt="Erro interno do servidor durante a análise.",
            status=500,
        )
    finally:
        if tmp_path is not None:
            tmp_path.unlink(missing_ok=True)

    # Build response
    warnings: list[str] = []
    if result["leaf_pixels"] == 0:
        warnings.append("NO_LEAF_DETECTED")

    response = AnalysisResponse(
        request_id=request_id,
        severity=result["severity"],
        severity_label_pt=result["severity_label_pt"],
        affected_pct=result["affected_pct"],
        leaf_pixels=result["leaf_pixels"],
        diseased_pixels=result["diseased_pixels"],
        bounding_boxes=result["bounding_boxes"],
        processing_ms=result["processing_ms"],
        api_version=settings.api_version,
        warnings=warnings,
    )

    # TODO(decouple): Currently writes annotated image to shared volume.
    # Future migration to base64 return is a ~30-line change on both sides.
    return JSONResponse(status_code=200, content=response.model_dump())
