"""Logging estructurado JSON unificado para todos los servicios Python."""

from __future__ import annotations

import logging
import sys

from pythonjsonlogger import jsonlogger


def configure_logging(service_name: str, level: str = "INFO") -> logging.Logger:
    """Configura un logger JSON listo para ELK/Datadog/Loki.

    Idempotente: si el root ya tiene handlers JSON, no los duplica.
    """

    root = logging.getLogger()
    root.setLevel(level.upper())

    already_configured = any(
        isinstance(getattr(h, "formatter", None), jsonlogger.JsonFormatter)
        for h in root.handlers
    )

    if not already_configured:
        handler = logging.StreamHandler(sys.stdout)
        formatter = jsonlogger.JsonFormatter(
            fmt="%(asctime)s %(levelname)s %(name)s %(message)s",
            rename_fields={"asctime": "ts", "levelname": "level", "name": "logger"},
        )
        handler.setFormatter(formatter)
        root.handlers = [handler]

    logger = logging.getLogger(service_name)
    return logger
