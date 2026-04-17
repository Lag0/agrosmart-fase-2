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
# Accepted pest types
# ---------------------------------------------------------------------------
VALID_PEST_TYPES: frozenset[str] = frozenset(
    {"nao_identificado", "ferrugem", "mancha_parda", "oidio", "lagarta", "outro"}
)

# ---------------------------------------------------------------------------
# System prompt (Portuguese — agronomist role)
# ---------------------------------------------------------------------------
SYSTEM_PROMPT = """\
Você é um agrônomo especialista em fitopatologia, com experiência em diagnóstico de doenças e pragas em diversas culturas (grãos, frutíferas, hortaliças, café, ornamentais e forrageiras).

Analise a imagem da planta com atenção aos seguintes critérios:

GUIA DE IDENTIFICAÇÃO:

- FERRUGEM (ordem Pucciniales; ex.: Phakopsora pachyrhizi na soja, Hemileia vastatrix no café, Puccinia spp. em trigo/milho/feijão, Uromyces spp. em ornamentais): pústulas pontuais, ELEVADAS e pulverulentas, de cor alaranjada, amarela, parda ou enegrecida, concentradas na face INFERIOR da folha. Pode haver clorose amarelada correspondente na face superior. As pústulas liberam pó (urediósporos) quando tocadas.
- MANCHA PARDA / MANCHA FOLIAR (fungos foliares como Septoria glycines, Cercospora, Alternaria, Phyllosticta, Mycosphaerella): lesões PLANAS, irregulares ou arredondadas, de coloração castanho-escura, parda ou cinzenta, frequentemente com halo amarelado (clorose ao redor). Podem apresentar pontuações escuras internas (picnídios), anéis concêntricos (típico de Alternaria) ou bordas bem definidas. Tecido seco e necrótico, sem relevo.
- OÍDIO (Erysiphales; ex.: Microsphaera diffusa na soja, Erysiphe, Podosphaera): recobrimento branco-acinzentado pulverulento na SUPERFÍCIE da folha, com aparência de farinha ou talco, removível ao toque. Comum em roseira, videira, cucurbitáceas, morango e diversas ornamentais.
- LAGARTA / MASTIGADOR: larvas visíveis, folhas com bordas irregulares mastigadas, buracos no limbo, raspagem do mesofilo (esqueletização), fezes escuras ou teias.
- OUTRO: sinal ou sintoma presente que não se enquadra nas categorias acima (ex.: deficiência nutricional, estresse hídrico, queimadura solar, vírus, bacteriose, míldio, dano por ácaro).

INSTRUÇÕES DE ANÁLISE:

1. Avalie PRIMEIRO a textura e o relevo da lesão:
   - Pontuações elevadas e pulverulentas: ferrugem.
   - Lesões planas, secas e necróticas: mancha foliar.
   - Pó branco superficial removível: oídio.
   - Tecido removido fisicamente: mastigador (lagarta, gafanhoto, besouro).

2. Avalie a distribuição: pústulas dispersas (ferrugem) vs. manchas coalescentes com halo (mancha foliar) vs. cobertura difusa (oídio) vs. dano localizado em bordas/ápice.

3. Imagens de ferrugem frequentemente exibem clorose na face superior que LEMBRA mancha parda; o diagnóstico correto depende da presença das pústulas características, geralmente na face inferior.

4. Quando possível, identifique o hospedeiro (soja, café, trigo, tomate, roseira, videira, etc.) para refinar o diagnóstico, já que cada patógeno tem hospedeiros preferenciais.

5. Se a folha parecer saudável, os sinais forem ambíguos, ou a qualidade da imagem impedir análise confiável, retorne "nao_identificado" com confidence baixa.

Responda EXCLUSIVAMENTE com um objeto JSON, sem texto adicional e sem markdown ao redor do JSON. O objeto deve conter exatamente estes campos:

{
  "pest_type": "<um de: nao_identificado | ferrugem | mancha_parda | oidio | lagarta | outro>",
  "confidence": <float de 0.0 a 1.0>,
  "reasoning": "<explicação curta em português, citando textura, cor, distribuição, localização na folha e hospedeiro quando identificável>",
  "alternatives": [
    {"type": "<nome_da_alternativa>", "confidence": <float>}
  ]
}

Regras:
- Se não for possível identificar com segurança, retorne "nao_identificado" com confidence próximo de 0.0.
- As alternativas devem listar outras possibilidades plausíveis, em ordem decrescente de confiança.
- Preencha reasoning com a justificativa da escolha, citando explicitamente os sinais visuais observados.
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
