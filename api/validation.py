"""Image validation: MIME sniffing, size limits, dimension guard, decode check."""

import tempfile
from pathlib import Path

import magic
from fastapi.responses import JSONResponse
from PIL import Image

ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp", "image/bmp"}
MAX_BYTES = 8 * 1024 * 1024  # 8 MiB
MAX_DIMENSION = 6000


class ValidationError(Exception):
    """Raised when image validation fails."""

    def __init__(self, status: int, code: str, message_en: str, message_pt: str):
        self.status = status
        self.code = code
        self.message_en = message_en
        self.message_pt = message_pt


def error_response(
    request_id: str,
    code: str,
    message_en: str,
    message_pt: str,
    status: int,
) -> JSONResponse:
    """Return a uniform error envelope."""
    return JSONResponse(
        status_code=status,
        content={
            "request_id": request_id,
            "error": {
                "code": code,
                "message": message_en,
                "message_pt": message_pt,
            },
        },
    )


def validate_upload(file_bytes: bytes, filename: str) -> tuple:
    """
    Validate uploaded image bytes.

    Returns:
        Tuple of (PIL.Image.Image, sniffed_mime_type)

    Raises:
        ValidationError: on any validation failure.
    """
    # 1. Size check
    if len(file_bytes) > MAX_BYTES:
        raise ValidationError(
            status=413,
            code="IMAGE_TOO_LARGE",
            message_en="Image exceeds the 8 MiB size limit.",
            message_pt="A imagem excede o limite de 8 MB.",
        )

    # 2. MIME sniff via python-magic
    sniffed_mime = magic.from_buffer(file_bytes, mime=True)
    if sniffed_mime not in ALLOWED_MIME:
        raise ValidationError(
            status=415,
            code="INVALID_MIME",
            message_en=f"Unsupported MIME type: {sniffed_mime}. Accepted: JPEG, PNG, WebP, BMP.",
            message_pt=f"Tipo MIME nao suportado: {sniffed_mime}. Aceitos: JPEG, PNG, WebP, BMP.",
        )

    # 3. Decode validation — write to temp, verify, then load
    with tempfile.NamedTemporaryFile(
        suffix=Path(filename).suffix or ".jpg", delete=False
    ) as tmp:
        tmp_path = tmp.name
        tmp.write(file_bytes)

    try:
        # Image.verify() catches truncated files and decompression bombs
        with Image.open(tmp_path) as img_verify:
            img_verify.verify()

        # Image.load() actually loads pixel data (verify doesn't)
        with Image.open(tmp_path) as img:
            img.load()

        # 4. Dimension check
        if img.width > MAX_DIMENSION or img.height > MAX_DIMENSION:
            raise ValidationError(
                status=413,
                code="IMAGE_TOO_LARGE",
                message_en=f"Image dimensions ({img.width}x{img.height}) exceed the {MAX_DIMENSION}x{MAX_DIMENSION} limit.",
                message_pt=f"Dimensoes da imagem ({img.width}x{img.height}) excedem o limite de {MAX_DIMENSION}x{MAX_DIMENSION}.",
            )

        return (img, sniffed_mime)

    except ValidationError:
        raise
    except Exception as exc:
        raise ValidationError(
            status=422,
            code="DECODE_FAILED",
            message_en="Could not decode the image file.",
            message_pt="Nao foi possivel decodificar o arquivo de imagem.",
        ) from exc
    finally:
        # Clean up temp file
        try:
            Path(tmp_path).unlink(missing_ok=True)
        except OSError:
            pass
