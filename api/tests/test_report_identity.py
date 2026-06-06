"""Tests para identidad del consultor en informes PDF."""

from types import SimpleNamespace

from app.core.config import Settings
from app.services.report_identity import resolve_report_identity


def _settings(**overrides):
    base = {
        "database_url": "postgresql+asyncpg://x:x@localhost/x",
        "redis_url": "redis://localhost/0",
        "email_from": "outreach@yoquelvis.dev",
        "email_from_name": "Orion Outreach",
        "sender_profile_website": "https://yoquelvis.dev",
        "agency_owner_name": "",
        "agency_website": "",
        "agency_name": "",
        "agency_owner_title": "Desarrollo web y optimización",
    }
    base.update(overrides)
    return Settings.model_construct(**base)


def test_identity_from_email_when_no_profile():
    consultant, brand = resolve_report_identity(None, _settings())
    assert consultant["name"] == "Yoquelvis"
    assert consultant["email"] == "outreach@yoquelvis.dev"
    assert consultant["website"] == "https://yoquelvis.dev"
    assert "orion.dev" not in consultant["website"]
    assert brand["email"] == "outreach@yoquelvis.dev"


def test_identity_derives_name_from_email_without_agency_owner():
    consultant, _ = resolve_report_identity(
        None,
        _settings(
            agency_owner_name="",
            email_from="contacto@miagencia.com.do",
            sender_profile_website="",
        ),
    )
    assert consultant["name"] == "Contacto"
    assert consultant["website"] == "https://miagencia.com.do"


def test_identity_ignores_placeholder_sender_name():
    sender = SimpleNamespace(
        name="Tu consultor",
        title="Consultor de rendimiento web",
        company="Orion",
        website="https://orion.dev",
        bio=None,
        services=[],
    )
    consultant, _ = resolve_report_identity(
        sender,
        _settings(agency_owner_name="Yoquelvis", agency_website="https://yoquelvis.dev"),
    )
    assert consultant["name"] == "Yoquelvis"
    assert consultant["website"] == "https://yoquelvis.dev"
    assert consultant["email"] == "outreach@yoquelvis.dev"
