"""AgroSmart Phase 3 — FastAPI analysis service."""

import asyncio
import logging
import logging.config
import os
import shutil
import sys
import tempfile
import uuid
from pathlib import Path

from fastapi import FastAPI, File, Form, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pythonjsonlogger import jsonlogger

from analysis import analyze_image
from validation import ValidationError, error_response, validate_upload

API_VERSION = "1.0.0"
UPLOADS_DIR = os.environ.get("UPLOADS_DIR", "/data/uploads")
ANALYSIS_TIMEOUT_S = 10

# ---------------------------------------------------------------------------
# Structured JSON logging
# ---------------------------------------------------------------------------
logging.config.dictConfig(
    {
        "version": 1,
        "disable_existing_loggers": False,
        "handlers": {"console": {"class": "logging.StreamHandler", "formatter": "json", "stream": "ext://sys.stdout"}},
        "formatters": {"json": {"class": "pythonjsonlogger.json.JsonFormatter", "format": "%(asctime)s %(levelname)s %(name)s %(message)s"}},
        "loggers": {
            "uvicorn.access": {"level": "INFO", "handlers": ["console"], "propagate": False},
            "uvicorn.error": {"level": "INFO", "handlers": ["console"], "propagate": False},
            "agrosmart": {"level": "INFO", "handlers": ["console"], "propagate": False},
        },
        "root": {"level": "WARNING", "handlers": ["console"]},
    }
)

logger = logging.getLogger("agrosmart")

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(
    title="AgroSmart Analysis API",
    version=API_VERSION,
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _get_request_id(request: Request) -> str:
    """Extract X-Request-Id from request or generate a new one."""
    rid = request.headers.get("X-Request-Id")
    if rid:
        try:
            uuid.UUID(rid, version=4)
            return rid
        except ValueError:
            pass
    return str(uuid.uuid4())


def _ensure_dirs(request_id: str):
    """Ensure upload directories exist."""
    original_dir = Path(UPLOADS_DIR) / "original"
    annotated_dir = Path(UPLOADS_DIR) / "annotated"
    original_dir.mkdir(parents=True, exist_ok=True)
    annotated_dir.mkdir(parents=True, exist_ok=True)
    return original_dir, annotated_dir


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@app.get("/health")
async def health():
    return {"ok": True, "version": API_VERSION}


@app.post("/analyze")
async def analyze(
    request: Request,
    image: UploadFile = File(...),
    request_id: str = Form(...),
):
    rid = _get_request_id(request)

    # Validate request_id is UUIDv4
    try:
        uuid.UUID(request_id, version=4)
    except (ValueError, AttributeError):
        return error_response(
            request_id=rid,
            code="MISSING_FIELD",
            message_en="request_id must be a valid UUIDv4.",
            message_pt="request_id deve ser um UUIDv4 valido.",
            status=400,
        )

    # Reject non-multipart
    content_type = request.headers.get("content-type", "")
    if "multipart/form-data" not in content_type:
        return error_response(
            request_id=rid,
            code="INVALID_MIME",
            message_en="Content-Type must be multipart/form-data.",
            message_pt="Content-Type deve ser multipart/form-data.",
            status=415,
        )

    # Read image bytes
    file_bytes = await image.read()

    # Validate the upload (MIME, size, decode, dimensions)
    try:
        pil_image, sniffed_mime = validate_upload(file_bytes, image.filename or "upload.jpg")
    except ValidationError as exc:
        return error_response(
            request_id=rid,
            code=exc.code,
            message_en=exc.message_en,
            message_pt=exc.message_pt,
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

    # Determine file extension from sniffed MIME
    ext_map = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "image/bmp": ".bmp",
    }
    ext = ext_map.get(sniffed_mime, ".jpg")

    # Ensure directories exist
    original_dir, annotated_dir = _ensure_dirs(request_id)

    original_path = original_dir / f"{request_id}{ext}"
    annotated_path = annotated_dir / f"{request_id}{ext}"

    # Write original image to shared volume
    tmp_fd = None
    tmp_path = None
    try:
        # Write to temp file first (atomic-ish), then the volume path
        tmp_fd, tmp_path = tempfile.mkstemp(suffix=ext)
        with os.fdopen(tmp_fd, "wb") as f:
            f.write(file_bytes)
        tmp_fd = None  # os.fdopen took ownership

        shutil.move(tmp_path, str(original_path))
        tmp_path = None

        # Run OpenCV analysis in a thread with timeout
        def _run_analysis():
            return analyze_image(str(original_path), str(annotated_path))

        result = await asyncio.wait_for(
            asyncio.to_thread(_run_analysis),
            timeout=ANALYSIS_TIMEOUT_S,
        )

    except asyncio.TimeoutError:
        logger.error(
            "analysis timed out",
            extra={"request_id": rid},
        )
        return error_response(
            request_id=rid,
            code="TIMEOUT",
            message_en="Analysis timed out.",
            message_pt="A analise demorou demais.",
            status=500,
        )
    except Exception as exc:
        logger.error(
            "analysis failed",
            extra={"request_id": rid, "err": str(exc)},
        )
        return error_response(
            request_id=rid,
            code="INTERNAL",
            message_en="Internal server error during analysis.",
            message_pt="Erro interno do servidor durante a analise.",
            status=500,
        )
    finally:
        # Clean up any temp file
        if tmp_path:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass

    # Build response
    response: dict = {
        "request_id": request_id,
        "severity": result["severity"],
        "severity_label_pt": result["severity_label_pt"],
        "affected_pct": result["affected_pct"],
        "leaf_pixels": result["leaf_pixels"],
        "diseased_pixels": result["diseased_pixels"],
        "bounding_boxes": result["bounding_boxes"],
        "processing_ms": result["processing_ms"],
        "api_version": API_VERSION,
    }

    # Handle NO_LEAF_DETECTED warning
    if result["leaf_pixels"] == 0:
        response["warnings"] = ["NO_LEAF_DETECTED"]

    # TODO(decouple): Currently writes annotated image to shared volume.
    # Future migration to base64 return is a ~30-line change on both sides.

    return JSONResponse(status_code=200, content=response)
