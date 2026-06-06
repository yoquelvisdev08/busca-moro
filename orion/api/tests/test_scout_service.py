"""Tests for Scout dork prompt generation."""
from app.services.scout_service import (
    build_dork_prompts,
    language_for_location,
)


def test_language_for_location_defaults_spanish():
    assert language_for_location("") == "es"
    assert language_for_location("México") == "es"
    assert language_for_location("Estados Unidos") == "en"
    assert language_for_location("Brasil") == "pt"


def test_build_dork_prompts_includes_icp_and_country():
    system, user = build_dork_prompts(
        "Clínicas dentales",
        "España",
        15,
        "es",
    )
    assert "Clínicas dentales" in system
    assert "España" in system
    assert "presupuesto" in system.lower() or "pagar" in system.lower()
    assert "15" in system
    assert "España" in user
    assert "800" in user or "8000" in user
