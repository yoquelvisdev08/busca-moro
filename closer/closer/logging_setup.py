"""Logging JSON estructurado."""

from __future__ import annotations

import logging
import sys

from pythonjsonlogger import jsonlogger


def configure_logging(service: str, level: str = "INFO") -> logging.Logger:
    root = logging.getLogger()
    root.setLevel(level.upper())
    if not any(isinstance(getattr(h, "formatter", None), jsonlogger.JsonFormatter) for h in root.handlers):
        handler = logging.StreamHandler(sys.stdout)
        formatter = jsonlogger.JsonFormatter(
            fmt="%(asctime)s %(levelname)s %(name)s %(message)s",
            rename_fields={"asctime": "ts", "levelname": "level", "name": "logger"},
        )
        handler.setFormatter(formatter)
        root.handlers = [handler]
    return logging.getLogger(service)
