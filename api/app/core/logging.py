"""Structured JSON logging setup — replaces logging_config.yaml."""

from __future__ import annotations

import logging
import logging.config


def configure_logging() -> None:
    """Configure structured JSON logging for the application.

    Must be called once at application startup, before any loggers are used.
    """
    logging.config.dictConfig(
        {
            "version": 1,
            "disable_existing_loggers": False,
            "handlers": {
                "console": {
                    "class": "logging.StreamHandler",
                    "formatter": "json",
                    "stream": "ext://sys.stdout",
                }
            },
            "formatters": {
                "json": {
                    "class": "pythonjsonlogger.json.JsonFormatter",
                    "format": "%(asctime)s %(levelname)s %(name)s %(message)s",
                    "datefmt": "%Y-%m-%dT%H:%M:%S.%fZ",
                }
            },
            "loggers": {
                "uvicorn.access": {
                    "level": "INFO",
                    "handlers": ["console"],
                    "propagate": False,
                },
                "uvicorn.error": {
                    "level": "INFO",
                    "handlers": ["console"],
                    "propagate": False,
                },
                "agrosmart": {
                    "level": "INFO",
                    "handlers": ["console"],
                    "propagate": False,
                },
            },
            "root": {"level": "WARNING", "handlers": ["console"]},
        }
    )
