"""AgroSmart Phase 3 — FastAPI analysis service."""

import logging
import logging.config
import sys
import uuid

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pythonjsonlogger import jsonlogger

API_VERSION = "1.0.0"

# ---------------------------------------------------------------------------
# Structured JSON logging
# ---------------------------------------------------------------------------
_log_handler = logging.StreamHandler(sys.stdout)
_log_handler.setFormatter(
    jsonlogger.JsonFormatter(
        "%(asctime)s %(levelname)s %(name)s %(message)s",
        rename_fields={"asctime": "ts", "levelname": "level", "name": "logger"},
        datefmt="%Y-%m-%dT%H:%M:%S.%fZ",
    )
)
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


def _error_response(
    request_id: str,
    code: str,
    message_en: str,
    message_pt: str,
    status: int,
) -> JSONResponse:
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


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@app.get("/health")
async def health():
    return {"ok": True, "version": API_VERSION}


@app.post("/analyze")
async def analyze(request: Request):
    request_id = _get_request_id(request)
    logger.info("analyze request received", extra={"request_id": request_id})
    return JSONResponse(
        status_code=501,
        content={
            "request_id": request_id,
            "error": {
                "code": "NOT_IMPLEMENTED",
                "message": "Analysis endpoint not yet implemented.",
                "message_pt": "Endpoint de analise ainda nao implementado.",
            },
        },
    )
