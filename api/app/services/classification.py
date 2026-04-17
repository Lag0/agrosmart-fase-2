"""VLM-based pest classification via OpenRouter (OpenAI-compatible API)."""

from __future__ import annotations

import base64
import json
import logging
import re
import time
from dataclasses import dataclass
from functools import lru_cache

from openai import AsyncOpenAI
from pydantic import BaseModel, Field, ValidationError, field_validator

from ..config import Settings, get_settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Accepted pest types — single source of truth
# ---------------------------------------------------------------------------
VALID_PEST_TYPES: frozenset[str] = frozenset(
    {"nao_identificado", "ferrugem", "mancha_parda", "oidio", "lagarta", "outro"}
)

# ---------------------------------------------------------------------------
# System prompt (Portuguese — agronomist role)
# ---------------------------------------------------------------------------
SYSTEM_PROMPT = """\
Você é um agrônomo especialista em fitopatologia, com experiência em diagnóstico de doenças e pragas em diversas culturas agrícolas.

DIAGNÓSTICO DIFERENCIAL — CRITÉRIOS-CHAVE

1. Ferrugem (Pucciniales: Phakopsora, Puccinia, Uromyces, Hemileia)
   - Pústulas ELEVADAS e pulverulentas na face INFERIOR da folha
   - Cor: alaranjada, amarela, parda ou enegrecida conforme estágio
   - Clorose amarelada na face superior (face同期 da pústula inferior)
   - Libera pó (urediósporos) ao toque

2. Mancha foliar / Mancha parda (Septoria, Cercospora, Alternaria, Phyllosticta)
   - Lesões PLANAS, sem relevo — necróticas e secas
   - Halo amarelado (clorose) ao redor da lesão
   - Anéis concêntricos ( targat-pattern, típico de Alternaria)
   - Pontuações escuras internas (picnídios visíveis com lupa)
   - Bordas bem definidas, forma arredondada ou irregular

3. Oídio (Erysiphales: Microsphaera, Erysiphe, Podosphaera)
   - Recobrimento branco-acinzentado, PULVERULENTO, na face SUPERIOR
   - Aparência de farinha ou talco, removível ao toque
   - Não forma lesão necrótica visível no estágio inicial

4. Lagarta / Mastigador (larvas de Lepidoptera, Coleoptera)
   - Larva visível na imagem OU sinais de mastigação
   - Bordas irregulares, buracos no limbo, esqueletização
   - Fezes escuras nos folíolos ou teias sedosas

5. Outro (qualquer condição que não se enquadre acima)
   - Deficiência nutricional, estresse hídrico, queimadura solar, vírus, bacteriose, míldio, ácaro, etc.

REGRA DE DECISÃO (siga esta ordem)

TEXTURA PRIMEIRO:
  → Elevada + pulverulenta = Ferrugem
  → Plana + necrótica = Mancha parda
  → Branco pulverulento removível = Oídio
  → Tecido removido fisicamente = Lagarta
  → Nenhuma das anteriores = Outro

DISTRIBUIÇÃO:
  → Pústulas dispersas = Ferrugem
  → Manchas coalescentes com halo = Mancha parda
  → Cobertura difusa = Oídio
  → Dano localizado em bordas = Lagarta

CUIDADO — ARMADILHAS COMUNS:
  - Ferrugem causa clorose na face superior que LEMBRA mancha parda; confirme pela presença de pústulas na face inferior.
  - Mancha parda com halo amarelado NÃO é ferrugem (são lesões planas).
  - Oídio em estágio avançado pode escurecer; confirme pelo recobrimento pulverulento característico.
  - Imagem com baixa resolução ou sem detalhe de textura deve retornar "nao_identificado".

RESPOSTA — JSON EXATO

Responda EXCLUSIVAMENTE com um objeto JSON, sem texto adicional ou markdown:

{
  "pest_type": "<nao_identificado | ferrugem | mancha_parda | oidio | lagarta | outro>",
  "confidence": <0.0–1.0>,
  "reasoning": "<explicação em português: textura, distribuição, cor, localização, hospedeiro>",
  "alternatives": [
    {"type": "<nome>", "confidence": <0.0–1.0>}
  ]
}

- Se não for possível identificar com segurança, retorne "nao_identificado" com confidence baixo.
- alternatives em ordem decrescente de confiança, máximo 5.
- reasoning deve citar explicitamente os sinais visuais observados e a regra de decisão aplicada.
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

_FENCED_JSON_RE = re.compile(r"```(?:json)?\s*\n?(.*?)\n?\s*```", re.DOTALL)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


@lru_cache(maxsize=4)
def _get_client(api_key: str, base_url: str) -> AsyncOpenAI:
    """Reuse a single AsyncOpenAI client per (api_key, base_url) pair."""
    return AsyncOpenAI(api_key=api_key, base_url=base_url)


def _extract_json(text: str) -> dict:
    """Extract JSON object from LLM response, tolerating markdown fences."""
    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    match = _FENCED_JSON_RE.search(text)
    if match:
        try:
            parsed = json.loads(match.group(1).strip())
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            pass

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


def _normalize_pest_type(raw: object) -> str:
    normalized = str(raw or "").strip().lower()
    return normalized if normalized in VALID_PEST_TYPES else "nao_identificado"


def _clamp01(raw: object) -> float:
    try:
        value = float(raw)
    except (TypeError, ValueError):
        return 0.0
    return max(0.0, min(1.0, value))


class _ValidatedAlternative(BaseModel):
    """Tolerant schema for an alternative diagnosis entry from the VLM."""

    type: str
    confidence: float

    @field_validator("type", mode="before")
    @classmethod
    def _coerce_type(cls, v: object) -> str:
        return _normalize_pest_type(v)

    @field_validator("confidence", mode="before")
    @classmethod
    def _coerce_confidence(cls, v: object) -> float:
        return _clamp01(v)


class _ValidatedClassification(BaseModel):
    """Tolerant schema for the VLM's JSON reply. Coerces invalid values."""

    pest_type: str
    confidence: float
    reasoning: str = ""
    alternatives: list[_ValidatedAlternative] = Field(default_factory=list)

    @field_validator("pest_type", mode="before")
    @classmethod
    def _coerce_type(cls, v: object) -> str:
        return _normalize_pest_type(v)

    @field_validator("confidence", mode="before")
    @classmethod
    def _coerce_confidence(cls, v: object) -> float:
        return _clamp01(v)

    @field_validator("reasoning", mode="before")
    @classmethod
    def _coerce_reasoning(cls, v: object) -> str:
        return str(v or "").strip()

    @field_validator("alternatives", mode="before")
    @classmethod
    def _coerce_alternatives(cls, v: object) -> list[object]:
        if not isinstance(v, list):
            return []
        return [item for item in v if isinstance(item, dict)][:5]


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

    model_name = settings.openrouter_model

    if sha256 is not None:
        cached = _cache.get(sha256)
        if cached is not None:
            if cached.expires_at > time.monotonic():
                logger.debug("Cache hit for %s", sha256[:12])
                return cached.result
            del _cache[sha256]

    if not settings.openrouter_api_key:
        logger.warning("OpenRouter API key not configured — returning fallback")
        return _fallback(model_name)

    success = False
    try:
        client = _get_client(
            settings.openrouter_api_key,
            settings.openrouter_base_url,
        )

        b64_image = base64.standard_b64encode(image_bytes).decode("ascii")
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
                            "text": "Analise esta imagem da folha e identifique a praga ou doença.",
                        },
                    ],
                },
            ],
            response_format={"type": "json_object"},
            max_tokens=settings.classify_max_tokens,
            timeout=settings.classify_timeout_s,
        )

        raw_content = response.choices[0].message.content or ""
        validated = _ValidatedClassification.model_validate(_extract_json(raw_content))

        reasoning = validated.reasoning or "Sem justificativa fornecida pelo modelo."
        alternatives: list[dict[str, str | float]] = [
            {"type": alt.type, "confidence": alt.confidence}
            for alt in validated.alternatives
            if alt.type != "nao_identificado" or alt.confidence > 0.0
        ]

        result = ClassificationResult(
            pest_type=validated.pest_type,
            confidence=round(validated.confidence, 4),
            reasoning=reasoning,
            alternatives=alternatives,
            model=model_name,
        )
        success = True

    except ValidationError:
        logger.exception("VLM response failed Pydantic validation — returning fallback")
        result = _fallback(model_name)
    except Exception:
        logger.exception("VLM classification failed — returning fallback")
        result = _fallback(model_name)

    if success and sha256 is not None:
        _cache[sha256] = _CacheEntry(
            result=result,
            expires_at=time.monotonic() + settings.cache_ttl_s,
        )

    return result


def _sniff_mime(data: bytes) -> str:
    """Basic MIME type detection from file header bytes."""
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if data[:2] == b"\xff\xd8":
        return "image/jpeg"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    if data[:2] == b"BM":
        return "image/bmp"
    return "image/jpeg"  # default assumption