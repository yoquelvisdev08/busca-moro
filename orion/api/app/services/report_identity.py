"""Resuelve la identidad del consultor para informes PDF y narrativa."""

from __future__ import annotations

import os
from typing import Any, Optional

from app.core.config import Settings

_GENERIC_FROM_NAMES = frozenset({"orion outreach", "orion", "outreach", ""})
_GENERIC_CONSULTANT_NAMES = frozenset({"tu consultor", "consultor", "orion outreach", "orion"})
_GENERIC_EMAIL_LOCALS = frozenset({"outreach", "hello", "info", "contact", "hola", "mail", "noreply"})
_PLACEHOLDER_SITES = frozenset({"https://orion.dev", "http://orion.dev", "orion.dev"})


def _name_from_email(email: str) -> str:
    if not email or "@" not in email:
        return "Consultor"
    local, domain = email.lower().split("@", 1)
    local = local.split("+")[0]
    if local in _GENERIC_EMAIL_LOCALS:
        brand = domain.split(".")[0]
        return brand.replace("-", " ").title()
    return local.replace(".", " ").replace("_", " ").title()


def _website_from_email(email: str) -> str:
    if not email or "@" not in email:
        return ""
    domain = email.split("@", 1)[1].strip()
    if not domain:
        return ""
    return f"https://{domain}"


def _clean_site(url: str) -> str:
    value = (url or "").strip()
    if not value:
        return ""
    if value.rstrip("/").lower() in _PLACEHOLDER_SITES:
        return ""
    return value


def resolve_report_identity(
    sender: Any,
    settings: Settings,
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Perfil del consultor + marca para pie de informe PDF."""
    email = (settings.email_from or "").strip()

    owner_name = os.environ.get("AGENCY_OWNER_NAME", "").strip() or settings.agency_owner_name.strip()
    sender_name = (getattr(sender, "name", None) or "").strip()
    if sender is not None and sender_name and sender_name.lower() not in _GENERIC_CONSULTANT_NAMES:
        consultant_name = sender_name
    elif owner_name:
        consultant_name = owner_name
    elif settings.email_from_name.strip().lower() not in _GENERIC_FROM_NAMES:
        consultant_name = settings.email_from_name.strip()
    else:
        consultant_name = _name_from_email(email)

    owner_title = os.environ.get("AGENCY_OWNER_TITLE", "").strip() or settings.agency_owner_title.strip()
    if sender is not None and getattr(sender, "title", None) and sender.title.strip():
        consultant_title = sender.title.strip()
    elif owner_title:
        consultant_title = owner_title
    else:
        consultant_title = "Desarrollo web y optimización"

    agency_name = os.environ.get("AGENCY_NAME", "").strip() or settings.agency_name.strip()
    if sender is not None and getattr(sender, "company", None) and sender.company.strip():
        consultant_company = sender.company.strip()
    elif agency_name:
        consultant_company = agency_name
    else:
        consultant_company = consultant_name

    agency_site = os.environ.get("AGENCY_WEBSITE", "").strip() or settings.agency_website.strip()
    sender_site = _clean_site(getattr(sender, "website", "") if sender else "")
    settings_site = _clean_site(settings.sender_profile_website)
    consultant_website = (
        sender_site
        or _clean_site(agency_site)
        or settings_site
        or _website_from_email(email)
    )

    consultant_bio = getattr(sender, "bio", None) if sender else None
    consultant_services = list(getattr(sender, "services", None) or []) if sender else []

    consultant = {
        "name": consultant_name,
        "title": consultant_title,
        "company": consultant_company,
        "website": consultant_website,
        "email": email,
        "bio": consultant_bio,
        "services": consultant_services,
        "byline": _format_byline(consultant_name, consultant_title, email, consultant_website),
        "contact_line": _format_contact_line(email, consultant_website),
    }
    brand = {
        "name": consultant_company,
        "website": consultant_website,
        "email": email,
        "tagline": "Optimización web y crecimiento digital",
        "primary_color": os.environ.get("AGENCY_PRIMARY_COLOR", "#6366f1"),
        "accent_color": os.environ.get("AGENCY_ACCENT_COLOR", "#a5b4fc"),
    }
    return consultant, brand


def _format_byline(name: str, title: str, email: str, website: str) -> str:
    parts = [name]
    if title:
        parts.append(title)
    if email:
        parts.append(email)
    elif website:
        parts.append(website)
    return " · ".join(parts)


def _format_contact_line(email: str, website: str) -> str:
    if email and website:
        return f"{email} · {website}"
    return email or website or ""
