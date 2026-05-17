"""Service layer para SenderProfile."""

from __future__ import annotations

import logging
import re
from datetime import datetime, timezone
from typing import Optional

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.sender_profile import SenderProfile
from app.schemas.sender_profile import SenderProfileCreate, SenderProfileUpdate

logger = logging.getLogger(__name__)

DEFAULT_WEBSITE = "https://yoquelvis.dev"


class SenderProfileService:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def get_active(self) -> Optional[SenderProfile]:
        """Return the most recently updated active sender profile."""
        result = await self._session.execute(
            select(SenderProfile)
            .where(SenderProfile.is_active == True)  # noqa: E712
            .order_by(SenderProfile.updated_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def get_by_id(self, profile_id: str) -> Optional[SenderProfile]:
        from uuid import UUID
        result = await self._session.execute(
            select(SenderProfile).where(SenderProfile.id == UUID(profile_id))
        )
        return result.scalar_one_or_none()

    async def create(self, payload: SenderProfileCreate) -> SenderProfile:
        # Deactivate any existing active profile
        await self._deactivate_existing()

        profile = SenderProfile(
            name=payload.name,
            title=payload.title,
            company=payload.company,
            website=payload.website,
            bio=payload.bio,
            services=payload.services or [],
            tech_stack=payload.tech_stack or [],
            tone=payload.tone,
            email_signature=payload.email_signature,
            is_active=True,
        )
        self._session.add(profile)
        await self._session.commit()
        await self._session.refresh(profile)
        return profile

    async def update(self, profile_id: str, payload: SenderProfileUpdate) -> Optional[SenderProfile]:
        profile = await self.get_by_id(profile_id)
        if profile is None:
            return None

        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(profile, field, value)

        await self._session.commit()
        await self._session.refresh(profile)
        return profile

    async def scrape_and_upsert(self, website: str = DEFAULT_WEBSITE) -> SenderProfile:
        """Scrape the given website and create/update the sender profile."""
        scraped = await self._scrape_website(website)

        # Deactivate existing
        await self._deactivate_existing()

        profile = SenderProfile(
            name=scraped.get("name", "Yoquelvis"),
            title=scraped.get("title", "Desarrollador Web Full-Stack"),
            company=scraped.get("company"),
            website=website,
            bio=scraped.get("bio", ""),
            services=scraped.get("services", []),
            tech_stack=scraped.get("tech_stack", []),
            tone="consultivo",
            email_signature=scraped.get("email_signature", ""),
            is_active=True,
            scraped_at=datetime.now(tz=timezone.utc),
        )
        self._session.add(profile)
        await self._session.commit()
        await self._session.refresh(profile)
        return profile

    async def _deactivate_existing(self) -> None:
        result = await self._session.execute(
            select(SenderProfile).where(SenderProfile.is_active == True)  # noqa: E712
        )
        existing = result.scalars().all()
        for profile in existing:
            profile.is_active = False
        if existing:
            await self._session.flush()

    async def _scrape_website(self, website: str) -> dict:
        """Lightweight scrape of a personal portfolio site using httpx + regex.

        Falls back to sensible defaults if the site is unreachable.
        """
        try:
            async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
                response = await client.get(website)
                response.raise_for_status()
                html = response.text
        except Exception as exc:
            logger.warning("scrape_failed", extra={"website": website, "error": str(exc)})
            return self._fallback_defaults()

        text = re.sub(r"<script[^>]*>.*?</script>", "", html, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r"<style[^>]*>.*?</style>", "", text, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r"<[^>]+>", " ", text)
        text = re.sub(r"\s+", " ", text).strip()

        name = self._extract_name(text, html) or "Yoquelvis"
        title = self._extract_title(text, html) or "Desarrollador Web Full-Stack"
        company = self._extract_company(text) or "Freelance"
        bio = self._extract_bio(text) or ""
        services = self._extract_services(text, html)
        tech_stack = self._extract_tech_stack(text, html)
        email_signature = self._build_signature(name, title, website)

        return {
            "name": name,
            "title": title,
            "company": company,
            "bio": bio,
            "services": services,
            "tech_stack": tech_stack,
            "email_signature": email_signature,
        }

    def _fallback_defaults(self) -> dict:
        return {
            "name": "Yoquelvis",
            "title": "Desarrollador Web Full-Stack",
            "company": "Freelance",
            "bio": (
                "Soy Yoquelvis, desarrollador web full-stack especializado en "
                "crear sitios rápidos, modernos y optimizados para conversiones. "
                "Ayudo a PYMES a mejorar su presencia digital con tecnologías de vanguardia."
            ),
            "services": [
                "Desarrollo Web",
                "Optimización de Performance",
                "SEO Técnico",
                "Diseño Responsive",
                "Auditorías Web",
            ],
            "tech_stack": [
                "React", "TypeScript", "Node.js", "Python",
                "FastAPI", "PostgreSQL", "Docker", "AWS",
            ],
            "email_signature": (
                "--\n"
                "Yoquelvis | Desarrollador Web Full-Stack\n"
                "yoquelvis.dev"
            ),
        }

    def _extract_name(self, text: str, html: str) -> Optional[str]:
        # Try common patterns: og:site_name, title tag, h1
        m = re.search(r'<title>([^<]*?)</title>', html, re.IGNORECASE)
        if m:
            title = m.group(1).strip()
            # Often "Name - Title" or "Name | Company"
            for sep in (" - ", " | ", " — ", " \u2013 ", " \u2014 ", " \u2022 "):
                if sep in title:
                    return title.split(sep)[0].strip()
            return title
        m = re.search(r'<h1[^>]*>(.*?)</h1>', html, re.IGNORECASE | re.DOTALL)
        if m:
            return re.sub(r"<[^>]+>", "", m.group(1)).strip()
        return None

    def _extract_title(self, text: str, html: str) -> Optional[str]:
        m = re.search(r'name="description" content="([^"]*)"', html, re.IGNORECASE)
        if m:
            desc = m.group(1).strip()
            # Use first sentence as title hint
            sentences = desc.split(".")
            if sentences:
                return sentences[0].strip()[:100]
        # Try h2 or role text
        m = re.search(r'(?i)(?:software engineer|developer|desarrollador|full[-\s]?stack|freelance|consultor)', text)
        if m:
            start = max(0, m.start() - 30)
            end = min(len(text), m.end() + 30)
            snippet = text[start:end]
            return snippet.strip()[:100]
        return None

    def _extract_company(self, text: str) -> Optional[str]:
        return "Freelance"

    def _extract_bio(self, text: str) -> Optional[str]:
        # Look for a paragraph with "soy" or first substantial paragraph
        m = re.search(r'(?i)(soy\s+[^.]{10,200}\.)', text)
        if m:
            return m.group(1).strip()[:500]
        # First paragraph > 50 chars
        paragraphs = [p.strip() for p in text.split("\n") if len(p.strip()) > 50]
        if paragraphs:
            return paragraphs[0][:500]
        return None

    def _extract_services(self, text: str, html: str) -> list[str]:
        candidates = [
            "Desarrollo Web", "Web Development",
            "Diseño Web", "Web Design",
            "SEO", "SEO Técnico", "Technical SEO",
            "Optimización de Performance", "Performance Optimization",
            "E-commerce", "Tiendas Online",
            "Consultoría Web", "Web Consulting",
            "Auditorías Web", "Web Audits",
            "Mantenimiento Web", "Web Maintenance",
            "Responsive Design", "Diseño Responsive",
            "API Development", "Desarrollo de APIs",
            "Automatización", "Automation",
        ]
        found = []
        text_lower = text.lower()
        for svc in candidates:
            if svc.lower() in text_lower:
                found.append(svc)
        # Deduplicate Spanish/English pairs, prefer Spanish
        spanish_map = {
            "Web Development": "Desarrollo Web",
            "Web Design": "Diseño Web",
            "Technical SEO": "SEO Técnico",
            "Performance Optimization": "Optimización de Performance",
            "Web Consulting": "Consultoría Web",
            "Web Audits": "Auditorías Web",
            "Web Maintenance": "Mantenimiento Web",
            "API Development": "Desarrollo de APIs",
            "Automation": "Automatización",
        }
        cleaned = []
        seen = set()
        for svc in found:
            if svc in spanish_map:
                # Skip English if Spanish equivalent exists
                continue
            if svc not in seen:
                seen.add(svc)
                cleaned.append(svc)
        return cleaned[:10]

    def _extract_tech_stack(self, text: str, html: str) -> list[str]:
        tech_keywords = [
            "React", "Vue", "Angular", "Svelte", "Next.js", "Nuxt",
            "TypeScript", "JavaScript", "Python", "Go", "Rust", "PHP",
            "Node.js", "Django", "Flask", "FastAPI", "Laravel",
            "PostgreSQL", "MySQL", "MongoDB", "Redis", "Prisma",
            "Docker", "Kubernetes", "AWS", "GCP", "Azure", "Vercel",
            "Tailwind CSS", "Bootstrap", "Sass", "CSS",
            "Git", "GitHub", "GitLab", "CI/CD",
            "GraphQL", "REST", "WebSockets",
            "Playwright", "Selenium", "Cypress",
            "Figma", "Adobe XD", "Sketch",
        ]
        found = []
        text_lower = text.lower()
        for tech in tech_keywords:
            if tech.lower() in text_lower:
                found.append(tech)
        return list(dict.fromkeys(found))[:15]

    def _build_signature(self, name: str, title: str, website: str) -> str:
        lines = [f"--", f"{name}"]
        if title:
            lines.append(f"{title}")
        lines.append(website)
        return "\n".join(lines)
