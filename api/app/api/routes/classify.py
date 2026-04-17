"""POST /classify — VLM pest classification endpoint."""

from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile
from fastapi.responses import JSONResponse

from app.config import Settings, get_settings
from app.models.classification import ClassifyResponse
from app.models.responses import make_error_response
from app.services.classification import classify_image
from app.services.validation import ValidationError, validate_upload

logger = logging.getLogger("agrosmart")

router = APIRouter()


@router.post("/classify", response_model=ClassifyResponse)
async def classify(
    request: Request,
    image: UploadFile = File(...),
    sha256: str = Form(None),
    settings: Settings = Depends(get_settings),
) -> JSONResponse:
    # Validate multipart
    content_type = request.headers.get("content-type", "")
    if "multipart/form-data" not in content_type:
        return make_error_response(
            request_id=sha256 or str(uuid.uuid4()),
            code="INVALID_MIME",
            msg_en="Content-Type must be multipart/form-data.",
            msg_pt="Content-Type deve ser multipart/form-data.",
            status=415,
        )

    # Read and validate image
    file_bytes = await image.read()

    try:
        _, _ = validate_upload(file_bytes, image.filename or "upload.jpg")
    except ValidationError as exc:
        return make_error_response(
            request_id=sha256 or str(uuid.uuid4()),
            code=exc.code,
            msg_en=exc.message_en,
            msg_pt=exc.message_pt,
            status=exc.status,
        )

    # Classify via VLM
    result = await classify_image(
        image_bytes=file_bytes,
        sha256=sha256,
        settings=settings,
    )

    response = ClassifyResponse(
        pest_type=result.pest_type,
        confidence=result.confidence,
        reasoning=result.reasoning,
        alternatives=result.alternatives,
        model=result.model,
    )

    return JSONResponse(status_code=200, content=response.model_dump())
