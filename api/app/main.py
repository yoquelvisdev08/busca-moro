"""SIPHON-X :: punto de entrada de la API orquestadora."""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse

from app import __version__
from app.api.v1 import router as v1_router
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.core.redis_client import close_redis, get_redis


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    logger = configure_logging(settings.service_name)
    logger.info("starting", extra={"version": __version__})

    redis = get_redis()
    try:
        await redis.ping()
        logger.info("redis_connected")
    except Exception as exc:  # noqa: BLE001
        logger.warning("redis_unreachable", extra={"error": str(exc)})

    yield

    await close_redis()
    logger.info("stopped")


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="SIPHON-X API",
        version=__version__,
        default_response_class=ORJSONResponse,
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.api_cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health", tags=["meta"])
    async def health() -> dict[str, str]:
        return {"status": "ok", "service": settings.service_name, "version": __version__}

    @app.get("/", tags=["meta"])
    async def root() -> dict[str, str]:
        return {"name": "SIPHON-X", "docs": "/docs", "version": __version__}

    app.include_router(v1_router)
    return app


app = create_app()
