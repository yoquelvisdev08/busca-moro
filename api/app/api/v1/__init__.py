"""Routers v1."""

from fastapi import APIRouter

from app.api.v1 import audits, leads, monitor, sales_intelligence, sniper

router = APIRouter(prefix="/v1")
router.include_router(leads.router)
router.include_router(audits.router)
router.include_router(sales_intelligence.router)
router.include_router(sniper.router)
router.include_router(monitor.router)
