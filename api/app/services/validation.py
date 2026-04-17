"""Image validation: MIME sniffing, size limits, dimension guard, decode check."""

from __future__ import annotations

from io import BytesIO

import magic
from PIL import Image

ALLOWED_MIME: frozenset[str] = frozenset(
    {"image/jpeg", "image/png", "image/webp", "image/bmp"}
)
MAX_BYTES: int = 8 * 1024 * 1024  # 8 MiB
MAX_DIMENSION: int = 6000


class ValidationError(Exception):
    """Raised when image validation fails."""

    def __init__(
        self,
        status: int,
        code: str,
        message_en: str,
        message_pt: str,
    ) -> None:
        self.status = status
        self.code = code
        self.message_en = message_en
        self.message_pt = message_pt


def validate_upload(file_bytes: bytes, filename: str) -> tuple[Image.Image, str]:
    """Validate uploaded image bytes entirely from memory.

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

    # 2. MIME sniff via python-magic (reads from buffer — no disk I/O)
    sniffed_mime = magic.from_buffer(file_bytes, mime=True)
    if sniffed_mime not in ALLOWED_MIME:
        sniffed_mime = _sniff_mime_from_header(file_bytes)
    if sniffed_mime not in ALLOWED_MIME:
        raise ValidationError(
            status=415,
            code="INVALID_MIME",
            message_en=(
                f"Unsupported MIME type: {sniffed_mime}. Accepted: JPEG, PNG, WebP, BMP."
            ),
            message_pt=(
                f"Tipo MIME nao suportado: {sniffed_mime}. Aceitos: JPEG, PNG, WebP, BMP."
            ),
        )

    # 3. Decode validation — entirely in memory, no temp file
    img = _check_decode(file_bytes)

    # 4. Dimension check (img is already loaded from _check_decode)
    if img.width > MAX_DIMENSION or img.height > MAX_DIMENSION:
        raise ValidationError(
            status=413,
            code="IMAGE_TOO_LARGE",
            message_en=(
                f"Image dimensions ({img.width}x{img.height}) exceed the "
                f"{MAX_DIMENSION}x{MAX_DIMENSION} limit."
            ),
            message_pt=(
                f"Dimensoes da imagem ({img.width}x{img.height}) excedem o "
                f"limite de {MAX_DIMENSION}x{MAX_DIMENSION}."
            ),
        )

    return img, sniffed_mime


def _check_decode(file_bytes: bytes) -> Image.Image:
    """Verify and fully load image from memory.

    Uses verify() for header/structure check, then load() for pixel data.

    Raises:
        ValidationError: if the image cannot be decoded.
    """
    try:
        buf = BytesIO(file_bytes)
        img = Image.open(buf)
        img.verify()  # header-only structural check (resets file pointer state)

        # verify() closes the internal state — must re-open for pixel load
        buf.seek(0)
        img = Image.open(buf)
        img.load()  # full pixel decode
        return img
    except ValidationError:
        raise
    except Exception as exc:
        raise ValidationError(
            status=422,
            code="DECODE_FAILED",
            message_en="Could not decode the image.",
            message_pt="Não foi possível decodificar a imagem.",
        ) from exc


def _sniff_mime_from_header(data: bytes) -> str:
    """Fallback MIME detection from file header bytes.

    Used when python-magic returns a generic type (e.g. "application/octet-stream"
    on macOS for WebP) because the system libmagic database is incomplete.
    """
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if data[:2] in (b"\xff\xd8", b"\xff\xe0", b"\xff\xe1"):
        return "image/jpeg"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    if data[:2] == b"BM":
        return "image/bmp"
    return ""
