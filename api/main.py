"""AgroSmart Phase 3 — FastAPI analysis service."""

import logging
import logging.config
import sys
import uuid

from fastapi import FastAPI, File, Form, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pythonjsonlogger import jsonlogger

from validation import ValidationError, error_response, validate_upload

API_VERSION = "1.0.0"

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

    # Reject non-multipart (FastAPI handles content-type at framework level,
    # but we guard against application/json explicitly)
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

    # Validate the upload
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

    # Placeholder response — real analysis logic comes in Task 11
    return JSONResponse(
        status_code=200,
        content={
            "request_id": rid,
            "severity": "healthy",
            "severity_label_pt": "Planta saudavel",
            "affected_pct": 0.0,
            "leaf_pixels": 0,
            "diseased_pixels": 0,
            "bounding_boxes": [],
            "processing_ms": 0.0,
            "api_version": API_VERSION,
        },
    )
