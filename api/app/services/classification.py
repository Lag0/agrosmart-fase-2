"""VLM-based pest classification via OpenRouter (OpenAI-compatible API)."""

from __future__ import annotations

import base64
import hashlib
import json
import logging
import re
import time
from dataclasses import dataclass

from openai import AsyncOpenAI

from ..config import Settings, get_settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Accepted pest types
# ---------------------------------------------------------------------------
VALID_PEST_TYPES: frozenset[str] = frozenset(
    {"nao_identificado", "ferrugem", "mancha_parda", "oidio", "lagarta"}
)

# ---------------------------------------------------------------------------
# System prompt (Portuguese — agronomist role)
# ---------------------------------------------------------------------------
SYSTEM_PROMPT = """\
Voce e um agronomo especialista em fitopatologia e entomologia. \
Analise a imagem da folha de soja e identifique a praga ou doenca mais provavel.

Responda EXCLUSIVAMENTE com um objeto JSON, sem texto adicional, sem markdown \
ao redor do JSON. O objeto deve conter exatamente estes campos:

{
  "pest_type": "<um de: nao_identificado | ferrugem | mancha_parda | oidio | lagarta>",
  "confidence": <float de 0.0 a 1.0>,
  "reasoning": "<explicacao curta em portugues>",
  "alternatives": [
    {"type": "<nome_da_alternativa>", "confidence": <float>}
  ]
}

Regras:
- Se nao for possivel identificar com seguranca, retorne "nao_identificado" \
com confidence proximo de 0.0.
- As alternativas devem listar outras possibilidades plausiveis, ordenadas por \
maior confianca.
- Preencha reasoning com a justificativa da escolha, mencionando caracteristicas \
visuais observadas.
"""

# ---------------------------------------------------------------------------
# Data model
# ---------------------------------------------------------------------------


@dataclass
class ClassificationResult:
    pest_type: str
    confidence: float
    reasoning: str
    alternatives: list[dict[str, str | float]]
    model: str


# ---------------------------------------------------------------------------
# In-memory cache
# ---------------------------------------------------------------------------


@dataclass
class _CacheEntry:
    result: ClassificationResult
    expires_at: float


_cache: dict[str, _CacheEntry] = {}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _compute_sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _extract_json(text: str) -> dict:
    """Extract JSON object from LLM response, tolerating markdown fences."""
    # Try direct parse first
    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    # Try to find JSON inside markdown code fences
    pattern = r"```(?:json)?\s*\n?(.*?)\n?\s*```"
    match = re.search(pattern, text, re.DOTALL)
    if match:
        try:
            parsed = json.loads(match.group(1).strip())
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            pass

    # Last resort: find first { ... } block
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            parsed = json.loads(text[start : end + 1])
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            pass

    return {}


def _sanitize_pest_type(raw: str) -> str:
    """Normalize pest_type to a known valid value."""
    normalized = raw.strip().lower()
    if normalized in VALID_PEST_TYPES:
        return normalized
    return "nao_identificado"


def _sanitize_alternatives(
    raw_list: list[dict] | None,
) -> list[dict[str, str | float]]:
    """Clean up alternatives list."""
    if not raw_list or not isinstance(raw_list, list):
        return []
    result: list[dict[str, str | float]] = []
    for item in raw_list[:5]:
        if not isinstance(item, dict):
            continue
        alt_type = _sanitize_pest_type(str(item.get("type", "")))
        alt_conf = float(item.get("confidence", 0.0))
        alt_conf = max(0.0, min(1.0, alt_conf))
        if alt_type != "nao_identificado" or alt_conf > 0.0:
            result.append({"type": alt_type, "confidence": alt_conf})
    return result


def _fallback(model: str) -> ClassificationResult:
    """Return a safe fallback when classification is unavailable."""
    return ClassificationResult(
        pest_type="nao_identificado",
        confidence=0.0,
        reasoning="Classificacao indisponivel no momento.",
        alternatives=[],
        model=model,
    )

# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


async def classify_image(
    image_bytes: bytes,
    sha256: str | None = None,
    settings: Settings | None = None,
) -> ClassificationResult:
    """Classify a plant leaf image using a VLM via OpenRouter.

    Args:
        image_bytes: Raw image bytes (JPEG, PNG, WebP, or BMP).
        sha256: Pre-computed SHA-256 hash of image_bytes. If None, computed
            internally and used for cache lookup.
        settings: Application settings. Loaded via get_settings() if None.

    Returns:
        A ClassificationResult. Never raises — on any failure, returns a
        fallback result with pest_type="nao_identificado" and confidence=0.0.
    """
    if settings is None:
        settings = get_settings()

    if sha256 is None:
        sha256 = _compute_sha256(image_bytes)

    model_name = settings.openrouter_model

    # --- Check cache ---
    now = time.monotonic()
    cached = _cache.get(sha256)
    if cached is not None:
        if cached.expires_at > now:
            logger.debug("Cache hit for %s", sha256[:12])
            return cached.result
        # Expired — evict
        del _cache[sha256]

    # --- Guard: API key required ---
    if not settings.openrouter_api_key:
        logger.warning("OpenRouter API key not configured — returning fallback")
        return _fallback(model_name)

    # --- Call OpenRouter ---
    try:
        client = AsyncOpenAI(
            api_key=settings.openrouter_api_key,
            base_url=settings.openrouter_base_url,
        )

        b64_image = base64.standard_b64encode(image_bytes).decode("ascii")

        # Determine MIME from magic bytes (basic sniff)
        mime = _sniff_mime(image_bytes)

        response = await client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{mime};base64,{b64_image}",
                            },
                        },
                        {
                            "type": "text",
                            "text": "Analise esta imagem de folha de soja e identifique a praga ou doenca.",
                        },
                    ],
                },
            ],
            max_tokens=settings.classify_max_tokens,
            timeout=settings.classify_timeout_s,
        )

        raw_content = response.choices[0].message.content or ""

        parsed = _extract_json(raw_content)

        pest_type = _sanitize_pest_type(parsed.get("pest_type", "nao_identificado"))

        confidence = float(parsed.get("confidence", 0.0))
        confidence = max(0.0, min(1.0, confidence))

        reasoning = str(parsed.get("reasoning", ""))
        if not reasoning:
            reasoning = "Sem justificativa fornecida pelo modelo."

        alternatives = _sanitize_alternatives(parsed.get("alternatives"))

        result = ClassificationResult(
            pest_type=pest_type,
            confidence=round(confidence, 4),
            reasoning=reasoning,
            alternatives=alternatives,
            model=model_name,
        )

    except Exception:
        logger.exception("VLM classification failed — returning fallback")
        result = _fallback(model_name)

    # --- Store in cache ---
    _cache[sha256] = _CacheEntry(
        result=result,
        expires_at=now + settings.cache_ttl_s,
    )

    return result


def _sniff_mime(data: bytes) -> str:
    """Basic MIME type detection from file header bytes."""
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if data[:2] in (b"\xff\xd8", b"\xff\xe0", b"\xff\xe1"):
        return "image/jpeg"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    if data[:2] == b"BM":
        return "image/bmp"
    return "image/jpeg"  # default assumption
