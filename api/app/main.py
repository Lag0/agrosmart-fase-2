"""AgroSmart Phase 3 — FastAPI application factory."""

from __future__ import annotations

import logging
import logging.config
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import analysis as analysis_router
from app.api.routes import classify as classify_router
from app.api.routes import health as health_router
from app.config import get_settings
from app.core.logging import configure_logging


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Application lifespan: startup tasks before yield, shutdown after."""
    settings = get_settings()

    # Ensure upload directories exist at startup
    for subdir in ("original", "annotated"):
        Path(settings.uploads_dir, subdir).mkdir(parents=True, exist_ok=True)

    logger = logging.getLogger("agrosmart")
    logger.info(
        "agrosmart api started",
        extra={"version": settings.api_version, "uploads_dir": settings.uploads_dir},
    )

    yield

    logger.info("agrosmart api shutting down")


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    configure_logging()
    settings = get_settings()

    app = FastAPI(
        title="AgroSmart Analysis API",
        version=settings.api_version,
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=False,
        allow_methods=["POST", "GET"],
        allow_headers=["X-Request-Id", "Content-Type"],
    )

    app.include_router(health_router.router)
    app.include_router(analysis_router.router)
    app.include_router(classify_router.router)

    return app


app = create_app()
