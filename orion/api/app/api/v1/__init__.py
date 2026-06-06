"""Routers v1."""

from fastapi import APIRouter

from app.api.v1 import (
    audits,
    automation,
    follow_ups,
    leads,
    monitor,
    outreach,
    reports,
    sales_intelligence,
    scout,
    sender_profile,
    sniper,
)
from poseidon_api.routes import router as poseidon_router

router = APIRouter(prefix="/v1")
router.include_router(leads.router)
router.include_router(audits.router)
router.include_router(sales_intelligence.router)
router.include_router(sender_profile.router)
router.include_router(outreach.router)
router.include_router(reports.router)
router.include_router(follow_ups.router)
router.include_router(sniper.router)
router.include_router(poseidon_router)
router.include_router(scout.router)
router.include_router(monitor.router)
router.include_router(automation.router)
